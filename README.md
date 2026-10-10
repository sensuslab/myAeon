# myAeon

An interactive solar system, personal birth-chart workspace and reflective
astrological readings. The solar display uses heliocentric geometry; birth charts
and the facts used in readings are geocentric, tropical and Placidus. Astrology
is a reflective practice, not deterministic prediction.

## Experience

- Live or selected-date solar system, flat/3D views and planet insights.
- Locally calculated natal and transit wheels, rendered as SVG textures in 3D.
- Birth date, time, time confidence, confirmed coordinates and IANA timezone.
- Today, three-day, weekly and monthly readings across four life domains.
- Optional birth-chart interpretation, standalone or enhancing a reading.
- Designed PDF with all reading sections, planetary reflections and chart pages.
- Streamed listening, downloadable narration and additional birth-chart insight.
- Talk to Zeus using fresh sky, confirmed facts and generated interpretation.
- Mobile reading drawer, reading-only view, light/dark themes and first-use tour.
- Separate privacy policy; no provider branding in routine controls.

## Architecture

Next.js and the custom Node server run beside an offline Python worker in one
Docker container. Kerykeion 6.0.2 with the Swiss Ephemeris Moshier backend computes
charts without RapidAPI, GeoNames or ephemeris downloads. No chart key, hosted
subscription, five-call allowance or persistent quota ledger is used.

Signed anonymous browser identities bind profiles, charts and enhanced readings
to their owner. These are temporary in-memory caches, not an account database;
they expire and are lost on deployment/restart. One Railway replica is required
until context and WebSocket tickets move to shared storage.

The initial reading and chart preparation run independently after birth details
are confirmed. Chart interpretation is an explicit action, not an automatic
extra AI request. It sends structured facts and bounded semantic chart context,
**not SVG markup or unsupported vision input**, to DeepSeek. SVGs are retained for
visualization, download and PDF. Zeus receives facts and generated text through
read-only server functions.

## Local Development

Requires Node.js 22 and Python 3.12 or later.

```bash
npm ci
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env.local
npm run dev
```

Set `ASTROLOGY_SESSION_SECRET` to a stable random value of at least 32 characters.
Set `DEEPSEEK_API_KEY` for written interpretation and `DEEPGRAM_API_KEY` for
listening and Zeus. Keys remain
server-side. Open http://localhost:3000.

The worker auto-detects `.venv/bin/python`; override with `ASTROLOGY_PYTHON` for
another environment. Coordinates/timezone are entered or explicitly confirmed;
no network geocoding is performed. Estimated times omit houses and angles.
Unknown times do not invent a natal chart.

## Deployment

Railway builds the Dockerfile with both runtimes and pinned Python dependencies.
Keep the existing AI keys and stable `ASTROLOGY_SESSION_SECRET`. Old
`ASTROLOGER_*` and `ASTROLOGY_QUOTA_DIR` variables are ignored. Do not rotate the
session secret during migration.

```bash
railway up --detach -m "Deploy myAeon local chart core"
```

The custom server listens on Railway's `PORT`. `/api/reading` reports reading
configuration and `/api/astrology/profile` reports chart availability. Smoke-test
actual calculation using a confirmed synthetic profile. Concurrency, payload,
queue and timeout bounds protect the process; no daily/lifetime chart quota
applies. Written AI and voice calls still incur their providers' normal costs.

## API Flow

1. `POST /api/astrology/profile` confirms details and returns an opaque ID.
2. `POST /api/reading` produces the initial sky reading independently of natal work.
3. `POST /api/astrology/chart` with `{profileId, readingDate}` prepares local
   natal/transit facts and theme-specific SVGs in temporary memory.
4. `POST /api/reading/enhance` with `{contextId, reading?}` produces a complete
   reading with a `birthChart` section and saves it against the owned context.
   Omit `reading` for standalone interpretation.
5. PDF and audio use the current reading. PDF SVGs come from owned server context,
   never client-submitted markup.
6. Zeus hydrates fresh facts and the saved interpretation at session open/refresh.

## Verification

```bash
npm test
npx tsc --noEmit
npm run build
```

Worker tests use the installed Python runtime; mocked tests cover owner isolation,
temporary storage, cancellation and no quota. Browser checks cover both scenes,
mobile controls, themes and chart rendering. Paid live checks require keys.

## Documentation

- [Implementation plan](docs/kerykeion-core-plan.md)
- [Reading prompt](docs/reading-prompt.md)
- [Voice agent and tools](docs/voice-agent.md)
- [Reading audio](docs/reading-audio.md)
- [Product info sheet](docs/myAeon-product-info-sheet.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

## Licensing

Application source is published above; this notice does not relicense it.
Kerykeion and its calculation backend carry separate upstream licenses; review
the notices and application licensing before distribution
or network availability. Non-commercial use does not automatically remove AGPL
source obligations. Switching to a paid hosted service later does not resolve
obligations of earlier self-hosted releases. This is a technical notice, not legal
advice.
