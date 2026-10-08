import { createHmac, timingSafeEqual } from 'node:crypto';
import WebSocket, { WebSocketServer } from 'ws';

export function validReading(request, apiKey, now = Date.now()) {
  const { script, authorization: auth } = request || {};
  if (typeof script !== 'string' || script.length < 80 || script.length > 20000
    || !Number.isSafeInteger(auth?.expiresAt) || auth.expiresAt <= now
    || auth.expiresAt > now + 86400000 || !/^[a-f0-9]{64}$/.test(auth.signature || '')) return false;
  const signature = createHmac('sha256', apiKey)
    .update(`myAeon:reading-audio:v1\n${auth.expiresAt}\n${script}`).digest('hex');
  return timingSafeEqual(Buffer.from(auth.signature, 'hex'), Buffer.from(signature, 'hex'));
}

export function streamChunks(script) {
  const sentences = [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(script)]
    .map(entry => entry.segment);
  const chunks = [];
  let current = '';
  for (const sentence of sentences) {
    for (const word of sentence.split(/(\s+)/)) {
      const limit = chunks.length === 0 ? 350 : 1800;
      if (current.length + word.length > limit && current) { chunks.push(current.trim()); current = ''; }
      // Bound unusually long words without cutting a Unicode code point.
      for (const char of word) {
        if (current.length + char.length > (chunks.length === 0 ? 350 : 1800)) {
          chunks.push(current.trim()); current = '';
        }
        current += char;
      }
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(Boolean);
}

export function attachReadingStream(server, otherUpgrade = () => {}, options = {}) {
  const connect = options.connect || ((url, headers) => new WebSocket(url, { headers, handshakeTimeout: 15000 }));
  const wss = new WebSocketServer({ noServer: true, maxPayload: 150000, perMessageDeflate: false });
  let active = 0;
  server.on('upgrade', (req, socket, head) => {
    if (new URL(req.url, 'http://localhost').pathname !== '/api/reading/audio/stream') {
      otherUpgrade(req, socket, head); return;
    }
    let sameOrigin = false;
    try { sameOrigin = new URL(req.headers.origin).host === req.headers.host; } catch {}
    if (!sameOrigin || active >= 4) {
      socket.end(`HTTP/1.1 ${sameOrigin ? '429 Too Many Requests' : '403 Forbidden'}\r\nConnection: close\r\n\r\n`);
      return;
    }
    wss.handleUpgrade(req, socket, head, client => wss.emit('connection', client));
  });
  wss.on('connection', client => {
    active++;
    let upstream;
    let nextTimer;
    let progressTimer;
    let complete = false;
    const send = message => { if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(message)); };
    const fail = message => { send({ type: 'error', message }); client.close(1011, 'Streaming stopped'); };
    const authTimer = setTimeout(() => fail('Listening request expired. Please try again.'), 10000);
    const lifetime = setTimeout(() => fail('Listening session expired. Please try again.'), 20 * 60000);
    client.on('error', () => {});
    client.once('close', () => {
      active--; clearTimeout(authTimer); clearTimeout(lifetime); clearTimeout(nextTimer); clearTimeout(progressTimer);
      upstream?.terminate();
    });
    client.once('message', (data, binary) => {
      clearTimeout(authTimer);
      let request;
      try { if (binary) throw new Error(); request = JSON.parse(data.toString()); } catch {
        fail('Invalid listening request.'); return;
      }
      const key = process.env.DEEPGRAM_API_KEY?.trim();
      if (!key) { fail('Listening is not configured yet.'); return; }
      if (!validReading(request, key)) { fail('Cast a new reading to listen.'); return; }
      const modelSetting = process.env.DEEPGRAM_MODEL || 'aura-2';
      const voice = process.env.DEEPGRAM_VOICE || 'thalia-en';
      const model = /^aura-(?:2-)?[a-z]+-[a-z]{2}$/.test(modelSetting) ? modelSetting
        : /^aura-(?:2-)?[a-z]+-[a-z]{2}$/.test(voice) ? voice : `${modelSetting}-${voice}`;
      if (!/^aura-(?:2-)?[a-z]+-[a-z]{2}$/.test(model)) { fail('Invalid voice configuration.'); return; }
      const chunks = streamChunks(request.script);
      let index = 0;
      let bytes = 0;
      const sent = [];
      const url = new URL('wss://api.deepgram.com/v1/speak');
      url.search = new URLSearchParams({ model, encoding: 'linear16', sample_rate: '24000' }).toString();
      upstream = connect(url, { Authorization: `Token ${key}` });
      const sendNext = () => {
        if (client.readyState !== WebSocket.OPEN || upstream.readyState !== WebSocket.OPEN) return;
        if (index === chunks.length) {
          if (!bytes) { fail('The voice service returned empty audio.'); return; }
          complete = true; send({ type: 'complete' }); upstream.send(JSON.stringify({ type: 'Close' }));
          client.close(1000, 'Complete'); return;
        }
        const now = Date.now();
        while (sent.length && sent[0].at <= now - 60000) sent.shift();
        const count = sent.reduce((total, item) => total + item.chars, 0);
        if (count + chunks[index].length > 2300 || sent.length >= 18) {
          nextTimer = setTimeout(sendNext, Math.max(1, sent[0].at + 60050 - now)); return;
        }
        const text = chunks[index++];
        sent.push({ at: now, chars: text.length });
        progressTimer = setTimeout(() => fail('Streaming stalled. Try again or Generate Download.'), 90000);
        upstream.send(JSON.stringify({ type: 'Speak', text }));
        upstream.send(JSON.stringify({ type: 'Flush' }));
      };
      upstream.on('open', () => { send({ type: 'ready', sampleRate: 24000 }); sendNext(); });
      upstream.on('message', (data, binary) => {
        if (binary) {
          bytes += data.length;
          if (bytes > 32 * 1024 * 1024 || client.bufferedAmount > 2 * 1024 * 1024) {
            fail('Recording is too large or the connection is too slow. Try Generate Download.'); return;
          }
          if (client.readyState === WebSocket.OPEN) client.send(data, { binary: true });
          return;
        }
        let message;
        try { message = JSON.parse(data.toString()); } catch { fail('Invalid voice service response.'); return; }
        if (message.type === 'Flushed') { clearTimeout(progressTimer); sendNext(); }
        if (message.type === 'Error' || message.type === 'Warning') {
          fail('The voice service could not finish streaming. Try Generate Download.');
        }
      });
      upstream.on('error', () => fail('Could not connect to the voice service. Try Generate Download.'));
      upstream.on('close', () => { if (!complete && client.readyState === WebSocket.OPEN) fail('Listening was interrupted. Try again or Generate Download.'); });
    });
  });
  return wss;
}
