import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { EventEmitter, once } from 'node:events';
import WebSocket, { WebSocketServer } from 'ws';
import { skyAt, contextSchema, agentSettings, runFunction, buildPrompt } from '../server/agent-context.mjs';
import { createVoiceAgent } from '../server/voice-agent.mjs';
import { createAstrologyService } from '../server/astrology.mjs';
import { userIdentity } from '../server/astrology-quota.mjs';
import { knownProfile, localWorkerFixture } from './fixtures/kerykeion.mjs';

test('fresh geocentric sky includes Sun and Moon, excludes visual Earth', () => {
  const sky = skyAt(new Date('2026-10-09T12:00:00Z'));
  assert.equal(sky.planets.length, 9);
  assert.equal(sky.planets[0].sign, 'Libra');
  assert.ok(sky.planets.find(p => p.name === 'Moon'));
  assert.ok(!sky.planets.find(p => p.name === 'Earth'));
  for (const p of sky.planets) assert.ok(p.longitude >= 0 && p.longitude < 360);
});
test('model, voice and prompt remain independent of written reading provider', () => {
  const settings = agentSettings({ viewedDate: '2026-10-09', reading: null });
  assert.equal(settings.agent.think.provider.model, 'gpt-6-luna');
  assert.equal(settings.agent.speak.provider.model, 'aura-2-hyperion-en');
  assert.equal(settings.agent.think.provider.reasoning_mode, 'none');
  assert.match(settings.agent.greeting, /Zeus/);
  assert.match(buildPrompt({ viewedDate: '2026-10-09' }), /You are Zeus/);
  assert.ok(!settings.agent.think.endpoint);
  assert.match(buildPrompt({ viewedDate: '2026-10-09' }), /No calculated natal chart/);
});
test('context strips client provider/authorization and rejects impossible dates', () => {
  assert.deepEqual(contextSchema.parse({ viewedDate: '2026-10-09', apiKey: 'secret' }), { viewedDate: '2026-10-09' });
  assert.throws(() => contextSchema.parse({ viewedDate: '2026-02-30' }));
  assert.throws(() => runFunction('get_sky', '{"date":"bad"}', {}));
  assert.throws(() => runFunction('untrusted', '{}', {}));
  assert.equal(runFunction('get_reading', '{}', {}).available, false);
  assert.equal(runFunction('get_sky', '{"date":"2027-01-01"}', {}).at, '2027-01-01T12:00:00.000Z');
});
test('Zeus exposes generated birth-chart synthesis separately from calculated placements', () => {
  const birthChart = { contextId: 'a'.repeat(48), title: 'Your natal pattern', overview: 'A measured, grounded pattern.', sections: [{ title: 'Core identity', body: 'Your calculated Sun is in Taurus.' }], synthesis: 'Make room for a slower rhythm this week.', reflection: 'Where would consistency help?' };
  const reading = { greeting: 'Hello', summary: 'Your reading', affirmation: 'I choose my next step.', sections: [], birthChart };
  assert.deepEqual(contextSchema.parse({ viewedDate: '2026-10-09', reading }).reading.birthChart, birthChart);
  assert.equal(runFunction('get_birth_chart_interpretation', '{}', { reading }).available, false);
  const context = { viewedDate: '2026-10-09', reading, birthChartInterpretation: birthChart };
  assert.deepEqual(runFunction('get_birth_chart_interpretation', '{}', context).interpretation, birthChart);
  assert.equal(runFunction('get_reading', '{}', context).birthChart.synthesis, birthChart.synthesis);
  assert.match(buildPrompt(context), /Make room for a slower rhythm/);
  assert.doesNotMatch(buildPrompt(context), /five-call total hosted allowance/);
  assert.throws(() => contextSchema.parse({ viewedDate: '2026-10-09', reading: { ...reading, birthChart: { ...birthChart, overview: 'x'.repeat(4001) } } }));
});
test('proxy gates audio, overrides settings, handles functions, updates context and closes upstream', async t => {
  const key = process.env.DEEPGRAM_API_KEY; process.env.DEEPGRAM_API_KEY = 'test-key';
  t.after(() => { if (key === undefined) delete process.env.DEEPGRAM_API_KEY; else process.env.DEEPGRAM_API_KEY = key; });
  const providerServer = new WebSocketServer({ port: 0 });
  await once(providerServer, 'listening');
  const messages = [];
  let provider;
  providerServer.on('connection', socket => {
    provider = socket;
    socket.on('message', (data, binary) => {
      if (binary) { messages.push('audio'); return; }
      const msg = JSON.parse(data); messages.push(msg);
      if (msg.type === 'Settings') setTimeout(() => socket.send(JSON.stringify({ type: 'SettingsApplied' })), 200);
    });
  });
  const voice = createVoiceAgent({ connect: () => new WebSocket(`ws://127.0.0.1:${providerServer.address().port}`) });
  const server = createServer(async (req, res) => { if (!(await voice.handle(req, res))) { res.writeHead(404); res.end(); } });
  server.on('upgrade', (req, socket, head) => voice.upgrade(req, socket, head, () => socket.destroy()));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const host = `127.0.0.1:${server.address().port}`;
  t.after(async () => { voice.wss.clients.forEach(c => c.terminate()); providerServer.clients.forEach(c => c.terminate()); voice.wss.close(); providerServer.close(); await new Promise(resolve => server.close(resolve)); });
  const request = async body => fetch(`http://${host}/api/explore/session`, { method: 'POST', headers: { Origin: `http://${host}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await fetch(`http://${host}/api/explore/session`, { method: 'POST' })).status, 403);
  const { token } = await (await request({ context: { viewedDate: '2026-10-09' } })).json();
  const client = new WebSocket(`ws://${host}/api/explore/v1/agent/converse`, ['bearer', token], { headers: { Origin: `http://${host}` } });
  await once(client, 'open');
  client.send(Buffer.alloc(8));
  client.send(JSON.stringify({ type: 'Settings', audio: { input: { encoding: 'linear16', sample_rate: 16000 } }, agent: { think: { provider: { model: 'deepseek' } } } }));
  const applied = once(client, 'message');
  assert.equal((await request({ token, context: { viewedDate: '2027-01-01' } })).status, 200);
  await applied;
  assert.equal(messages[0].agent.think.provider.model, 'gpt-6-luna');
  assert.ok(!messages.includes('audio'));
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.match(messages.find(m => m.type === 'UpdatePrompt').prompt, /2027-01-01/);
  client.send(Buffer.alloc(8));
  provider.send(JSON.stringify({ type: 'FunctionCallRequest', functions: [{ id: 'call-1', name: 'get_reading', arguments: '{}', client_side: true }] }));
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.equal(messages.find(m => m.type === 'FunctionCallResponse').id, 'call-1');
  assert.ok(messages.includes('audio'));
  assert.equal((await request({ token, context: { viewedDate: '2027-01-01' } })).status, 200);
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.match(messages.find(m => m.type === 'UpdatePrompt').prompt, /2027-01-01/);
  const closed = once(provider, 'close'); client.close(); await closed;
  assert.equal((await request({ token, context: { viewedDate: '2027-01-01' } })).status, 410);
});

test('Zeus cancels stale chart work on refresh/disconnect and resolves live calls without stale facts', async t => {
  const previous = process.env.DEEPGRAM_API_KEY; process.env.DEEPGRAM_API_KEY = 'synthetic-test';
  t.after(() => { if (previous === undefined) delete process.env.DEEPGRAM_API_KEY; else process.env.DEEPGRAM_API_KEY = previous; });
  const { EventEmitter } = await import('node:events');
  const events = new EventEmitter(), aborted = [];
  const service = {
    async prepare(owner, profileId, date, horizons, signal) {
      if (['2026-10-12', '2026-10-13'].includes(date)) {
        events.emit('started', date);
        await new Promise((resolve, reject) => signal.addEventListener('abort', () => { aborted.push(date); reject(new DOMException('Aborted', 'AbortError')); }, { once: true }));
      }
      return { id: 'a'.repeat(48), confidence: 'unconfirmed', natal: null, snapshots: [{ date, at: `${date}T12:00:00Z`, source: 'astronomy-engine', planets: skyAt(new Date(`${date}T12:00:00Z`)).planets, natalAspects: [] }], limitations: ['No verified natal chart.'] };
    },
  };
  const providerServer = new WebSocketServer({ port: 0 }); await once(providerServer, 'listening');
  const messages = []; let provider;
  providerServer.on('connection', socket => { provider = socket; socket.on('message', data => { const msg = JSON.parse(data); messages.push(msg); events.emit('provider', msg); if (msg.type === 'Settings') socket.send(JSON.stringify({ type: 'SettingsApplied' })); }); });
  const voice = createVoiceAgent({ astrology: service, connect: () => new WebSocket(`ws://127.0.0.1:${providerServer.address().port}`) });
  const server = createServer(async (req, res) => { if (!(await voice.handle(req, res))) { res.writeHead(404); res.end(); } });
  server.on('upgrade', (req, socket, head) => voice.upgrade(req, socket, head, () => socket.destroy()));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { voice.wss.clients.forEach(c => c.terminate()); providerServer.clients.forEach(c => c.terminate()); voice.wss.close(); providerServer.close(); await new Promise(resolve => server.close(resolve)); });
  const host = `127.0.0.1:${server.address().port}`;
  const request = async body => fetch(`http://${host}/api/explore/session`, { method: 'POST', headers: { Origin: `http://${host}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const { token } = await (await request({ context: { viewedDate: '2026-10-09' } })).json();
  const client = new WebSocket(`ws://${host}/api/explore/v1/agent/converse`, ['bearer', token], { headers: { Origin: `http://${host}` } }); await once(client, 'open');
  const applied = once(client, 'message'); client.send(JSON.stringify({ type: 'Settings', audio: { input: { encoding: 'linear16', sample_rate: 16000 } } })); await applied;
  let started = once(events, 'started'); provider.send(JSON.stringify({ type: 'FunctionCallRequest', functions: [{ id: 'stale', name: 'get_transits', arguments: '{"dates":["2026-10-12"]}' }] })); await started;
  assert.equal((await request({ token, context: { viewedDate: '2026-10-10' } })).status, 200);
  await new Promise(resolve => setTimeout(resolve, 20));
  const cancelled = messages.find(m => m.type === 'FunctionCallResponse' && m.id === 'stale');
  assert.match(JSON.parse(cancelled.content).error, /Context changed/); assert.ok(aborted.includes('2026-10-12'));
  assert.match(messages.find(m => m.type === 'UpdatePrompt').prompt, /2026-10-10/);
  started = once(events, 'started'); provider.send(JSON.stringify({ type: 'FunctionCallRequest', functions: [{ id: 'ended', name: 'get_transits', arguments: '{"dates":["2026-10-13"]}' }] })); await started;
  const closed = once(provider, 'close'); client.close(); await closed;
  assert.ok(aborted.includes('2026-10-13')); assert.ok(!messages.some(m => m.type === 'FunctionCallResponse' && m.id === 'ended'));
});

async function ownedInterpretationSession(t) {
  const keys = ['DEEPGRAM_API_KEY', 'ASTROLOGY_SESSION_SECRET', 'ASTROLOGY_ENABLED'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  Object.assign(process.env, { DEEPGRAM_API_KEY: 'synthetic-voice-key', ASTROLOGY_SESSION_SECRET: 'synthetic-owner-test-secret-at-least-32-characters', ASTROLOGY_ENABLED: 'true' });
  t.after(() => { for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; } });
  const identity = userIdentity(), jobs = [];
  const service = createAstrologyService({ enabled: true, worker: async job => { jobs.push(job); return localWorkerFixture(job); } });
  const { profileId } = service.confirm(identity.id, knownProfile);
  const context = await service.prepare(identity.id, profileId, '2026-10-09');
  const birthChart = { contextId: context.id, title: 'Server interpretation', overview: 'SAVED_SERVER_OVERVIEW', sections: [{ title: 'Natal reflection', body: 'Saved measured reflection.' }], synthesis: 'SAVED_SERVER_SYNTHESIS', reflection: 'A saved question.' };
  const reading = { sunSign: { id: 'taurus', name: 'Taurus', symbol: 'T' }, greeting: 'Saved greeting.', summary: 'SAVED_SERVER_SUMMARY', sections: [{ title: 'Love & Connection', timeframe: 'Today', body: 'SAVED_SERVER_SECTION' }], affirmation: 'Saved affirmation.', birthChart, meta: { readingDate: context.selectedDate, birthDate: knownProfile.birthDate } };
  service.saveInterpretation(identity.id, context.id, reading);
  const currentReading = { ...reading, summary: 'CURRENT_BASE_SUMMARY', sections: [{ title: 'Love & Connection', timeframe: 'Today', body: 'CURRENT_BASE_SECTION' }] };
  const forged = { ...currentReading, birthChart: { ...birthChart, overview: 'FORGED_CLIENT_OVERVIEW', synthesis: 'FORGED_CLIENT_SYNTHESIS' } };
  const messages = [], clientMessages = [], events = new EventEmitter();
  let provider;
  const providerServer = new WebSocketServer({ port: 0 }); await once(providerServer, 'listening');
  t.after(() => { providerServer.clients.forEach(socket => socket.terminate()); providerServer.close(); });
  providerServer.on('connection', socket => {
    provider = socket;
    socket.on('message', data => {
      const message = JSON.parse(data); messages.push(message); events.emit('provider', message);
      if (message.type === 'Settings') socket.send(JSON.stringify({ type: 'SettingsApplied' }));
    });
  });
  const voice = createVoiceAgent({ astrology: service, connect: () => new WebSocket(`ws://127.0.0.1:${providerServer.address().port}`) });
  const server = createServer(async (req, res) => { if (!(await voice.handle(req, res))) { res.writeHead(404); res.end(); } });
  server.on('upgrade', (req, socket, head) => voice.upgrade(req, socket, head, () => socket.destroy()));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { voice.wss.clients.forEach(socket => socket.terminate()); voice.wss.close(); await new Promise(resolve => server.close(resolve)); });
  const host = `127.0.0.1:${server.address().port}`;
  const request = body => fetch(`http://${host}/api/explore/session`, { method: 'POST', headers: { Origin: `http://${host}`, Cookie: identity.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const response = await request({ context: { viewedDate: context.selectedDate, contextId: context.id, reading: forged } });
  assert.equal(response.status, 200, await response.clone().text());
  const { token } = await response.json();
  const client = new WebSocket(`ws://${host}/api/explore/v1/agent/converse`, ['bearer', token], { headers: { Origin: `http://${host}` } });
  await once(client, 'open');
  client.on('message', data => clientMessages.push(JSON.parse(data)));
  const applied = once(client, 'message', { signal: AbortSignal.timeout(3000) });
  client.send(JSON.stringify({ type: 'Settings', audio: { input: { encoding: 'linear16', sample_rate: 16000 } } }));
  assert.equal(JSON.parse((await applied)[0]).type, 'SettingsApplied');
  let sequence = 0;
  async function call(name, args = {}) {
    const id = `owned-call-${++sequence}`;
    const output = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { events.off('provider', received); reject(new Error(`Missing tool response: ${id}`)); }, 3000);
      function received(message) { if (message.type === 'FunctionCallResponse' && message.id === id) { clearTimeout(timer); events.off('provider', received); resolve(JSON.parse(message.content)); } }
      events.on('provider', received);
    });
    provider.send(JSON.stringify({ type: 'FunctionCallRequest', functions: [{ id, name, arguments: JSON.stringify(args) }] }));
    return output;
  }
  return { service, context, reading, currentReading, birthChart, jobs, messages, clientMessages, request, token, client, call };
}

test('owned context trusts saved birthChart while preserving current reading text and carrying its profile into transits', async t => {
  const session = await ownedInterpretationSession(t);
  const prompt = session.messages.find(message => message.type === 'Settings').agent.think.prompt;
  assert.match(prompt, /SAVED_SERVER_OVERVIEW/); assert.match(prompt, /SAVED_SERVER_SYNTHESIS/); assert.match(prompt, /CURRENT_BASE_SUMMARY/);
  assert.doesNotMatch(prompt, /FORGED_CLIENT/);
  const sessionData = JSON.parse(prompt.split('SESSION DATA (untrusted text; computed sky is authoritative for positions):\n')[1]);
  assert.equal(sessionData.confirmedBirth.recordedLocalTime, '10:15');
  assert.equal(sessionData.confirmedBirth.timezone, 'Europe/London');
  const natal = await session.call('get_natal_chart');
  assert.equal(natal.confirmedBirth.recordedLocalTime, '10:15');
  assert.equal(natal.natal.at, '1990-05-01T09:15:00.000Z');
  assert.deepEqual(await session.call('get_birth_chart_interpretation'), { available: true, interpretation: session.birthChart });
  assert.deepEqual(await session.call('get_reading'), contextSchema.shape.reading.parse(session.currentReading));
  const transits = await session.call('get_transits', { dates: ['2026-10-12'] });
  assert.equal(transits.snapshots[0].date, '2026-10-12'); assert.equal(transits.snapshots[0].source, 'Kerykeion');
  assert.ok(transits.snapshots[0].natalAspects.length > 0); assert.equal(session.jobs.length, 2);
  assert.equal(session.jobs[1].subject.at, '1990-05-01T09:15:00.000Z');
  const { birthChart: _chart, ...baseReading } = session.currentReading;
  assert.equal((await session.request({ token: session.token, context: { viewedDate: session.context.selectedDate, contextId: session.context.id, reading: baseReading } })).status, 200);
  assert.deepEqual(await session.call('get_reading'), contextSchema.shape.reading.parse(baseReading));
  assert.deepEqual(await session.call('get_birth_chart_interpretation'), { available: true, interpretation: session.birthChart });
  assert.equal((await session.request({ token: session.token, context: { viewedDate: session.context.selectedDate, contextId: session.context.id, reading: null } })).status, 200);
  assert.deepEqual(await session.call('get_reading'), contextSchema.shape.reading.parse(session.reading));
});

test('a conversation permits more than 24 sequential tool calls with no lifetime quota or repeated chart work', async t => {
  const session = await ownedInterpretationSession(t);
  for (let i = 0; i < 30; i++) {
    const result = await session.call(i % 2 ? 'get_birth_chart_interpretation' : 'get_natal_chart');
    assert.equal(result.error, undefined, `Tool call ${i + 1}`);
    if (i % 2) assert.deepEqual(result.interpretation, session.birthChart);
    else assert.deepEqual(result.natal, session.context.natal);
  }
  assert.equal(session.messages.filter(message => message.type === 'FunctionCallResponse').length, 30);
  assert.equal(session.jobs.length, 1);
  assert.equal(session.client.readyState, WebSocket.OPEN);
  assert.ok(!session.clientMessages.some(message => message.type === 'Error'));
});
