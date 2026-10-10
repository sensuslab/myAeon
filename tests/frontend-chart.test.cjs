const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { test } = require('node:test');
const assert = require('node:assert/strict');

for (const extension of ['.ts', '.tsx']) require.extensions[extension] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
};

const load = Module._load;
const mocked = new Set(['AppHeader', 'ControlPanel', 'ReadingPanel', 'PlanetTooltip', 'PlanetInfoBar', 'HowItWorksModal', 'AeonPreloader', 'QuickTour', 'MobileBottomActions', 'MobileReadingDrawer', 'MobileReadingView', 'SceneViewControls', 'BirthChartView']);
const audioInputs = [];
const audio = { stream: { stop() {} }, pause() {} };
Module._load = function(request, parent, isMain) {
  if (request === 'next/dynamic') return () => props => React.createElement('dynamic-ui', props);
  if (request === '@/components/ui/useReadingAudio') return { useReadingAudio: reading => { audioInputs.push(reading); return audio; } };
  if (request.startsWith('@/')) {
    const name = request.split('/').at(-1);
    if (mocked.has(name)) return { __esModule: true, default: props => React.createElement(`mock-${name}`, props) };
    request = path.resolve(__dirname, '../src', request.slice(2));
  }
  return load.call(this, request, parent, isMain);
};
const Home = require('../src/app/page.tsx').default;
const { initialBirthInput } = require('../src/components/ui/BirthDetailsForm.tsx');
const Enhancement = require('../src/components/ui/BirthChartReading.tsx').default;
const ChartView = require('../src/components/ui/BirthChartView.tsx').default;
const { chartHouseLabel, chartPointLabel, publicMessage } = require('../src/components/ui/chartPresentation.ts');
const { downloadReadingPdf } = require('../src/components/ui/downloadReadingPdf.ts');
Module._load = load;

const response = (body, ok = true) => ({ ok, json: async () => body });
const context = { id: 'c'.repeat(48), profileId: 'p'.repeat(48), natal: { planets: [] }, snapshots: [], confidence: 'known', selectedDate: '2026-10-10' };
const reading = { sunSign: { id: 'taurus', name: 'Taurus', symbol: 'T' }, greeting: 'Hello', summary: 'Baseline', sections: [], affirmation: 'Reflect' };
const enhanced = { ...reading, birthChart: { contextId: context.id, title: 'Birth chart', overview: 'Overview', sections: [{ title: 'Pattern', body: 'Calculated pattern' }], synthesis: 'Synthesis', reflection: 'Reflection' } };

function harness() {
  global.window = { localStorage: { getItem: () => 'seen', setItem() {} }, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) };
  global.document = { documentElement: { dataset: {} }, body: { dataset: {} }, querySelector: () => null };
  const requests = [];
  global.fetch = (url, options) => {
    if (!options?.method) return Promise.resolve(response({ enabled: true, usage: null }));
    let resolve;
    const pending = new Promise(done => { resolve = done; });
    requests.push({ url, options, body: JSON.parse(options.body), resolve });
    return pending;
  };
  let tree;
  act(() => { tree = create(React.createElement(Home)); });
  const props = name => tree.root.findByType(`mock-${name}`).props;
  const input = { ...initialBirthInput(), birthDate: '1990-05-01', birthTime: '10:15', timeConfidence: 'known', confirmed: true, readingDate: '2026-10-10' };
  act(() => props('ControlPanel').onChange(input));
  const submit = () => { act(() => { void props('ControlPanel').onSubmit(input, { name: 'Taurus', glyph: 'T' }); }); };
  const resolve = async (url, body, ok = true) => {
    const request = requests.findLast(item => item.url === url);
    await act(async () => { request.resolve(response(body, ok)); await Promise.resolve(); });
    return request;
  };
  const close = () => act(() => tree.unmount());
  return { tree, props, requests, input, submit, resolve, close };
}

test('Cast confirms first, starts baseline/chart in parallel, and chart failure preserves the baseline', async () => {
  const h = harness();
  try {
    h.submit();
    assert.deepEqual(h.requests.map(item => item.url), ['/api/astrology/profile']);
    await h.resolve('/api/astrology/profile', { profileId: context.profileId });
    assert.deepEqual(h.requests.map(item => item.url), ['/api/astrology/profile', '/api/astrology/chart', '/api/reading']);
    assert.deepEqual(h.requests[1].body, { profileId: context.profileId, readingDate: h.input.readingDate });
    await h.resolve('/api/reading', reading);
    assert.equal(h.props('ReadingPanel').reading.summary, 'Baseline');
    assert.equal(h.props('ReadingPanel').chartLoading, true);
    await h.resolve('/api/astrology/chart', { error: 'Astrologer quota exceeded' }, false);
    assert.equal(h.props('ReadingPanel').reading.summary, 'Baseline');
    assert.equal(h.props('ReadingPanel').chartLoading, false);
    assert.equal(h.requests.some(item => item.url === '/api/reading/enhance'), false);
  } finally { h.close(); }
});

test('enhancement is explicit, uses the computed context, replaces payload, and reuses a matching chart', async () => {
  const h = harness();
  try {
    h.submit();
    await h.resolve('/api/astrology/profile', { profileId: context.profileId });
    await h.resolve('/api/astrology/chart', { context });
    await h.resolve('/api/reading', reading);
    assert.equal(h.requests.some(item => item.url === '/api/reading/enhance'), false);
    act(() => h.props('ReadingPanel').onEnhanceChart());
    const request = h.requests.at(-1);
    assert.equal(request.url, '/api/reading/enhance');
    assert.equal(request.body.contextId, context.id);
    assert.equal(request.body.reading.summary, 'Baseline');
    await h.resolve('/api/reading/enhance', enhanced);
    assert.equal(h.props('ReadingPanel').reading.birthChart.title, 'Birth chart');
    assert.equal(audioInputs.at(-1).birthChart.contextId, context.id);
    const priorChartCalls = h.requests.filter(item => item.url === '/api/astrology/chart').length;
    h.submit();
    await act(async () => { await Promise.resolve(); });
    assert.equal(h.requests.filter(item => item.url === '/api/astrology/chart').length, priorChartCalls);
  } finally { h.close(); }
});

test('changing the sky date aborts stale requests and invalidates the chart and enhancement', async () => {
  const h = harness();
  try {
    h.submit();
    await h.resolve('/api/astrology/profile', { profileId: context.profileId });
    const chartRequest = h.requests.find(item => item.url === '/api/astrology/chart');
    const baselineRequest = h.requests.find(item => item.url === '/api/reading');
    act(() => h.props('ControlPanel').onChange({ ...h.input, readingDate: '2026-10-11' }));
    assert.equal(chartRequest.options.signal.aborted, true);
    assert.equal(baselineRequest.options.signal.aborted, true);
    await h.resolve('/api/astrology/chart', { context });
    await h.resolve('/api/reading', reading);
    assert.equal(h.props('ReadingPanel').reading, null);
    assert.equal(h.props('ReadingPanel').chartAvailable, false);
    assert.equal(h.props('ReadingPanel').loading, false);
  } finally { h.close(); }
});

test('chart-only calculation makes no reading request; interpretation omits the optional reading', async () => {
  const h = harness();
  try {
    act(() => h.props('SceneViewControls').onChange('chart'));
    act(() => h.props('BirthChartView').onCalculate());
    await h.resolve('/api/astrology/profile', { profileId: context.profileId });
    await h.resolve('/api/astrology/chart', { context });
    assert.equal(h.requests.some(item => item.url === '/api/reading' || item.url === '/api/reading/enhance'), false);
    act(() => h.props('BirthChartView').onEnhanceChart());
    assert.deepEqual(h.requests.at(-1).body, { contextId: context.id });
    await h.resolve('/api/reading/enhance', enhanced);
    assert.equal(h.props('ReadingPanel').reading.birthChart.contextId, context.id);
    const voice = h.tree.root.findAllByType('dynamic-ui').find(item => 'profileId' in item.props);
    assert.equal(voice.props.profileId, context.profileId);
    assert.equal(voice.props.contextId, context.id);
  } finally { h.close(); }
});

test('enhancement actions are optional and interpreted sections are distinct from facts', () => {
  let tree;
  act(() => { tree = create(React.createElement(Enhancement, { reading })); });
  assert.equal(tree.toJSON(), null);
  act(() => tree.update(React.createElement(Enhancement, { reading, onEnhanceChart() {}, chartAvailable: false })));
  assert.equal(tree.root.findByType('button').props.disabled, true);
  act(() => tree.update(React.createElement(Enhancement, { reading: enhanced })));
  assert.equal(tree.root.findAllByType('button').length, 0);
  assert.match(JSON.stringify(tree.toJSON()), /AI interpretation \/ Birth chart/);
  assert.match(JSON.stringify(tree.toJSON()), /Synthesis/);
  act(() => tree.unmount());
  assert.equal(publicMessage('DeepSeek returned an empty response.', 'Try again.'), 'Try again.');
  assert.equal(publicMessage('5 API calls remaining', ''), '');
});

test('estimated natal facts permit explicit interpretation, with approximation warnings', async () => {
  const h = harness();
  try {
    act(() => h.props('ControlPanel').onChange({ ...h.input, timeConfidence: 'estimated' }));
    act(() => h.props('SceneViewControls').onChange('chart'));
    act(() => h.props('BirthChartView').onCalculate());
    await h.resolve('/api/astrology/profile', { profileId: context.profileId });
    await h.resolve('/api/astrology/chart', { context: { ...context, confidence: 'estimated', charts: undefined } });
    assert.equal(h.props('ReadingPanel').chartAvailable, true);
    assert.equal(h.props('ReadingPanel').chartConfidence, 'estimated');
    act(() => h.props('BirthChartView').onEnhanceChart());
    assert.equal(h.requests.at(-1).url, '/api/reading/enhance');
    await h.resolve('/api/reading/enhance', enhanced);
    let tree;
    act(() => { tree = create(React.createElement(Enhancement, { reading: enhanced, chartConfidence: 'estimated' })); });
    assert.match(JSON.stringify(tree.toJSON()), /Estimated birth time/);
    assert.match(JSON.stringify(tree.toJSON()), /approximate/);
    act(() => tree.unmount());
  } finally { h.close(); }
});

test('PDF export accepts computed context before enhancement without mutating the baseline', async () => {
  const requests = [];
  const oldDocument = global.document;
  global.fetch = async (_url, options) => { requests.push(JSON.parse(options.body)); return { ok: true, blob: async () => new Blob(['%PDF']) }; };
  global.document = { body: { appendChild() {} }, createElement: () => ({ click() {}, remove() {} }) };
  try {
    await downloadReadingPdf(reading, context.id);
    assert.deepEqual(requests[0], { reading, contextId: context.id });
    assert.equal(reading.birthChart, undefined);
    await downloadReadingPdf(reading);
    assert.deepEqual(requests[1], { reading });
  } finally { global.document = oldDocument; }
});

test('chart inspector displays house numbers and familiar angle names while preserving point identifiers', () => {
  const ordinals = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth'];
  ordinals.forEach((name, index) => assert.equal(chartHouseLabel(`${name}_House`), `House ${index + 1}`));
  assert.equal(chartHouseLabel('11'), 'House 11');
  assert.equal(chartHouseLabel('House 11'), 'House 11');
  assert.equal(chartPointLabel('Medium_Coeli'), 'Midheaven');
  assert.equal(chartPointLabel('Imum_Coeli'), 'IC');
  assert.equal(chartPointLabel('Sun'), 'Sun');
  let tree;
  act(() => { tree = create(React.createElement(ChartView, {
    context: { ...context, natal: {
      planets: [{ name: 'Sun', sign: 'Taurus', degree: 10, house: 'Eleventh_House' }],
      angles: [{ name: 'Medium_Coeli', sign: 'Aries', degree: 15 }, { name: 'Imum_Coeli', sign: 'Libra', degree: 15 }],
    } }, theme: 'dark', loading: false, error: null, timeConfidence: 'known', confirmed: true,
    hasReading: false, enhanced: false, onCalculate() {}, onEditDetails() {},
  })); });
  try {
    assert.match(JSON.stringify(tree.toJSON()), /House 11/);
    assert.doesNotMatch(JSON.stringify(tree.toJSON()), /House Eleventh_House/);
    const midheaven = tree.root.findAllByType('option').find(option => option.props.value === 'Medium_Coeli');
    const ic = tree.root.findAllByType('option').find(option => option.props.value === 'Imum_Coeli');
    assert.deepEqual(midheaven.children, ['Midheaven']);
    assert.deepEqual(ic.children, ['IC']);
    act(() => tree.root.findByType('select').props.onChange({ target: { value: 'Medium_Coeli' } }));
    assert.equal(tree.root.findByType('select').props.value, 'Medium_Coeli');
  } finally { act(() => tree.unmount()); }
});
