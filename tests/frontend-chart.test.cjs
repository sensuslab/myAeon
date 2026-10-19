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
const mocked = new Set(['AlphaDisclaimer', 'WelcomeScreen', 'Modal', 'AppHeader', 'ControlPanel', 'ReadingPanel', 'PlanetTooltip', 'PlanetInfoBar', 'HowItWorksModal', 'AeonPreloader', 'QuickTour', 'MobileBottomActions', 'MobileReadingDrawer', 'MobileReadingView', 'SceneViewControls', 'BirthChartView']);
const audioInputs = [];
const audio = { stream: { stop() {} }, pause() {} };
Module._load = function(request, parent, isMain) {
  if (request === 'next/dynamic') return () => props => React.createElement('dynamic-ui', props);
  if (request === '@/components/ui/useReadingAudio') return { useReadingAudio: reading => { audioInputs.push(reading); return audio; } };
  if (request.startsWith('@/')) {
    const name = request.split('/').at(-1);
    if (name === 'BirthDetailsForm') return { ...load.call(this, path.resolve(__dirname, '../src', request.slice(2)), parent, isMain), __esModule:true, default: props => React.createElement('mock-BirthDetailsForm', props) };
    if (mocked.has(name)) return { __esModule: true, default: props => React.createElement(`mock-${name}`, props, props.children) };
    request = path.resolve(__dirname, '../src', request.slice(2));
  }
  return load.call(this, request, parent, isMain);
};
const Home = require('../src/app/Home.tsx').default;
const { initialBirthInput } = require('../src/components/ui/BirthDetailsForm.tsx');
const Enhancement = require('../src/components/ui/BirthChartReading.tsx').default;
const ChartView = require('../src/components/ui/BirthChartView.tsx').default;
const { chartHouseLabel, chartPointLabel, publicMessage } = require('../src/components/ui/chartPresentation.ts');
const { downloadReadingPdf } = require('../src/components/ui/downloadReadingPdf.ts');
Module._load = load;

const response = (body, ok = true) => ({ ok, json: async () => body });
const context = { id: 'c'.repeat(48), profileId: 'p'.repeat(48), natal: { planets: [] }, snapshots: [], confidence: 'known', selectedDate: '2026-10-10' };
const reading = { sunSign: { id: 'taurus', name: 'Taurus', symbol: 'T' }, greeting: 'Hello', summary: 'Baseline', meta: {readingDate:'2026-10-10'}, sections: [], affirmation: 'Reflect' };
const enhanced = { ...reading, birthChart: { contextId: context.id, title: 'Birth chart', overview: 'Overview', sections: [{ title: 'Pattern', body: 'Calculated pattern' }], synthesis: 'Synthesis', reflection: 'Reflection' } };

function harness({ startupOnly = false, tourSeen = true } = {}) {
  const storageWrites = [];
  global.window = { localStorage: { getItem: () => tourSeen ? 'seen' : null, setItem: (...args) => storageWrites.push(args) }, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) };
  global.document = { documentElement: { dataset: {}, style: { setProperty() {} } }, body: { dataset: {} }, querySelector: () => null };
  const requests = [];
  global.fetch = (url, options) => {
    if (!options?.method) return Promise.resolve(response({ enabled: true, usage: null }));
    let resolve;
    const pending = new Promise(done => { resolve = done; });
    requests.push({ url, options, body: JSON.parse(options.body), resolve });
    return pending;
  };
  let tree;
  act(() => { tree = create(React.createElement(Home, { initialDate:'2026-10-10' })); });
  if (startupOnly) return { tree, storageWrites, close: () => act(() => tree.unmount()) };
  act(() => tree.root.findByType('mock-AeonPreloader').props.onComplete());
  act(() => tree.root.findByType('mock-AlphaDisclaimer').props.onContinue());
  const nav = label => act(() => tree.root.findAllByType('nav')[0].findAllByType('button').find(b => b.children.includes(label)).props.onClick());
  const props = name => {
    if(name === 'ControlPanel') { name='BirthDetailsForm'; if(!tree.root.findAllByType('mock-BirthDetailsForm').length) act(()=>tree.root.findAllByType('button').find(b=>b.children.includes('Birth details ')).props.onClick()); }
    if(name==='ReadingPanel'&&!tree.root.findAllByType('mock-ReadingPanel').length) nav('Reading');
    if(name==='BirthChartView'&&!tree.root.findAllByType('mock-BirthChartView').length) nav('Birth chart');
    if(name==='SceneViewControls') return {onChange:()=>nav('Birth chart')};
    return tree.root.findByType(`mock-${name}`).props;
  };
  act(()=>props('WelcomeScreen').onStart('today'));
  const input = { ...initialBirthInput(), birthDate: '1990-05-01', birthTime: '10:15', timeConfidence: 'known', confirmed: true, readingDate: '2026-10-10' };
  act(() => props('ControlPanel').onChange(input));
  const submit = () => { const form = props('ControlPanel'); act(() => { void form.onSubmit(input, { name: 'Taurus', glyph: 'T' }); }); };
  const resolve = async (url, body, ok = true) => {
    const request = requests.findLast(item => item.url === url);
    await act(async () => { request.resolve(response(body, ok)); await Promise.resolve(); });
    return request;
  };
  const close = () => act(() => tree.unmount());
  return { tree, props, requests, input, submit, resolve, close };
}

test('startup shows the Alpha notice only after the wordmark and before the first-use tour', () => {
  const h = harness({ startupOnly: true, tourSeen: false });
  try {
    assert.equal(h.tree.root.findAllByType('mock-AlphaDisclaimer').length, 0);
    assert.equal(h.tree.root.findByType('mock-QuickTour').props.open, false);
    act(() => h.tree.root.findByType('mock-AeonPreloader').props.onComplete());
    assert.equal(h.tree.root.findAllByType('mock-AlphaDisclaimer').length, 1);
    assert.equal(h.tree.root.findAllByType('mock-WelcomeScreen').length, 0);
    assert.equal(h.tree.root.findByType('mock-QuickTour').props.open, false);
    act(() => h.tree.root.findByType('mock-AlphaDisclaimer').props.onContinue());
    assert.equal(h.tree.root.findAllByType('mock-AlphaDisclaimer').length, 0);
    assert.equal(h.tree.root.findByType('mock-QuickTour').props.open, true);
    act(() => h.tree.root.findByType('mock-QuickTour').props.onClose());
    assert.ok(h.storageWrites.some(([key, value]) => key === 'aeon-walkthrough-chart-v3' && value === 'seen'));
  } finally { h.close(); }
});

test('returning visitors still see the Alpha notice without repeating the completed tour', () => {
  const h = harness({ startupOnly: true });
  try {
    act(() => h.tree.root.findByType('mock-AeonPreloader').props.onComplete());
    assert.equal(h.tree.root.findAllByType('mock-AlphaDisclaimer').length, 1);
    act(() => h.tree.root.findByType('mock-AlphaDisclaimer').props.onContinue());
    assert.equal(h.tree.root.findByType('mock-QuickTour').props.open, false);
    assert.equal(h.tree.root.findAllByType('mock-WelcomeScreen').length, 1);
  } finally { h.close(); }
});

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

test('reading and chart Zeus launches carry their focus and preserve the accepted reading date', async () => {
  const h = harness();
  const voiceProps = () => h.tree.root.findAllByType('dynamic-ui').find(node => node.props.onStart).props;
  try {
    h.submit();
    await h.resolve('/api/astrology/profile', { profileId: context.profileId });
    await h.resolve('/api/astrology/chart', { context });
    await h.resolve('/api/reading', {...reading,meta:{...reading.meta,profileId:context.profileId}});
    const explain = h.props('BirthChartView').onExplain;
    act(() => explain('Saturn', 'natal'));
    assert.equal(voiceProps().source, 'chart');
    assert.deepEqual(voiceProps().selectedFeature, {name:'Saturn',frame:'natal',date:'2026-10-10'});
    assert.equal(voiceProps().contextId, context.id);
    act(() => voiceProps().onClose());
    const change = h.props('ControlPanel').onChange;
    act(() => change({...h.input,readingDate:'2026-10-11'}));
    const focus = {title:'Purpose & Work',timeframe:'Week'};
    const ask = h.props('ReadingPanel').onAskZeus;
    act(() => ask(focus));
    assert.equal(voiceProps().source, 'reading');
    assert.equal(voiceProps().viewedDate, '2026-10-10');
    assert.equal(voiceProps().profileId, context.profileId);
    assert.deepEqual(voiceProps().readingFocus, focus);
    assert.equal(voiceProps().selectedFeature, null);
    assert.equal(voiceProps().selectedPlanet, null);
    act(() => voiceProps().onClose());
    act(() => h.tree.root.findAllByType('button').find(node => node.props['aria-label'] === 'Welcome screen').props.onClick());
    act(() => h.props('WelcomeScreen').onZeus());
    assert.equal(voiceProps().source, 'welcome');
    assert.equal(voiceProps().readingFocus, null);
    assert.equal(voiceProps().selectedFeature, null);
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
    const enhanceAction = h.props('ReadingPanel').onEnhanceChart; act(() => { void enhanceAction(); });
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
    const chartAction = h.props('BirthChartView').onEnhanceChart; act(() => { void chartAction(); });
    assert.deepEqual(h.requests.at(-1).body, { contextId: context.id, mode: 'today' });
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
    assert.equal(h.props('BirthChartView').timeConfidence, 'estimated');
    assert.equal(h.props('ReadingPanel').chartConfidence, 'estimated');
    const chartAction = h.props('BirthChartView').onEnhanceChart; act(() => { void chartAction(); });
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
