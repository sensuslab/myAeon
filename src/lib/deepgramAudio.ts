import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { splitSpeechText, type AudioAuthorization } from "./readingAudio";

const AUTH_TTL_MS = 24 * 60 * 60 * 1000;
const SAMPLE_RATE = 24_000;
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX_BYTES = 64 * 1024 * 1024;
const MAX_RECORDING_BYTES = 32 * 1024 * 1024;
const cache = new Map<string, { data: Buffer; expiresAt: number }>();
const inFlight = new Map<string, Promise<Buffer>>();
let cacheBytes = 0;

export class AudioError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

// Deepgram encodes the voice AND language in its model identifier.
export function resolveVoiceModel(model = "aura-2", voice = "thalia-en") {
  if (/^aura-(?:2-)?[a-z]+-[a-z]{2}$/.test(model)) return model;
  if (/^aura-(?:2-)?[a-z]+-[a-z]{2}$/.test(voice)) return voice;
  if (!/^aura(?:-2)?$/.test(model) || !/^[a-z]+-[a-z]{2}$/.test(voice)) {
    throw new AudioError("Reading audio has an invalid voice configuration.", 503);
  }
  return `${model}-${voice}`;
}

export function getAudioConfig() {
  const apiKey = process.env.DEEPGRAM_API_KEY?.trim();
  if (!apiKey) throw new AudioError("Listening is not configured yet. Please try again later.", 503);
  const model = resolveVoiceModel(process.env.DEEPGRAM_MODEL, process.env.DEEPGRAM_VOICE);
  const rawTimeout = Number(process.env.DEEPGRAM_TIMEOUT_MS ?? 120_000);
  const timeoutMs = Number.isFinite(rawTimeout) && rawTimeout >= 1000
    ? Math.min(rawTimeout, 180_000) : 120_000;
  return { apiKey, model, timeoutMs };
}

function signatureFor(script: string, expiresAt: number, apiKey: string) {
  return createHmac("sha256", apiKey)
    .update(`myAeon:reading-audio:v1\n${expiresAt}\n${script}`).digest("hex");
}

export function authorizeAudio(script: string): AudioAuthorization | undefined {
  const apiKey = process.env.DEEPGRAM_API_KEY?.trim();
  if (!apiKey) return undefined;
  const expiresAt = Date.now() + AUTH_TTL_MS;
  return { expiresAt, signature: signatureFor(script, expiresAt, apiKey) };
}

export function verifyAudio(script: string, auth: AudioAuthorization, apiKey: string) {
  if (!Number.isSafeInteger(auth.expiresAt) || auth.expiresAt <= Date.now()
    || auth.expiresAt > Date.now() + AUTH_TTL_MS || !/^[a-f0-9]{64}$/.test(auth.signature)) return false;
  return timingSafeEqual(Buffer.from(auth.signature, "hex"),
    Buffer.from(signatureFor(script, auth.expiresAt, apiKey), "hex"));
}

function getCached(key: string) {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key); cacheBytes -= entry.data.length;
    return undefined;
  }
  cache.delete(key); cache.set(key, entry);
  return entry.data;
}

function putCached(key: string, data: Buffer) {
  if (data.length > CACHE_MAX_BYTES) return;
  const previous = cache.get(key);
  if (previous) { cacheBytes -= previous.data.length; cache.delete(key); }
  for (const [oldKey, entry] of cache) {
    if (entry.expiresAt <= Date.now() || cacheBytes + data.length > CACHE_MAX_BYTES) {
      cache.delete(oldKey); cacheBytes -= entry.data.length;
    }
  }
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  cacheBytes += data.length;
}

/** One WAV header for all PCM chunks: correct duration, seeking and browser playback. */
export function pcmToWav(pcm: Buffer) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0); header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVEfmt ", 8); header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24); header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write("data", 36); header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

async function requestChunk(text: string, config: ReturnType<typeof getAudioConfig>, signal: AbortSignal) {
  const url = new URL("https://api.deepgram.com/v1/speak");
  url.search = new URLSearchParams({ model: config.model, encoding: "linear16",
    container: "none", sample_rate: String(SAMPLE_RATE) }).toString();
  const response = await fetch(url, {
    method: "POST", headers: { Authorization: `Token ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text }), signal, cache: "no-store",
  });
  if (!response.ok) {
    // Provider response bodies can contain input text. Keep them out of client errors/logs.
    await response.body?.cancel();
    throw new AudioError(response.status === 429
      ? "The voice service is busy. Please try again shortly."
      : "Could not generate reading audio. Please try again.", response.status === 429 ? 429 : 502);
  }
  if (!response.headers.get("content-type")?.startsWith("audio/") || !response.body) {
    await response.body?.cancel();
    throw new AudioError("The voice service returned invalid audio.", 502);
  }
  const buffers: Buffer[] = [];
  let size = 0;
  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_RECORDING_BYTES) {
        await reader.cancel();
        throw new AudioError("The generated recording is too large.", 502);
      }
      buffers.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  if (!size || size % 2) throw new AudioError("The voice service returned incomplete audio.", 502);
  return Buffer.concat(buffers);
}

/** Generate only on demand. Deduplicate and reuse both complete and successful partial audio. */
export async function generateReadingAudio(script: string, config: ReturnType<typeof getAudioConfig>) {
  const scope = createHash("sha256").update(`${config.apiKey}\n${config.model}`).digest("hex");
  const key = createHash("sha256").update(`${scope}\nreading\n${script}`).digest("hex");
  const existing = getCached(key);
  if (existing) return existing;
  const pending = inFlight.get(key);
  if (pending) return pending;
  if (inFlight.size >= 2) throw new AudioError("Reading audio is busy. Please try again shortly.", 429);

  const task = (async () => {
    const signal = AbortSignal.timeout(config.timeoutMs);
    const chunks: Buffer[] = [];
    let total = 0;
    for (const text of splitSpeechText(script)) {
      signal.throwIfAborted();
      const chunkKey = createHash("sha256").update(`${scope}\nchunk\n${text}`).digest("hex");
      let chunk = getCached(chunkKey);
      if (!chunk) {
        chunk = await requestChunk(text, config, signal);
        putCached(chunkKey, chunk);
      }
      total += chunk.length;
      if (total > MAX_RECORDING_BYTES) throw new AudioError("The generated recording is too large.", 502);
      chunks.push(chunk);
    }
    const wav = pcmToWav(Buffer.concat(chunks));
    putCached(key, wav);
    return wav;
  })();
  inFlight.set(key, task);
  try { return await task; } finally { inFlight.delete(key); }
}
