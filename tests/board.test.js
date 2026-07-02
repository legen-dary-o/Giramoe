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

test('short rows (0 and 3) have edge corners; full rows (1,2) do not', () => {
  const res = board.createBoard('X', 'A');
  const grid = res.board.grid;
  // rows 0 and 3 are 14-wide: their first and last cells are structural edges
  assert.strictEqual(grid[0][0].type, 'edge');
  assert.strictEqual(grid[0][15].type, 'edge');
  assert.strictEqual(grid[3][0].type, 'edge');
  assert.strictEqual(grid[3][15].type, 'edge');
  // rows 1 and 2 are 16-wide: no edge cells at all
  assert.ok(grid[1].every(c => c.type !== 'edge'));
  assert.ok(grid[2].every(c => c.type !== 'edge'));
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

test('apostrophe is a pre-revealed cell, not a guessable letter', () => {
  const { board: b } = board.createBoard('X', "L'AMORE");
  const cells = b.grid.flat().filter(c => c.type === 'letter');
  // L ' A M O R E -> 7 cells in a row, the apostrophe shown from the start
  const apos = cells.filter(c => c.letter === "'");
  assert.strictEqual(apos.length, 1, 'one apostrophe cell');
  assert.strictEqual(apos[0].revealed, true, 'apostrophe shown immediately');
  // the apostrophe is not counted as a guessable letter
  assert.strictEqual(board.countOccurrences(b.grid, "'"), 0);
  assert.strictEqual(board.hiddenLetterCells(b.grid).some(c => c.letter === "'"), false);
  // base letters are hidden and guessable
  assert.strictEqual(board.countOccurrences(b.grid, 'A'), 1);
  // solving needs only the real letters; the apostrophe never blocks it
  ['L', 'A', 'M', 'O', 'R', 'E'].forEach(L => board.revealLetter(b.grid, L));
  assert.strictEqual(board.isSolved(b.grid), true);
});

test('accented letters guess by base, but reveal with the accent', () => {
  const { board: b } = board.createBoard('X', 'PERCHÉ');
  const acc = b.grid.flat().find(c => c.type === 'letter' && c.display);
  assert.ok(acc, 'an accented cell exists');
  assert.strictEqual(acc.letter, 'E', 'matched by the base letter E');
  assert.strictEqual(acc.display, 'É', 'displays the accented glyph');
  // picking the base E counts and reveals the accented cell too
  assert.strictEqual(board.countOccurrences(b.grid, 'E'), 2); // E and É
  // letterPositions reports the glyph to draw (accent preserved on screen)
  const pos = board.letterPositions(b.grid, 'E').map(p => p.letter).sort();
  assert.deepStrictEqual(pos, ['E', 'É']);
  board.revealLetter(b.grid, 'E');
  assert.strictEqual(board.countOccurrences(b.grid, 'E'), 0);
});

test("apostrophe and accent together (C'È)", () => {
  const { board: b } = board.createBoard('X', "C'È");
  const cells = b.grid.flat().filter(c => c.type === 'letter');
  assert.deepStrictEqual(cells.map(c => c.letter), ['C', "'", 'E']);
  const e = cells.find(c => c.letter === 'E');
  assert.strictEqual(e.display, 'È');
  assert.strictEqual(e.revealed, false);
  assert.strictEqual(cells.find(c => c.letter === "'").revealed, true);
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

test('interior empty cells are blocked (red), not edge', () => {
  // "AB CD" on row 0: the separator space between words is an interior blocked cell
  const res = board.createBoard('X', 'AB CD');
  const row0 = res.board.grid[0];
  const types = row0.map(c => c.type);
  assert.ok(types.includes('blocked'), 'has an interior blocked cell');
  assert.ok(types.includes('letter'), 'has letter cells');
});

test('letterPositions returns unrevealed matches in top-left to bottom-right order', () => {
  const { board: b } = board.createBoard('X', 'CECE');
  const pos = board.letterPositions(b.grid, 'C');
  assert.strictEqual(pos.length, 2);
  // row-major order: earlier row first, then earlier column
  for (let i = 1; i < pos.length; i++) {
    const a = pos[i - 1], c = pos[i];
    assert.ok(a.row < c.row || (a.row === c.row && a.col < c.col), 'ordered TL->BR');
  }
  assert.ok(pos.every(p => p.letter === 'C'));
  assert.deepStrictEqual(board.letterPositions(b.grid, 'Z'), []);
});

test('letterPositions skips already-revealed cells', () => {
  const { board: b } = board.createBoard('X', 'CECE');
  board.revealLetter(b.grid, 'C');
  assert.deepStrictEqual(board.letterPositions(b.grid, 'C'), []);
});

test('hiddenLetterCells lists every unrevealed letter cell, then shrinks as they reveal', () => {
  const { board: b } = board.createBoard('X', 'CECE');
  assert.strictEqual(board.hiddenLetterCells(b.grid).length, 4);
  assert.ok(board.hiddenLetterCells(b.grid).every(c =>
    typeof c.row === 'number' && typeof c.col === 'number' && typeof c.letter === 'string'));
  board.revealLetter(b.grid, 'C');
  assert.strictEqual(board.hiddenLetterCells(b.grid).length, 2);
  board.revealLetter(b.grid, 'E');
  assert.deepStrictEqual(board.hiddenLetterCells(b.grid), []);
});

test('revealCellAt reveals one cell and returns its letter; null off a letter cell', () => {
  const { board: b } = board.createBoard('X', 'CE');
  const cell = board.hiddenLetterCells(b.grid)[0];
  assert.strictEqual(board.revealCellAt(b.grid, cell.row, cell.col), cell.letter);
  assert.strictEqual(b.grid[cell.row][cell.col].revealed, true);
  assert.strictEqual(board.hiddenLetterCells(b.grid).length, 1);
  // an edge corner on row 0 is not a letter cell
  assert.strictEqual(board.revealCellAt(b.grid, 0, 0), null);
});

test('boardStatus flags consonanti/vocali finite when all of a kind are revealed', () => {
  const { board: b } = board.createBoard('CAT', 'CASA'); // C S consonants, A A vowels
  assert.deepStrictEqual(board.boardStatus(b.grid), { consonantsFinished: false, vowelsFinished: false });
  board.revealLetter(b.grid, 'A'); // both vowels revealed
  assert.strictEqual(board.boardStatus(b.grid).vowelsFinished, true);
  assert.strictEqual(board.boardStatus(b.grid).consonantsFinished, false);
  board.revealLetter(b.grid, 'C');
  board.revealLetter(b.grid, 'S');
  assert.strictEqual(board.boardStatus(b.grid).consonantsFinished, true);
});
