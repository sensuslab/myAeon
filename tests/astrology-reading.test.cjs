const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const ts = require('typescript');
const { test } = require('node:test');
const assert = require('node:assert/strict');
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8').replace(/(["'])@\/([^"']+)\1/g, (_, quote, target) => JSON.stringify(path.resolve(__dirname, '../src', target)));
  module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, filename);
};
const profileRoute = require('../src/app/api/astrology/profile/route.ts');
const readingRoute = require('../src/app/api/reading/route.ts');
const pdfRoute = require('../src/app/api/reading/pdf/route.ts');
const origin = 'http://localhost';
function request(route, body, cookie) { return new Request(`${origin}${route}`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) }); }

test('confirmed profile → five hosted requests → evidence-rich DeepSeek reading → verified PDF → cached Zeus context', async t => {
  const previousEnv = { ...process.env }, originalFetch = global.fetch;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aeon-reading-'));
  Object.assign(process.env, { ASTROLOGER_ENABLED: 'true', ASTROLOGER_API_KEY: 'synthetic-astrologer', ASTROLOGY_SESSION_SECRET: 'synthetic-secret-at-least-32-characters', ASTROLOGY_QUOTA_DIR: dir, DEEPSEEK_API_KEY: 'synthetic-deepseek' });
  t.after(() => { process.env = previousEnv; global.fetch = originalFetch; fs.rmSync(dir, { recursive: true, force: true }); });
  const { knownProfile, providerFixture } = await import('./fixtures/astrologer.mjs');
  const { astrology } = await import('../server/astrology.mjs');
  const { userIdentity } = await import('../server/astrology-quota.mjs');
  let providerCalls = 0, readingCalls = 0, lastEvidence;
  global.fetch = async (url, args) => {
    if (String(url).includes('astrologer.p.rapidapi.com')) {
      providerCalls++; assert.equal(args.headers['X-RapidAPI-Key'], 'synthetic-astrologer'); return providerFixture(url, args);
    }
    assert.ok(String(url).includes('api.deepseek.com')); readingCalls++;
    const payload = JSON.parse(args.body), marker = 'VALIDATED COMPUTATION DATA: ';
    lastEvidence = JSON.parse(payload.messages[1].content.split(marker)[1].split('\n')[0]);
    assert.equal(lastEvidence.natal.planets[0].name, 'Sun');
    assert.ok(!payload.messages[1].content.includes('synthetic-astrologer'));
    assert.ok(payload.messages[0].content.includes('geocentric'));
    return Response.json({ choices: [{ message: { content: JSON.stringify({ greeting: 'Welcome.', summary: 'A chart-informed reflection.', sections: [], planetInsights: [], affirmation: 'I make thoughtful choices.' }) } }] });
  };
  const profile = await profileRoute.POST(request('/api/astrology/profile', knownProfile));
  assert.equal(profile.status, 200); const cookie = profile.headers.get('set-cookie'), { profileId } = await profile.json();
  const input = { birthDate: knownProfile.birthDate, birthTime: knownProfile.birthTime, birthPlace: 'London, UK', readingDate: '2026-10-09', profileId };
  const response = await readingRoute.POST(request('/api/reading', input, cookie));
  assert.equal(response.status, 200); const reading = await response.json();
  assert.equal(providerCalls, 5); assert.equal(readingCalls, 1); assert.equal(reading.sections.length, 16); assert.equal(reading.planetInsights.length, 8);
  assert.equal(reading.meta.astrology.source, 'Astrologer v6'); assert.equal(reading.meta.astrology.usage.remaining, 0); assert.equal(reading.meta.birthTime, '10:15');
  const earth = reading.planetInsights.find(p => p.id === 'earth'); assert.equal(earth.sign, 'Reflective note'); assert.ok(!/Earth in /.test(earth.title));
  const context = astrology.resolveContext(userIdentity(cookie).id, reading.meta.astrology.contextId);
  assert.deepEqual(context.natal, lastEvidence.natal);
  const pdf = await pdfRoute.POST(request('/api/reading/pdf', { reading }, cookie));
  assert.equal(pdf.status, 200); assert.equal(pdf.headers.get('content-type'), 'application/pdf'); assert.ok((await pdf.arrayBuffer()).byteLength > 5000);
  const warm = await readingRoute.POST(request('/api/reading', input, cookie)); assert.equal(warm.status, 200); assert.equal(providerCalls, 5);
  const denied = await readingRoute.POST(request('/api/reading', input)); assert.equal(denied.status, 400); assert.equal(providerCalls, 5);
  const changed = await readingRoute.POST(request('/api/reading', { ...input, birthDate: '1991-01-01' }, cookie)); assert.equal(changed.status, 400);
  const forged = await profileRoute.POST(new Request(`${origin}/api/astrology/profile`, { method: 'POST', body: JSON.stringify(knownProfile) })); assert.equal(forged.status, 403);
});
