/**
 * Planet data + astronomy utilities.
 *
 * The 3D scene uses astronomy-engine to compute real heliocentric ecliptic
 * longitudes for each planet at "now" (or at the user's birth date if we want
 * a natal view later). Those longitudes drive orbital angles in the scene.
 *
 * For the reading flow, we use the sun's ecliptic longitude to derive the
 * sun sign — same as a real astrologer would.
 */

import {
  Body,
  EclipticLongitude,
} from "astronomy-engine";

export type PlanetId =
  | "mercury"
  | "venus"
  | "earth"
  | "mars"
  | "jupiter"
  | "saturn"
  | "uranus"
  | "neptune";

export type PlanetVisual = {
  id: PlanetId;
  name: string;
  /** Distance from sun in scene units (AU * scale) */
  orbitRadius: number;
  /** Sphere radius in scene units (not to real scale, exaggerated) */
  size: number;
  /** Base color */
  color: string;
  /** Emissive tint */
  emissive: string;
  /** Short poetic description */
  archetype: string;
  /** Domains this planet governs (for the reading) */
  domains: string[];
};

export const PLANETS: PlanetVisual[] = [
  {
    id: "mercury",
    name: "Mercury",
    orbitRadius: 4.5,
    size: 0.42,
    color: "#d7c6b9",
    emissive: "#7c6458",
    archetype: "The Messenger — mind, speech, pattern",
    domains: ["communication", "thinking", "learning"],
  },
  {
    id: "venus",
    name: "Venus",
    orbitRadius: 6.2,
    size: 0.52,
    color: "#f3d699",
    emissive: "#8a6020",
    archetype: "The Lover — beauty, value, connection",
    domains: ["love", "aesthetics", "pleasure"],
  },
  {
    id: "earth",
    name: "Earth",
    orbitRadius: 8.0,
    size: 0.58,
    color: "#68c7f0",
    emissive: "#154a68",
    archetype: "Home — embodiment, growth, belonging",
    domains: ["grounding", "family", "health"],
  },
  {
    id: "mars",
    name: "Mars",
    orbitRadius: 10.0,
    size: 0.48,
    color: "#f27a4f",
    emissive: "#702a16",
    archetype: "The Warrior — drive, courage, will",
    domains: ["action", "conflict", "desire"],
  },
  {
    id: "jupiter",
    name: "Jupiter",
    orbitRadius: 13.5,
    size: 1.16,
    color: "#e3bb86",
    emissive: "#77542c",
    archetype: "The Sage — expansion, faith, fortune",
    domains: ["growth", "philosophy", "travel"],
  },
  {
    id: "saturn",
    name: "Saturn",
    orbitRadius: 16.5,
    size: 1.04,
    color: "#ead6a2",
    emissive: "#77643a",
    archetype: "The Elder — structure, time, mastery",
    domains: ["discipline", "responsibility", "karma"],
  },
  {
    id: "uranus",
    name: "Uranus",
    orbitRadius: 19.5,
    size: 0.82,
    color: "#8ef5ef",
    emissive: "#1f7676",
    archetype: "The Awakener — innovation, liberation, surprise",
    domains: ["rebellion", "insight", "technology"],
  },
  {
    id: "neptune",
    name: "Neptune",
    orbitRadius: 22.0,
    size: 0.8,
    color: "#7194ff",
    emissive: "#233d8f",
    archetype: "The Mystic — dreams, intuition, dissolution",
    domains: ["spirit", "imagination", "compassion"],
  },
];

// Map our id → astronomy-engine Body enum
const BODY_BY_ID: Record<PlanetId, Body> = {
  mercury: Body.Mercury,
  venus: Body.Venus,
  earth: Body.Earth,
  mars: Body.Mars,
  jupiter: Body.Jupiter,
  saturn: Body.Saturn,
  uranus: Body.Uranus,
  neptune: Body.Neptune,
};

export type PlanetPosition = {
  id: PlanetId;
  /** Heliocentric ecliptic longitude in degrees [0, 360) */
  longitude: number;
  /** Converted to scene radians, with 0° at +Z (so the camera at +Z looking at origin sees Aries on the right) */
  angleRad: number;
};

export type CosmicSnapshot = {
  /** ISO timestamp of the snapshot */
  timestamp: string;
  /** Sun's apparent geocentric ecliptic longitude in degrees */
  sunLongitude: number;
  /** Position of every planet */
  planets: PlanetPosition[];
};

/**
 * Compute a real-time snapshot of planetary positions.
 * Uses astronomy-engine for accurate heliocentric longitudes.
 */
export function computeSnapshot(date: Date = new Date()): CosmicSnapshot {
  // Astronomy Engine throws for heliocentric longitude of the Sun itself.
  // The Sun's apparent geocentric ecliptic longitude equals Earth's heliocentric
  // longitude + 180°.
  const earthHeliLon = EclipticLongitude(Body.Earth, date);
  const sunLon = (earthHeliLon + 180) % 360;

  const planets: PlanetPosition[] = PLANETS.map((p) => {
    let lon: number;
    if (p.id === "earth") {
      // Place Earth at the opposite side of the Sun in this heliocentric view.
      lon = earthHeliLon;
    } else {
      lon = EclipticLongitude(BODY_BY_ID[p.id], date);
    }
    return {
      id: p.id,
      longitude: lon,
      angleRad: (lon * Math.PI) / 180,
    };
  });

  return {
    timestamp: date.toISOString(),
    sunLongitude: sunLon,
    planets,
  };
}

// ============================================================
// Zodiac — sun sign from longitude
// ============================================================

export type ZodiacSign = {
  id: string;
  name: string;
  symbol: string;
  element: "Fire" | "Earth" | "Air" | "Water";
  modality: "Cardinal" | "Fixed" | "Mutable";
  ruler: PlanetId | "moon" | "sun";
  startDegree: number; // 0–360 ecliptic longitude
  glyph: string;
};

export const ZODIAC_SIGNS: ZodiacSign[] = [
  { id: "aries",       name: "Aries",       symbol: "♈", element: "Fire",  modality: "Cardinal", ruler: "mars",    startDegree:   0, glyph: "♈" },
  { id: "taurus",      name: "Taurus",      symbol: "♉", element: "Earth", modality: "Fixed",    ruler: "venus",   startDegree:  30, glyph: "♉" },
  { id: "gemini",      name: "Gemini",      symbol: "♊", element: "Air",   modality: "Mutable",  ruler: "mercury", startDegree:  60, glyph: "♊" },
  { id: "cancer",      name: "Cancer",      symbol: "♋", element: "Water", modality: "Cardinal", ruler: "moon",    startDegree:  90, glyph: "♋" },
  { id: "leo",         name: "Leo",         symbol: "♌", element: "Fire",  modality: "Fixed",    ruler: "sun",     startDegree: 120, glyph: "♌" },
  { id: "virgo",       name: "Virgo",       symbol: "♍", element: "Earth", modality: "Mutable",  ruler: "mercury", startDegree: 150, glyph: "♍" },
  { id: "libra",       name: "Libra",       symbol: "♎", element: "Air",   modality: "Cardinal", ruler: "venus",   startDegree: 180, glyph: "♎" },
  { id: "scorpio",     name: "Scorpio",     symbol: "♏", element: "Water", modality: "Fixed",    ruler: "mars",    startDegree: 210, glyph: "♏" },
  { id: "sagittarius", name: "Sagittarius", symbol: "♐", element: "Fire",  modality: "Mutable",  ruler: "jupiter", startDegree: 240, glyph: "♐" },
  { id: "capricorn",   name: "Capricorn",   symbol: "♑", element: "Earth", modality: "Cardinal", ruler: "saturn",  startDegree: 270, glyph: "♑" },
  { id: "aquarius",    name: "Aquarius",    symbol: "♒", element: "Air",   modality: "Fixed",    ruler: "uranus",  startDegree: 300, glyph: "♒" },
  { id: "pisces",      name: "Pisces",      symbol: "♓", element: "Water", modality: "Mutable",  ruler: "neptune", startDegree: 330, glyph: "♓" },
];

/**
 * Map an ecliptic longitude (degrees) to its zodiac sign.
 */
export function longitudeToSign(lon: number): ZodiacSign {
  const norm = ((lon % 360) + 360) % 360;
  const idx = Math.floor(norm / 30) % 12;
  return ZODIAC_SIGNS[idx];
}

/**
 * Backwards-compat: derive sun sign from a calendar date.
 * Uses astronomy-engine for the actual ecliptic longitude (synchronous import).
 */
export function getSunSign(date: Date): ZodiacSign {
  // Sun's geocentric ecliptic longitude = Earth's heliocentric + 180°
  const lon = (EclipticLongitude(Body.Earth, date) + 180) % 360;
  return longitudeToSign(lon);
}

// ============================================================
// Astrological interpretation helpers
// ============================================================

export type AspectType = "conjunction" | "sextile" | "square" | "trine" | "opposition";

const ASPECTS: { type: AspectType; angle: number; label: string }[] = [
  { type: "conjunction", angle: 0,   label: "conjunct" },
  { type: "sextile",     angle: 60,  label: "sextile" },
  { type: "square",      angle: 90,  label: "square" },
  { type: "trine",       angle: 120, label: "trine" },
  { type: "opposition",  angle: 180, label: "opposition" },
];

const ASPECT_ORB = 8; // degrees

export type Aspect = {
  type: AspectType;
  label: string;
  orb: number;
};

/**
 * Determine the major aspect between two ecliptic longitudes.
 * Returns null if no aspect falls within orb.
 */
export function computeAspect(lonA: number, lonB: number): Aspect | null {
  let diff = Math.abs(lonA - lonB) % 360;
  if (diff > 180) diff = 360 - diff;

  for (const aspect of ASPECTS) {
    const orb = Math.abs(diff - aspect.angle);
    if (orb <= ASPECT_ORB) {
      return { type: aspect.type, label: aspect.label, orb: Math.round(orb * 10) / 10 };
    }
  }
  return null;
}

export type Dignity = "domicile" | "exaltation" | "detriment" | "fall";

const DIGNITY_TABLE: Record<PlanetId, { domicile: string[]; exaltation: string[]; detriment: string[]; fall: string[] }> = {
  mercury:  { domicile: ["gemini", "virgo"],      exaltation: ["virgo"],          detriment: ["sagittarius", "pisces"],  fall: ["pisces"] },
  venus:    { domicile: ["taurus", "libra"],      exaltation: ["pisces"],         detriment: ["scorpio", "aries"],      fall: ["virgo"] },
  earth:    { domicile: [],                       exaltation: [],                 detriment: [],                        fall: [] },
  mars:     { domicile: ["aries", "scorpio"],     exaltation: ["capricorn"],      detriment: ["libra", "taurus"],       fall: ["cancer"] },
  jupiter:  { domicile: ["sagittarius", "pisces"], exaltation: ["cancer"],        detriment: ["gemini", "virgo"],       fall: ["capricorn"] },
  saturn:   { domicile: ["capricorn", "aquarius"], exaltation: ["libra"],         detriment: ["cancer", "leo"],         fall: ["aries"] },
  uranus:   { domicile: ["aquarius"],             exaltation: ["scorpio"],        detriment: ["leo"],                   fall: ["taurus"] },
  neptune:  { domicile: ["pisces"],               exaltation: ["cancer", "leo"],  detriment: ["virgo"],                 fall: ["capricorn"] },
};

/**
 * Determine a planet's dignity in a given sign.
 * Returns null if the planet has no notable dignity in that sign.
 */
export function planetDignity(planetId: PlanetId, signId: string): Dignity | null {
  const table = DIGNITY_TABLE[planetId];
  if (!table) return null;
  if (table.exaltation.includes(signId)) return "exaltation";
  if (table.domicile.includes(signId)) return "domicile";
  if (table.fall.includes(signId)) return "fall";
  if (table.detriment.includes(signId)) return "detriment";
  return null;
}

export type SunSignMeta = {
  element: string;
  modality: string;
  ruler: string;
};

/**
 * Return interpretive metadata for a sun sign.
 */
export function sunSignMeta(sign: ZodiacSign): SunSignMeta {
  const rulerNames: Record<string, string> = {
    sun: "the Sun", moon: "the Moon", mercury: "Mercury", venus: "Venus",
    mars: "Mars", jupiter: "Jupiter", saturn: "Saturn", uranus: "Uranus", neptune: "Neptune",
  };
  return {
    element: sign.element,
    modality: sign.modality,
    ruler: rulerNames[sign.ruler] ?? sign.ruler,
  };
}

function approximateSunLongitude(date: Date): number {
  // Approximate the sun's ecliptic longitude from a calendar date.
  // Used as a last-resort fallback if astronomy-engine throws.
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / 86400000);
  return (dayOfYear / 365.25) * 360;
}

/**
 * Compute a birth chart summary for the user — what sign the sun was in at
 * the moment of their birth, plus the current positions of all planets.
 */
export function computeBirthChart(birthDate: Date): {
  birthSunSign: ZodiacSign;
  birthSunLongitude: number;
  currentSnapshot: CosmicSnapshot;
} {
  const lon = (EclipticLongitude(Body.Earth, birthDate) + 180) % 360;
  return {
    birthSunSign: longitudeToSign(lon),
    birthSunLongitude: lon,
    currentSnapshot: computeSnapshot(new Date()),
  };
}
