const { test } = require('node:test');
const assert = require('node:assert');
const giramoe = require('../giramoe');
const game = require('../game');
const board = require('../board');

function make(phrase = 'CECE BACA') {
  const r = giramoe.createGiramoe(
    [{ id: 0, name: 'A' }, { id: 1, name: 'B' }, { id: 2, name: 'C' }], 'CAT', phrase);
  assert.strictEqual(r.ok, true, r.error);
  return r.gi;
}

test('GIRAMOE_SEGMENTS keeps the numbers and swaps the 5 specials for points', () => {
  const s = game.GIRAMOE_SEGMENTS;
  assert.strictEqual(s.length, 16);
  assert.ok(s.every(v => typeof v === 'number'), 'no special segments remain');
  assert.strictEqual(s[0], 1000); // unchanged number
  assert.strictEqual(s[3], 200);  // unchanged number
  assert.strictEqual(s[1], 900);  // was bancarotta
  assert.strictEqual(s[2], 600);  // was raddoppia
  assert.strictEqual(s[6], 250);  // was next
});

test('createGiramoe builds the board, players zeroed, awaiting the admin spin', () => {
  const gi = make();
  assert.ok(gi.board.grid);
  assert.strictEqual(gi.state, 'AWAIT_SPIN');
  assert.strictEqual(gi.multiplier, null);
  assert.ok(gi.players.every(p => p.points === 0));
});

test('callConsonant is rejected before the admin spins', () => {
  const gi = make();
  assert.strictEqual(giramoe.callConsonant(gi, 'C').ok, false);
});

test('a present consonant scores multiplier x occurrences for the current player', () => {
  const gi = make('CECE');
  giramoe.setMultiplier(gi, 300);
  assert.strictEqual(gi.state, 'PLAYING');
  const res = giramoe.callConsonant(gi, 'C'); // 2 occurrences
  assert.strictEqual(res.present, true);
  assert.strictEqual(res.count, 2);
  assert.strictEqual(gi.players[0].points, 600); // 300 x 2
  assert.strictEqual(gi.calledThisTurn, true);
});

test('vowels cannot be called', () => {
  const gi = make('CECE');
  giramoe.setMultiplier(gi, 300);
  assert.strictEqual(giramoe.callConsonant(gi, 'E').ok, false);
  assert.strictEqual(gi.players[0].points, 0);
  assert.strictEqual(gi.calledThisTurn, false);
});

test('only one letter per turn; a second call is rejected until the turn passes', () => {
  const gi = make('CECE BACA');
  giramoe.setMultiplier(gi, 100);
  giramoe.callConsonant(gi, 'C');
  assert.strictEqual(giramoe.callConsonant(gi, 'B').ok, false);
});

test('buzz is only allowed for the current player after they called a letter', () => {
  const gi = make('CECE');
  giramoe.setMultiplier(gi, 100);
  assert.strictEqual(giramoe.buzz(gi, 0).ok, false); // no letter called yet
  giramoe.callConsonant(gi, 'C');
  assert.strictEqual(giramoe.buzz(gi, 1).ok, false); // not their turn
  assert.deepStrictEqual(giramoe.buzz(gi, 0), { ok: true, playerId: 0 });
  assert.strictEqual(gi.state, 'BUZZED');
});

test('correct solve: only the solver banks their own points, others bank nothing', () => {
  const gi = make('CECE BACA');
  giramoe.setMultiplier(gi, 200);
  giramoe.callConsonant(gi, 'C'); // P0: 3 C in "CECE BACA" -> +600
  assert.strictEqual(gi.players[0].points, 600);
  giramoe.buzz(gi, 0);
  const res = giramoe.judgeCorrect(gi);
  assert.deepStrictEqual(res, { ok: true, winnerId: 0, name: 'A', points: 600 });
  assert.strictEqual(gi.state, 'SOLVED');
  assert.strictEqual(board.isSolved(gi.board.grid), true);

  const gamePlayers = [
    { id: 0, name: 'A', bank: 1000 },
    { id: 1, name: 'B', bank: 700 },
    { id: 2, name: 'C', bank: 0 }
  ];
  giramoe.bankResult(gi, gamePlayers);
  assert.strictEqual(gamePlayers[0].bank, 1600, 'winner banks their points');
  assert.strictEqual(gamePlayers[1].bank, 700, 'others unchanged');
  assert.strictEqual(gamePlayers[2].bank, 0);
});

test('wrong solve passes the turn with no penalty (points kept)', () => {
  const gi = make('CECE BACA');
  giramoe.setMultiplier(gi, 200);
  giramoe.callConsonant(gi, 'C'); // P0 +600
  giramoe.buzz(gi, 0);
  const res = giramoe.judgeWrong(gi);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(gi.players[0].points, 600, 'points kept');
  assert.strictEqual(gi.currentTurnIndex, 1, 'turn passed');
  assert.strictEqual(gi.calledThisTurn, false);
  assert.strictEqual(gi.state, 'PLAYING');
});

test('timeout (no buzz in the window) passes the turn', () => {
  const gi = make('CECE');
  giramoe.setMultiplier(gi, 100);
  giramoe.callConsonant(gi, 'C');
  const res = giramoe.timeout(gi);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(gi.currentTurnIndex, 1);
  // before a letter is called, timeout is a no-op
  assert.strictEqual(giramoe.timeout(gi).ok, false);
});

test('an absent consonant scores nothing and passes the turn (no buzz)', () => {
  const gi = make('CECE');
  giramoe.setMultiplier(gi, 100);
  const res = giramoe.callConsonant(gi, 'Z'); // absent
  assert.strictEqual(res.present, false);
  assert.strictEqual(res.passed, true);
  assert.strictEqual(gi.players[0].points, 0);
  assert.strictEqual(gi.currentTurnIndex, 1, 'turn passed to the next player');
  assert.strictEqual(gi.calledThisTurn, false);
  assert.strictEqual(giramoe.buzz(gi, 0).ok, false, 'the caller cannot buzz after an absent letter');
  assert.strictEqual(giramoe.buzz(gi, 1).ok, false, 'the next player must call a letter first');
});

test('an absent called consonant is not recorded and stays callable on later turns', () => {
  const gi = make('CECE'); // Z is absent
  giramoe.setMultiplier(gi, 100);
  giramoe.callConsonant(gi, 'Z'); // P0 calls Z (absent) -> pass, not recorded
  assert.ok(!gi.usedLetters.includes('Z'), 'absent letter is not locked out');
  // P1 can call Z again
  assert.strictEqual(giramoe.callConsonant(gi, 'Z').ok, true, 'Z is callable again');
  assert.strictEqual(gi.currentTurnIndex, 2, 'and it passes again');
});

test('a present called consonant stays locked out for everyone', () => {
  const gi = make('CECE');
  giramoe.setMultiplier(gi, 100);
  giramoe.callConsonant(gi, 'C'); // present -> recorded
  assert.ok(gi.usedLetters.includes('C'));
  giramoe.timeout(gi); // pass to P1
  assert.strictEqual(giramoe.callConsonant(gi, 'C').ok, false, 'C cannot be called again');
});

test('once every consonant is revealed the current player may buzz without calling', () => {
  const gi = make('CACA'); // only consonant is C
  giramoe.setMultiplier(gi, 100);
  giramoe.callConsonant(gi, 'C'); // reveals all C -> consonants finished, buzz window open
  assert.strictEqual(giramoe.consonantsFinished(gi), true);
  giramoe.timeout(gi); // P0 lets the window lapse -> P1's turn, nothing left to call
  assert.strictEqual(gi.calledThisTurn, false);
  assert.strictEqual(giramoe.buzz(gi, 1).ok, true, 'P1 buzzes directly, no call needed');
  assert.strictEqual(gi.state, 'BUZZED');
});

test('canBuyVowel: serve il proprio turno, 500 punti e nessuna azione già fatta', () => {
  const gi = make('CECE BACA');
  giramoe.setMultiplier(gi, 250);
  // prima dello spin nessuno compra: qui lo spin c'è ma P0 ha 0 punti
  assert.strictEqual(giramoe.canBuyVowel(gi, 0), false, 'senza punti non si compra');
  giramoe.callConsonant(gi, 'C'); // 3 occorrenze -> P0 a 750
  assert.strictEqual(gi.players[0].points, 750);
  assert.strictEqual(giramoe.canBuyVowel(gi, 0), false, 'ha già chiamato in questo turno');
  assert.strictEqual(giramoe.canBuyVowel(gi, 1), false, 'non è il suo turno');
  giramoe.timeout(gi); // passa a P1, P0 conserva i 750
  assert.strictEqual(giramoe.canBuyVowel(gi, 1), false, 'P1 non ha punti');
  giramoe.callConsonant(gi, 'Z'); // assente -> passa a P2
  assert.strictEqual(giramoe.canBuyVowel(gi, 2), false);
  assert.strictEqual(giramoe.canBuyVowel(gi, 0), false, 'P0 ha i punti ma non è il suo turno');
});

test('canBuyVowel è vero al turno successivo di chi ha accumulato 500+', () => {
  const gi = make('CECE BACA');
  giramoe.setMultiplier(gi, 250);
  giramoe.callConsonant(gi, 'C'); // P0 -> 750
  giramoe.timeout(gi);            // P1
  giramoe.callConsonant(gi, 'Z'); // assente -> P2
  giramoe.callConsonant(gi, 'Z'); // assente -> torna a P0
  assert.strictEqual(gi.currentTurnIndex, 0);
  assert.strictEqual(giramoe.canBuyVowel(gi, 0), true);
});

test('canBuyVowel è falso prima dello spin e quando le vocali sono finite', () => {
  const gi = make('CECE');
  gi.players[0].points = 1000;
  assert.strictEqual(giramoe.canBuyVowel(gi, 0), false, 'stato AWAIT_SPIN');
  giramoe.setMultiplier(gi, 250);
  assert.strictEqual(giramoe.vowelsFinished(gi), false);
  assert.strictEqual(giramoe.canBuyVowel(gi, 0), true);
  board.revealLetter(gi.board.grid, 'E'); // unica vocale di "CECE"
  assert.strictEqual(giramoe.vowelsFinished(gi), true);
  assert.strictEqual(giramoe.canBuyVowel(gi, 0), false, 'niente più vocali da comprare');
});
