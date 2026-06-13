const { test } = require('node:test');
const assert = require('node:assert');
const env = require('../envelopes');

test('createEnvelopes colours by results and sets changes = greens - 1', () => {
  const e = env.createEnvelopes([true, false, true], ['A', 'B', 'C']);
  assert.deepStrictEqual(e.envelopes.map(x => x.color), ['green', 'red', 'green']);
  assert.deepStrictEqual(e.greens, [0, 2]);
  assert.strictEqual(e.changesLeft, 1);
  assert.strictEqual(e.state, 'CHOOSING');
  assert.ok(e.envelopes.every(x => !x.revealed));
});

test('all green -> two changes; no green -> NONE', () => {
  assert.strictEqual(env.createEnvelopes([true, true, true], ['x', 'y', 'z']).changesLeft, 2);
  const none = env.createEnvelopes([false, false, false], ['x', 'y', 'z']);
  assert.strictEqual(none.state, 'NONE');
  assert.strictEqual(none.changesLeft, 0);
});

test('opening a green reveals it and arms the change; a red cannot be opened', () => {
  const e = env.createEnvelopes([true, false, true], ['PRIZE', 'NOPE', 'GIFT']);
  assert.strictEqual(env.openEnvelope(e, 1).ok, false, 'red not openable');
  const r = env.openEnvelope(e, 0);
  assert.deepStrictEqual(r, { ok: true, index: 0, content: 'PRIZE' });
  assert.strictEqual(e.envelopes[0].revealed, true);
  assert.strictEqual(e.current, 0);
  assert.strictEqual(e.state, 'OPENED');
});

test('change swaps to the other green, abandons the first, and it cannot be re-chosen', () => {
  const e = env.createEnvelopes([true, false, true], ['ONE', 'X', 'TWO']);
  env.openEnvelope(e, 0);
  const r = env.changeEnvelope(e);
  assert.deepStrictEqual(r, { ok: true, index: 2, content: 'TWO' });
  assert.strictEqual(e.current, 2);
  assert.strictEqual(e.envelopes[0].abandoned, true);
  assert.strictEqual(e.changesLeft, 0);
  // no changes left, and the abandoned one is gone from the pool
  assert.strictEqual(env.changeEnvelope(e).ok, false);
});

test('three greens: open then change twice, visiting all three', () => {
  const e = env.createEnvelopes([true, true, true], ['A', 'B', 'C']);
  env.openEnvelope(e, 1);
  assert.strictEqual(e.current, 1);
  assert.strictEqual(env.changeEnvelope(e).index, 0); // next available green by index
  assert.strictEqual(env.changeEnvelope(e).index, 2);
  assert.strictEqual(e.changesLeft, 0);
  assert.ok(e.envelopes[1].abandoned && e.envelopes[0].abandoned);
});

test('admin reveals a red; greens are not red-revealable and double-reveal is rejected', () => {
  const e = env.createEnvelopes([true, false, true], ['A', 'NOPE', 'C']);
  assert.strictEqual(env.revealRed(e, 0).ok, false, 'green is not red');
  const r = env.revealRed(e, 1);
  assert.deepStrictEqual(r, { ok: true, index: 1, content: 'NOPE' });
  assert.strictEqual(e.envelopes[1].revealed, true);
  assert.strictEqual(env.revealRed(e, 1).ok, false, 'already revealed');
});

test('with one green the player opens that one and cannot change', () => {
  const e = env.createEnvelopes([false, true, false], ['x', 'WIN', 'y']);
  assert.strictEqual(e.changesLeft, 0);
  assert.strictEqual(env.openEnvelope(e, 1).ok, true);
  assert.strictEqual(env.changeEnvelope(e).ok, false);
});
