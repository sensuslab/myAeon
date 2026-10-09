# myAeon Voice Explorer

The Explore button opens an audio-reactive Deepgram Orb, with start/end,
microphone mute, speaker mute, a live transcript and optional text questions.
Closing the panel ends the microphone and provider connection. A new session
starts with fresh context, without requiring a reading.

## Provider Configuration

- Live agent: Deepgram-managed OpenAI `gpt-6-luna`.
- Voice: `aura-2-hyperion-en`, mono linear16 at 24 kHz.
- Recognition: Deepgram Nova-3, mono linear16 at 16 kHz.
- Reasoning: **`none`**. Live testing confirmed that Luna's function tools via
  Deepgram's chat-completions integration fail with low/default reasoning.
  No temperature override or unsupported token parameters are sent.
- DeepSeek remains exclusively the written-reading provider, not the agent.
- Existing server-only `DEEPGRAM_API_KEY` is sufficient; no OpenAI key or
  Deepgram agent UUID is needed. Managed voice-agent usage is billed by Deepgram.
- `mip_opt_out: true` is sent. myAeon does not persist recordings/transcripts;
  provider processing/retention is subject to the Deepgram account's policies.

## Context and Tools

`server/agent-context.mjs` contains the editable `AGENT_PROMPT`, `buildPrompt`,
model configuration and tool schemas. This is separate from the written prompt.
Every opening calculates the actual current sky and the selected-date sky.
Selected dates use noon UTC. Context includes a reading summary/metadata when
available and the selected planet. The full reading is retrieved by `get_reading`.
No default form values are assumed to be confirmed personal information.

- `get_sky`: current instant or a validated date between 1900 and 2100.
  Geocentric tropical longitudes for Sun, Moon and seven planets (excluding Earth), plus major
  transit-to-transit aspects within a six-degree orb.
- `get_reading`: existing sections, planetary interpretations and metadata;
  explicitly unavailable when no reading exists.

Functions use Deepgram's client-side dispatch protocol, but execute in myAeon's
server proxy, not the browser. They are read-only, bounded and do not expose
credentials. Context changes replace the prompt while preserving its base rules.
User-provided reading text is labeled untrusted data, not instructions.

The existing 3D solar system is heliocentric. Its positions are **not** used as
geocentric astrological facts. The agent explains that distinction when needed.
Birthplace timezone/coordinates are not resolved; no natal houses, ascendant,
retrograde status or natal-to-transit aspects are invented.

## Transport and Limits

`server/voice-agent.mjs` exposes POST `/api/explore/session` and WebSocket
`/api/explore/v1/agent/converse`. A single-use opaque ticket expires after 30
seconds if not connected. Same-origin checks, body limits, input validation,
four concurrent sessions, backpressure, a 15-minute lifetime and a three-minute
conversation-idle limit bound usage. Settings/model/endpoints are server-owned.
Audio is withheld until Deepgram acknowledges Settings. KeepAlive does not
reset the conversation-idle limit. On disconnect, the provider is terminated.
Starting again remounts the SDK session to avoid its short-lived token cache
reusing a consumed ticket. Provider sessions are not automatically reconnected.

Tickets are stored in memory, so this initial deployment expects one Railway
replica. For scaling, move tickets/context to shared storage or add connection
affinity. Before large public promotion, add user/account-level quotas and
abuse protection: same-origin checks and global limits are not authentication.

## Astrologer-API Assessment

[Astrologer-API](https://github.com/g-battaglia/Astrologer-API) provides natal,
synastry, transit, composite and return charts through a separate Python service.
Its repository is AGPL-3.0. It is **not copied, installed or deployed** in this
change. Integrating it deserves a separate service boundary and license review,
and verified birthplace coordinates/timezone/unknown-time handling before
personal natal claims. The new read-only sky/reading tools provide an explicit
extension point for a future validated `get_natal_chart` tool. Existing
astronomy-engine supplies the geocentric context without a new service.

## Verification

`node --test tests/voice-agent.test.mjs` tests positions, model/voice separation,
validation, proxy settings override, audio gating, tool dispatch, context refresh,
and disconnection cleanup. Existing reading/audio tests remain unchanged.
`scripts/check-voice-agent.mjs` is an opt-in paid live check using a server key;
it disables the greeting, requires a real tool-assisted answer and checks audio.

Sources: [Browser Agent](https://developers.deepgram.com/docs/browser-agent-overview),
[React UI](https://developers.deepgram.com/docs/browser-agent-react-ui),
[Settings](https://developers.deepgram.com/docs/configure-voice-agent),
[Functions](https://developers.deepgram.com/docs/build-a-function-call).
