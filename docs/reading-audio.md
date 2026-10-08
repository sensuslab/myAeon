# Listen to reading

Every `/api/reading` request now asks the existing DeepSeek completion to return
both the written reading and an `audioScript`. The narration covers the greeting,
sky summary, four domains in each of four timeframes, eight planet insights and
reflections, and the affirmation. It is a spoken adaptation rather than a second
reading or a summary of the currently selected tab.

The authoritative narration prompt lives in `src/lib/readingAudio.ts` and is
inserted into the reading system prompt. It directs the model to use short spoken
sentences, natural punctuation, clear transitions, spoken numbers and dates, and
brief explanations of astrological terms. It excludes Markdown, SSML, stage
directions, glyphs and references to the screen. The reading's symbolic framing
and meaning must be preserved. The completion ceiling was raised from 8192 to
12288 tokens to accommodate both outputs; this does not force use of the ceiling.

If the model omits or malforms the narration, the API assembles a separate spoken
script from the normalized reading, without an additional model call. The script
is still returned when Deepgram is unconfigured. The listening control explains
that audio is unavailable in that case.

## Deployment configuration

All variables belong in the deployment environment, not the frontend:

```dotenv
DEEPGRAM_API_KEY=your_deepgram_key
DEEPGRAM_MODEL=aura-2
DEEPGRAM_VOICE=thalia-en
DEEPGRAM_TIMEOUT_MS=300000
```

Deepgram's Aura API encodes the voice and language in the model identifier.
`aura-2` plus `thalia-en` becomes `aura-2-thalia-en`. You can instead set
`DEEPGRAM_MODEL=aura-2-luna-en`; a complete MODEL id takes precedence over VOICE.
A complete id in VOICE is also accepted for compatibility. This implementation
uses Aura/Aura-2 through `https://api.deepgram.com/v1/speak`; Flux models use a
different API and are not supported by this route. The narration is English;
choose an English voice. Never prefix these variables with `NEXT_PUBLIC_`.

Restart or redeploy after changing variables. Existing readings issued before
the key was configured need to be cast again to receive audio authorization.

## Demand and cost behavior

1. Cast a reading: one AI request generates written content and the separate
   narration. There are zero Deepgram requests at this stage, or on hover,
   changing tabs, opening a reading or resizing the screen.
2. Press **Listen to reading**: the browser sends only the narration and its
   authorization to `/api/reading/audio`.
3. The server verifies the signature and its 24-hour expiry before synthesis.
   The browser cannot select a paid model, override the endpoint or synthesize
   arbitrary text with the server's key. This is a reading capability, not a user
   identity or billing system; existing public reading access is unchanged.
4. Aura input is limited to 2000 characters per request. The server splits the
   script into chunks of at most 1900 characters, preferring sentence then word
   boundaries. Sequential requests generate raw 24 kHz mono, 16-bit PCM. One
   WAV header wraps the complete recording, giving browsers correct duration
   and seek behavior without concatenating multiple WAV headers or MP3 files.
5. The recording plays on desktop or mobile. An iOS autoplay restriction after
   asynchronous generation prompts the user to press Play again. Pause, seek,
   speed, replay and download use the same recording.

The current reading's audio stays in browser memory until a new reading is cast
or the page closes. Desktop and mobile share one player, so changing viewport or
closing/reopening the mobile reading does not create another speech request.
Starting a new reading cancels the browser request and clears its old player and
object URL. Already submitted provider work may complete and enter the cache.

Server audio and successful partial chunks use a bounded 64 MiB, one-hour,
in-process cache. Identical in-flight recordings are deduplicated; at most two
distinct recordings synthesize concurrently per process. Retries reuse successful
chunks still in cache, and no automatic paid retry occurs. Each complete recording
is limited to 32 MiB. The cache is not durable or shared across instances: refreshes,
restarts, eviction or routing to another instance can incur another synthesis call.
An expired authorization requires a new reading. No recording or narration is
written to disk, public storage or logs. The endpoint marks audio private/no-store;
Deepgram receives the narration on demand, not the raw birth-data payload.

## Verification

```bash
npm ci
npm run test:audio
npx tsc --noEmit
npm run build
```

Tests use mocked DeepSeek and Deepgram responses, never live credentials or paid
requests. They verify reading and script generation, the absence of eager speech
calls, signature tampering/expiry, configuration, provider-size limits, Unicode
boundaries, WAV duration/data, repeat and concurrent calls, partial retry reuse,
bad payloads, missing keys, invalid audio and safe timeout errors. React player
tests also verify click-only generation, pause/seek/speed/replay without new calls,
mobile autoplay rejection and safe cancellation when a new reading replaces the old one.

For live acceptance, configure deployment variables, cast a reading, confirm zero
Deepgram calls before pressing Listen, listen once, pause/seek/change speed/replay,
then test on an iPhone. Check that the narration matches the written reading and
that selected names, zodiac terms and dates sound natural. Voice quality and model
obedience must be assessed with the actual configured providers.

## Provider references

- [Aura REST API and 2000-character input limit](https://developers.deepgram.com/docs/text-to-speech)
- [Formatting text for Aura-2](https://developers.deepgram.com/docs/improving-aura-2-formatting)
- [Supported audio formats](https://developers.deepgram.com/docs/tts-media-output-settings)
- [Voice model identifiers](https://developers.deepgram.com/docs/tts-models)
