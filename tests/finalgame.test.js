const { test } = require('node:test');
const assert = require('node:assert');
const finalgame = require('../finalgame');
const board = require('../board');

function make(phrases = ['CENTRO NORD', 'PRIMA E ULTIMA', 'TUTTO VUOTO']) {
  const r = finalgame.createFinalGame('CAT', phrases);
  assert.strictEqual(r.ok, true, r.error);
  return r.fg;
}

function revealedLetters(grid) {
  return grid.flat().filter(c => c.type === 'letter' && c.revealed).map(c => c.letter);
}

test('createFinalGame builds 3 boards; board 1 reveals N R T E and waits for picks', () => {
  const fg = make(['NORTE', 'X', 'Y']);
  assert.strictEqual(fg.boards.length, 3);
  assert.strictEqual(fg.state, 'PICKING');
  assert.strictEqual(fg.boardIndex, 0);
  // "NORTE" -> N, R, T, E revealed (not O)
  assert.deepStrictEqual(revealedLetters(finalgame.currentGrid(fg)).sort(), ['E', 'N', 'R', 'T']);
});

test('createFinalGame rejects the wrong number of phrases', () => {
  assert.strictEqual(finalgame.createFinalGame('C', ['UNO', 'DUE']).ok, false);
});

test('board 1: 3 consonants + 1 vowel, then the timer starts', () => {
  const fg = make(['BACI DAMA', 'X', 'Y']); // letters B A C I D A M A
  // N,R,T,E already "used" though absent. Pick 3 consonants + 1 vowel.
  assert.strictEqual(finalgame.pick(fg, 'B').ok, true);
  assert.strictEqual(finalgame.pick(fg, 'C').ok, true);
  let r = finalgame.pick(fg, 'D');
  assert.strictEqual(r.complete, false); // 3 consonants, still need a vowel
  assert.strictEqual(fg.state, 'PICKING');
  // a 4th consonant is rejected
  assert.strictEqual(finalgame.pick(fg, 'M').ok, false);
  r = finalgame.pick(fg, 'A'); // vowel -> complete
  assert.strictEqual(r.complete, true);
  assert.strictEqual(r.startTimer, true);
  assert.strictEqual(fg.state, 'RUNNING');
  // a second vowel after completion is rejected
  assert.strictEqual(finalgame.pick(fg, 'I').ok, false);
});

test('board 1: cannot pick an already-revealed preset letter (N/R/T/E)', () => {
  const fg = make(['NRT BC', 'X', 'Y']);
  assert.strictEqual(finalgame.pick(fg, 'N').ok, false);
  assert.strictEqual(finalgame.pick(fg, 'E').ok, false);
});

test('buzz only works while the timer is running', () => {
  const fg = make(['BACI DAMA', 'X', 'Y']);
  assert.strictEqual(finalgame.buzz(fg).ok, false); // still PICKING
  finalgame.pick(fg, 'B'); finalgame.pick(fg, 'C'); finalgame.pick(fg, 'D'); finalgame.pick(fg, 'A');
  assert.strictEqual(fg.state, 'RUNNING');
  assert.strictEqual(finalgame.buzz(fg).ok, true);
  assert.strictEqual(fg.state, 'BUZZED');
});

test('resolve reveals the board but waits; advance moves to board 2 (first+last)', () => {
  const fg = make(['BACI DAMA', 'SOLE MARE', 'Y']);
  finalgame.pick(fg, 'B'); finalgame.pick(fg, 'C'); finalgame.pick(fg, 'D'); finalgame.pick(fg, 'A');
  finalgame.buzz(fg);
  const r = finalgame.resolve(fg, true);
  assert.strictEqual(r.finished, false);
  assert.strictEqual(fg.boardIndex, 0, 'not advanced yet');
  assert.strictEqual(fg.state, 'BOARD_DONE');
  assert.strictEqual(fg.results[0], true);
  finalgame.advance(fg);
  assert.strictEqual(fg.boardIndex, 1);
  assert.strictEqual(fg.state, 'RUNNING');
  // "SOLE MARE" -> first/last of each word: S,E (SOLE) and M,E (MARE)
  assert.deepStrictEqual(revealedLetters(finalgame.currentGrid(fg)).sort(), ['E', 'E', 'M', 'S']);
});

function toBoard(fg, n) { // play forward to board index n, marking earlier boards green
  while (fg.boardIndex < n) {
    if (fg.boardIndex === 0) { finalgame.pick(fg, 'B'); finalgame.pick(fg, 'C'); finalgame.pick(fg, 'D'); finalgame.pick(fg, 'A'); }
    finalgame.buzz(fg); finalgame.resolve(fg, true); finalgame.advance(fg);
  }
}

test('board 2 takes no picks; board 3 allows unlimited consonants + 1 vowel', () => {
  const fg = make(['AB', 'CIAO MONDO', 'CASA BELLA']);
  toBoard(fg, 1);
  assert.strictEqual(finalgame.pick(fg, 'C').ok, false, 'no picking on board 2');
  toBoard(fg, 2);
  assert.strictEqual(fg.boardIndex, 2);
  assert.strictEqual(finalgame.pick(fg, 'C').ok, true);
  assert.strictEqual(finalgame.pick(fg, 'S').ok, true);
  assert.strictEqual(finalgame.pick(fg, 'L').ok, true); // 3rd consonant fine (unlimited)
  assert.strictEqual(finalgame.pick(fg, 'A').ok, true); // one vowel
  assert.strictEqual(finalgame.pick(fg, 'E').ok, false, 'only one vowel on board 3');
});

test('board 3: an absent letter is flagged wrong (server docks 3s)', () => {
  const fg = make(['AB', 'CD', 'CIAO']);
  toBoard(fg, 2);
  const ok = finalgame.pick(fg, 'C'); // present in CIAO
  assert.strictEqual(ok.wrong, false);
  const bad = finalgame.pick(fg, 'Z'); // absent
  assert.strictEqual(bad.present, false);
  assert.strictEqual(bad.wrong, true);
});

test('resolve on the last board finishes with the three results', () => {
  const fg = make(['AB', 'CD', 'EF']);
  finalgame.pick(fg, 'B'); finalgame.pick(fg, 'C'); finalgame.pick(fg, 'D'); finalgame.pick(fg, 'A');
  finalgame.buzz(fg); finalgame.resolve(fg, true); finalgame.advance(fg);  // b1 green
  finalgame.buzz(fg); finalgame.resolve(fg, false); finalgame.advance(fg); // b2 red
  finalgame.buzz(fg);
  const r = finalgame.resolve(fg, true);                                   // b3 green
  assert.strictEqual(r.finished, true);
  assert.deepStrictEqual(r.results, [true, false, true]);
  assert.strictEqual(fg.state, 'DONE');
});

test('expire marks the current and remaining boards as lost', () => {
  const fg = make(['AB', 'CD', 'EF']);
  toBoard(fg, 1); // b1 green, now on b2 (RUNNING)
  const r = finalgame.expire(fg);
  assert.deepStrictEqual(r.results, [true, false, false]);
  assert.strictEqual(fg.state, 'DONE');
});
