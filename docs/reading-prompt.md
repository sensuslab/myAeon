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
`enhancementPrompt` and `ENHANCEMENT_RESPONSE_SCHEMA`. `src/app/api/reading/enhance/route.ts` resolves an owner-bound
chart context and validates the matching birth profile/date before requesting AI.

The chart-specific prompt retains the initial interpretation framework, without
duplicating its response examples or narration request. It adds:

- Natal placements, houses/angles for known time, computed aspects and orbs.
- Dated transit-to-natal relationships over all four horizons.
- An explicit computed aspect-statement index, with natal/current-sky/transiting
  roles and exact orbs kept separate. The model is instructed to use only these
  named relationships and not derive aspects from sign names.
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

Chart interpretation uses a forced `emit_chart_reading` function call on the
provider's strict-schema endpoint. The function is only an output contract; it
does not execute tools or access external data. Server validation still enforces
the sixteen unique domain/timeframe pairs, eight planet IDs and text bounds.
The established `jsonrepair` parser can recover syntax errors such as an extra
closing delimiter. It does not supply interpretation prose; all required fields
and section pairs still have to pass validation. Truncated completions and
incomplete interpretations return a retryable error without replacing a previous
reading. No generic chart interpretation is saved.

## Audio And Zeus

`src/lib/readingAudio.ts` defines narration instructions and a complete fallback
adaptation. Enhanced narration includes every birth-chart section, synthesis and
reflection. A new reading invalidates previous playback and signed scripts.

Zeus has a separate conversational prompt in `server/agent-context.mjs`, with
`buildPrompt` and read-only functions for sky, natal chart, transits, lunar phase,
reading and previously generated birth-chart interpretation. Its live model is
independent of the written-reading model.

## Model Parameters

Written calls default to `deepseek-v4-pro`, output token limit `12288` and thinking
disabled. Initial sky readings retain temperature `0.85`, JSON-object response
format and model-written narration. Chart interpretations use temperature `0.35` and strict function
output instead; the server derives their complete narration from accepted text,
so the model does not need to duplicate the reading in an `audioScript`. Timeout defaults to
120 seconds and is configurable up to 180 seconds. Provider keys and model
configuration remain server-side. Change tone and emphasis in the two source
prompts while retaining the schema, uncertainty and computation constraints.

Strict-schema behavior and supported constraints are documented in
[DeepSeek's tool-call guide](https://api-docs.deepseek.com/guides/tool_calls/).
