import { createServer } from 'node:http';
import next from 'next';
import { attachReadingStream } from './server/reading-stream.mjs';

const dev = process.env.NODE_ENV !== 'production';
const port = Number(process.env.PORT || 3000);
const app = next({ dev, hostname: '0.0.0.0', port });
await app.prepare();
const handle = app.getRequestHandler();
const upgrade = app.getUpgradeHandler();
const server = createServer((req, res) => handle(req, res));
attachReadingStream(server, upgrade);
server.listen(port, '0.0.0.0', () => console.log(`myAeon ready on port ${port}`));
