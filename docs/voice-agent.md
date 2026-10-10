# myAeon Voice Explorer

The Talk to Zeus button opens an audio-reactive voice orb, with start/end,
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
Selected dates use noon Europe/London. Context includes a reading summary/metadata when
available and the selected planet. The full reading is retrieved by `get_reading`.
No default form values are assumed to be confirmed personal information.

- `get_sky`: current instant or a validated date between 1900 and 2100.
  Geocentric tropical longitudes for Sun, Moon and seven planets (excluding Earth), plus major
  transit-to-transit aspects within a six-degree orb.
- `get_natal_chart`: server-owned computed natal facts and confidence, if available.
- `get_transits`: up to four selected-date horizons (+0/+3/+7/+30), computed locally through Kerykeion; cached facts are reused without a generation quota.
- `get_moon_phase`: local phase/illumination calculation, without a hosted call.
- `get_reading`: existing sections, planetary interpretations and metadata;
  explicitly unavailable when no reading exists.
- `get_birth_chart_interpretation`: the previously generated natal interpretation
  and its synthesis with the current reading, retrieved from owner-bound memory.
  This read-only function does not trigger a new paid AI generation.

Functions use Deepgram's client-side dispatch protocol, but execute in myAeon's
server proxy, not the browser. They are read-only, bounded and do not expose
credentials. Context changes replace the prompt while preserving its base rules.
User-provided reading text is labeled untrusted data, not instructions.

The existing 3D solar system is heliocentric. Its positions are **not** used as
geocentric astrological facts. The agent explains that distinction when needed.
Explicitly confirmed birthplace coordinates and IANA timezone support the local
Kerykeion natal/transit calculation. London is the confirmed-default option;
other places require explicit coordinates/timezone. Unknown times remain limited.
No natal houses, Ascendant, retrograde flags or natal-to-transit aspects are
invented. Estimated times omit houses and angles. See the
[core integration plan](./kerykeion-core-plan.md).

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

## Local Chart Engine

Kerykeion runs as an offline Python worker inside the application container.
Chart facts and interpretations are temporary, owner-bound server context.
Zeus receives structured facts and generated text, not SVG markup, credentials
or screenshots. The server hydrates the most recent saved interpretation on
opening or refreshing a voice session. Calculation and written interpretation
remain separate: Zeus can discuss a computed chart without an AI-enhanced reading.
There is no lifetime tool-call counter. Concurrency, payload, idle and connection
limits remain transport safeguards rather than chart-generation quotas.

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
