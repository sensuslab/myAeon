# myAeon Reading Prompts

Updated 10 October 2026. The source files below are authoritative and editable.
The earlier sign-centre aspect template is no longer the calculation contract.

## Initial Sky Reading

`src/lib/readingGeneration.ts` exports `SYSTEM_PROMPT` and `buildUserPrompt`.
`src/app/api/reading/route.ts` handles the request and resolves four geocentric
sky snapshots without waiting for natal chart generation.

The system prompt specifies symbolic, non-deterministic interpretation, grounded
in supplied placements and computed major aspects within a six-degree orb.
It defines sign elements/modalities, dignity as a symbolic framework, four life
domains and four timeframes. Each of the sixteen sections has two or three
sentences: situational, interpretive and actionable. Earth is a grounding
reflection, not a geocentric natal placement.

The user prompt includes the optional name, broad date-only Sun-sign theme and
validated sky context. It explicitly forbids natal claims in this first stage.
The noon London snapshots are +0, +3, +7 and +30 days, not calculated event peaks
or guaranteed forecasts. A date-only sign must not be treated as an exact natal
Sun longitude, especially near a sign boundary.

Output remains `greeting`, `summary`, sixteen `sections`, eight `planetInsights`,
`affirmation` and a complete `audioScript`. The server supplies validated position
fields and signed audio authorization. JSON recovery and bounded fallback text
protect the established response contract.

## Optional Birth-Chart Interpretation

`src/lib/readingEnhancement.ts` exports `ENHANCEMENT_SYSTEM_PROMPT` and
`enhancementPrompt`. `src/app/api/reading/enhance/route.ts` resolves an owner-bound
chart context and validates the matching birth profile/date before requesting AI.

The enhancement prompt extends the initial system prompt and adds:

- Natal placements, houses/angles for known time, computed aspects and orbs.
- Dated transit-to-natal relationships over all four horizons.
- Bounded Kerykeion semantic XML alongside validated typed facts.
- The existing reading as untrusted continuity text, never computation evidence.
- An explicit prohibition on guessing from images, inventing missing facts or
  following instructions embedded in names, XML or reading text.
- Approximate-only interpretation for estimated time, with no houses or angles.
- A separate `birthChart` object containing title, overview, sections, synthesis,
  reflection and the verified context ID.
- Updated compatible reading sections and narration covering all added insight.

SVG markup is not sent as an image: the text model does not support this vision
path. Chart graphics and prompt facts originate from the same local calculation.
Omitting a prior reading creates a standalone personal chart interpretation in
the same complete response shape.

## Audio And Zeus

`src/lib/readingAudio.ts` defines narration instructions and a complete fallback
adaptation. Enhanced narration includes every birth-chart section, synthesis and
reflection. A new reading invalidates previous playback and signed scripts.

Zeus has a separate conversational prompt in `server/agent-context.mjs`, with
`buildPrompt` and read-only functions for sky, natal chart, transits, lunar phase,
reading and previously generated birth-chart interpretation. Its live model is
independent of the written-reading model.

## Model Parameters

Written calls default to `deepseek-v4-pro`, temperature `0.85`, output token limit
`12288`, JSON-object response format and thinking disabled. Timeout defaults to
120 seconds and is configurable up to 180 seconds. Provider keys and model
configuration remain server-side. Change tone and emphasis in the two source
prompts while retaining the schema, uncertainty and computation constraints.
