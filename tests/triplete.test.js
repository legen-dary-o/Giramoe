const { test } = require('node:test');
const assert = require('node:assert');
const triplete = require('../triplete');
const board = require('../board');

function make(phrases = ['CIAO', 'SOLE', 'LUNA'], title = 'TEST') {
  const r = triplete.createTriplete(
    [{ id: 0, name: 'A' }, { id: 1, name: 'B' }, { id: 2, name: 'C' }], title, phrases);
  assert.strictEqual(r.ok, true, r.error);
  return r.t;
}

// Solve the current board for `playerId` (buzz from REVEALING, then admin says correct).
function solveCurrent(t, playerId) {
  assert.strictEqual(triplete.buzz(t, playerId).ok, true);
  return triplete.judgeCorrect(t);
}

test('createTriplete builds 3 boards on the shared title, players zeroed, revealing', () => {
  const t = make();
  assert.strictEqual(t.boards.length, 3);
  assert.ok(t.boards.every(b => b.category === 'TEST'));
  assert.strictEqual(t.state, 'REVEALING');
  assert.strictEqual(t.boardIndex, 0);
  assert.ok(t.players.every(p => p.points === 0 && p.solved === 0));
});

test('createTriplete rejects the wrong number of phrases', () => {
  const r = triplete.createTriplete([{ id: 0, name: 'A' }], 'T', ['UNA', 'DUE']);
  assert.strictEqual(r.ok, false);
});

test('createTriplete rejects an overflow phrase and names which one', () => {
  const r = triplete.createTriplete([{ id: 0, name: 'A' }], 'T', ['OK', 'PAROLA '.repeat(30), 'OK']);
  assert.strictEqual(r.ok, false);
  assert.ok(/2/.test(r.error));
});

test('buzz books the player and blocks a second buzz until judged', () => {
  const t = make();
  assert.deepStrictEqual(triplete.buzz(t, 1), { ok: true, playerId: 1 });
  assert.strictEqual(t.state, 'BUZZED');
  assert.strictEqual(t.buzzedBy, 1);
  assert.strictEqual(triplete.buzz(t, 2).ok, false); // someone is mid-buzz
});

test('judgeCorrect awards 1000, advances the board, but is not finished on board 1', () => {
  const t = make();
  const res = solveCurrent(t, 0);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.points, 1000);
  assert.strictEqual(res.solved, 1);
  assert.strictEqual(res.finished, false);
  assert.strictEqual(t.state, 'BOARD_DONE');
  assert.strictEqual(t.buzzedBy, null);
  assert.strictEqual(board.isSolved(triplete.currentGrid(t)), true);
});

test('a wrong player is locked out and cannot re-buzz until everyone misses', () => {
  const t = make();
  triplete.buzz(t, 0);
  assert.deepStrictEqual(triplete.judgeWrong(t), { ok: true, playerId: 0, reset: false });
  assert.strictEqual(t.state, 'REVEALING');
  assert.strictEqual(triplete.buzz(t, 0).ok, false); // 0 is locked
  assert.strictEqual(triplete.buzz(t, 1).ok, true);  // 1 still allowed
});

test('when all players have missed, the locks reset for the same board', () => {
  const t = make();
  triplete.buzz(t, 0); triplete.judgeWrong(t);
  triplete.buzz(t, 1); triplete.judgeWrong(t);
  triplete.buzz(t, 2);
  const res = triplete.judgeWrong(t);
  assert.strictEqual(res.reset, true);
  assert.deepStrictEqual(t.lockedOut, []);
  assert.strictEqual(triplete.buzz(t, 0).ok, true); // 0 can buzz again
});

test('solving all three boards scores 5000, not 3000, and finishes', () => {
  const t = make();
  solveCurrent(t, 0);            // 1000
  triplete.nextBoard(t);
  solveCurrent(t, 0);            // 2000
  triplete.nextBoard(t);
  const res = solveCurrent(t, 0); // treble -> 5000
  assert.strictEqual(res.points, 5000);
  assert.strictEqual(res.solved, 3);
  assert.strictEqual(res.finished, true);
  assert.strictEqual(t.state, 'FINISHED');
  assert.strictEqual(triplete.player(t, 0).points, 5000);
});

test('solving only two of three boards stays at 2000 (no bonus)', () => {
  const t = make();
  solveCurrent(t, 0);   // P0: 1000
  triplete.nextBoard(t);
  solveCurrent(t, 1);   // P1: 1000
  triplete.nextBoard(t);
  solveCurrent(t, 0);   // P0: 2000 (only 2 of 3)
  assert.strictEqual(triplete.player(t, 0).points, 2000);
  assert.strictEqual(triplete.player(t, 1).points, 1000);
});

test('nextBoard advances and resets locks + flash tracking; not past the last board', () => {
  const t = make();
  triplete.buzz(t, 0); triplete.judgeWrong(t);
  t.flashed.push('0,0'); t.flashCount = 1;
  const res = triplete.nextBoard(t);
  assert.deepStrictEqual(res, { ok: true, boardIndex: 1 });
  assert.deepStrictEqual(t.lockedOut, []);
  assert.deepStrictEqual(t.flashed, []);
  assert.strictEqual(t.flashCount, 0);
  triplete.nextBoard(t); // -> board 2 (index 2, last)
  assert.strictEqual(triplete.nextBoard(t).ok, false);
});

test('revealNext reveals one hidden cell at a time and returns null when full', () => {
  const t = make(['CE', 'X', 'Y']); // board 0 has 2 letter cells
  const grid = triplete.currentGrid(t);
  assert.strictEqual(board.hiddenLetterCells(grid).length, 2);
  const a = triplete.revealNext(t, () => 0);
  assert.ok(a && typeof a.letter === 'string');
  assert.strictEqual(board.hiddenLetterCells(grid).length, 1);
  triplete.revealNext(t, () => 0);
  assert.strictEqual(board.hiddenLetterCells(grid).length, 0);
  assert.strictEqual(triplete.revealNext(t, () => 0), null);
});

test('flashNext picks unflashed cells without revealing them, then returns null', () => {
  const t = make(['CE', 'X', 'Y']);
  const grid = triplete.currentGrid(t);
  const a = triplete.flashNext(t, () => 0);
  assert.ok(a);
  assert.strictEqual(board.hiddenLetterCells(grid).length, 2); // nothing revealed
  assert.strictEqual(t.flashCount, 1);
  triplete.flashNext(t, () => 0); // flash the other one
  assert.strictEqual(t.flashed.length, 2);
  assert.strictEqual(triplete.flashNext(t, () => 0), null); // all flashed
});

test('applyToBank adds triplete points onto each matching game player bank', () => {
  const t = make();
  solveCurrent(t, 0); // P0 +1000
  const gamePlayers = [
    { id: 0, name: 'A', bank: 2500 },
    { id: 1, name: 'B', bank: 400 },
    { id: 2, name: 'C', bank: 0 }
  ];
  triplete.applyToBank(t, gamePlayers);
  assert.strictEqual(gamePlayers[0].bank, 3500);
  assert.strictEqual(gamePlayers[1].bank, 400);
  assert.strictEqual(gamePlayers[2].bank, 0);
});
