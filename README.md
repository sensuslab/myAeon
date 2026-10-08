# Aeon — Cosmic Astrological Guide

A premium full-screen 3D **live solar system** with the Sun as the only light source and the eight planets in their real heliocentric positions, combined with an AI-powered astrological reading. Built with **Next.js 14 (App Router)**, **React Three Fiber**, and the **DeepSeek V4 Pro** language model.

> The planets aren't a metaphor. Their angles are computed live by `astronomy-engine` for the current moment. Your reading then uses those same angles — plus your birth date — to write a personalized reflection.

![aeon preview](https://placehold.co/1200x600/040414/d4a437?text=AEON+%E2%80%94+LIVE+SOLAR+SYSTEM+%2B+AI+READINGS)

---

## ✨ What's on screen

- **Live 3D solar system** — Sun at center, eight planets (Mercury → Neptune), each lit only on its sun-facing side. Saturn has its rings.
- **Real orbital positions** — every planet's angle is computed by the `astronomy-engine` library from the current UTC time. The scene is a faithful snapshot of the real solar system.
- **Hover tooltips** — name + archetype + the zodiac sign each planet is currently transiting.
- **Bottom planet-info bar** — every planet's current zodiac sign + degree, updated live.
- **Flat ↔ 3D toggle** — flatten the system onto the camera plane for a top-down map view, or rotate freely in 3D.
- **Persistent left panel** — birth-data form, sun sign auto-detected from your date.
- **Persistent right panel** — your reading, with tabs for **Today / 3 Days / Week / Month** across **Love / Purpose / Body / Inner World**.
- **"How This Works" modal** — full transparency on what the AI does and doesn't claim.
- **Listen to reading** — a separate spoken adaptation is included in every AI reading. Choose Listen to generate audio, then pause, seek, change speed, replay or download it on desktop and mobile.

---

## 🚀 Deploy to Railway (one-click)

This repo ships with `railway.json` + `nixpacks.toml` so Railway auto-detects it as a Next.js project.

### Option A — Deploy from GitHub (recommended)

```bash
git init
git add .
git commit -m "feat: aeon initial commit"
git branch -M main
git remote add origin git@github.com:YOUR_USERNAME/aeon.git
git push -u origin main
```

Then on Railway:
1. **New Project → Deploy from GitHub repo → pick `aeon`**
2. **Variables tab → add** `DEEPSEEK_API_KEY = <your key>` (get one from the [DeepSeek platform](https://platform.deepseek.com/))
   - Optional overrides:
     - `DEEPSEEK_MODEL` (default `deepseek-v4-pro`)
     - `DEEPSEEK_API_BASE` (default `https://api.deepseek.com`)
     - `DEEPSEEK_TIMEOUT_MS` (default `120000`)
   - To enable listening, add server-side `DEEPGRAM_API_KEY`, `DEEPGRAM_MODEL=aura-2`, and `DEEPGRAM_VOICE=thalia-en`. Audio is generated only when the listener requests it. See [reading audio setup](docs/reading-audio.md).
3. **Settings → Networking → Generate Domain**

### Option B — Railway CLI

```bash
npm i -g @railway/cli
railway login
railway init
railway up
railway variables set DEEPSEEK_API_KEY=your_key_here
railway domain
```

See the `use-railway` skill for the full CLI/MCP workflow: [`npx skills add railwayapp/railway-skills`](https://www.skills.sh/railwayapp/railway-skills/use-railway).

---

## 🛠 Local development

Requires Node 18+ (Node 20 recommended — that's what Railway uses).

```bash
npm install
cp .env.example .env.local        # then paste your DEEPSEEK_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Health check

```bash
curl http://localhost:3000/api/reading
```

Returns the configured model + whether the key is set:

```json
{ "service": "aeon-reading", "provider": "deepseek", "model": "deepseek-v4-pro", "configured": false, ... }
```

---

## 🧱 Stack

| Layer        | Tech                                                  |
| ------------ | ----------------------------------------------------- |
| Framework    | Next.js 14 (App Router) + React 18 + TypeScript       |
| 3D           | three.js + @react-three/fiber + @react-three/drei     |
| Astronomy    | astronomy-engine (live planetary positions)           |
| UI motion    | framer-motion                                         |
| AI           | DeepSeek `deepseek-v4-pro` via `https://api.deepseek.com` |
| Styling      | Tailwind CSS v3                                       |
| Deploy       | Railway (Nixpacks)                                    |

---

## 📁 Project structure

```
src/
├── app/
│   ├── api/reading/route.ts    ← POST endpoint that calls DeepSeek
│   ├── layout.tsx
│   ├── page.tsx                ← main scene + panels wiring
│   ├── globals.css
│   └── fonts/                  ← Geist (local)
├── components/
│   ├── scene/
│   │   ├── SceneCanvas.tsx     ← R3F Canvas root + camera
│   │   ├── SolarSystem.tsx     ← orchestrator
│   │   ├── Sun.tsx             ← emissive sun + point light
│   │   ├── Planet.tsx          ← single planet + hover
│   │   ├── PlanetOrbit.tsx     ← orbital ring
│   │   ├── Starfield.tsx       ← twinkling procedural stars
│   │   └── Nebula.tsx          ← soft color clouds
│   └── ui/
│       ├── AppHeader.tsx
│       ├── ControlPanel.tsx    ← left: birth data + view toggle
│       ├── ReadingPanel.tsx    ← right: tabs + reading output
│       ├── PlanetTooltip.tsx   ← hover popover
│       ├── PlanetInfoBar.tsx   ← bottom planet strip
│       ├── HowItWorksModal.tsx ← transparency modal
│       └── types.ts            ← shared ReadingPayload type
└── lib/
    └── zodiac.ts               ← planet data + astronomy-engine wrapper
```

---

## 🔐 Environment variables

| Variable            | Required | Default                          | Notes                                              |
| ------------------- | -------- | -------------------------------- | -------------------------------------------------- |
| `DEEPSEEK_API_KEY`   | ✅       | —                               | Server-side only. Never expose to the client.      |
| `DEEPSEEK_API_BASE`  | ❌       | `https://api.deepseek.com`      | Base URL for DeepSeek's OpenAI-compatible API.     |
| `DEEPSEEK_MODEL`     | ❌       | `deepseek-v4-pro`               | Model id sent in the request.                      |
| `DEEPSEEK_TIMEOUT_MS`| ❌       | `120000`                        | Request timeout, capped at 180000ms.               |
| `DEEPGRAM_API_KEY`   | For audio | —                              | Server-side Deepgram key; no `NEXT_PUBLIC_` prefix. |
| `DEEPGRAM_MODEL`     | ❌       | `aura-2`                       | Aura family, or a full voice model id such as `aura-2-thalia-en`. |
| `DEEPGRAM_VOICE`     | ❌       | `thalia-en`                    | Voice plus language; combined with the model family. Ignored when MODEL is a full id. |
| `DEEPGRAM_TIMEOUT_MS`| ❌       | `120000`                       | Overall audio generation timeout, capped at 180000ms. |

Railway automatically provides `PORT` and `HOSTNAME` — Next.js reads them natively.

---

## 🧠 How it works

### The 3D scene

`src/lib/zodiac.ts → computeSnapshot()` calls `astronomy-engine` to get each planet's heliocentric ecliptic longitude right now. Those longitudes become scene-space angles, so the planets are placed where they actually are.

The Sun component holds the only point light source — this means every planet has a true lit side and a true dark side, exactly like in space. There's a soft ambient at 0.15 intensity so the dark sides aren't pitch black.

### The AI integration

`src/app/api/reading/route.ts` accepts a POST with the user's birth date (and optional name/time/place). It:

1. Uses `astronomy-engine` again to compute the sun's geocentric ecliptic longitude at the user's birth → maps that to their sun sign.
2. Builds a system prompt that asks for 16 sections across four timeframes, eight planet insights, and a separate complete `audioScript` in strict JSON.
3. Calls `POST {DEEPSEEK_API_BASE}/chat/completions` with model `deepseek-v4-pro` by default, JSON output enabled, and thinking disabled for this strict JSON flow.
4. Parses the JSON, stripping code fences or reasoning tags if the model includes them.
5. Returns a structured payload to the client. With a Deepgram key configured, it includes a signed, 24-hour authorization for the narration script. No speech API call occurs here.
6. Only when Listen is pressed, `/api/reading/audio` verifies the script authorization and calls Deepgram. Sentence-aware chunks are joined into a single WAV for full duration, seeking and playback. Replays reuse browser audio, with a bounded one-hour server cache for repeat requests.

The API key is read from `process.env.DEEPSEEK_API_KEY` on the server only — it never reaches the browser.

### Verify reading audio

```bash
npm run test:audio
npx tsc --noEmit
npm run build
```

The audio tests mock provider responses and verify deferred generation, script authorization, chunking, WAV assembly, caching, concurrent request deduplication, partial-failure retries and safe errors. Live voice quality requires configured DeepSeek and Deepgram credentials.

---

## 🪪 License

MIT — do whatever you want, just don't claim the stars are deterministic.

---

> "We are a way for the cosmos to know itself." — Carl Sagan
