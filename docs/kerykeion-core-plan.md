# myAeon: Self-Hosted Chart Core

Date: 10 October 2026
Status: implemented; final production verification and deployment in progress.

## Objectives

Replace paid RapidAPI chart requests with offline Kerykeion calculations as a core component. Remove the five-call lifetime quota. Keep the solar-system experience and its Today / 3 Days / Week / Month readings; add a birth-chart view, generated chart wheels and an optional AI enhancement. Carry the enhancement into the PDF, spoken overview and Zeus context. Keep service names out of routine app controls and disclose processing accurately in a separate privacy policy.

## Architecture

Use one Railway container containing Node/Next and a pinned Python 3.12+ Kerykeion runtime. Node dispatches bounded, cancellable JSON jobs to a local Python worker through stdin/stdout, never through a public chart endpoint. Subjects use explicit coordinates, IANA timezone, local birth time and `online=False`; no GeoNames or RapidAPI call is made. Chart output remains temporary, private server memory with bounded caches and expiration. No raw birth data, chart markup or transcript is written to logs.

Pin Kerykeion 6.0.2 and Swiss Ephemeris 2.10.3.2. Use the reproducible offline Moshier backend, which requires no ephemeris-file download. Validate returned positions, backend flags, frame and time. Keep explicit unknown/estimated birth-time handling: no fabricated Ascendant, houses or exact natal facts. Preserve DST checks and document effective house-system limitations, including polar births.

Keep private owner-bound profile/context IDs and the signed HttpOnly identity cookie, but remove persistent paid-call accounting and all lifetime/daily generation quotas. Bounded concurrency, input sizes, timeouts and memory are infrastructure safety controls, not usage allowances. Preserve the signing secret across deployments. Do not delete the existing storage ledger or rotate secrets as part of migration.

## Reading Flow

1. The user enters birth date, optional name, birth-time confidence/time, birthplace and selected sky date.
2. Cast reading starts the existing four-horizon AI reading. Confirmed eligible birth details also start local natal/transit chart generation in parallel, without blocking the initial reading.
3. Both jobs have independent loading/error states. A chart failure must not discard a successful sky reading; a reading failure must not discard a successful chart.
4. The user selects **Enhance with my birth chart**. The server resolves the private computed context and combines natal placements, houses/angles when reliable, aspects, transit evidence and the current reading in an explicit enhancement prompt.
5. The response preserves the established reading sections and adds a separate birth-chart interpretation and synthesis. New audio narration includes that insight; previous audio is stopped/invalidated. PDF and Zeus receive the same updated interpretation.
6. From Birth Chart view, **Interpret birth chart** also works before a sky reading exists. It returns the same compatible reading/enhancement shape and can later be combined with the current reading.

The SVG is a visual representation, not a source from which the text model must guess astronomy. Send validated structured data and bounded library-generated semantic chart context to DeepSeek. Do not claim image/vision support or attach SVG as an unsupported image modality. The displayed SVG and prompt facts must originate from the same calculation.

## Two Views

Provide a clear **Solar system / Birth chart** segmented control on desktop and mobile. Initial view remains the existing planet-first experience. Reading-only mode and its persistent Talk to Zeus action remain available.

Birth Chart displays Kerykeion's SVG wheel in a full-bleed Three.js scene, mapped onto a readable high-resolution surface. Allow orbit/tilt and reset plus a flat presentation for inspection. Natal / Transits controls switch chart wheels from the same context. Show reliable Sun, Moon, Ascendant and key placements in a compact inspector; label uncertainty once without overwhelming the experience. Keep touch targets, mobile safe areas and the pinned Cast reading footer.

Expose original SVG download and use the same chart source for the designed PDF. Loading, missing birth details, estimated/unknown time and failed computation have useful recoverable states. Avoid rendering untrusted arbitrary SVG as HTML; use restricted image/texture rendering and server-owned generated SVGs.

## Shared Outputs

- **PDF:** retain the complete existing reading; append a Birth Chart section with wheel(s), placement/aspect evidence, uncertainty and the AI interpretation/synthesis when available. Charts without AI interpretation are still exportable as computed output. Resolve chart content by owner-bound context ID, never trust browser-supplied chart provenance.
- **Audio:** regenerate the signed narration input after enhancement so Listen and Generate Download include the new interpretation; no automatic audio call or playback.
- **Zeus:** fresh computed sky and eligible natal context at every start, reading/enhancement supplied when available. Update context after successful enhancement. Extend validated conversation reading fields and retrieval functions so birth-chart interpretations are not stripped. Preserve GPT 6 Luna and Hyperion voice configuration.

## Privacy And Licensing

Remove provider-branded explanation from routine controls, status panels and voice footer. Keep clear consent and concise functional limitations. Publish `/privacy` with the actual providers, what each receives, temporary storage, cookies/preferences, logging limitations, user-requested audio processing and exports. Link it from the UI rather than repeating provider lists.

Kerykeion is AGPL-3.0; non-commercial use is not a blanket exemption from its network/distribution obligations. Retain upstream notices and document the library/backend licenses and exact versions. Provide the deployed application source link in the policy/about surface. Before a public/proprietary release, assess AGPL-compatible source obligations, a commercial license or switching chart calculation to the hosted paid API. Paying an API subscription later does not retroactively change the license of self-hosted code. This is an engineering compliance note, not legal advice.

AI, speech and Railway compute still have costs. Removing chart API quotas does not imply those services are free or require publishing an unauthenticated unlimited AI endpoint. Preserve request validation and transport security while removing the chart generation cap.

## Implementation Order

1. Verify library release/API/backend and baseline Git version; install reproducible runtime.
2. Replace the chart adapter and quota dependency; add local natal/transit SVG and structured-context generation.
3. Add chart retrieval and interpretation/enhancement routes with strict input/output validation, owner binding and cancellation.
4. Add the two-view UI, chart scene, actions and independent asynchronous flow.
5. Extend PDF, narration and Zeus context; add privacy policy and update walkthrough.
6. Run local Python calculations, Node tests, production build and synthetic end-to-end checks. Inspect desktop/mobile dark/light screenshots, chart texture pixels and touch interactions; verify no stale chart is used after profile/date changes.
7. Push verified changes to GitHub; deploy the combined runtime to Railway; confirm live local charts, AI enhancement, PDF and conversation context. Retain existing secrets but ensure no RapidAPI request is made.

## Acceptance Checks

- No lifetime/daily chart quota or RapidAPI dependence in the active path.
- Recorded birth time remains available and is interpreted in the correct timezone.
- Original sky reading survives independent chart failure.
- Birth-chart SVG is readable and nonblank in 3D and flat presentations on phones and desktop.
- Enhancement uses the matching profile/date/context and does not invent missing angles/houses.
- PDF contains computed chart output plus full enhancement text; narration includes added insights.
- Zeus can retrieve both chart facts and the generated birth-chart interpretation.
- Normal UI text has no service-brand disclosures; policy contains truthful disclosures.
- No provider secrets in Git, browser assets, screenshots or logs.
- Railway reports healthy operation with the Python worker and pinned dependency installed.

References: https://github.com/g-battaglia/kerykeion and its LICENSE, LICENSING.md, v6 API documentation and chart drawing examples.

## Implementation And Verification Record

The implementation uses a single Node 22 / Python 3.12 Docker image, an offline child-process worker, owner-bound one-hour chart caches, four transit horizons, transparent natal/transit SVGs, explicit interpretation requests and a new Birth Chart view. Recorded local birth time and UTC calculation instants remain distinct in both interpretation and Zeus prompts. Failed optional interpretations leave the previous reading unchanged.

Synthetic end-to-end checks verified:

The final regression run passed 79 tests, with its opt-in live endpoint test run separately and passed against the production build. The production build includes TypeScript and lint checks. PDF pages were rendered and visually inspected, including long interpretation pagination and the final synthesis/reflection.

- Local natal calculation, ten natal bodies, twelve reliable houses and four transit snapshots; an observed chart request completed in about 0.8 seconds.
- A real initial DeepSeek reading, a separate real chart enhancement, all sixteen reading sections and complete enhanced narration.
- Designed PDF export before and after enhancement, with vector natal/transit wheels, calculation evidence, all reading sections and added interpretation.
- Nonblank chart canvases at 320px and 390px mobile widths and 1440px desktop width in both themes; tilt/drag, reset, flat mode and original SVG download.
- Real streaming narration audio arriving in about 0.95 seconds in one smoke test. This is an observed result, not a latency guarantee.
- A real Zeus session introducing himself correctly and retrieving the synthetic Sun, Ascendant and saved chart-interpretation title.
- Isolation between owners, profile/date invalidation, unknown/estimated-time restrictions, DST folds/gaps, expired context recovery, cancellation, bounded worker failure and more than 24 sequential voice function calls without a lifetime quota.

### Deployment Safety Notes

The existing Next 14 / React 18 stack has upstream dependency advisories requiring a separate framework-major migration. Compatible transitive patches were applied; the unused image-optimizer and Server Actions endpoints are blocked, production unknown WebSocket upgrades are rejected, and the Docker runtime uses a non-root user. These mitigations are not a claim that every dependency advisory is resolved. Keep this deployment private while exploring, and upgrade the framework before broader availability.

Charts no longer incur hosted astrology API charges or chart-generation quotas. Written AI, speech, voice-agent and hosting charges still apply. Queue/concurrency, payload, transport, timeout and cache bounds remain to protect the application process.
