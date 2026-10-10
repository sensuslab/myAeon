const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { test } = require('node:test');
const assert = require('node:assert/strict');
for (const ext of ['.ts', '.tsx']) require.extensions[ext] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8').replace(/(["'])@\/([^"']+)\1/g, (_, q, p) => JSON.stringify(path.resolve(__dirname, '../src', p)));
  module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);
};
const { default: Form, initialBirthInput, profileFingerprint, birthProfile } = require('../src/components/ui/BirthDetailsForm.tsx');
function field(tree, text) { return tree.root.findAllByType('label').find(l => l.findAllByType('span').some(s => s.children.includes(text))); }
test('birth form requires explicit dates/time confidence and separates Zeus confirmation from casting', () => {
  const initial = initialBirthInput(); assert.equal(initial.birthDate, ''); assert.equal(initial.birthTime, ''); assert.equal(initial.timeConfidence, 'unknown'); assert.equal(initial.location.timezone, 'Europe/London');
  let tree; const calls = [];
  function Harness() { const [input, onChange] = React.useState(initial); return React.createElement(Form, { input, onChange, onSubmit: value => calls.push(['reading', value]), onConfirm: value => calls.push(['Zeus', value]), loading: false, confirming: false, profileConfirmed: false, status: null, usage: { limit: 5, remaining: 5 }, enrichmentEnabled: true }); }
  act(() => { tree = create(React.createElement(Harness)); });
  const text = JSON.stringify(tree.toJSON());
  assert.match(text, /Use these birth details to calculate my chart and personalise my reading\/conversation\./);
  assert.doesNotMatch(text, /Deepgram|DeepSeek|Astrologer|five.call|allowance|API calls remaining/i);
  assert.equal(tree.root.findByType('a').props.href, '/privacy');
  assert.equal(tree.root.findByType('a').props.target, '_blank');
  const confirm = () => tree.root.findAllByType('button').find(b => b.children.includes('Confirm birth details for Zeus'));
  assert.equal(confirm().props.disabled, true);
  assert.ok(!tree.root.findAllByType('input').some(i => i.props.type === 'time'));
  act(() => field(tree, 'Birth date').findByType('input').props.onChange({ target: { value: '1990-05-01' } }));
  act(() => field(tree, 'How certain is your birth time?').findByType('select').props.onChange({ target: { value: 'known' } }));
  assert.equal(confirm().props.disabled, true);
  act(() => field(tree, 'Recorded local birth time').findByType('input').props.onChange({ target: { value: '10:15' } }));
  act(() => tree.root.findAllByType('input').find(i => i.props.type === 'checkbox').props.onChange({ target: { checked: true } }));
  assert.equal(confirm().props.disabled, false); assert.equal(calls.length, 0);
  act(() => confirm().props.onClick({ currentTarget: { form: { reportValidity: () => true } } }));
  assert.equal(calls[0][0], 'Zeus'); assert.equal(calls[0][1].birthTime, '10:15');
  const signature = profileFingerprint(calls[0][1]); assert.notEqual(profileFingerprint({ ...calls[0][1], birthTime: '10:16' }), signature);
  act(() => tree.root.findByType('form').props.onSubmit({ preventDefault() {} })); assert.equal(calls[1][0], 'reading');
  assert.equal(birthProfile({ ...calls[0][1], timeConfidence: 'unknown' }).birthTime, undefined);
  act(() => tree.unmount());
});
