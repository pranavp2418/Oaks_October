import { test } from "node:test";
import assert from "node:assert/strict";
import { empty, replace, validateRecord } from "../src/journal.mjs";
import { resolveSku } from "../src/selection.mjs";
test("compare-and-swap rejects stale cross-tab write and leaves current unchanged", () => {
  const initial = empty(),
    next = replace(initial, 0, { schema: 1, journal: [{ id: "one" }] });
  assert.equal(next.revision, 1);
  assert.throws(() => replace(next, 0, initial.workspace), /Another tab/);
  assert.equal(next.workspace.journal.length, 1);
  assert.equal(initial.revision, 0);
});
test("malformed local and remote envelope fail before persistence", () => {
  for (const x of [
    null,
    {},
    { revision: -1, workspace: { schema: 1, journal: [] } },
    { revision: 0, workspace: { schema: 2, journal: [] } },
  ])
    assert.throws(() => validateRecord(x));
  assert.throws(() => replace(empty(), 0, { schema: 1, journal: null }));
});
test('custom imports/restores use the displayed SKU for proposal submission', () => {
  assert.equal(resolveSku([{sku:'ROOT'}], 'APPLE'), 'ROOT');
  assert.equal(resolveSku([{sku:'ROOT'}, {sku:'LEAF'}], 'LEAF'), 'LEAF');
  assert.equal(resolveSku([{sku:'CITRUS'}], 'ROOT'), 'CITRUS');
  assert.equal(resolveSku([], 'APPLE'), '');
});
