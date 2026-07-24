const { test } = require('node:test');
const assert = require('node:assert');
const game = require('../game');

function newGame(phrase = 'CECE BACA') {
  const g = game.createGame([
    { id: 0, name: 'P1' }, { id: 1, name: 'P2' }, { id: 2, name: 'P3' }
  ]);
  const r = game.startBoard(g, 'CAT', phrase, 0, 1);
  assert.strictEqual(r.ok, true);
  return g;
}

test('createGame sets up players with zeroed scores and 16 segments', () => {
  const g = game.createGame([{ id: 0, name: 'A' }]);
  assert.strictEqual(g.players[0].roundPoints, 0);
  assert.strictEqual(g.players[0].bank, 0);
  assert.strictEqual(g.segments.length, 16);
  assert.strictEqual(g.segments[0], 1000);
  assert.strictEqual(g.segments[1], 'bancarotta');
});

test('startBoard lays out the phrase and sets the starting player', () => {
  const g = newGame('SOLE');
  assert.strictEqual(g.turnState, 'MUST_SPIN');
  assert.strictEqual(g.currentTurnIndex, 0);
  assert.strictEqual(g.boardNumber, 1);
  assert.ok(g.board.grid);
});

test('spin on a number sets PICK_CONSONANT and records value', () => {
  const g = newGame();
  const res = game.applySpin(g, 3);
  assert.deepStrictEqual(res, { type: 'number', value: 200 });
  assert.strictEqual(g.turnState, 'PICK_CONSONANT');
  assert.strictEqual(g.lastSpinValue, 200);
});

test('present consonant scores value x occurrences and keeps the turn', () => {
  const g = newGame('CECE');
  game.applySpin(g, 3); // 200
  const res = game.applyConsonant(g, 'C');
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.present, true);
  assert.strictEqual(res.count, 2);
  assert.strictEqual(g.players[0].roundPoints, 400);
  assert.strictEqual(g.turnState, 'CONTINUE');
  assert.strictEqual(g.hasScoredConsonant, true);
  assert.ok(g.usedLetters.includes('C'));
});

test('absent consonant passes the turn and keeps round points', () => {
  const g = newGame('CECE');
  game.applySpin(g, 0); // 1000
  game.applyConsonant(g, 'C'); // present, +2000, CONTINUE
  game.applySpin(g, 3); // 200
  const res = game.applyConsonant(g, 'Z'); // absent
  assert.strictEqual(res.present, false);
  assert.strictEqual(g.players[0].roundPoints, 2000);
  assert.strictEqual(g.currentTurnIndex, 1);
  assert.strictEqual(g.turnState, 'MUST_SPIN');
  assert.strictEqual(g.hasScoredConsonant, false);
});

test('next passes the turn, round points kept', () => {
  const g = newGame();
  game.applySpin(g, 0); game.applyConsonant(g, 'C');
  const before = g.players[0].roundPoints;
  game.applySpin(g, 6); // 'next'
  assert.strictEqual(g.currentTurnIndex, 1);
  assert.strictEqual(g.players[0].roundPoints, before);
});

test('bancarotta wipes round points AND bank of current player, passes turn', () => {
  const g = newGame();
  g.players[0].bank = 5000;
  game.applySpin(g, 0); game.applyConsonant(g, 'C');
  const res = game.applySpin(g, 1); // 'bancarotta'
  assert.strictEqual(res.type, 'bancarotta');
  assert.strictEqual(g.players[0].roundPoints, 0);
  assert.strictEqual(g.players[0].bank, 0);
  assert.strictEqual(g.currentTurnIndex, 1);
});

test('raddoppia doubles round points when consonant present', () => {
  const g = newGame('BARCA'); // consonants B, R, C ; vowels A, A
  game.applySpin(g, 0); // 1000
  game.applyConsonant(g, 'B'); // one B -> +1000
  assert.strictEqual(g.players[0].roundPoints, 1000);
  game.applySpin(g, 2); // 'raddoppia'
  assert.strictEqual(g.turnState, 'PICK_CONSONANT_DOUBLE');
  const res = game.applyConsonant(g, 'R'); // present consonant
  assert.strictEqual(res.present, true);
  assert.strictEqual(g.players[0].roundPoints, 2000); // doubled
  assert.strictEqual(g.turnState, 'CONTINUE');
});

test('raddoppia rejects a vowel (must be a consonant)', () => {
  const g = newGame('BARCA');
  game.applySpin(g, 0); game.applyConsonant(g, 'B'); // +1000
  game.applySpin(g, 2); // raddoppia -> PICK_CONSONANT_DOUBLE
  const res = game.applyConsonant(g, 'A'); // vowel, not allowed here
  assert.strictEqual(res.ok, false);
  assert.strictEqual(g.players[0].roundPoints, 1000); // unchanged
  assert.strictEqual(g.turnState, 'PICK_CONSONANT_DOUBLE'); // still waiting
});

test('raddoppia with absent consonant passes the turn', () => {
  const g = newGame('CECE');
  game.applySpin(g, 0); game.applyConsonant(g, 'C');
  game.applySpin(g, 2); // raddoppia
  const res = game.applyConsonant(g, 'Z');
  assert.strictEqual(res.present, false);
  assert.strictEqual(g.currentTurnIndex, 1);
});

test('vowel buy requires hasScoredConsonant and >=500, costs 500, no points per occurrence', () => {
  const g = newGame('CECE');
  assert.strictEqual(game.canBuyVowel(g), false);
  game.applySpin(g, 0); // 1000
  game.applyConsonant(g, 'C'); // +2000, CONTINUE
  assert.strictEqual(game.canBuyVowel(g), true);
  const res = game.applyVowel(g, 'E');
  assert.strictEqual(res.present, true);
  assert.strictEqual(res.count, 2);
  assert.strictEqual(g.players[0].roundPoints, 1500);
  assert.strictEqual(g.turnState, 'CONTINUE');
});

test('vowel buy blocked below 500 round points', () => {
  const g = newGame('CECE');
  game.applySpin(g, 3); // 200
  game.applyConsonant(g, 'C'); // +400
  assert.strictEqual(game.canBuyVowel(g), false);
  const res = game.applyVowel(g, 'E');
  assert.strictEqual(res.ok, false);
});

test('absent vowel still costs 500 and passes turn', () => {
  const g = newGame('CCCC BBBB');
  game.applySpin(g, 0); // 1000
  game.applyConsonant(g, 'C'); // present (4 C) -> +4000
  const res = game.applyVowel(g, 'A'); // absent
  assert.strictEqual(res.present, false);
  assert.strictEqual(g.players[0].roundPoints, 3500);
  assert.strictEqual(g.currentTurnIndex, 1);
});

test('solve banks round points and reports solved', () => {
  const g = newGame('OK');
  game.applySpin(g, 0); game.applyConsonant(g, 'K'); // +1000
  const res = game.applySolve(g);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(g.players[0].bank, 1000);
  const { isSolved } = require('../board');
  assert.strictEqual(isSolved(g.board.grid), true);
});

test('passTurn cycles players and resets per-turn flags', () => {
  const g = newGame();
  game.applySpin(g, 0); game.applyConsonant(g, 'C');
  game.passTurn(g);
  assert.strictEqual(g.currentTurnIndex, 1);
  assert.strictEqual(g.turnState, 'MUST_SPIN');
  assert.strictEqual(g.hasScoredConsonant, false);
});

test('startBoard resets all round points but keeps bank and sets rotated starter', () => {
  const g = newGame('OK');
  g.players[0].roundPoints = 999;
  g.players[1].bank = 1234;
  const r = game.startBoard(g, 'CAT2', 'CIAO', 1, 2);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(g.players[0].roundPoints, 0);
  assert.strictEqual(g.players[1].bank, 1234);
  assert.strictEqual(g.currentTurnIndex, 1);
  assert.strictEqual(g.boardNumber, 2);
});

test('startBoard rejects an overflow phrase without mutating the active board', () => {
  const g = newGame('OK');
  const r = game.startBoard(g, 'CAT', 'PAROLA '.repeat(30), 0, 2);
  assert.strictEqual(r.ok, false);
});

test('applyConsonant includes ordered positions for a present letter', () => {
  const g = newGame('CECE');
  game.applySpin(g, 3); // 200
  const res = game.applyConsonant(g, 'C');
  assert.strictEqual(res.present, true);
  assert.ok(Array.isArray(res.positions));
  assert.strictEqual(res.positions.length, 2);
  assert.ok(res.positions.every(p => p.letter === 'C' && typeof p.row === 'number' && typeof p.col === 'number'));
});

test('applyConsonant returns empty positions for an absent letter', () => {
  const g = newGame('CECE');
  game.applySpin(g, 3);
  const res = game.applyConsonant(g, 'Z');
  assert.strictEqual(res.present, false);
  assert.deepStrictEqual(res.positions, []);
});

test('applyVowel includes positions for a present vowel', () => {
  const g = newGame('CECE');
  game.applySpin(g, 0); game.applyConsonant(g, 'C'); // +2000, CONTINUE
  const res = game.applyVowel(g, 'E');
  assert.strictEqual(res.present, true);
  assert.strictEqual(res.positions.length, 2);
});

// --- EXPRESS mode ---

test('EXPRESS_SEGMENTS replaces the first PASSA with express, keeps the rest', () => {
  assert.strictEqual(game.EXPRESS_SEGMENTS[6], 'express');
  assert.strictEqual(game.EXPRESS_SEGMENTS[11], 'next');
  assert.strictEqual(game.EXPRESS_SEGMENTS[15], 'next');
  assert.strictEqual(game.EXPRESS_SEGMENTS.length, 16);
  assert.strictEqual(game.EXPRESS_SEGMENTS[0], 1000);
});

test('landing on express enters EXPRESS turn state immediately', () => {
  const g = newGame('CECE');
  g.segments = game.EXPRESS_SEGMENTS.slice();
  const res = game.applySpin(g, 6); // express
  assert.deepStrictEqual(res, { type: 'express' });
  assert.strictEqual(g.turnState, 'EXPRESS');
});

test('express consonant scores 500 x occurrences and keeps firing', () => {
  const g = newGame('CECE');
  g.segments = game.EXPRESS_SEGMENTS.slice();
  game.applySpin(g, 6);
  const res = game.applyExpressLetter(g, 'C'); // 2 occurrences
  assert.strictEqual(res.present, true);
  assert.strictEqual(res.count, 2);
  assert.strictEqual(g.players[0].roundPoints, 1000); // 500 x 2
  assert.strictEqual(g.turnState, 'EXPRESS');
  assert.ok(g.usedLetters.includes('C'));
});

test('express absent consonant = full bancarotta (turn AND bank) + pass', () => {
  const g = newGame('CECE');
  g.players[0].bank = 8000;
  g.segments = game.EXPRESS_SEGMENTS.slice();
  game.applySpin(g, 6);
  game.applyExpressLetter(g, 'C'); // +1000
  const res = game.applyExpressLetter(g, 'Z'); // absent
  assert.strictEqual(res.present, false);
  assert.strictEqual(res.bankrupt, true);
  assert.strictEqual(g.players[0].roundPoints, 0);
  assert.strictEqual(g.players[0].bank, 0);
  assert.strictEqual(g.currentTurnIndex, 1);
  assert.strictEqual(g.turnState, 'MUST_SPIN');
});

test('express vowel costs 500, reveals, scores no points', () => {
  const g = newGame('CECE');
  g.segments = game.EXPRESS_SEGMENTS.slice();
  game.applySpin(g, 6);
  game.applyExpressLetter(g, 'C'); // +1000 -> roundPoints 1000
  const res = game.applyExpressLetter(g, 'E'); // vowel: -500, present, no points
  assert.strictEqual(res.present, true);
  assert.strictEqual(res.vowel, true);
  assert.strictEqual(g.players[0].roundPoints, 500); // 1000 - 500
});

test('express vowel below 500 round points is rejected (no-op)', () => {
  const g = newGame('CECE');
  g.segments = game.EXPRESS_SEGMENTS.slice();
  game.applySpin(g, 6);
  const res = game.applyExpressLetter(g, 'E'); // roundPoints 0
  assert.strictEqual(res.ok, false);
  assert.strictEqual(g.players[0].roundPoints, 0);
  assert.strictEqual(g.turnState, 'EXPRESS');
});

test('express absent vowel = full bancarotta', () => {
  const g = newGame('CC EE');
  g.players[0].bank = 3000;
  g.segments = game.EXPRESS_SEGMENTS.slice();
  game.applySpin(g, 6);
  game.applyExpressLetter(g, 'C'); // 2 C -> +1000
  const res = game.applyExpressLetter(g, 'A'); // vowel, absent (paid 500 then bankrupt)
  assert.strictEqual(res.present, false);
  assert.strictEqual(res.bankrupt, true);
  assert.strictEqual(g.players[0].bank, 0);
  assert.strictEqual(g.currentTurnIndex, 1);
});

test('express letter that completes the board reports solved', () => {
  const g = newGame('OK');
  g.segments = game.EXPRESS_SEGMENTS.slice();
  game.applySpin(g, 6);
  game.applyExpressLetter(g, 'K');
  const res = game.applyExpressLetter(g, 'O');
  assert.strictEqual(res.present, true);
  assert.strictEqual(res.solved, true);
});

test('express wrong solve = full bancarotta + pass', () => {
  const g = newGame('CECE');
  g.players[0].bank = 4000;
  g.segments = game.EXPRESS_SEGMENTS.slice();
  game.applySpin(g, 6);
  game.applyExpressLetter(g, 'C'); // +1000
  const res = game.applyExpressWrongSolve(g);
  assert.strictEqual(res.bankrupt, true);
  assert.strictEqual(g.players[0].roundPoints, 0);
  assert.strictEqual(g.players[0].bank, 0);
  assert.strictEqual(g.currentTurnIndex, 1);
});

test('express correct solve banks the express points (via applySolve)', () => {
  const g = newGame('CECE');
  g.segments = game.EXPRESS_SEGMENTS.slice();
  game.applySpin(g, 6);
  game.applyExpressLetter(g, 'C'); // +1000
  const res = game.applySolve(g);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(g.players[0].bank, 1000);
});

test('entering express keeps turn points accrued on the wheel; express points add on top', () => {
  const g = newGame('BACO CENA'); // B x1, C x2
  g.segments = game.EXPRESS_SEGMENTS.slice();

  // Wheel phase of the express round: score a consonant on a number segment.
  game.applySpin(g, 0); // 1000
  game.applyConsonant(g, 'B'); // 1 x 1000 -> roundPoints 1000, state CONTINUE
  assert.strictEqual(g.players[0].roundPoints, 1000);

  // Keep spinning and land on express: the accrued turn points are NOT reset.
  const spin = game.applySpin(g, 6);
  assert.deepStrictEqual(spin, { type: 'express' });
  assert.strictEqual(g.turnState, 'EXPRESS');
  assert.strictEqual(g.players[0].roundPoints, 1000, 'accrued turn points survive entering express');

  // Express letter adds on top of the accrued total (500 x 2 occurrences).
  game.applyExpressLetter(g, 'C');
  assert.strictEqual(g.players[0].roundPoints, 2000, 'express points stack on the accrued turn points');

  // Solving banks the combined total in one shot.
  game.applySolve(g);
  assert.strictEqual(g.players[0].bank, 2000);
});
