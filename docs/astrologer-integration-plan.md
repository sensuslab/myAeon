# Astrologer-API Integration Plan

Status: implementation completed on the development branch. See [Astrologer integration](./astrologer-integration.md) for implemented behavior, configuration and deployment checks. Hosted calls remain opt-in; live subscription validation requires the deployment key. The user-selected allowance is five total attempts per anonymous browser identity, shared across reading and voice. London, UK / Europe/London are the defaults.

## Product Outcome

Give written readings and Zeus the same computed astrological facts, rather than asking either model to infer a natal chart from a birthday. A confirmed birthplace and local birth time enable natal Moon placements, Ascendant, houses and genuine transit-to-natal aspects. Selected future dates provide calculated positions and symbolic upcoming themes, not guaranteed predictions.

Keep the existing planetary visualization, reading JSON, PDF, listening controls and mobile flows. DeepSeek remains the written-reading provider. Zeus remains Deepgram Voice Agent with managed OpenAI GPT 6 Luna, reasoning disabled for compatible function calls, and Aura 2 Hyperion voice.

## Hosted Service Contract

Use the hosted RapidAPI service, not a self-hosted copy of the source repository. Confirm the user's subscription and v6 endpoint availability before implementation. Hosted usage and self-hosted source licensing have different terms; review the applicable provider agreement before release.

- Base: `https://astrologer.p.rapidapi.com/api/v6`.
- All listed endpoints use POST JSON, including current-time endpoints.
- Server-only secret: `ASTROLOGER_API_KEY`; headers `X-RapidAPI-Key`, `X-RapidAPI-Host: astrologer.p.rapidapi.com`, `Content-Type: application/json`.
- Require HTTP 200, response `status: "OK"`, and a valid nonempty feature payload.
- `/chart-data/birth-chart`: structured natal `chart_data`.
- `/chart-data/transit`: structured natal/transit data; request `first_subject` and `transit_subject`. Do not confuse request names with response aliases.
- `/now/subject`: current UTC Greenwich subject; do not present its houses as the user's local houses.
- `/moon-phase` or `/moon-phase/now-utc`: optional lunar context.
- `/context/birth-chart` and `/context/transit`: alternatives supplying XML plus data when useful; not separate generated interpretations.
- `/chart/birth-chart`: optional SVG for a later chart/PDF enhancement, requested only when needed.

No published hosted batch or event-search routes should be assumed. Verify each endpoint against the v6 playground schema; extra fields are rejected. Computed response subjects require mapping before reuse as request subjects. Use precomputed chart data only on endpoints explicitly supporting it.

## Birth Details And Accuracy

1. Preserve time of birth and add an explicit known / estimated / unknown choice. The existing default noon value must not count as confirmed knowledge.
2. Resolve birthplace to a selected geographic entity, latitude, longitude and historical IANA timezone. Ambiguous city names require a choice. Complete coordinates and timezone avoid repeated provider GeoNames lookups; GeoNames lookup is an alternative with the required account configuration.
3. Send recorded local wall-clock birth time with that timezone. Do not first convert to UTC and then attach the original timezone. Validate historical daylight saving, ambiguous times and nonexistent local times.
4. With unknown time or unresolved location, retain a clearly limited reading. Do not invent noon, houses, Ascendant or exact natal Moon/aspects. Date-only sign boundaries can also be uncertain; disclose that limitation.
5. Default to tropical zodiac, apparent geocentric positions and explicit Placidus settings. Do not silently change house systems at polar latitudes; ask for or document an alternative when Placidus is unavailable.
6. Confirm birth details for Zeus separately from generating a reading. Unsubmitted default form values must never become a claimed natal profile.

## Shared Context Architecture

Create a server-side adapter with validated input/output and a common `AstrologyContext`. Include source/version, computation timestamp, target instant/timezone, settings, birth-data confidence, planetary longitudes/sign/degrees, optional actual returned retrograde flags, optional angles/houses, computed aspects and orbs, optional lunar data, and limitations.

The same context ID and normalized facts should support the reading prompt, Zeus functions and PDF metadata. Browser references must be opaque and server-owned or signed; do not trust client-supplied claims of verified chart data. Keep chart facts separate from user text and model instructions.

The 3D scene is a heliocentric visualization. Written and conversational interpretations must use geocentric astrology. Replace any current heliocentric-to-birthday-Sun comparisons with genuine geocentric transit-to-natal aspects. Earth is not an ordinary geocentric natal planet: retain its existing reflective UI note without fabricating a natal Earth placement.

## Written Reading Pipeline

Confirmed profile -> cached natal chart -> selected-date transit snapshots -> validated common context -> compact evidence-rich user prompt -> existing DeepSeek reading generation and recovery logic.

For Today, 3 Days, Week and Month, compute explicitly dated anchors at the selected instant and +3, +7 and +30 days. These are snapshots, not a searched timeline of exact peaks, stations or ingress events. Do not interpolate an exact event date unless a separate validated calculation supports it.

Prioritize tight personal-planet aspects, Sun/Moon/Ascendant and relevant houses when actually available. Map relationship themes to appropriate Venus/Moon/relationship evidence, work to relevant Mars/Saturn/MC evidence, energy to symbolic vitality/rest themes, and inner life to emotional patterns. Avoid medical diagnosis, deterministic outcomes or generic lists of every aspect.

Preserve `ReadingPayload` and current section/planet insight fields initially. Include confidence and context provenance in server metadata; only add optional response fields with backward-compatible validation. A missing natal chart must reduce the scope of the reading, not silently produce a fabricated full-chart interpretation.

## Zeus Pipeline And Functions

Prepare fresh selected-date sky context at every conversation start, whether or not a reading exists. Add confirmed natal facts and the current generated reading when available. A small initial context primer should state the date, frame, confidence and a few relevant placements; retrieve detailed information on demand.

Retain `get_sky` and `get_reading`; add bounded read-only functions:

- `get_natal_chart`: confirmed profile facts, placements and limitations.
- `get_transits`: an allowed date or a bounded maximum of four requested snapshots; genuine natal/transit aspects.
- `get_moon_phase`: supported lunar data for a requested date/location.

Zeus should distinguish natal placements from transits, dates from exact event times, and missing information from facts. He can explain theory without making a provider call. He must not claim to see a user's Ascendant before confirmed birth details are available.

Refresh the session context when the selected date, confirmed profile or reading changes. Preserve the Zeus base prompt when updating context. Handle asynchronous function cancellation and disconnects without replying into an ended session. Never pass the Astrologer key to the browser or model.

## Latency, Quotas And Failure Handling

- Reuse one natal result across reading horizons and voice functions. A full four-horizon cold reading has an initial budget of one natal plus four transit requests; actual billing depends on the subscribed plan and endpoint contract.
- Share a short-lived public sky cache keyed by timestamp bucket and computation settings, approximately five minutes. Do not equate a cached noon snapshot with the entire day.
- Keep private profile/chart caches bounded and ephemeral by default. Use HMAC-derived keys rather than raw birth details in logs or cache identifiers. Longer private caching requires an explicit retention decision.
- Deduplicate concurrent identical work. Invalidate on profile/settings/API-version changes; never cache failures as valid charts.
- Start voice promptly from available validated context. If provider enrichment is unavailable, disclose the limited local geocentric sky context; do not pretend full-chart tools succeeded.
- Suggested external-call budget: 8-10 seconds per request, bounded total preparation time, with cancellation. Confirm those budgets against measured provider behavior.
- Limit voice tool calls and concurrency per session and enforce application-level rate/usage caps. Revisit limits before enabling anonymous paid API access broadly.
- Treat 401/403 as configuration/subscription issues and 422 as invalid input. For 429/503, respect `Retry-After` with at most one retry within the overall budget. Do not blindly repeat timed-out billable requests.
- Use a feature flag such as `ASTROLOGER_ENABLED`. Failure may fall back to clearly labelled local sky data, never invented natal houses or aspects.

## Privacy And Security

Explain that confirmed birth information is processed by the hosted astrology provider, and voice context by Deepgram and its managed model provider. Application non-storage is not a promise about provider retention. Do not log raw profiles, XML, audio, transcripts, tokens or API responses containing personal data.

Allowlist provider hosts/routes and validate every function argument. Treat XML as data, disable external entities/DTDs when parsing, and keep it outside instruction boundaries. Sanitize any future SVG and render it safely; never directly insert untrusted SVG markup into the application. No extra PDF/chart implementation is needed in this phase.

## Verification And Rollout

1. **Contract check:** key/subscription confirmation, synthetic subject request, fixtures captured without real birth information, quota and terms review.
2. **Shared data and written readings:** profile confidence/timezone handling, adapter, caching, four horizon snapshots, evidence-grounded prompt, existing reading response compatibility.
3. **Zeus enrichment:** fresh initial context without a reading, natal/transit/lunar tools, refresh/cancellation, bounded latency and call budgets.
4. **Optional expansion:** chart SVG in UI/PDF, returns, dominant analysis, and consent-based two-person synastry. Compatibility scores are not probabilities of relationship success.

Test known/unknown/estimated birth time, historical DST, ambiguous cities, zero coordinates, sign boundaries, polar house behavior, future-date anchors, malformed successful responses, auth/quota/timeouts and cancellation. Verify reading/Zeus/PDF consistency, no key in browser assets or logs, and that no full natal claims appear in fallback mode. Measure cold/warm provider latency and total costs before enabling broadly.

## Decisions Before Implementation

Confirm v6 subscription/key type, the location/timezone provider, retention policy and quota ceiling. Recommended initial defaults: hosted service, tropical apparent geocentric calculations, explicit Placidus, no invented unknown birth times, ephemeral private caching, and shared facts for reading and Zeus.

References: [v6 API README](https://github.com/g-battaglia/Astrologer-API/blob/v6/README.md), [v6 playground](https://rapidapi.com/gbattaglia/api/astrologer/playground/), [subscription](https://www.kerykeion.net/astrologer-api/subscribe).
