// Regression: QA-001 — backgrounded frame intervals must not be called visible.
// Found by adversarial review; exercises the actual verification-page handlers.
import test from 'node:test';
import assert from 'node:assert/strict';

test('visibility interruption invalidates a frame sample even when visible again before callback', async () => {
  const elements = new Map(['#result','#product','#mobile','#desktop','#storage','#frames'].map(k => [k, {}]));
  const listeners = new Map();
  const callbacks = [];
  globalThis.document = { visibilityState: 'visible', head: {append(){}}, createElement: () => ({}),
    querySelector: name => elements.get(name), addEventListener: (kind, f) => listeners.set(kind, f),
    removeEventListener: (kind) => listeners.delete(kind) };
  globalThis.requestAnimationFrame = f => callbacks.push(f);
  try {
    await import('../src/verification.mjs');
    elements.get('#frames').onclick();
    callbacks.shift()(0);
    document.visibilityState = 'hidden'; listeners.get('visibilitychange')?.();
    document.visibilityState = 'visible'; listeners.get('visibilitychange')?.();
    for (let t = 5000; callbacks.length; t += 16) callbacks.shift()(t);
    assert.match(elements.get('#result').textContent, /Not measured: visibility changed/);
    assert.equal(listeners.size, 0);
  } finally { delete globalThis.document; delete globalThis.requestAnimationFrame; }
});
