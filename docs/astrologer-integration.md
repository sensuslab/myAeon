# Astrologer v6 integration

> Historical record, superseded on 10 October 2026. The active implementation
> uses the self-hosted Kerykeion core without hosted chart calls or generation
> quotas. Do not apply the old configuration below to the current release.
> See [the current implementation plan](./kerykeion-core-plan.md) and README.

Implemented from `docs/astrologer-integration-plan.md`. The hosted provider is opt-in. Live subscription/schema validation remains a deployment check: no real API key was supplied during development, and all provider verification used synthetic data.

## Enable on Railway

Keep the existing DeepSeek and Deepgram variables. Add these server-only variables:

```dotenv
ASTROLOGER_ENABLED=true
ASTROLOGER_API_KEY=<your RapidAPI Astrologer subscription key>
ASTROLOGY_SESSION_SECRET=<stable random secret of at least 32 characters>
ASTROLOGY_QUOTA_DIR=/data/astrology-quota
```

Mount a **persistent volume** at `/data`. The quota path must be absolute and persistent across deployments. Missing configuration or an unreadable ledger prevents paid enrichment. Do not set any `NEXT_PUBLIC_` key. Keep the signing secret unchanged: rotating it invalidates anonymous identity signatures and private HMAC cache keys.

This release uses the existing single-service Node 20 Railway runtime. The quota ledger uses atomic per-user directory locks and atomic counter replacement on disk. Do not run independent replicas with separate quota volumes. An abnormal process exit can leave a lock directory; inspect the associated ledger and remove only that stale lock while the service is stopped. Never delete the ledger to recover a lock.

Before enabling paid usage, use a synthetic London profile to validate your subscribed hosted v6 endpoints. The source request models were checked, but source availability does not prove your hosted subscription exposes the same schema. Check cold/warm latency and your provider's billing/retention terms. Each provider attempt is bounded to nine seconds and is never automatically retried.

## User flow

1. Enter a birth date. No birthday or noon birth time is prefilled as personal knowledge.
2. Select Known / recorded, Estimated or Unknown. Known and Estimated require the recorded local wall-clock time. Unknown supplies no natal Moon, houses, angles or exact natal aspects.
3. London, UK (`51.5074`, `-0.1278`, `Europe/London`) is the default birthplace. Confirm it explicitly. Another location requires an exact city, country code, coordinates and IANA timezone; there is no silent city-name geocoding. Historical DST gaps are rejected and repeated times require an earlier/later choice. A response with a different UTC instant/location is rejected.
4. Check the birth-details/provider-processing consent. **Confirm birth details for Zeus** registers a server-owned profile without making a hosted call. The profile can be used in voice before a written reading exists.
5. **Cast my reading** uses the confirmed profile when consent is checked. With consent unchecked, the reading remains limited to local geocentric sky facts and a date-only Sun-sign theme.
6. The reading shows its source, birth-time confidence, calculated natal summary, limitations and remaining allowance. Its provenance can be expanded. Visual planet positions are labelled heliocentric; reading placements are geocentric. Earth's note is reflective only.
7. **Talk to Zeus** shares the reading context when its owner/profile/date match; otherwise it prepares fresh selected-date context. Profile/date/reading changes update the prompt without replacing Zeus's base instructions.
8. The six-step, first-visit walkthrough covers these controls, data confidence, quotas, voice, downloads and processing. Existing users see the new walkthrough once, and can reopen it from the header.

Sky/transit snapshots always use London and `Europe/London`, even when the birthplace is elsewhere. Horizons are selected date and +3/+7/+30 calendar days, each at **12:00 London local time**. They do not imply exact peaks, ingress times, stations or a searched event timeline.

## Five calls per user

The hard cap is **five total hosted provider attempts**, shared across readings and voice. There is no daily reset and no override above five. A cold four-horizon reading uses one natal request plus four transit requests. A voice session with a confirmed profile but no reading typically uses two calls (natal + selected-date transit), leaving three for the other horizons.

myAeon currently has no account login. “User” therefore means a **signed anonymous browser identity** stored in an HttpOnly, SameSite=Strict cookie (Secure in production). This persists across normal reloads. Clearing cookies or changing browser creates another identity; it is not an account-level or person-level anti-abuse guarantee. True cross-device/person limits require authenticated account IDs before broader paid anonymous access.

Reservations are written before dispatch, so errors, malformed responses, timeouts and aborted dispatched work still count. The quota file contains only a count; filenames are HMACs, never raw birth information. Concurrent requests cannot reserve a sixth call. Cached charts are read before the quota gate, so exhaustion does not block warm chart reuse. Identical concurrent requests are deduplicated.

Private profiles, normalized results and contexts are bounded to 500 entries per store and expire after one hour. They are in memory and disappear on restart; only anonymous usage counts persist. After cache expiry or restart, an exhausted user receives clearly limited local sky facts. The cookie lasts one year; no claims are made about provider retention.

## Shared facts and providers

- `server/astrology-input.mjs`: strict profiles, London defaults, IANA local-time validation and horizon anchors.
- `server/astrology-quota.mjs`: signed identity, HMAC keys and atomic durable quota.
- `server/astrology.mjs`: allowlisted hosted requests, settings/time/location/output validation, normalized facts, caching, owner-bound opaque profile/context IDs and fallback.
- `server/sky.mjs`: local geocentric Sun/Moon/planet positions, sky aspects and Moon phase; no paid call.
- `POST /api/astrology/profile`: consented profile registration. `GET` reports configuration/allowance without a hosted call.
- `POST /api/reading`: validated shared facts → existing DeepSeek JSON generation/recovery → existing reading shape, with optional `meta.astrology`.
- `POST /api/reading/pdf`: resolves the owner-bound context before adding source, settings, confidence, anchor dates and limitations. An expired/unverifiable context is labelled; no paid call is made by PDF export.

Hosted routes are only `/chart-data/birth-chart` and `/chart-data/transit` at `https://astrologer.p.rapidapi.com/api/v6`, POST JSON with server-only RapidAPI headers. Request `transit_subject` is mapped from confirmed input; response `second_subject` is normalized as the transit ring. Settings are explicitly Tropical / Apparent Geocentric / Placidus. Polar births are limited; no house-system substitution is accepted.

Major natal and transit-to-natal aspects are calculated from validated longitudes, with a six-degree maximum orb. Returned retrograde flags are included only when actually supplied. Known times can include returned angles and houses; Estimated omits both, and marks placements/aspects approximate. Local fallback has no natal aspects. No provider XML/SVG is requested or inserted.

## Zeus functions

Zeus retains Deepgram Voice Agent, managed `gpt-6-luna` with reasoning disabled, and `aura-2-hyperion-en`. DeepSeek remains the written-reading model.

| Function | Behavior | Hosted usage |
| --- | --- | --- |
| `get_sky` | Actual current instant, or a validated London-noon date; geocentric local sky | None |
| `get_reading` | Existing sections, insights and metadata; untrusted interpretation text | None |
| `get_natal_chart` | Available validated natal facts, confidence and limits | Cached session facts |
| `get_transits` | Up to four allowed horizons; actual natal/transit aspects when verified | Only missing eligible snapshots |
| `get_moon_phase` | Locally computed phase angle, illumination and named phase | None |

Arguments reject extra fields, unsupported dates and more than four snapshots. Voice sessions allow at most 24 tool calls and two concurrent batches. Context refresh/disconnect cancels pending work and prevents stale responses being sent into a changed or ended session. Theory discussions do not require provider tools. The Astrologer secret is never passed to the browser or any model.

## Verification

```bash
npm test
npx tsc --noEmit
npm run build
```

The integration suite covers known/estimated/unknown time, London historical DST gaps/overlaps, zero coordinates, date bounds, polar limitations, signed identities, durable concurrent quota, deduplication, cache/owner isolation, malformed successes, incompatible frames, missing Moon, auth/input/rate/provider failures, cancellation, bounded Zeus functions, reading evidence and PDF export. Existing audio/streaming/mobile-action/voice tests remain part of `npm test`.

Development verification uses synthetic provider data, never a real person's chart. A deployment smoke test with the configured subscription is still required; it should verify API responses and actual Deepgram voice function dispatch without making automatic retries.

References: [Astrologer v6 README](https://github.com/g-battaglia/Astrologer-API/blob/v6/README.md), [request models](https://github.com/g-battaglia/Astrologer-API/blob/v6/types/request_core.py), [hosted playground](https://rapidapi.com/gbattaglia/api/astrologer/playground/).
> Historical implementation notes: the hosted RapidAPI integration and its
> five-call ledger have been replaced by the self-hosted Kerykeion core.
> Use [kerykeion-core-plan.md](./kerykeion-core-plan.md) and the root README
> for current deployment instructions. These notes describe the previous release.
