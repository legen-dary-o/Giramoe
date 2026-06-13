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

test('change swaps to the CHOSEN green, abandons the first, and it cannot be re-chosen', () => {
  const e = env.createEnvelopes([true, false, true], ['ONE', 'X', 'TWO']);
  env.openEnvelope(e, 0);
  const r = env.changeEnvelope(e, 2); // the player picks index 2
  assert.deepStrictEqual(r, { ok: true, index: 2, content: 'TWO' });
  assert.strictEqual(e.current, 2);
  assert.strictEqual(e.envelopes[0].abandoned, true);
  assert.strictEqual(e.changesLeft, 0);
  // no changes left, and the abandoned one is gone from the pool
  assert.strictEqual(env.changeEnvelope(e, 0).ok, false);
});

test('change is rejected for a non-green, the held one, or a value not in the pool', () => {
  const e = env.createEnvelopes([true, false, true], ['A', 'NOPE', 'C']);
  env.openEnvelope(e, 0);
  assert.strictEqual(env.changeEnvelope(e, 1).ok, false, 'cannot change into a red');
  assert.strictEqual(env.changeEnvelope(e, 0).ok, false, 'cannot change into the one you hold');
  assert.strictEqual(env.changeEnvelope(e, 9).ok, false, 'out-of-range index');
});

test('three greens: open then change twice, the PLAYER chooses which each time', () => {
  const e = env.createEnvelopes([true, true, true], ['A', 'B', 'C']);
  env.openEnvelope(e, 1);
  assert.strictEqual(e.current, 1);
  assert.strictEqual(env.changeEnvelope(e, 2).index, 2); // chosen, not auto
  assert.strictEqual(env.changeEnvelope(e, 0).index, 0);
  assert.strictEqual(e.changesLeft, 0);
  assert.ok(e.envelopes[1].abandoned && e.envelopes[2].abandoned);
});

test('keep locks in the held envelope (state KEPT) and blocks further actions', () => {
  const e = env.createEnvelopes([true, true, true], ['A', 'B', 'C']);
  env.openEnvelope(e, 0);
  const r = env.keepEnvelope(e);
  assert.deepStrictEqual(r, { ok: true, index: 0, content: 'A' });
  assert.strictEqual(e.state, 'KEPT');
  assert.strictEqual(env.changeEnvelope(e, 1).ok, false, 'no changing after keep');
  assert.strictEqual(env.keepEnvelope(e).ok, false, 'cannot keep twice');
});

test('keep is only valid while holding an opened envelope', () => {
  const e = env.createEnvelopes([true, false, true], ['A', 'X', 'C']);
  assert.strictEqual(env.keepEnvelope(e).ok, false, 'nothing opened yet');
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
  assert.strictEqual(env.changeEnvelope(e, 0).ok, false);
});
