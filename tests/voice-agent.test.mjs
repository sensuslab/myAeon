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
      if (msg.type === 'Settings') socket.send(JSON.stringify({ type: 'SettingsApplied' }));
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
  await once(client, 'message');
  assert.equal(messages[0].agent.think.provider.model, 'gpt-6-luna');
  assert.ok(!messages.includes('audio'));
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
