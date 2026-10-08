import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import { EventEmitter, once } from 'node:events';
import WebSocket from 'ws';
import { attachReadingStream, streamChunks, validReading } from '../server/reading-stream.mjs';

function signed(script, key) {
  const expiresAt = Date.now() + 60000;
  return { script, authorization: { expiresAt, signature: createHmac('sha256', key)
    .update(`myAeon:reading-audio:v1\n${expiresAt}\n${script}`).digest('hex') } };
}

test('stream authorization rejects edited, expired and oversized readings', () => {
  const reading = signed('Your reading. '.repeat(20), 'test-key');
  assert.equal(validReading(reading, 'test-key'), true);
  assert.equal(validReading({ ...reading, script: reading.script + 'changed' }, 'test-key'), false);
  assert.equal(validReading(reading, 'test-key', Date.now() + 120000), false);
  assert.equal(validReading(signed('a'.repeat(20001), 'test-key'), 'test-key'), false);
});

test('short first speech chunk and bounded later chunks retain all text', () => {
  const text = 'Pause and consider your next step. '.repeat(180).trim();
  const chunks = streamChunks(text);
  assert.ok(chunks[0].length <= 350);
  assert.ok(chunks.every(chunk => chunk.length <= 1800));
  assert.equal(chunks.join(' '), text);
});

test('stream relays PCM as it arrives and closes upstream on completion and cancellation', async () => {
  const previous = process.env.DEEPGRAM_API_KEY;
  process.env.DEEPGRAM_API_KEY = 'test-stream-key';
  let calls = 0; let terminated = 0;
  const server = createServer();
  const wss = attachReadingStream(server, () => {}, { connect: (url, headers) => {
    calls++;
    assert.equal(headers.Authorization, 'Token test-stream-key');
    assert.equal(url.searchParams.get('encoding'), 'linear16');
    const upstream = new EventEmitter(); upstream.readyState = WebSocket.OPEN;
    upstream.terminate = () => { terminated++; };
    upstream.send = data => {
      const message = JSON.parse(data);
      if (message.type === 'Flush') setImmediate(() => {
        upstream.emit('message', Buffer.from([1, 0, 2, 0]), true);
        upstream.emit('message', Buffer.from('{"type":"Flushed"}'), false);
      });
    };
    setImmediate(() => upstream.emit('open'));
    return upstream;
  } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const host = `127.0.0.1:${server.address().port}`;
  const connect = () => new WebSocket(`ws://${host}/api/reading/audio/stream`, { origin: `http://${host}` });
  try {
    const client = connect(); const received = [];
    client.on('message', (data, binary) => received.push(binary ? 'pcm' : JSON.parse(data).type));
    await once(client, 'open'); client.send(JSON.stringify(signed('Reflect with care. '.repeat(8), process.env.DEEPGRAM_API_KEY)));
    await once(client, 'close');
    assert.deepEqual(received, ['ready', 'pcm', 'complete']);
    const invalid = connect(); await once(invalid, 'open'); invalid.send(JSON.stringify({ script: 'fake' }));
    await once(invalid, 'close'); assert.equal(calls, 1);
    const cancelled = connect(); await once(cancelled, 'open');
    cancelled.send(JSON.stringify(signed('Reflect with care. '.repeat(8), process.env.DEEPGRAM_API_KEY)));
    cancelled.close(); await once(cancelled, 'close');
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(terminated >= 1);
  } finally {
    for (const client of wss.clients) client.terminate();
    wss.close(); await new Promise(resolve => server.close(resolve));
    if (previous === undefined) delete process.env.DEEPGRAM_API_KEY; else process.env.DEEPGRAM_API_KEY = previous;
  }
});
