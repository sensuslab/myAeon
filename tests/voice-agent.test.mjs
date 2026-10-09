import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import WebSocket, { WebSocketServer } from 'ws';
import { skyAt, contextSchema, agentSettings, runFunction, buildPrompt } from '../server/agent-context.mjs';
import { createVoiceAgent } from '../server/voice-agent.mjs';

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
