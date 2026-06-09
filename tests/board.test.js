const { test } = require('node:test');
const assert = require('node:assert');
const board = require('../board');

test('normalize uppercases, strips accents and punctuation, collapses spaces', () => {
  assert.strictEqual(board.normalize('  È l\'estate, ragazzi! '), 'E LESTATE RAGAZZI');
  assert.strictEqual(board.normalize('Città  perduta'), 'CITTA PERDUTA');
});

test('createBoard places a short phrase, no word split, letters hidden', () => {
  const res = board.createBoard('ESTATE', 'SOLE');
  assert.strictEqual(res.ok, true);
  const grid = res.board.grid;
  assert.strictEqual(grid.length, 4);
  assert.strictEqual(grid[0].length, 16);
  const letterCells = grid.flat().filter(c => c.type === 'letter');
  assert.strictEqual(letterCells.length, 4);
  assert.ok(letterCells.every(c => c.revealed === false));
  assert.deepStrictEqual(letterCells.map(c => c.letter), ['S', 'O', 'L', 'E']);
});

test('row capacities are 14/16/16/14 with blocked corners on rows 0 and 3', () => {
  const res = board.createBoard('X', 'A');
  const grid = res.board.grid;
  assert.strictEqual(grid[0][0].type, 'blocked');
  assert.strictEqual(grid[0][15].type, 'blocked');
  assert.strictEqual(grid[3][0].type, 'blocked');
  assert.strictEqual(grid[3][15].type, 'blocked');
});

test('words never split across rows; long phrase wraps', () => {
  const res = board.createBoard('CAT', 'QUANDO ARRIVA LA BELLA STAGIONE ESTIVA');
  assert.strictEqual(res.ok, true);
  const words = 'QUANDO ARRIVA LA BELLA STAGIONE ESTIVA'.split(' ');
  const rowsText = res.board.grid.map(row =>
    row.map(c => (c.type === 'letter' ? c.letter : ' ')).join('').replace(/\s+/g, ' ').trim()
  );
  const allRowWords = rowsText.join(' ').split(' ').filter(Boolean);
  assert.deepStrictEqual(allRowWords.sort(), words.slice().sort());
});

test('overflow phrase is rejected with an error', () => {
  const res = board.createBoard('CAT', 'PAROLA ' .repeat(20));
  assert.strictEqual(res.ok, false);
  assert.ok(typeof res.error === 'string' && res.error.length > 0);
});

test('a single word longer than 16 is rejected', () => {
  const res = board.createBoard('CAT', 'SUPERCALIFRAGILISTICHESPIRALIDOSO');
  assert.strictEqual(res.ok, false);
});

test('countOccurrences counts only unrevealed matching letters', () => {
  const { board: b } = board.createBoard('X', 'CECE');
  assert.strictEqual(board.countOccurrences(b.grid, 'C'), 2);
  assert.strictEqual(board.countOccurrences(b.grid, 'E'), 2);
  assert.strictEqual(board.countOccurrences(b.grid, 'Z'), 0);
});

test('revealLetter reveals all matches and returns the count', () => {
  const { board: b } = board.createBoard('X', 'CECE');
  const n = board.revealLetter(b.grid, 'C');
  assert.strictEqual(n, 2);
  const revealed = b.grid.flat().filter(c => c.type === 'letter' && c.revealed);
  assert.strictEqual(revealed.length, 2);
  assert.strictEqual(board.countOccurrences(b.grid, 'C'), 0);
});

test('isSolved is true only when every letter cell is revealed', () => {
  const { board: b } = board.createBoard('X', 'OK');
  assert.strictEqual(board.isSolved(b.grid), false);
  board.revealLetter(b.grid, 'O');
  assert.strictEqual(board.isSolved(b.grid), false);
  board.revealLetter(b.grid, 'K');
  assert.strictEqual(board.isSolved(b.grid), true);
});

test('revealAll reveals everything', () => {
  const { board: b } = board.createBoard('X', 'CIAO MONDO');
  board.revealAll(b.grid);
  assert.strictEqual(board.isSolved(b.grid), true);
});

test('isVowel / isConsonant classify A-Z correctly', () => {
  assert.strictEqual(board.isVowel('A'), true);
  assert.strictEqual(board.isVowel('B'), false);
  assert.strictEqual(board.isConsonant('B'), true);
  assert.strictEqual(board.isConsonant('A'), false);
  assert.strictEqual(board.isConsonant('1'), false);
});
