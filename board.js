const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);
const ROW_CAPACITIES = [14, 16, 16, 14];
const GRID_WIDTH = 16;

function normalize(text) {
  return String(text)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Pack words into 4 rows with capacities ROW_CAPACITIES.
// Returns { ok:true, rows:[[word,...] x4] } or { ok:false, error }.
function layoutPhrase(phrase) {
  const words = normalize(phrase).split(' ').filter(Boolean);
  if (words.length === 0) return { ok: false, error: 'Frase vuota' };

  const rows = [[], [], [], []];
  const used = [0, 0, 0, 0];
  let r = 0;

  for (const word of words) {
    if (word.length > GRID_WIDTH) {
      return { ok: false, error: `La parola "${word}" è troppo lunga (max ${GRID_WIDTH})` };
    }
    let placed = false;
    while (r < 4) {
      const sep = rows[r].length === 0 ? 0 : 1;
      if (used[r] + sep + word.length <= ROW_CAPACITIES[r]) {
        used[r] += sep + word.length;
        rows[r].push(word);
        placed = true;
        break;
      }
      r++; // try next row
    }
    if (!placed) return { ok: false, error: 'La frase è troppo lunga per il tabellone' };
  }
  return { ok: true, rows };
}

// Build a 4x16 grid of cells from packed rows.
// Cells outside a short row's usable width are structural `edge` cells (drawn
// transparent); interior non-letter cells are `blocked` (red); letters are `letter`.
function buildGrid(rows) {
  const grid = [];
  for (let r = 0; r < 4; r++) {
    const cap = ROW_CAPACITIES[r];
    const sideBlocked = (GRID_WIDTH - cap) / 2; // 1 for rows 0,3 ; 0 for rows 1,2
    const content = rows[r].join(' ');           // length <= cap
    const pad = Math.floor((cap - content.length) / 2);
    const cells = [];
    for (let c = 0; c < GRID_WIDTH; c++) {
      const usableCol = c - sideBlocked;
      if (usableCol < 0 || usableCol >= cap) {
        cells.push({ type: 'edge' });
        continue;
      }
      const idx = usableCol - pad;
      const ch = (idx >= 0 && idx < content.length) ? content[idx] : null;
      if (ch && ch !== ' ') {
        cells.push({ type: 'letter', letter: ch, revealed: false });
      } else {
        cells.push({ type: 'blocked' });
      }
    }
    grid.push(cells);
  }
  return grid;
}

function createBoard(category, phrase) {
  const layout = layoutPhrase(phrase);
  if (!layout.ok) return { ok: false, error: layout.error };
  return {
    ok: true,
    board: { category: String(category), phrase: normalize(phrase), grid: buildGrid(layout.rows) }
  };
}

function countOccurrences(grid, letter) {
  let n = 0;
  for (const row of grid)
    for (const cell of row)
      if (cell.type === 'letter' && cell.letter === letter && !cell.revealed) n++;
  return n;
}

function revealLetter(grid, letter) {
  let n = 0;
  for (const row of grid)
    for (const cell of row)
      if (cell.type === 'letter' && cell.letter === letter && !cell.revealed) {
        cell.revealed = true;
        n++;
      }
  return n;
}

// Positions of currently-unrevealed cells matching `letter`, in row-major
// (top-left -> bottom-right) order.
function letterPositions(grid, letter) {
  const out = [];
  for (let r = 0; r < grid.length; r++)
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c];
      if (cell.type === 'letter' && cell.letter === letter && !cell.revealed)
        out.push({ row: r, col: c, letter });
    }
  return out;
}

// All currently-unrevealed letter cells, in row-major order. Used by the Triplete
// to pick which cell to reveal/flash next.
function hiddenLetterCells(grid) {
  const out = [];
  for (let r = 0; r < grid.length; r++)
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c];
      if (cell.type === 'letter' && !cell.revealed) out.push({ row: r, col: c, letter: cell.letter });
    }
  return out;
}

// Reveal a single cell by position. Returns its letter, or null if it isn't a letter cell.
function revealCellAt(grid, row, col) {
  const cell = grid[row] && grid[row][col];
  if (!cell || cell.type !== 'letter') return null;
  cell.revealed = true;
  return cell.letter;
}

function isSolved(grid) {
  for (const row of grid)
    for (const cell of row)
      if (cell.type === 'letter' && !cell.revealed) return false;
  return true;
}

function revealAll(grid) {
  for (const row of grid)
    for (const cell of row)
      if (cell.type === 'letter') cell.revealed = true;
}

function isVowel(letter) {
  return VOWELS.has(letter);
}

function isConsonant(letter) {
  return /^[A-Z]$/.test(letter) && !VOWELS.has(letter);
}

module.exports = {
  normalize, layoutPhrase, buildGrid, createBoard,
  countOccurrences, revealLetter, letterPositions, isSolved, revealAll, isVowel, isConsonant,
  hiddenLetterCells, revealCellAt,
  VOWELS, ROW_CAPACITIES, GRID_WIDTH
};
