import { randomBytes } from 'node:crypto';
import WebSocket, { WebSocketServer } from 'ws';
import { contextSchema, agentSettings, buildPrompt, runFunction } from './agent-context.mjs';

const sameOrigin = req => { try { return new URL(req.headers.origin).host === req.headers.host; } catch { return false; } };
export function createVoiceAgent(options = {}) {
  const tickets = new Map();
  const limits = new Map();
  const connect = options.connect || (() => new WebSocket('wss://agent.deepgram.com/v1/agent/converse', { headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY?.trim()}` }, handshakeTimeout: 15000 }));
  const wss = new WebSocketServer({ noServer: true, maxPayload: 100000, perMessageDeflate: false });
  function prune() {
    const now = Date.now();
    for (const [id, ticket] of tickets) if (!ticket.client && ticket.expires <= now) tickets.delete(id);
    for (const [id, limit] of limits) if (limit.expires <= now) limits.delete(id);
  }
  function respond(res, status, data) { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); }
  async function handle(req, res) {
    if (new URL(req.url, 'http://localhost').pathname !== '/api/explore/session') return false;
    if (req.method !== 'POST' || !sameOrigin(req)) { respond(res, 403, { error: 'Request not allowed.' }); return true; }
    if (!process.env.DEEPGRAM_API_KEY) { respond(res, 503, { error: 'Voice conversations are not configured yet.' }); return true; }
    prune();
    try {
      let bytes = 0; const chunks = [];
      for await (const chunk of req) { bytes += chunk.length; if (bytes > 100000) throw new Error('Too large'); chunks.push(chunk); }
      const body = JSON.parse(Buffer.concat(chunks).toString());
      const context = contextSchema.parse(body.context);
      if (body.token) {
        const ticket = tickets.get(body.token);
        if (!ticket?.client || ticket.host !== req.headers.host) { respond(res, 410, { error: 'Conversation ended.' }); return true; }
        ticket.context = context;
        if (!ticket.applied) ticket.dirty = true;
        if (ticket.applied && ticket.upstream?.readyState === WebSocket.OPEN) ticket.upstream.send(JSON.stringify({ type: 'UpdatePrompt', prompt: buildPrompt(context) }));
        respond(res, 200, { updated: true }); return true;
      }
      const address = req.socket.remoteAddress || 'unknown';
      const limit = limits.get(address) || { count: 0, expires: Date.now() + 60000 };
      if (++limit.count > 12 || tickets.size >= 100) { respond(res, 429, { error: 'Please wait a moment before starting another conversation.' }); return true; }
      limits.set(address, limit);
      const token = randomBytes(32).toString('hex');
      tickets.set(token, { context, host: req.headers.host, expires: Date.now() + 30000 });
      respond(res, 200, { token });
    } catch { respond(res, 400, { error: 'Could not prepare conversation context.' }); }
    return true;
  }
  function upgrade(req, socket, head, fallback) {
    if (new URL(req.url, 'http://localhost').pathname !== '/api/explore/v1/agent/converse') { fallback(req, socket, head); return; }
    prune();
    const protocols = (req.headers['sec-websocket-protocol'] || '').split(',').map(value => value.trim());
    const token = req.headers.authorization?.replace(/^Bearer /, '') || protocols.find(value => /^[a-f0-9]{64}$/.test(value));
    const ticket = tickets.get(token);
    if (!sameOrigin(req) || !ticket || ticket.client || ticket.expires <= Date.now() || ticket.host !== req.headers.host || wss.clients.size >= 4) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return;
    }
    wss.handleUpgrade(req, socket, head, client => {
      ticket.client = client;
      const upstream = ticket.upstream = connect();
      let configured = false; let cleaned = false; let messages = 0; let pendingSettings;
      const send = (data, binary = false) => { if (client.readyState === WebSocket.OPEN) client.send(data, { binary }); };
      const fail = message => { send(JSON.stringify({ type: 'Error', code: 'MYAEON_AGENT', description: message })); client.close(1000, 'Conversation ended'); };
      const timeout = setTimeout(() => fail('The voice service took too long to connect. Please try again.'), 25000);
      const lifetime = setTimeout(() => fail('This conversation has reached its 15-minute limit. Start a new conversation to continue.'), 15 * 60000);
      let lastActivity = Date.now();
      const idle = setInterval(() => { messages = 0; if (Date.now() - lastActivity > 3 * 60000) fail('Conversation paused after three minutes of inactivity.'); }, 10000);
      const cleanup = () => { if (cleaned) return; cleaned = true; clearTimeout(timeout); clearTimeout(lifetime); clearInterval(idle); tickets.delete(token); upstream.terminate(); };
      client.on('close', cleanup); client.on('error', cleanup);
      client.on('message', (data, binary) => {
        if (++messages > 1500 || data.length > 100000 || upstream.bufferedAmount > 2 * 1024 * 1024) { fail('Connection overloaded. Please reconnect.'); return; }
        if (binary) { if (ticket.applied && upstream.readyState === WebSocket.OPEN) upstream.send(data, { binary: true }); return; }
        let message; try { message = JSON.parse(data.toString()); } catch { fail('Invalid conversation request.'); return; }
        if (message.type === 'Settings' && !configured) {
          configured = true;
          const rate = message.audio?.input?.sample_rate;
          if (message.audio?.input?.encoding !== 'linear16' || ![16000, 24000, 48000].includes(rate)) { fail('Unsupported microphone audio.'); return; }
          pendingSettings = JSON.stringify(agentSettings(ticket.context, rate));
          if (upstream.readyState === WebSocket.OPEN) { upstream.send(pendingSettings); pendingSettings = null; }
          return;
        }
        if (ticket.applied && message.type === 'KeepAlive') upstream.send(JSON.stringify({ type: 'KeepAlive' }));
        if (ticket.applied && message.type === 'InjectUserMessage' && typeof message.content === 'string' && message.content.length <= 2000) { lastActivity = Date.now(); upstream.send(JSON.stringify({ type: 'InjectUserMessage', content: message.content })); }
      });
      upstream.on('open', () => { if (pendingSettings) { upstream.send(pendingSettings); pendingSettings = null; } });
      upstream.on('message', (data, binary) => {
        if (client.bufferedAmount > 2 * 1024 * 1024) { fail('Connection is too slow. Please reconnect.'); return; }
        if (binary) { send(data, true); return; }
        let message; try { message = JSON.parse(data.toString()); } catch { fail('Invalid voice service response.'); return; }
        if (message.type === 'SettingsApplied') {
          ticket.applied = true; clearTimeout(timeout);
          if (ticket.dirty) { ticket.dirty = false; upstream.send(JSON.stringify({ type: 'UpdatePrompt', prompt: buildPrompt(ticket.context) })); }
        }
        if (message.type === 'UserStartedSpeaking' || message.type === 'ConversationText') lastActivity = Date.now();
        if (message.type === 'FunctionCallRequest') {
          for (const call of (message.functions || []).slice(0, 8)) {
            let result; try { result = runFunction(call.name, call.arguments, ticket.context); } catch { result = { error: 'Invalid function arguments or unavailable data. Do not invent a result.' }; }
            upstream.send(JSON.stringify({ type: 'FunctionCallResponse', id: call.id, name: call.name, content: JSON.stringify(result) }));
          }
          return;
        }
        if (message.type === 'Error') { fail('The voice service could not complete this conversation. Please try again.'); return; }
        send(data);
      });
      upstream.on('error', () => fail('Could not connect to the voice service. Please try again.'));
      upstream.on('close', () => { if (!cleaned) fail('The voice connection ended. Start again to reconnect.'); });
    });
  }
  return { handle, upgrade, wss };
}
