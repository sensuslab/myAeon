import WebSocket from 'ws';
import { agentSettings, runFunction } from '../server/agent-context.mjs';
const context = { viewedDate: new Date().toISOString().slice(0, 10) };
const socket = new WebSocket('wss://agent.deepgram.com/v1/agent/converse', { headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}` } });
const started = Date.now(); let applied = false; let text = false; let bytes = 0; let finished = false; let calls = 0;
const deadline = setTimeout(() => { console.error('Voice smoke test timed out'); socket.terminate(); process.exitCode = 1; }, 45000);
socket.on('open', () => { const settings = agentSettings(context); delete settings.agent.greeting; if (process.env.AGENT_TEST_DEFAULT_REASONING) delete settings.agent.think.provider.reasoning_mode; if (process.env.AGENT_TEST_NO_TOOLS) delete settings.agent.think.functions; socket.send(JSON.stringify(settings)); });
socket.on('message', (data, binary) => {
  if (binary) { bytes += data.length; if (text && !finished) { finished = true; console.log(JSON.stringify({ settingsApplied: applied, responseText: text, audioBytes: bytes, functionCalls: calls, elapsedMs: Date.now() - started })); socket.close(); } return; }
  const msg = JSON.parse(data);
  if (msg.type === 'SettingsApplied') { applied = true; socket.send(JSON.stringify({ type: 'InjectUserMessage', content: 'Use get_sky to tell me which sign the Moon is in right now, in one sentence.' })); }
  if (msg.type === 'FunctionCallRequest') for (const call of msg.functions) { calls++; socket.send(JSON.stringify({ type: 'FunctionCallResponse', id: call.id, name: call.name, content: JSON.stringify(runFunction(call.name, call.arguments, context)) })); }
  if (msg.type === 'ConversationText' && msg.role === 'assistant') { text = true; console.log('Agent response:', msg.content); }
  if (msg.type === 'Error') { console.error('Provider error:', msg.code, msg.description); process.exitCode = 1; socket.close(); }
  if (msg.type === 'Warning') console.error('Provider warning:', msg.code, msg.description);
});
socket.on('error', err => { console.error('Voice connection failed:', err.message); process.exitCode = 1; });
socket.on('close', () => { clearTimeout(deadline); if (!applied || !text || !bytes) process.exitCode = 1; });
