import { createServer } from 'node:http';
import next from 'next';
import { attachReadingStream } from './server/reading-stream.mjs';
import { createVoiceAgent } from './server/voice-agent.mjs';
import { rejectUnusedFrameworkEndpoint } from './server/http-guard.mjs';

const dev = process.env.NODE_ENV !== 'production';
const port = Number(process.env.PORT || 3000);
const app = next({ dev, hostname: '0.0.0.0', port });
await app.prepare();
const handle = app.getRequestHandler();
const upgrade = app.getUpgradeHandler();
const voice = createVoiceAgent();
const server = createServer(async (req, res) => {
  if (rejectUnusedFrameworkEndpoint(req, res)) return;
  if (!(await voice.handle(req, res))) handle(req, res);
});
attachReadingStream(server, (req, socket, head) => voice.upgrade(req, socket, head, dev ? upgrade : (_req, unknownSocket) => unknownSocket.destroy()));
server.listen(port, '0.0.0.0', () => console.log(`myAeon ready on port ${port}`));
