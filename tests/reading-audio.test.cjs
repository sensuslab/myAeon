// Use the existing TypeScript dependency, so these tests require no new runtime packages.
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const assert = require("node:assert/strict");
const { test, afterEach } = require("node:test");
require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8").replace(/(["'])@\/([^"']+)\1/g,
    (_, quote, target) => JSON.stringify(path.resolve(__dirname, "../src", target)));
  module._compile(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
  } }).outputText, filename);
};
const speech = require("../src/lib/readingAudio.ts");
const provider = require("../src/lib/deepgramAudio.ts");
const audioRoute = require("../src/app/api/reading/audio/route.ts");
const readingRoute = require("../src/app/api/reading/route.ts");
const React = require("react");
const { create, act } = require("react-test-renderer");
const { useReadingAudio } = require("../src/components/ui/useReadingAudio.ts");
const originalFetch = global.fetch;
const originalEnv = { ...process.env };
afterEach(() => { global.fetch = originalFetch; process.env = { ...originalEnv }; });
function setup(key) { process.env.DEEPGRAM_API_KEY = `test-only-${key}`; }
function scriptFor(label) { return `${label}. This is a symbolic reflection. Take a little time to listen, reflect, and choose a kind action today.`; }
function audioRequest(script, authorization = provider.authorizeAudio(script)) {
  return new Request("http://localhost/api/reading/audio", { method: "POST",
    body: JSON.stringify({ script, authorization }), headers: { "Content-Type": "application/json" } });
}
function pcmResponse() {
  return new Response(new Uint8Array([1, 0, 2, 0, 3, 0, 4, 0]),
    { headers: { "Content-Type": "audio/l16;rate=24000" } });
}

test("voice configuration supports separate and complete Deepgram model ids", () => {
  assert.equal(provider.resolveVoiceModel(), "aura-2-thalia-en");
  assert.equal(provider.resolveVoiceModel("aura", "asteria-en"), "aura-asteria-en");
  assert.equal(provider.resolveVoiceModel("aura-2-luna-en", "thalia-en"), "aura-2-luna-en");
  assert.equal(provider.resolveVoiceModel("aura-2", "aura-2-luna-en"), "aura-2-luna-en");
  assert.throws(() => provider.resolveVoiceModel("nova-3", "thalia-en"), /configuration/);
});

test("chunking respects provider limits, sentence order and Unicode", () => {
  const script = "Take time to listen carefully. Reflect on love and purpose. ".repeat(200);
  const chunks = speech.splitSpeechText(script);
  assert.ok(chunks.length > 2);
  assert.ok(chunks.every((text) => text.length <= 1900));
  assert.equal(chunks.join(" "), script.trim());
  const unicode = "🌌".repeat(2000);
  assert.equal(speech.splitSpeechText(unicode).join(""), unicode);
  assert.ok(speech.splitSpeechText(unicode).every((s) => !s.includes("\ufffd")));
});

test("fallback narration covers all timeframes, insights and affirmation without markup", () => {
  const reading = { greeting: "Welcome.", summary: "Your reflection.", affirmation: "I choose care.",
    sections: ["Today", "3 Days", "Week", "Month"].map((timeframe) =>
      ({ timeframe, title: "Love & Connection", body: "Notice **Venus** at 12°." })),
    planetInsights: [{ title: "Mercury in Libra", body: "Listen gently.", reflection: "What can you hear?" }] };
  const result = speech.resolveAudioScript(null, reading);
  for (const words of ["For today", "next three days", "coming week", "coming month", "Mercury", "I choose care."]) {
    assert.ok(result.includes(words));
  }
  assert.ok(!/[&*°]/.test(result));
  assert.equal(speech.cleanSpeechText("<speak>**Hello** [pause] & [world](https://example.com).</speak>"), "Hello and world.");
});

test("reading request asks AI for a separate script, signs it and never calls Deepgram", async () => {
  setup("reading"); process.env.DEEPSEEK_API_KEY = "test-only-deepseek";
  let calls = 0;
  const script = scriptFor("Your spoken reading");
  global.fetch = async (url, options) => {
    calls++;
    assert.ok(String(url).endsWith("/chat/completions"));
    const payload = JSON.parse(options.body);
    assert.ok(payload.messages[0].content.includes(speech.AUDIO_SCRIPT_PROMPT));
    assert.ok(payload.max_tokens >= 12288);
    return Response.json({ choices: [{ message: { content: JSON.stringify({
      greeting: "Welcome.", summary: "A quiet reflection.", sections: [], planetInsights: [],
      affirmation: "I listen.", audioScript: script,
    }) } }] });
  };
  const response = await readingRoute.POST(new Request("http://localhost/api/reading", { method: "POST",
    body: JSON.stringify({ birthDate: "1992-03-12", readingDate: "2026-10-08" }) }));
  assert.equal(response.status, 200);
  const reading = await response.json();
  assert.equal(reading.audioScript, script);
  assert.ok(provider.verifyAudio(script, reading.audioAuthorization, process.env.DEEPGRAM_API_KEY));
  assert.equal(reading.sections.length, 16);
  assert.equal(reading.planetInsights.length, 8);
  assert.equal(calls, 1);
  assert.ok(!JSON.stringify(reading).includes("test-only"));
});

test("reading still produces narration when listening is unconfigured or model omits script", async () => {
  delete process.env.DEEPGRAM_API_KEY; process.env.DEEPSEEK_API_KEY = "test-only-deepseek";
  global.fetch = async () => Response.json({ choices: [{ message: { content: JSON.stringify({
    greeting: "Welcome.", summary: "A quiet reflection.", affirmation: "I choose care.",
  }) } }] });
  const response = await readingRoute.POST(new Request("http://localhost/api/reading", { method: "POST",
    body: JSON.stringify({ birthDate: "1992-03-12" }) }));
  const reading = await response.json();
  assert.equal(response.status, 200);
  assert.ok(reading.audioScript.includes("For the coming month"));
  assert.equal(reading.audioAuthorization, undefined);
});

test("forged, changed and expired scripts are rejected before a paid call", async () => {
  setup("invalid"); let calls = 0;
  global.fetch = async () => { calls++; return pcmResponse(); };
  const script = scriptFor("Invalid requests");
  const auth = provider.authorizeAudio(script);
  assert.equal((await audioRoute.POST(audioRequest(script + " Changed.", auth))).status, 403);
  assert.equal((await audioRoute.POST(audioRequest(script, { ...auth, signature: "0".repeat(64) }))).status, 403);
  assert.equal((await audioRoute.POST(audioRequest(script, { ...auth, expiresAt: Date.now() - 1 }))).status, 403);
  assert.equal(calls, 0);
});

test("on-demand audio uses environment settings and returns one valid, seekable WAV", async () => {
  setup("wav"); process.env.DEEPGRAM_MODEL = "aura-2"; process.env.DEEPGRAM_VOICE = "luna-en";
  const script = (scriptFor("Long reading") + " ").repeat(40).trim();
  let calls = 0;
  global.fetch = async (url, options) => {
    calls++;
    const endpoint = new URL(url);
    assert.equal(endpoint.origin, "https://api.deepgram.com");
    assert.equal(endpoint.searchParams.get("model"), "aura-2-luna-en");
    assert.equal(endpoint.searchParams.get("encoding"), "linear16");
    assert.equal(endpoint.searchParams.get("container"), "none");
    assert.equal(options.headers.Authorization, "Token test-only-wav");
    assert.ok(JSON.parse(options.body).text.length <= 2000);
    return pcmResponse();
  };
  const response = await audioRoute.POST(audioRequest(script));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "audio/wav");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const buffer = Buffer.from(await response.arrayBuffer());
  assert.equal(buffer.toString("ascii", 0, 4), "RIFF");
  assert.equal(buffer.toString("ascii", 8, 12), "WAVE");
  assert.equal(buffer.readUInt32LE(24), 24000);
  assert.equal(buffer.readUInt32LE(40), calls * 8);
  assert.equal(buffer.length, 44 + calls * 8);
  const before = calls;
  assert.equal((await audioRoute.POST(audioRequest(script))).status, 200);
  assert.equal(calls, before, "replaying audio must not incur more provider calls");
});

test("parallel chunks preserve speech order when the second finishes first", async () => {
  setup("parallel-order");
  const script = "First sentence for speech. ".repeat(100) + "Last sentence for speech. ".repeat(100);
  const texts = speech.splitSpeechText(script);
  let active = 0; let peak = 0;
  global.fetch = async (_, options) => {
    const index = texts.indexOf(JSON.parse(options.body).text);
    active++; peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, index === 0 ? 20 : 1));
    active--;
    return new Response(new Uint8Array([index + 1, 0]), { headers: { "Content-Type": "audio/l16" } });
  };
  const result = await provider.generateReadingAudio(script, provider.getAudioConfig());
  assert.equal(peak, 2);
  assert.deepEqual([...result.subarray(44)], texts.flatMap((_, index) => [index + 1, 0]));
});

test("simultaneous requests for the same script share one provider call", async () => {
  setup("dedupe"); const script = scriptFor("Concurrent listening"); let calls = 0;
  global.fetch = async () => { calls++; await new Promise((resolve) => setImmediate(resolve)); return pcmResponse(); };
  const responses = await Promise.all([audioRoute.POST(audioRequest(script)), audioRoute.POST(audioRequest(script))]);
  assert.ok(responses.every((response) => response.status === 200));
  assert.equal(calls, 1);
});

test("failed generation returns a safe error and retries reuse successful chunks", async () => {
  setup("retry"); const script = (scriptFor("Retry narration") + " ").repeat(40).trim();
  const texts = []; let fail = true;
  global.fetch = async (_, options) => {
    texts.push(JSON.parse(options.body).text);
    if (texts.length === 2 && fail) return new Response("provider error containing private text", { status: 429 });
    return pcmResponse();
  };
  const failed = await audioRoute.POST(audioRequest(script));
  assert.equal(failed.status, 429);
  assert.ok(!(await failed.text()).includes("private text"));
  fail = false;
  assert.equal((await audioRoute.POST(audioRequest(script))).status, 200);
  assert.equal(texts.filter((text) => text === texts[0]).length, 1);
});

test("bad bodies, oversized scripts, missing keys and invalid audio do not masquerade as recordings", async () => {
  setup("bad-audio"); let calls = 0;
  global.fetch = async () => { calls++; return Response.json({ message: "not audio" }); };
  assert.equal((await audioRoute.POST(new Request("http://localhost/api/reading/audio", { method: "POST", body: "{" }))).status, 400);
  assert.equal((await audioRoute.POST(audioRequest("x".repeat(20_001)))).status, 400);
  assert.equal((await audioRoute.POST(new Request("http://localhost/api/reading/audio", { method: "POST", body: "x".repeat(150_001) }))).status, 413);
  assert.equal(calls, 0);
  const script = scriptFor("Invalid recording");
  assert.equal((await audioRoute.POST(audioRequest(script))).status, 502);
  delete process.env.DEEPGRAM_API_KEY;
  assert.equal((await audioRoute.POST(audioRequest(script, { expiresAt: Date.now(), signature: "0".repeat(64) }))).status, 503);
});

test("network timeouts produce a retryable error without exposing credentials", async () => {
  setup("timeout");
  global.fetch = async () => { throw new DOMException("private key details", "TimeoutError"); };
  const response = await audioRoute.POST(audioRequest(scriptFor("Timeout narration")));
  assert.equal(response.status, 504);
  assert.ok(!(await response.text()).includes("private key"));
});

function playerHarness(reading, options = {}) {
  const previous = { Audio: global.Audio, create: URL.createObjectURL, revoke: URL.revokeObjectURL };
  const instances = [];
  const revoked = [];
  let state;
  class MockAudio extends EventTarget {
    constructor() { super(); this.paused = true; this.ended = false; this.currentTime = 0;
      this.duration = 30; this.src = ""; this.playbackRate = 1; instances.push(this); }
    async play() {
      if (options.blockFirstPlay) { options.blockFirstPlay = false; throw new Error("Gesture required"); }
      this.paused = false; this.dispatchEvent(new Event("play"));
    }
    pause() { this.paused = true; this.dispatchEvent(new Event("pause")); }
    removeAttribute() { this.src = ""; }
    load() {}
  }
  global.Audio = MockAudio;
  URL.createObjectURL = () => "blob:test-reading";
  URL.revokeObjectURL = (url) => revoked.push(url);
  function Probe({ reading }) { state = useReadingAudio(reading); return null; }
  let renderer;
  act(() => { renderer = create(React.createElement(Probe, { reading })); });
  return { get state() { return state; }, instances, revoked,
    update(reading) { act(() => renderer.update(React.createElement(Probe, { reading }))); },
    dispose() { act(() => renderer.unmount()); global.Audio = previous.Audio;
      URL.createObjectURL = previous.create; URL.revokeObjectURL = previous.revoke; },
  };
}

test("download generation does not autoplay or start a streaming connection", async () => {
  const reading = { audioScript: scriptFor("Download-only narration"), audioAuthorization: { expiresAt: 1, signature: "test" } };
  global.fetch = async () => new Response(new Uint8Array([1, 2]), { headers: { "Content-Type": "audio/wav" } });
  const harness = playerHarness(reading);
  try {
    await act(async () => { await harness.state.generateDownload(); });
    assert.equal(harness.state.ready, true);
    assert.equal(harness.instances[0].paused, true);
    assert.equal(harness.state.stream.ready, false);
  } finally { harness.dispose(); }
});

test("streaming starts on tap, plays incoming PCM, pauses and disposes on a new reading", async () => {
  const saved = { context: global.AudioContext, socket: global.WebSocket, window: global.window };
  const sockets = []; const contexts = [];
  class Context {
    constructor() { this.currentTime = 0; this.state = "suspended"; this.destination = {}; contexts.push(this); }
    async resume() { this.state = "running"; }
    async suspend() { this.state = "suspended"; }
    async close() { this.state = "closed"; }
    createBuffer(_, length, sampleRate) { const data = new Float32Array(length); return { duration: length / sampleRate, getChannelData: () => data }; }
    createBufferSource() { return { playbackRate: { value: 1 }, connect() {}, disconnect() {}, start() {}, stop() {} }; }
  }
  class Socket {
    constructor() { sockets.push(this); }
    send(data) { this.request = JSON.parse(data); }
    close() { this.closed = true; }
  }
  global.AudioContext = Context; global.WebSocket = Socket;
  global.window = { location: { href: "https://myaeon.test/", protocol: "https:" } };
  const reading = { audioScript: scriptFor("Streaming narration"), audioAuthorization: { expiresAt: 1, signature: "test" } };
  const harness = playerHarness(reading);
  try {
    assert.equal(sockets.length, 0);
    await act(async () => { await harness.state.stream.togglePlayback(); });
    sockets[0].onopen(); assert.equal(sockets[0].request.script, reading.audioScript);
    act(() => sockets[0].onmessage({ data: new ArrayBuffer(48000) }));
    assert.equal(harness.state.stream.ready, true); assert.equal(harness.state.stream.playing, true);
    assert.equal(harness.state.stream.duration, 1);
    await act(async () => { await harness.state.stream.togglePlayback(); });
    assert.equal(contexts[0].state, "suspended"); assert.equal(harness.state.stream.playing, false);
    act(() => harness.state.stream.seek(0.5)); assert.equal(harness.state.stream.currentTime, 0.5);
    act(() => harness.state.stream.changeRate(1.5)); assert.equal(harness.state.stream.rate, 1.5);
    harness.update({ ...reading });
    assert.equal(sockets[0].closed, true); assert.equal(contexts[0].state, "closed");
    act(() => sockets[0].onmessage({ data: new ArrayBuffer(48000) }));
    assert.equal(harness.state.stream.ready, false);
  } finally {
    harness.dispose(); global.AudioContext = saved.context; global.WebSocket = saved.socket; global.window = saved.window;
  }
});

test("player generates only on click; pause, seek, speed and replay reuse one recording", async () => {
  setup("player"); let calls = 0;
  const reading = { audioScript: scriptFor("Player narration"), audioAuthorization: { expiresAt: 1, signature: "test" } };
  global.fetch = async (_, options) => { calls++; assert.equal(JSON.parse(options.body).script, reading.audioScript);
    return new Response(new Uint8Array([1, 2]), { headers: { "Content-Type": "audio/wav" } }); };
  const harness = playerHarness(reading);
  try {
    assert.equal(calls, 0);
    await act(async () => { await harness.state.togglePlayback(); });
    assert.ok(harness.state.ready && harness.state.playing);
    assert.equal(calls, 1);
    await act(async () => { await harness.state.togglePlayback(); });
    assert.equal(harness.state.playing, false);
    act(() => { harness.state.seek(12); harness.state.changeRate(1.5); });
    assert.equal(harness.instances[0].currentTime, 12);
    assert.equal(harness.instances[0].playbackRate, 1.5);
    await act(async () => { await harness.state.togglePlayback(); });
    assert.equal(calls, 1);
    harness.update(null);
    assert.ok(!harness.state.ready && !harness.state.playing);
    assert.deepEqual(harness.revoked, ["blob:test-reading"]);
  } finally { harness.dispose(); }
});

test("mobile autoplay refusal keeps audio ready and the next gesture incurs no new generation", async () => {
  let calls = 0;
  global.fetch = async () => { calls++; return new Response(new Uint8Array([1, 2]),
    { headers: { "Content-Type": "audio/wav" } }); };
  const harness = playerHarness({ audioScript: scriptFor("Mobile playback"), audioAuthorization: { expiresAt: 1, signature: "test" } },
    { blockFirstPlay: true });
  try {
    await act(async () => { await harness.state.togglePlayback(); });
    assert.equal(harness.state.ready, true);
    assert.equal(harness.state.playing, false);
    assert.match(harness.state.notice, /Press play/);
    await act(async () => { await harness.state.togglePlayback(); });
    assert.equal(harness.state.playing, true);
    assert.equal(harness.state.notice, null);
    assert.equal(calls, 1);
  } finally { harness.dispose(); }
});

test("new reading aborts pending generation and prevents stale audio from playing", async () => {
  let release;
  let signal;
  global.fetch = async (_, options) => { signal = options.signal;
    return new Promise((resolve) => { release = () => resolve(new Response(new Uint8Array([1, 2]),
      { headers: { "Content-Type": "audio/wav" } })); }); };
  const harness = playerHarness({ audioScript: scriptFor("Old reading"), audioAuthorization: { expiresAt: 1, signature: "test" } });
  try {
    let pending;
    act(() => { pending = harness.state.togglePlayback(); });
    assert.equal(harness.state.generating, true);
    harness.update(null);
    assert.equal(signal.aborted, true);
    await act(async () => { release(); await pending; });
    assert.equal(harness.state.ready, false);
    assert.equal(harness.state.playing, false);
    assert.equal(harness.instances[0].src, "");
    assert.equal(harness.state.generating, false);
  } finally { harness.dispose(); }
});
