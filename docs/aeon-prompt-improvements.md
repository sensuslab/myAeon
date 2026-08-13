# Aeon Reading Prompt Improvements

Date: 2026-07-06

## Overview

Enriched the Aeon astrological reading prompt system to produce more grounded, specific, and astrologically coherent readings — without changing the UI components or JSON response shape.

## Files Changed

### `src/lib/zodiac.ts`

Added three new exported helper functions:

#### `computeAspect(lonA, lonB)`
Determines the major aspect between two ecliptic longitudes (conjunction, sextile, square, trine, opposition) within an 8° orb. Returns the aspect type, label, and orb distance, or `null` if no aspect is within orb.

#### `planetDignity(planetId, signId)`
Checks a planet's traditional dignity in a given zodiac sign using the classical dignity table:
- **Domicile** — the sign the planet rules (strong natural expression)
- **Exaltation** — the sign where the planet reaches its highest expression
- **Detriment** — the sign opposite its domicile (works against the grain)
- **Fall** — the sign opposite its exaltation (challenged expression)

Returns `null` when no notable dignity applies.

#### `sunSignMeta(sign)`
Returns a sun sign's element, modality, and ruling planet name for prompt enrichment.

---

### `src/app/api/reading/route.ts`

#### System Prompt — new sections

**Astrological Interpretation Framework** — teaches the LLM how to reason about:
- Element qualities (Fire = initiative, Earth = endurance, Air = connection, Water = intuition)
- Modality qualities (Cardinal = initiating, Fixed = sustaining, Mutable = adapting)
- Planetary dignity and when to mention it
- Major aspects as relational dynamics between planets

**Timeframe Guidance** — differentiates what each timeframe should emphasize:
- Today: immediate energy, a specific action for the next 24 hours
- 3 Days: an unfolding pattern building or shifting
- Week: the thematic arc and most useful posture for 7 days
- Month: the deeper current, a longer cycle or lesson

**Domain Guidance** — defines what each reading section governs:
- Love & Connection: relational dynamics, emotional exchanges, intimacy
- Purpose & Work: vocation, direction, creative output, effort meeting meaning
- Body & Energy: physical vitality, nervous system, rest, movement
- Inner World: psychological landscape, spiritual reflection, the private self

**Section Body Guidance** — raised from "1 concise, specific sentence" to "2–3 sentences: one situational, one interpretive, one actionable."

**Affirmation Guidance** — must distill the reading's dominant theme, not a generic positivity platitude.

#### User Prompt — computed astrological context

The `buildUserPrompt` function now computes and includes:

- **Sun sign metadata**: element, modality, and ruling planet (e.g., "Gemini (Air Mutable, ruled by Mercury)")
- **Aspect relationships**: for each planet, its major aspect to the user's sun sign (e.g., "Mars: Libra 15°. square your Gemini sun")
- **Dignity status**: when a planet is in domicile, exaltation, detriment, or fall, it's noted inline
- **Closing instruction**: references the sun sign's elemental nature and asks for aspect-grounded planet insights

#### Example planet line (before vs after)

**Before:**
```
- Mars: Libra 15°. Archetype: The Warrior — drive, courage, will. Domains: action, conflict, desire.
```

**After:**
```
- Mars: Libra 15°. square your Gemini sun. (in detriment — working against the grain). Archetype: The Warrior — drive, courage, will. Domains: action, conflict, desire.
```

---

## What Stayed the Same

- All UI components (ReadingPanel, MobileReadingView, PlanetInfoBar, PlanetTooltip, Planet)
- The JSON response shape (`ReadingPayload`)
- The fallback reading system
- The JSON parsing and recovery logic
- The `response_format: { type: "json_object" }` approach
- Temperature (0.85), token limit (8192), model configuration
