const fs = require("node:fs");
const ts = require("typescript");
const React = require("react");
const { create, act } = require("react-test-renderer");
const { test } = require("node:test");
const assert = require("node:assert/strict");

require.extensions[".tsx"] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
};
const Actions = require("../src/components/ui/MobileBottomActions.tsx").default;

for (const [name, reading, readingView, label, expected] of [
  ["initial sky", null, false, "Cast reading", "drawer"],
  ["sky with reading", {}, false, "Reading", "reading"],
  ["full-page reading", {}, true, "New reading", "drawer"],
]) {
  test(`${name} retains Zeus and the appropriate primary action`, () => {
    const calls = [];
    let tree;
    act(() => { tree = create(React.createElement(Actions, {
      hidden: false, loading: false, reading, readingView,
      onTalk: () => calls.push("Zeus"), onOpenDrawer: () => calls.push("drawer"), onOpenReading: () => calls.push("reading"),
    })); });
    const buttons = tree.root.findAllByType("button");
    assert.equal(buttons.length, 2);
    assert.ok(buttons[0].children.includes(label));
    assert.ok(buttons[1].children.includes("Talk to Zeus"));
    act(() => { buttons[0].props.onClick(); buttons[1].props.onClick(); });
    assert.deepEqual(calls, [expected, "Zeus"]);
    act(() => tree.unmount());
  });
}
