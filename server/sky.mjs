import { createRequire } from 'node:module';
const { Body, GeoVector, Ecliptic, MoonPhase } = createRequire(import.meta.url)('astronomy-engine');
const signs = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
export function skyAt(instant = new Date()) {
  const bodies = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];
  const planets = bodies.map(name => {
    const longitude = Ecliptic(GeoVector(Body[name], instant, true)).elon;
    return { name, longitude: +longitude.toFixed(3), sign: signs[Math.floor(longitude / 30)], degree: +(longitude % 30).toFixed(2) };
  });
  const aspects = [];
  for (let i = 0; i < planets.length; i++) for (let j = i + 1; j < planets.length; j++) {
    const separation = Math.abs(((planets[i].longitude - planets[j].longitude + 540) % 360) - 180);
    for (const [angle, name] of [[0, 'conjunction'], [60, 'sextile'], [90, 'square'], [120, 'trine'], [180, 'opposition']]) {
      if (Math.abs(separation - angle) <= 6) aspects.push({ planets: [planets[i].name, planets[j].name], aspect: name, orb: +Math.abs(separation - angle).toFixed(2) });
    }
  }
  return { at: instant.toISOString(), frame: 'Geocentric tropical ecliptic longitude; astronomy-engine, aberration corrected', planets, aspects };
}

export function moonAt(instant) {
  const angle = MoonPhase(instant), fraction = (1 - Math.cos(angle * Math.PI / 180)) / 2;
  const names = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];
  return { at: instant.toISOString(), source: 'astronomy-engine', angle: +angle.toFixed(3), illumination: +fraction.toFixed(4), phaseName: names[Math.floor((angle + 22.5) / 45) % 8] };
}
