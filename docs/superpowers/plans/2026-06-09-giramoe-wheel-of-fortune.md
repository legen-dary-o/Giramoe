# Giramoe v2 — Wheel of Fortune Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Giramoe into a 3-board Wheel-of-Fortune game with a points wheel, a hidden-phrase board, consonant/vowel mechanics, per-player round points + bank, and a match-end screen.

**Architecture:** Authoritative game logic moves out of `server.js` into two pure, unit-tested server modules — `board.js` (phrase normalization, grid layout, reveal) and `game.js` (turn state machine + scoring + board lifecycle). `server.js` becomes a thin Socket.IO layer that maps client intents to those modules and broadcasts state. The three browser views (main screen, admin, player) render state and send intents.

**Tech Stack:** Node.js, Express, Socket.IO, HTML5 Canvas. Tests use Node's built-in test runner (`node --test`, `node:test` + `node:assert`) — zero new dependencies. `socket.io-client` is used as a dev-only dependency for the integration test.

**Spec:** `docs/superpowers/specs/2026-06-09-giramoe-wheel-of-fortune-design.md`

**Working directory for all commands:** `/Users/mario_dangelo/Documents/Giramoe`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `board.js` (new) | Phrase normalize, word-wrap layout into [14,16,16,14] grid, occurrence count, reveal, solved check, letter classification. Pure functions. |
| `game.js` (new) | Turn state machine, scoring, vowel gating, specials (next/bancarotta/raddoppia), solve, board lifecycle. Operates on a game object; pure logic (RNG injected). |
| `server.js` (rewrite) | Socket.IO layer: wires intents → `game.js`/`board.js`, owns RNG for spins, broadcasts state to main/admin/players, tracks board number + match end. |
| `tests/board.test.js` (new) | Unit tests for `board.js`. |
| `tests/game.test.js` (new) | Unit tests for `game.js`. |
| `tests/integration.test.js` (new) | Socket.IO end-to-end match test. |
| `public/js/wheel.js` (modify) | Value labels, special-segment colors, glass borders, pointer touching the rim. |
| `public/index.html` + `public/js/main.js` (modify) | Fullscreen video, category banner, board grid render, score bar. |
| `public/play.html` + `public/js/player.js` (modify) | Spin/keyboard/vowel UI, turn-state gating, round points + bank. |
| `public/admin.html` + `public/js/admin.js` (modify) | Board setup form, solve/pass buttons, live scores, board number, match end. |
| `public/css/style.css` (modify) | Board grid, keyboard, banner, fullscreen video styles. |

**Wheel segment values (index 0→15, clockwise from pointer):**
`[1000, 'bancarotta', 'raddoppia', 200, 400, 500, 'next', 400, 300, 700, 500, 'next', 400, 300, 500, 'next']`

---

## Task 1: Test infra + board layout

**Files:**
- Modify: `package.json`
- Create: `board.js`
- Create: `tests/board.test.js`

- [ ] **Step 1: Add test script and dev dependency to package.json**

Replace the entire contents of `package.json` with:

```json
{
  "name": "giramoe",
  "version": "2.0.0",
  "description": "Interactive live party game with spinning wheel",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "test": "node --test"
  },
  "dependencies": {
    "express": "^4.21.0",
    "socket.io": "^4.8.0"
  },
  "devDependencies": {
    "socket.io-client": "^4.8.0"
  }
}
```

Run: `npm install`
Expected: installs `socket.io-client` into devDependencies, no errors.

- [ ] **Step 2: Write failing tests for normalize + layout**

Create `tests/board.test.js`:

```javascript
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
  // SOLE is 4 letters -> 4 letter cells on row 0
  const letterCells = grid.flat().filter(c => c.type === 'letter');
  assert.strictEqual(letterCells.length, 4);
  assert.ok(letterCells.every(c => c.revealed === false));
  assert.deepStrictEqual(letterCells.map(c => c.letter), ['S', 'O', 'L', 'E']);
});

test('row capacities are 14/16/16/14 with blocked corners on rows 0 and 3', () => {
  const res = board.createBoard('X', 'A');
  const grid = res.board.grid;
  // first and last cell of rows 0 and 3 must always be blocked
  assert.strictEqual(grid[0][0].type, 'blocked');
  assert.strictEqual(grid[0][15].type, 'blocked');
  assert.strictEqual(grid[3][0].type, 'blocked');
  assert.strictEqual(grid[3][15].type, 'blocked');
});

test('words never split across rows; long phrase wraps', () => {
  const res = board.createBoard('CAT', 'QUANDO ARRIVA LA BELLA STAGIONE ESTIVA');
  assert.strictEqual(res.ok, true);
  // Reconstruct words per row from letter runs and ensure each original word is intact on one row
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
```

- [ ] **Step 3: Run tests, verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../board'`.

- [ ] **Step 4: Implement board.js layout half**

Create `board.js`:

```javascript
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
// Each row's joined content is centered within its usable width; rows 0 and 3
// have one permanently-blocked cell on each side.
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
      let ch = null;
      if (usableCol >= 0 && usableCol < cap) {
        const idx = usableCol - pad;
        if (idx >= 0 && idx < content.length) ch = content[idx];
      }
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

module.exports = { normalize, layoutPhrase, buildGrid, createBoard, VOWELS, ROW_CAPACITIES, GRID_WIDTH };
```

- [ ] **Step 5: Run tests, verify they pass**

Run: `npm test`
Expected: PASS — all 6 board tests green.

- [ ] **Step 6: Commit**

```bash
cd /Users/mario_dangelo/Documents/Giramoe
git add package.json package-lock.json board.js tests/board.test.js
git commit -m "feat: board phrase layout module with tests"
```

---

## Task 2: Board reveal + letter classification

**Files:**
- Modify: `board.js`
- Modify: `tests/board.test.js`

- [ ] **Step 1: Append failing tests for reveal/count/classify**

Append to `tests/board.test.js`:

```javascript
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
  // counting C again now yields 0 (already revealed)
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
```

- [ ] **Step 2: Run tests, verify the new ones fail**

Run: `npm test`
Expected: FAIL — `board.countOccurrences is not a function`.

- [ ] **Step 3: Implement reveal/count/classify in board.js**

In `board.js`, add these functions before `module.exports`:

```javascript
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
```

Then replace the `module.exports` line with:

```javascript
module.exports = {
  normalize, layoutPhrase, buildGrid, createBoard,
  countOccurrences, revealLetter, isSolved, revealAll, isVowel, isConsonant,
  VOWELS, ROW_CAPACITIES, GRID_WIDTH
};
```

- [ ] **Step 4: Run tests, verify all pass**

Run: `npm test`
Expected: PASS — all 11 board tests green.

- [ ] **Step 5: Commit**

```bash
cd /Users/mario_dangelo/Documents/Giramoe
git add board.js tests/board.test.js
git commit -m "feat: board reveal, occurrence count, letter classification"
```

---

## Task 3: Game state machine + scoring

**Files:**
- Create: `game.js`
- Create: `tests/game.test.js`

The game object shape (created by `createGame`):

```
{
  players: [{ id, name, roundPoints, bank }, ...],
  segments: [1000,'bancarotta','raddoppia',200,...],   // 16 entries
  board: { category, phrase, grid } | null,
  boardNumber: 1,
  currentTurnIndex: 0,
  turnState: 'MUST_SPIN' | 'PICK_CONSONANT' | 'PICK_CONSONANT_DOUBLE' | 'CONTINUE',
  lastSpinValue: null,        // numeric value of the current spin (for scoring)
  hasScoredConsonant: false,  // unlocks vowel buying this turn
  usedLetters: []             // letters that were present and got revealed (disabled for all)
}
```

Note: there is no separate `PICK_VOWEL` server state — the buy-vowel intent carries the letter and is handled atomically from `CONTINUE`.

- [ ] **Step 1: Write failing tests for game logic**

Create `tests/game.test.js`:

```javascript
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
  // segment index 3 is value 200
  const res = game.applySpin(g, 3);
  assert.deepStrictEqual(res, { type: 'number', value: 200 });
  assert.strictEqual(g.turnState, 'PICK_CONSONANT');
  assert.strictEqual(g.lastSpinValue, 200);
});

test('present consonant scores value x occurrences and keeps the turn', () => {
  const g = newGame('CECE'); // two C, two E
  game.applySpin(g, 3); // 200
  const res = game.applyConsonant(g, 'C');
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.present, true);
  assert.strictEqual(res.count, 2);
  assert.strictEqual(g.players[0].roundPoints, 400); // 200 * 2
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
  assert.strictEqual(g.players[0].roundPoints, 2000); // kept
  assert.strictEqual(g.currentTurnIndex, 1);          // passed
  assert.strictEqual(g.turnState, 'MUST_SPIN');
  assert.strictEqual(g.hasScoredConsonant, false);    // reset
});

test('next passes the turn, round points kept', () => {
  const g = newGame();
  game.applySpin(g, 0); game.applyConsonant(g, 'C'); // P1 has points
  const before = g.players[0].roundPoints;
  game.applySpin(g, 6); // index 6 is 'next'
  assert.strictEqual(g.currentTurnIndex, 1);
  assert.strictEqual(g.players[0].roundPoints, before);
});

test('bancarotta wipes round points AND bank of current player, passes turn', () => {
  const g = newGame();
  g.players[0].bank = 5000;
  game.applySpin(g, 0); game.applyConsonant(g, 'C'); // some round points
  const res = game.applySpin(g, 1); // 'bancarotta'
  assert.strictEqual(res.type, 'bancarotta');
  assert.strictEqual(g.players[0].roundPoints, 0);
  assert.strictEqual(g.players[0].bank, 0);
  assert.strictEqual(g.currentTurnIndex, 1);
});

test('raddoppia doubles round points when consonant present', () => {
  const g = newGame('CECE');
  game.applySpin(g, 0); game.applyConsonant(g, 'C'); // 1000*2 = 2000
  assert.strictEqual(g.players[0].roundPoints, 2000);
  game.applySpin(g, 2); // 'raddoppia'
  assert.strictEqual(g.turnState, 'PICK_CONSONANT_DOUBLE');
  const res = game.applyConsonant(g, 'E'); // present
  assert.strictEqual(res.present, true);
  assert.strictEqual(g.players[0].roundPoints, 4000); // doubled
  assert.strictEqual(g.turnState, 'CONTINUE');
});

test('raddoppia with absent consonant passes the turn', () => {
  const g = newGame('CECE');
  game.applySpin(g, 0); game.applyConsonant(g, 'C');
  game.applySpin(g, 2); // raddoppia
  const res = game.applyConsonant(g, 'Z'); // absent
  assert.strictEqual(res.present, false);
  assert.strictEqual(g.currentTurnIndex, 1);
});

test('vowel buy requires hasScoredConsonant and >=500, costs 500, no points per occurrence', () => {
  const g = newGame('CECE'); // E present twice
  // cannot buy vowel before scoring a consonant
  assert.strictEqual(game.canBuyVowel(g), false);
  game.applySpin(g, 0); // 1000
  game.applyConsonant(g, 'C'); // +2000, CONTINUE
  assert.strictEqual(game.canBuyVowel(g), true);
  const res = game.applyVowel(g, 'E');
  assert.strictEqual(res.present, true);
  assert.strictEqual(res.count, 2);
  assert.strictEqual(g.players[0].roundPoints, 1500); // 2000 - 500, no per-occurrence bonus
  assert.strictEqual(g.turnState, 'CONTINUE');
});

test('vowel buy blocked below 500 round points', () => {
  const g = newGame('CECE');
  game.applySpin(g, 3); // 200
  game.applyConsonant(g, 'C'); // +400 -> 400 < 500
  assert.strictEqual(game.canBuyVowel(g), false);
  const res = game.applyVowel(g, 'E');
  assert.strictEqual(res.ok, false);
});

test('absent vowel still costs 500 and passes turn', () => {
  const g = newGame('CCCC BBBB'); // no vowels except... none of A E I O U? phrase has no vowels
  game.applySpin(g, 0); // 1000
  game.applyConsonant(g, 'C'); // present (4 C) -> +4000
  const res = game.applyVowel(g, 'A'); // absent
  assert.strictEqual(res.present, false);
  assert.strictEqual(g.players[0].roundPoints, 3500); // 4000 - 500
  assert.strictEqual(g.currentTurnIndex, 1); // passed
});

test('solve banks round points and reports solved', () => {
  const g = newGame('OK');
  game.applySpin(g, 0); game.applyConsonant(g, 'K'); // +1000
  const res = game.applySolve(g);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(g.players[0].bank, 1000);
  // whole board revealed
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
  assert.strictEqual(g.players[1].bank, 1234); // bank preserved
  assert.strictEqual(g.currentTurnIndex, 1);   // rotated starter
  assert.strictEqual(g.boardNumber, 2);
});

test('startBoard rejects an overflow phrase without mutating the active board', () => {
  const g = newGame('OK');
  const r = game.startBoard(g, 'CAT', 'PAROLA '.repeat(30), 0, 2);
  assert.strictEqual(r.ok, false);
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../game'`.

- [ ] **Step 3: Implement game.js**

Create `game.js`:

```javascript
const board = require('./board');

const SEGMENTS = [
  1000, 'bancarotta', 'raddoppia', 200, 400, 500, 'next', 400,
  300, 700, 500, 'next', 400, 300, 500, 'next'
];

function createGame(players) {
  return {
    players: players.map(p => ({ id: p.id, name: p.name, roundPoints: 0, bank: 0 })),
    segments: SEGMENTS.slice(),
    board: null,
    boardNumber: 1,
    currentTurnIndex: 0,
    turnState: 'MUST_SPIN',
    lastSpinValue: null,
    hasScoredConsonant: false,
    usedLetters: []
  };
}

function currentPlayer(game) {
  return game.players[game.currentTurnIndex];
}

function passTurn(game) {
  game.currentTurnIndex = (game.currentTurnIndex + 1) % game.players.length;
  game.turnState = 'MUST_SPIN';
  game.hasScoredConsonant = false;
  game.lastSpinValue = null;
}

// startBoard(game, category, phrase, startIndex, boardNumber)
function startBoard(game, category, phrase, startIndex, boardNumber) {
  const result = board.createBoard(category, phrase);
  if (!result.ok) return { ok: false, error: result.error };
  game.board = result.board;
  game.boardNumber = boardNumber;
  game.usedLetters = [];
  game.currentTurnIndex = startIndex;
  game.turnState = 'MUST_SPIN';
  game.hasScoredConsonant = false;
  game.lastSpinValue = null;
  game.players.forEach(p => { p.roundPoints = 0; });
  return { ok: true };
}

function applySpin(game, segmentIndex) {
  // A spin is allowed at the start of the turn (MUST_SPIN) and after a correct
  // letter (CONTINUE) — that is the "keep spinning until you miss" loop.
  if (game.turnState !== 'MUST_SPIN' && game.turnState !== 'CONTINUE') return { ok: false };
  const seg = game.segments[segmentIndex];
  if (seg === 'next') {
    passTurn(game);
    return { type: 'next' };
  }
  if (seg === 'bancarotta') {
    const p = currentPlayer(game);
    p.roundPoints = 0;
    p.bank = 0;
    passTurn(game);
    return { type: 'bancarotta' };
  }
  if (seg === 'raddoppia') {
    game.turnState = 'PICK_CONSONANT_DOUBLE';
    return { type: 'raddoppia' };
  }
  game.lastSpinValue = seg;
  game.turnState = 'PICK_CONSONANT';
  return { type: 'number', value: seg };
}

function applyConsonant(game, letter) {
  letter = String(letter).toUpperCase();
  if (game.turnState !== 'PICK_CONSONANT' && game.turnState !== 'PICK_CONSONANT_DOUBLE') {
    return { ok: false };
  }
  if (!board.isConsonant(letter) || game.usedLetters.includes(letter)) {
    return { ok: false };
  }
  const count = board.countOccurrences(game.board.grid, letter);
  const p = currentPlayer(game);
  const doubling = game.turnState === 'PICK_CONSONANT_DOUBLE';

  if (count > 0) {
    board.revealLetter(game.board.grid, letter);
    game.usedLetters.push(letter);
    if (doubling) {
      p.roundPoints = p.roundPoints * 2;
    } else {
      p.roundPoints += game.lastSpinValue * count;
    }
    game.hasScoredConsonant = true;
    game.turnState = 'CONTINUE';
    return { ok: true, present: true, count, solved: board.isSolved(game.board.grid) };
  }
  passTurn(game);
  return { ok: true, present: false, count: 0 };
}

function canBuyVowel(game) {
  const p = currentPlayer(game);
  return game.turnState === 'CONTINUE' && game.hasScoredConsonant && p.roundPoints >= 500;
}

function applyVowel(game, letter) {
  letter = String(letter).toUpperCase();
  if (!canBuyVowel(game)) return { ok: false };
  if (!board.isVowel(letter) || game.usedLetters.includes(letter)) return { ok: false };
  const p = currentPlayer(game);
  p.roundPoints -= 500;
  const count = board.countOccurrences(game.board.grid, letter);
  if (count > 0) {
    board.revealLetter(game.board.grid, letter);
    game.usedLetters.push(letter);
    game.turnState = 'CONTINUE';
    return { ok: true, present: true, count, solved: board.isSolved(game.board.grid) };
  }
  passTurn(game);
  return { ok: true, present: false, count: 0 };
}

function applySolve(game) {
  const p = currentPlayer(game);
  board.revealAll(game.board.grid);
  p.bank += p.roundPoints;
  return { ok: true, solvedBy: p.id };
}

module.exports = {
  SEGMENTS, createGame, currentPlayer, passTurn, startBoard,
  applySpin, applyConsonant, canBuyVowel, applyVowel, applySolve
};
```

- [ ] **Step 4: Run tests, verify all pass**

Run: `npm test`
Expected: PASS — board tests + all game tests green.

- [ ] **Step 5: Commit**

```bash
cd /Users/mario_dangelo/Documents/Giramoe
git add game.js tests/game.test.js
git commit -m "feat: game turn state machine, scoring, board lifecycle with tests"
```

---

## Task 4: Wire server.js + integration test

**Files:**
- Rewrite: `server.js`
- Create: `tests/integration.test.js`

- [ ] **Step 1: Rewrite server.js to use game.js/board.js**

Replace the entire contents of `server.js` with:

```javascript
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');
const game = require('./game');
const board = require('./board');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const PORT = 3000;
const TOTAL_BOARDS = 3;
const SPIN_MS = 6000; // wheel animation duration (must match client)

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

let state = {
  phase: 'video',     // video | lobby | playing | matchEnd
  roomCode: null,
  lobby: [],          // [{ name, socketId, connected }]
  g: null             // game object once playing
};

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

// --- Serialization for clients ---

function publicScores() {
  return state.g.players.map(p => ({ id: p.id, name: p.name, roundPoints: p.roundPoints, bank: p.bank }));
}

function boardView() {
  return {
    category: state.g.board.category,
    grid: state.g.board.grid.map(row => row.map(cell =>
      cell.type === 'letter'
        ? { type: 'letter', revealed: cell.revealed, letter: cell.revealed ? cell.letter : null }
        : { type: 'blocked' }
    ))
  };
}

function mainGameView() {
  return {
    board: boardView(),
    scores: publicScores(),
    currentTurn: state.g.currentTurnIndex,
    boardNumber: state.g.boardNumber,
    totalBoards: TOTAL_BOARDS,
    segments: state.g.segments
  };
}

function adminView() {
  return {
    phase: state.phase,
    roomCode: state.roomCode,
    players: state.phase === 'playing' || state.phase === 'matchEnd'
      ? publicScores()
      : state.lobby.map((p, i) => ({ id: i, name: p.name, connected: p.connected })),
    boardNumber: state.g ? state.g.boardNumber : 0,
    totalBoards: TOTAL_BOARDS,
    currentTurn: state.g ? state.g.currentTurnIndex : 0,
    turnState: state.g ? state.g.turnState : null
  };
}

function playerView(playerIndex) {
  const p = state.g.players[playerIndex];
  return {
    isMyTurn: state.g.currentTurnIndex === playerIndex,
    turnState: state.g.turnState,
    roundPoints: p.roundPoints,
    bank: p.bank,
    usedLetters: state.g.usedLetters,
    canBuyVowel: state.g.currentTurnIndex === playerIndex && game.canBuyVowel(state.g),
    currentTurnName: state.g.players[state.g.currentTurnIndex].name
  };
}

function broadcastPlaying() {
  io.to('main').emit('main:gameState', mainGameView());
  io.to('admin').emit('admin:state', adminView());
  state.g.players.forEach((p, i) => {
    io.to(state.lobby[i].socketId).emit('player:turnState', playerView(i));
  });
}

// --- Socket handlers ---

io.on('connection', (socket) => {
  socket.on('admin:init', () => {
    socket.join('admin');
    socket.emit('admin:state', adminView());
  });

  socket.on('main:init', () => {
    socket.join('main');
    socket.emit('main:state', { phase: state.phase });
    if (state.phase === 'playing') socket.emit('main:gameState', mainGameView());
  });

  socket.on('admin:inizia', () => {
    state.phase = 'lobby';
    state.roomCode = generateRoomCode();
    state.lobby = [];
    const url = `http://${getLocalIP()}:${PORT}/play.html?room=${state.roomCode}`;
    io.to('main').emit('main:showLobby', { roomCode: state.roomCode, url, players: [] });
    io.to('admin').emit('admin:state', adminView());
  });

  socket.on('player:join', ({ roomCode, name }) => {
    if (state.roomCode !== roomCode) return socket.emit('player:error', 'Codice stanza non valido');
    if (state.phase !== 'lobby') return socket.emit('player:error', 'La partita non accetta giocatori');
    if (state.lobby.length >= 3) return socket.emit('player:error', 'Lobby piena');

    const playerIndex = state.lobby.length;
    state.lobby.push({ name, socketId: socket.id, connected: true });
    socket.playerIndex = playerIndex;
    socket.emit('player:joined', { playerIndex, name });
    io.to('main').emit('main:playerJoined', { players: state.lobby.map(p => ({ name: p.name, connected: p.connected })) });
    io.to('admin').emit('admin:state', adminView());
  });

  socket.on('admin:startGame', () => {
    if (state.lobby.length !== 3) return;
    state.g = game.createGame(state.lobby.map((p, i) => ({ id: i, name: p.name })));
    state.phase = 'playing';
    // Board 1: starter index 0
    io.to('main').emit('main:startGame');
    state.lobby.forEach(p => io.to(p.socketId).emit('player:gameStarted'));
    io.to('admin').emit('admin:state', adminView());
  });

  socket.on('admin:setBoard', ({ category, phrase }) => {
    if (state.phase !== 'playing' && state.phase !== 'lobby') return;
    if (!state.g) return;
    const startIndex = (state.g.boardNumber - 1) % state.g.players.length;
    const r = game.startBoard(state.g, category, phrase, startIndex, state.g.boardNumber);
    if (!r.ok) return io.to('admin').emit('admin:boardError', r.error);
    broadcastPlaying();
  });

  socket.on('player:spin', () => {
    if (state.phase !== 'playing' || !state.g || !state.g.board) return;
    const pi = socket.playerIndex;
    if (pi !== state.g.currentTurnIndex) return;
    if (state.g.turnState !== 'MUST_SPIN' && state.g.turnState !== 'CONTINUE') return;

    const winningSegment = Math.floor(Math.random() * 16);
    const extra = 5 + Math.floor(Math.random() * 3);
    const totalAngle = extra * 360 + (360 - winningSegment * 22.5 - 11.25);
    const result = game.applySpin(state.g, winningSegment);

    const spinData = { winningSegment, totalAngle, value: state.g.segments[winningSegment], result };
    io.to('main').emit('main:spin', spinData);
    io.to(socket.id).emit('player:spinResult', spinData);

    // Let the wheel animation play, then broadcast the resolved state.
    setTimeout(() => broadcastPlaying(), SPIN_MS + 200);
  });

  socket.on('player:pickConsonant', ({ letter }) => {
    if (state.phase !== 'playing' || !state.g || !state.g.board) return;
    if (socket.playerIndex !== state.g.currentTurnIndex) return;
    const res = game.applyConsonant(state.g, letter);
    if (!res.ok) return;
    io.to('main').emit('main:reveal', { letter: String(letter).toUpperCase(), present: res.present, count: res.count });
    broadcastPlaying();
  });

  socket.on('player:buyVowel', ({ letter }) => {
    if (state.phase !== 'playing' || !state.g || !state.g.board) return;
    if (socket.playerIndex !== state.g.currentTurnIndex) return;
    const res = game.applyVowel(state.g, letter);
    if (!res.ok) return;
    io.to('main').emit('main:reveal', { letter: String(letter).toUpperCase(), present: res.present, count: res.count });
    broadcastPlaying();
  });

  socket.on('admin:solve', () => {
    if (state.phase !== 'playing' || !state.g) return;
    game.applySolve(state.g);
    io.to('main').emit('main:reveal', { letter: null, present: true, count: 0 });

    if (state.g.boardNumber >= TOTAL_BOARDS) {
      state.phase = 'matchEnd';
      const standings = state.g.players
        .map(p => ({ name: p.name, bank: p.bank }))
        .sort((a, b) => b.bank - a.bank);
      io.to('main').emit('main:matchEnd', { standings });
      io.to('admin').emit('admin:state', adminView());
      state.lobby.forEach(p => io.to(p.socketId).emit('player:matchEnd', { standings }));
    } else {
      state.g.boardNumber += 1;
      broadcastPlaying(); // reveals full board; admin sets the next board next
      io.to('admin').emit('admin:boardSolved', { boardNumber: state.g.boardNumber });
    }
  });

  socket.on('admin:passTurn', () => {
    if (state.phase !== 'playing' || !state.g) return;
    game.passTurn(state.g);
    broadcastPlaying();
  });

  socket.on('disconnect', () => {
    const p = state.lobby.find(pl => pl.socketId === socket.id);
    if (p) {
      p.connected = false;
      io.to('main').emit('main:playerDisconnected', { players: state.lobby.map(x => ({ name: x.name, connected: x.connected })) });
      io.to('admin').emit('admin:state', adminView());
    }
  });

  socket.on('player:reconnect', ({ roomCode, name }) => {
    const p = state.lobby.find(pl => pl.name === name && !pl.connected);
    if (!p) return socket.emit('player:error', 'Impossibile riconnettersi');
    p.socketId = socket.id;
    p.connected = true;
    socket.playerIndex = state.lobby.indexOf(p);
    socket.emit('player:reconnected', { playerIndex: socket.playerIndex, name, phase: state.phase });
    if (state.phase === 'playing' && state.g) {
      socket.emit('player:turnState', playerView(socket.playerIndex));
    }
    io.to('main').emit('main:playerReconnected', { players: state.lobby.map(x => ({ name: x.name, connected: x.connected })) });
    io.to('admin').emit('admin:state', adminView());
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log('Giramoe server running!');
  console.log(`Main screen: http://${ip}:${PORT}`);
  console.log(`Admin:       http://${ip}:${PORT}/admin.html`);
});

module.exports = { app, server };
```

- [ ] **Step 2: Write the integration test**

Create `tests/integration.test.js`:

```javascript
const { test } = require('node:test');
const assert = require('node:assert');
const { io } = require('socket.io-client');

const BASE = 'http://localhost:3000';
const wait = (ms) => new Promise(r => setTimeout(r, ms));
function connect() { return io(BASE, { transports: ['websocket'], forceNew: true }); }

test('full 1-board flow: lobby, set board, spin, score, solve', async () => {
  // server is started by the test runner harness below
  const admin = connect();
  const main = connect();
  let adminState = null, mainGame = null, lastSpin = null;
  admin.on('admin:state', s => { adminState = s; });
  main.on('main:gameState', g => { mainGame = g; });
  main.on('main:spin', d => { lastSpin = d; });

  admin.emit('admin:init'); main.emit('main:init');
  await wait(200);
  admin.emit('admin:inizia');
  await wait(200);
  const roomCode = adminState.roomCode;
  assert.ok(roomCode);

  const players = [];
  const pstate = [];
  for (let i = 0; i < 3; i++) {
    const p = connect();
    const st = { turn: null, joined: null };
    p.on('player:joined', d => { st.joined = d; });
    p.on('player:turnState', d => { st.turn = d; });
    players.push(p); pstate.push(st);
    await wait(100);
    p.emit('player:join', { roomCode, name: 'P' + (i + 1) });
    await wait(150);
  }
  admin.emit('admin:startGame');
  await wait(200);

  // set a board with a known phrase
  admin.emit('admin:setBoard', { category: 'TEST', phrase: 'SOLE' });
  await wait(200);
  assert.strictEqual(mainGame.board.category, 'TEST');
  assert.strictEqual(mainGame.boardNumber, 1);

  // P1 spins; we can't control the outcome, but the state must resolve
  players[0].emit('player:spin');
  await wait(6500);
  assert.ok(lastSpin, 'main received a spin');
  assert.ok(mainGame.scores, 'scores present');

  // Force a solve from the admin and verify match continues to board 2
  admin.emit('admin:solve');
  await wait(200);
  // board solved -> boardNumber advanced to 2 (since TOTAL_BOARDS=3)
  assert.strictEqual(adminState.boardNumber, 2);

  [admin, main, ...players].forEach(s => s.close());
  await wait(100);
});
```

- [ ] **Step 3: Run the integration test against a live server**

Run:
```bash
cd /Users/mario_dangelo/Documents/Giramoe
node server.js > /tmp/giramoe-it.log 2>&1 &
SERVER_PID=$!
sleep 2
node --test tests/integration.test.js
TEST_EXIT=$?
kill $SERVER_PID 2>/dev/null
exit $TEST_EXIT
```
Expected: PASS — the integration test resolves a full board and advances to board 2.

(Note: `npm test` also runs this file, but it needs a live server. If you run the whole suite, start the server first, or run unit files explicitly with `node --test tests/board.test.js tests/game.test.js`.)

- [ ] **Step 4: Verify unit suites still pass**

Run: `node --test tests/board.test.js tests/game.test.js`
Expected: PASS — board + game unit tests green.

- [ ] **Step 5: Commit**

```bash
cd /Users/mario_dangelo/Documents/Giramoe
git add server.js tests/integration.test.js
git commit -m "feat: socket layer wired to game/board modules + integration test"
```

---

## Task 5: Main screen — fullscreen video, restyled wheel, category + board

**Files:**
- Modify: `public/js/wheel.js`
- Modify: `public/index.html`
- Modify: `public/js/main.js`
- Modify: `public/css/style.css`

- [ ] **Step 1: Update wheel.js for value labels, special colors, pointer-touching rim**

In `public/js/wheel.js`, add a style map after the `SEGMENT_COLORS` array:

```javascript
const SPECIAL_STYLE = {
  bancarotta: { fill: '#161616', text: '#ffffff' },
  next:       { fill: '#9ca3af', text: '#ffffff' },
  raddoppia:  { fill: '#f5b301', text: '#ffffff' }
};
```

In the `resize()` method, change the size factor so the wheel nearly fills its container (the pointer will sit on the rim). Replace this line:

```javascript
    const size = Math.min(container.clientWidth, container.clientHeight) * 0.85;
```

with:

```javascript
    const size = Math.min(container.clientWidth, container.clientHeight) * 0.96;
```

In the `draw()` method, replace the segment fill + label block. Find the loop body that fills the segment and draws the label, and replace the **fill color** logic and **label** logic so the value text and special colors are used. Specifically, replace this part:

```javascript
      ctx.fillStyle = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
      ctx.fill();
```

with:

```javascript
      const label = this.labels[i];
      const special = SPECIAL_STYLE[label];
      ctx.fillStyle = special ? special.fill : SEGMENT_COLORS[i % SEGMENT_COLORS.length];
      ctx.fill();
```

And replace the label-drawing block:

```javascript
      if (this.showLabels && this.labels[i]) {
        ctx.save();
        const midAngle = startAngle + segAngle / 2;
        ctx.rotate(midAngle);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(11, r * 0.07)}px -apple-system, sans-serif`;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 3;

        const text = this.labels[i];
        const maxWidth = r * 0.55;
        const truncated = this.truncateText(ctx, text, maxWidth);
        ctx.fillText(truncated, r * 0.88, 0);
        ctx.restore();
      }
```

with:

```javascript
      if (this.showLabels && this.labels[i] != null) {
        ctx.save();
        const midAngle = startAngle + segAngle / 2;
        ctx.rotate(midAngle);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = special ? special.text : '#ffffff';
        const text = String(this.labels[i]).toUpperCase();
        const isWord = !!special;
        ctx.font = `bold ${Math.max(10, r * (isWord ? 0.05 : 0.08))}px -apple-system, sans-serif`;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        ctx.shadowBlur = 3;
        const maxWidth = r * 0.62;
        const truncated = this.truncateText(ctx, text, maxWidth);
        ctx.fillText(truncated, r * 0.92, 0);
        ctx.restore();
      }
```

The existing per-segment white border + glass gradient already give the liquid-glass divider look; leave them as-is.

- [ ] **Step 2: Update index.html — fullscreen video, category banner, board, score bar**

Replace the **game-screen** `<div>` block in `public/index.html` (the `<div id="game-screen" ...>` through its closing `</div>` before the disconnect overlay) with:

```html
  <!-- Game Screen -->
  <div id="game-screen" class="screen hidden">
    <div class="game-container">
      <div class="board-meta">
        <span class="board-counter" id="board-counter"></span>
      </div>
      <div class="wheel-container" id="main-wheel-container">
        <div class="wheel-indicator"></div>
        <canvas id="main-wheel-canvas"></canvas>
      </div>
      <div class="category-banner glass-panel" id="category-banner"></div>
      <div class="board-grid" id="board-grid"></div>
      <div class="players-bar" id="players-bar"></div>
    </div>

    <div class="result-overlay" id="result-overlay">
      <div class="result-text" id="result-text"></div>
    </div>
  </div>

  <!-- Match End Screen -->
  <div id="matchend-screen" class="screen hidden">
    <div class="game-container">
      <h1 class="matchend-title">Classifica finale</h1>
      <div class="standings" id="standings"></div>
    </div>
  </div>
```

- [ ] **Step 3: Update main.js — render board, scores, banner, match end**

Replace the entire contents of `public/js/main.js` with:

```javascript
const socket = io();
let wheel = null;

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

const video = document.getElementById('intro-video');
video.addEventListener('ended', () => showScreen('start-screen'));
video.addEventListener('error', () => showScreen('start-screen'));

socket.emit('main:init');

socket.on('main:state', ({ phase }) => {
  if (phase === 'video') showScreen('video-screen');
  else if (phase === 'lobby') showScreen('lobby-screen');
  else if (phase === 'playing') showScreen('game-screen');
  else if (phase === 'matchEnd') showScreen('matchend-screen');
});

socket.on('main:showLobby', ({ url, players }) => {
  showScreen('lobby-screen');
  QRCode.toCanvas(document.getElementById('qr-canvas'), url, {
    width: 220, margin: 2, color: { dark: '#1a1a1a', light: '#ffffff' }
  });
  updatePlayerSlots(players);
});

socket.on('main:playerJoined', ({ players }) => updatePlayerSlots(players));

socket.on('main:startGame', () => {
  showScreen('game-screen');
});

socket.on('main:gameState', (g) => {
  showScreen('game-screen');
  if (!wheel) initMainWheel(g.segments);
  document.getElementById('board-counter').textContent =
    `Tabellone ${g.boardNumber} / ${g.totalBoards}`;
  document.getElementById('category-banner').textContent = g.board.category;
  renderBoard(g.board.grid);
  renderScores(g.scores, g.currentTurn);
});

socket.on('main:spin', ({ totalAngle, value }) => {
  if (!wheel) return;
  wheel.onSpinEnd = () => showResult(String(value).toUpperCase());
  wheel.spinTo(totalAngle, 6000);
});

socket.on('main:reveal', () => { /* board re-render arrives via main:gameState */ });

socket.on('main:matchEnd', ({ standings }) => {
  showScreen('matchend-screen');
  const el = document.getElementById('standings');
  el.innerHTML = '';
  standings.forEach((s, i) => {
    const row = document.createElement('div');
    row.className = 'standing-row glass-panel' + (i === 0 ? ' winner' : '');
    row.innerHTML = `<span>${i + 1}. ${s.name}</span><span>${s.bank}</span>`;
    el.appendChild(row);
  });
});

socket.on('main:playerDisconnected', () =>
  document.getElementById('disconnect-overlay').classList.add('visible'));
socket.on('main:playerReconnected', () =>
  document.getElementById('disconnect-overlay').classList.remove('visible'));

// --- rendering helpers ---

function updatePlayerSlots(players) {
  for (let i = 0; i < 3; i++) {
    const slot = document.getElementById(`slot-${i}`);
    if (players[i]) { slot.textContent = players[i].name; slot.classList.add('filled'); }
    else { slot.textContent = '—'; slot.classList.remove('filled'); }
  }
}

function initMainWheel(segments) {
  const canvas = document.getElementById('main-wheel-canvas');
  wheel = new Wheel(canvas, { segments: 16, labels: segments, showLabels: true });
  window.addEventListener('resize', () => wheel.resize());
}

function renderBoard(grid) {
  const el = document.getElementById('board-grid');
  el.innerHTML = '';
  for (const row of grid) {
    for (const cell of row) {
      const div = document.createElement('div');
      if (cell.type === 'blocked') {
        div.className = 'cell blocked';
      } else if (cell.revealed) {
        div.className = 'cell letter revealed';
        div.textContent = cell.letter;
      } else {
        div.className = 'cell letter';
      }
      el.appendChild(div);
    }
  }
}

function renderScores(scores, currentTurn) {
  const bar = document.getElementById('players-bar');
  bar.innerHTML = '';
  scores.forEach((s, i) => {
    const el = document.createElement('div');
    el.className = 'player-name glass-panel' + (i === currentTurn ? ' active' : '');
    el.innerHTML = `<div class="pn-name">${s.name}</div>
      <div class="pn-score">Turno: ${s.roundPoints}</div>
      <div class="pn-bank">Banca: ${s.bank}</div>`;
    bar.appendChild(el);
  });
}

function showResult(text) {
  const overlay = document.getElementById('result-overlay');
  document.getElementById('result-text').textContent = text;
  overlay.classList.add('visible');
  setTimeout(() => overlay.classList.remove('visible'), 2500);
}
```

- [ ] **Step 4: Add styles for fullscreen video, board grid, banner, standings**

Append to `public/css/style.css`:

```css
/* === FULLSCREEN VIDEO === */
#video-screen { background: #000; }
#intro-video {
  width: 100vw;
  height: 100vh;
  object-fit: cover;
}

/* === GAME LAYOUT (main screen) === */
.board-meta { margin-bottom: 4px; }
.board-counter {
  font-size: 18px;
  font-weight: 600;
  color: #888;
}

.category-banner {
  padding: 10px 32px;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: #1a1a1a;
}

/* Board grid: 16 columns x 4 rows */
.board-grid {
  display: grid;
  grid-template-columns: repeat(16, 1fr);
  gap: 4px;
  width: min(92vw, 1100px);
}

.cell {
  aspect-ratio: 1 / 1;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(10px, 2.2vw, 30px);
  font-weight: 700;
  color: #1a1a1a;
}

.cell.blocked {
  background: linear-gradient(135deg, #ff5a7a 0%, #e23a5e 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.cell.letter {
  background: linear-gradient(135deg, #ffffff 0%, #eef3ff 100%);
  border: 1px solid rgba(180, 200, 255, 0.7);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 1px 3px rgba(0, 0, 0, 0.08);
}

.player-name .pn-name { font-size: 18px; font-weight: 700; }
.player-name .pn-score { font-size: 14px; color: #4facfe; }
.player-name .pn-bank { font-size: 13px; color: #888; }
.player-name { display: flex; flex-direction: column; gap: 2px; min-width: 130px; }

/* Pointer touching the rim */
.wheel-indicator { top: -4px; }

/* Match end */
.matchend-title {
  font-size: 36px; font-weight: 800; margin-bottom: 24px;
  background: linear-gradient(135deg, #4facfe, #a855f7);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
}
.standings { display: flex; flex-direction: column; gap: 12px; width: min(80vw, 420px); }
.standing-row { display: flex; justify-content: space-between; padding: 16px 24px; font-size: 22px; font-weight: 600; }
.standing-row.winner { box-shadow: 0 0 24px rgba(245, 179, 1, 0.5); border: 1px solid rgba(245, 179, 1, 0.7); }
```

- [ ] **Step 5: Manual verification note**

Run: `npm start`, open `http://localhost:3000` on the PC. Confirm: video is fullscreen; after starting a game + setting a board from admin, the wheel shows value labels with black `BANCAROTTA`, grey `NEXT`, gold `RADDOPPIA`; the category banner and the 14/16/16/14 board render below the wheel; player score cards show Turno + Banca. (Full driven verification happens in Task 8.) Stop the server when done.

- [ ] **Step 6: Commit**

```bash
cd /Users/mario_dangelo/Documents/Giramoe
git add public/js/wheel.js public/index.html public/js/main.js public/css/style.css
git commit -m "feat: main screen restyle — fullscreen video, value wheel, category + board"
```

---

## Task 6: Player view — spin, keyboard, vowel gating, scores

**Files:**
- Modify: `public/play.html`
- Modify: `public/js/player.js`
- Modify: `public/css/style.css`

- [ ] **Step 1: Update play.html game screen**

Replace the **player game screen** block in `public/play.html` (the `<div id="player-game-screen" ...>` and its contents) with:

```html
  <!-- Game Screen -->
  <div id="player-game-screen" class="screen hidden">
    <div class="mobile-container">
      <div class="score-row">
        <span class="score-pill">Turno: <b id="round-points">0</b></span>
        <span class="score-pill">Banca: <b id="bank-points">0</b></span>
      </div>
      <div class="turn-message" id="turn-message">Attendi il tuo turno</div>
      <div class="wheel-container" id="player-wheel-container">
        <div class="wheel-indicator"></div>
        <canvas id="player-wheel-canvas"></canvas>
      </div>
      <button class="glass-button" id="btn-spin">Gira la ruota</button>
      <div class="keyboard" id="keyboard"></div>
      <button class="glass-button" id="btn-vowel" disabled>Compra vocale (500)</button>
      <div class="vowel-picker hidden" id="vowel-picker"></div>
      <div class="player-nick" id="player-nick-display"></div>
    </div>
  </div>

  <!-- Match End -->
  <div id="player-matchend" class="screen hidden">
    <div class="mobile-container">
      <h2 class="matchend-title">Fine partita!</h2>
      <div class="standings" id="player-standings"></div>
    </div>
  </div>
```

- [ ] **Step 2: Rewrite player.js**

Replace the entire contents of `public/js/player.js` with:

```javascript
const socket = io();
const params = new URLSearchParams(window.location.search);
const roomCode = params.get('room');

const CONSONANTS = 'BCDFGHJKLMNPQRSTVWXYZ'.split('');
const VOWELS = 'AEIOU'.split('');

let playerWheel = null;
let myIndex = -1;
let myName = '';

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

// --- Join ---
document.getElementById('btn-join').addEventListener('click', () => {
  const name = document.getElementById('nick-input').value.trim();
  if (!name) return;
  myName = name;
  const saved = sessionStorage.getItem('giramoe-player');
  if (saved) {
    const data = JSON.parse(saved);
    if (data.roomCode === roomCode) { socket.emit('player:reconnect', { roomCode, name: data.name }); return; }
  }
  socket.emit('player:join', { roomCode, name });
});
document.getElementById('nick-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-join').click();
});

// --- Connection events ---
socket.on('player:joined', ({ playerIndex, name }) => {
  myIndex = playerIndex; myName = name;
  sessionStorage.setItem('giramoe-player', JSON.stringify({ roomCode, name }));
  showScreen('wait-screen');
});
socket.on('player:error', msg => alert(msg));
socket.on('player:gameStarted', () => {
  showScreen('player-game-screen');
  document.getElementById('player-nick-display').textContent = myName;
  initWheel();
  buildKeyboard();
});
socket.on('player:reconnected', ({ playerIndex, name, phase }) => {
  myIndex = playerIndex; myName = name;
  if (phase === 'playing') {
    showScreen('player-game-screen');
    document.getElementById('player-nick-display').textContent = myName;
    initWheel();
    buildKeyboard();
  } else showScreen('wait-screen');
});

socket.on('player:spinResult', ({ totalAngle }) => {
  if (playerWheel) playerWheel.spinTo(totalAngle, 6000);
});

socket.on('player:turnState', (st) => {
  document.getElementById('round-points').textContent = st.roundPoints;
  document.getElementById('bank-points').textContent = st.bank;
  applyTurnState(st);
});

socket.on('player:matchEnd', ({ standings }) => {
  showScreen('player-matchend');
  const el = document.getElementById('player-standings');
  el.innerHTML = '';
  standings.forEach((s, i) => {
    const row = document.createElement('div');
    row.className = 'standing-row glass-panel' + (i === 0 ? ' winner' : '');
    row.innerHTML = `<span>${i + 1}. ${s.name}</span><span>${s.bank}</span>`;
    el.appendChild(row);
  });
});

// --- Wheel + spin ---
function initWheel() {
  const canvas = document.getElementById('player-wheel-canvas');
  playerWheel = new Wheel(canvas, { segments: 16, labels: [], showLabels: false });
  canvas.addEventListener('click', spin);
  window.addEventListener('resize', () => playerWheel.resize());
}
document.getElementById('btn-spin').addEventListener('click', spin);
function spin() {
  socket.emit('player:spin');
}

// --- Keyboard ---
// The consonant keyboard (#keyboard) is built once and never rebuilt; turn-state
// updates only toggle disabled states. The vowel picker (#vowel-picker) is a
// separate element shown/hidden by the "Compra vocale" button.
function buildKeyboard() {
  const kb = document.getElementById('keyboard');
  kb.innerHTML = '';
  CONSONANTS.forEach(letter => {
    const b = document.createElement('button');
    b.className = 'key';
    b.textContent = letter;
    b.dataset.letter = letter;
    b.addEventListener('click', () => socket.emit('player:pickConsonant', { letter }));
    kb.appendChild(b);
  });

  const vp = document.getElementById('vowel-picker');
  vp.innerHTML = '';
  VOWELS.forEach(letter => {
    const b = document.createElement('button');
    b.className = 'key vowel';
    b.textContent = letter;
    b.dataset.letter = letter;
    b.addEventListener('click', () => {
      socket.emit('player:buyVowel', { letter });
      vp.classList.add('hidden');
    });
    vp.appendChild(b);
  });

  document.getElementById('btn-vowel').addEventListener('click', () => {
    document.getElementById('vowel-picker').classList.toggle('hidden');
  });
}

function markUsedLetters(used) {
  document.querySelectorAll('#keyboard .key, #vowel-picker .key').forEach(b => {
    b.disabled = used.includes(b.dataset.letter);
  });
}

// --- Turn state gating ---
function applyTurnState(st) {
  const msg = document.getElementById('turn-message');
  const spinBtn = document.getElementById('btn-spin');
  const vowelBtn = document.getElementById('btn-vowel');
  const kb = document.getElementById('keyboard');
  const vp = document.getElementById('vowel-picker');
  const container = document.getElementById('player-wheel-container');

  markUsedLetters(st.usedLetters);

  if (!st.isMyTurn) {
    msg.textContent = `Turno di ${st.currentTurnName}`;
    msg.className = 'turn-message waiting';
    spinBtn.disabled = true;
    vowelBtn.disabled = true;
    kb.classList.add('disabled');
    vp.classList.add('hidden');
    container.classList.add('disabled');
    return;
  }

  container.classList.remove('disabled');
  msg.className = 'turn-message your-turn';

  const state = st.turnState;
  const canSpin = state === 'MUST_SPIN' || state === 'CONTINUE';
  const mustConsonant = state === 'PICK_CONSONANT' || state === 'PICK_CONSONANT_DOUBLE';

  spinBtn.disabled = !canSpin;
  vowelBtn.disabled = !st.canBuyVowel;
  kb.classList.toggle('disabled', !mustConsonant);
  if (state !== 'CONTINUE') vp.classList.add('hidden'); // only buyable while continuing

  if (state === 'MUST_SPIN') msg.textContent = 'Tocca a te! Gira la ruota';
  else if (mustConsonant) msg.textContent = state === 'PICK_CONSONANT_DOUBLE'
    ? 'RADDOPPIA! Scegli una consonante' : 'Scegli una consonante';
  else if (state === 'CONTINUE') msg.textContent = 'Rigira, compra vocale o risolvi a voce';
}
```

- [ ] **Step 3: Add player keyboard + score styles**

Append to `public/css/style.css`:

```css
/* === PLAYER KEYBOARD === */
.score-row { display: flex; gap: 12px; }
.score-pill {
  padding: 6px 14px; border-radius: 12px; font-size: 14px; color: #555;
  background: rgba(100, 180, 255, 0.12); border: 1px solid rgba(100, 180, 255, 0.3);
}
.score-pill b { color: #4facfe; }

.keyboard {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
  width: 100%;
  max-width: 360px;
}
.keyboard.disabled { opacity: 0.4; pointer-events: none; }

.key {
  aspect-ratio: 1 / 1;
  border-radius: 12px;
  font-size: 18px; font-weight: 700; color: #1a1a1a;
  background: linear-gradient(135deg, rgba(255,255,255,0.9), rgba(220,235,255,0.5));
  border: 1px solid rgba(180, 200, 255, 0.7);
  box-shadow: inset 0 1px 0 rgba(255,255,255,1), 0 2px 4px rgba(0,0,0,0.06);
  cursor: pointer;
}
.key.vowel { background: linear-gradient(135deg, #ffe9a8, #ffd24d); }
.key:disabled { opacity: 0.3; cursor: not-allowed; }

.vowel-picker {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  width: 100%;
  max-width: 280px;
}
.vowel-picker.hidden { display: none; }
```

- [ ] **Step 4: Syntax check**

Run: `node --check public/js/player.js`
Expected: no output (valid syntax).

- [ ] **Step 5: Commit**

```bash
cd /Users/mario_dangelo/Documents/Giramoe
git add public/play.html public/js/player.js public/css/style.css
git commit -m "feat: player view — spin, consonant/vowel keyboard with turn gating, scores"
```

---

## Task 7: Admin view — board setup, controls, live scores, match end

**Files:**
- Modify: `public/admin.html`
- Modify: `public/js/admin.js`
- Modify: `public/css/style.css`

- [ ] **Step 1: Update admin.html game section**

Replace the **admin game** block in `public/admin.html` (the `<div id="admin-game" ...>` and its contents) with:

```html
  <!-- Game -->
  <div id="admin-game" class="screen hidden">
    <div class="admin-container">
      <h1>Giramoe</h1>
      <div class="admin-section">
        <h2 id="admin-board-counter">Tabellone</h2>
        <input type="text" id="cat-input" class="glass-input" placeholder="Categoria" autocomplete="off">
        <input type="text" id="phrase-input" class="glass-input" placeholder="Frase" autocomplete="off" style="margin-top:8px;">
        <button class="glass-button" id="btn-set-board" style="margin-top:8px;">Avvia tabellone</button>
        <div class="board-error" id="board-error"></div>
      </div>
      <div class="admin-section">
        <h2>Turno: <span id="admin-turn-name">—</span> <span id="admin-turn-state" class="turn-state-tag"></span></h2>
        <div class="admin-player-list" id="admin-scores"></div>
      </div>
      <div class="admin-section admin-actions">
        <button class="glass-button" id="btn-solve">Frase indovinata</button>
        <button class="glass-button" id="btn-pass">Passa turno</button>
      </div>
    </div>
  </div>

  <!-- Match End -->
  <div id="admin-matchend" class="screen hidden">
    <div class="admin-container">
      <h1>Fine partita</h1>
      <div class="admin-player-list" id="admin-standings"></div>
    </div>
  </div>
```

- [ ] **Step 2: Rewrite admin.js**

Replace the entire contents of `public/js/admin.js` with:

```javascript
const socket = io();

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

socket.emit('admin:init');

document.getElementById('btn-inizia').addEventListener('click', () => socket.emit('admin:inizia'));
document.getElementById('btn-avvia').addEventListener('click', () => socket.emit('admin:startGame'));

document.getElementById('btn-set-board').addEventListener('click', () => {
  const category = document.getElementById('cat-input').value.trim();
  const phrase = document.getElementById('phrase-input').value.trim();
  if (!category || !phrase) { showBoardError('Inserisci categoria e frase'); return; }
  showBoardError('');
  socket.emit('admin:setBoard', { category, phrase });
});
document.getElementById('btn-solve').addEventListener('click', () => socket.emit('admin:solve'));
document.getElementById('btn-pass').addEventListener('click', () => socket.emit('admin:passTurn'));

socket.on('admin:state', (s) => {
  if (s.phase === 'video') showScreen('admin-pregame');
  else if (s.phase === 'lobby') {
    showScreen('admin-lobby');
    updateLobby(s.players);
    document.getElementById('btn-avvia').disabled = s.players.length < 3;
  } else if (s.phase === 'playing') {
    showScreen('admin-game');
    renderGame(s);
  } else if (s.phase === 'matchEnd') {
    showScreen('admin-matchend');
  }
});

socket.on('admin:boardError', (err) => showBoardError(err));
socket.on('admin:boardSolved', ({ boardNumber }) => {
  showBoardError('');
  document.getElementById('cat-input').value = '';
  document.getElementById('phrase-input').value = '';
  alert(`Tabellone risolto! Imposta il tabellone ${boardNumber}.`);
});

function updateLobby(players) {
  for (let i = 0; i < 3; i++) {
    const el = document.getElementById(`ap-${i}`);
    if (players[i]) {
      el.querySelector('span:first-child').textContent = players[i].name;
      el.querySelector('.status-dot').classList.remove('disconnected');
    } else {
      el.querySelector('span:first-child').textContent = 'In attesa...';
      el.querySelector('.status-dot').classList.add('disconnected');
    }
  }
}

const STATE_LABEL = {
  MUST_SPIN: 'deve girare',
  PICK_CONSONANT: 'consonante',
  PICK_CONSONANT_DOUBLE: 'consonante (raddoppia)',
  CONTINUE: 'continua/vocale/risolve'
};

function renderGame(s) {
  document.getElementById('admin-board-counter').textContent =
    `Tabellone ${s.boardNumber} / ${s.totalBoards}`;
  const turnPlayer = s.players[s.currentTurn];
  document.getElementById('admin-turn-name').textContent = turnPlayer ? turnPlayer.name : '—';
  document.getElementById('admin-turn-state').textContent = STATE_LABEL[s.turnState] || '';

  const list = document.getElementById('admin-scores');
  list.innerHTML = '';
  s.players.forEach((p, i) => {
    const item = document.createElement('div');
    item.className = 'admin-player-item glass-panel';
    if (i === s.currentTurn) {
      item.style.border = '1px solid rgba(100, 180, 255, 0.5)';
      item.style.boxShadow = '0 0 12px rgba(100, 180, 255, 0.2)';
    }
    item.innerHTML = `<span>${p.name}</span>
      <span class="admin-scorenums">T: <b>${p.roundPoints}</b> · B: <b>${p.bank}</b></span>`;
    list.appendChild(item);
  });

  if (s.phase === 'matchEnd') return;
}

function showBoardError(msg) {
  document.getElementById('board-error').textContent = msg;
}

// Match end standings (admin)
socket.on('admin:state', (s) => {
  if (s.phase === 'matchEnd') {
    const el = document.getElementById('admin-standings');
    el.innerHTML = '';
    s.players.slice().sort((a, b) => b.bank - a.bank).forEach((p, i) => {
      const item = document.createElement('div');
      item.className = 'admin-player-item glass-panel' + (i === 0 ? ' winner' : '');
      item.innerHTML = `<span>${i + 1}. ${p.name}</span><span><b>${p.bank}</b></span>`;
      el.appendChild(item);
    });
  }
});
```

- [ ] **Step 3: Add admin styles**

Append to `public/css/style.css`:

```css
/* === ADMIN GAME === */
.board-error { color: #e23a5e; font-size: 13px; margin-top: 6px; min-height: 16px; }
.admin-actions { display: flex; gap: 10px; }
.admin-actions .glass-button { flex: 1; padding: 14px 12px; font-size: 16px; }
.turn-state-tag { font-size: 12px; font-weight: 500; color: #4facfe; }
.admin-scorenums { font-size: 14px; color: #555; }
.admin-scorenums b { color: #4facfe; }
.admin-player-item.winner { box-shadow: 0 0 16px rgba(245,179,1,0.5); border: 1px solid rgba(245,179,1,0.7); }
```

- [ ] **Step 4: Syntax check**

Run: `node --check public/js/admin.js`
Expected: no output (valid syntax).

- [ ] **Step 5: Commit**

```bash
cd /Users/mario_dangelo/Documents/Giramoe
git add public/admin.html public/js/admin.js public/css/style.css
git commit -m "feat: admin view — board setup, solve/pass controls, live scores, match end"
```

---

## Task 8: Final integration + browser smoke test

**Files:** none (verification only), then update README.

- [ ] **Step 1: Run the full unit suite**

Run: `node --test tests/board.test.js tests/game.test.js`
Expected: PASS — all board + game unit tests green.

- [ ] **Step 2: Run the integration test against a live server**

Run:
```bash
cd /Users/mario_dangelo/Documents/Giramoe
node server.js > /tmp/giramoe-it.log 2>&1 &
SERVER_PID=$!
sleep 2
node --test tests/integration.test.js
TEST_EXIT=$?
kill $SERVER_PID 2>/dev/null
exit $TEST_EXIT
```
Expected: PASS.

- [ ] **Step 3: Browser smoke test via preview**

Create `.claude/launch.json` under the working directory's `.claude` (or reuse an existing preview workflow), start the server, and using the preview/browser tools confirm on the main screen:
- Video is fullscreen (object-fit cover).
- After driving admin → start game → `admin:setBoard {category:'ESTATE', phrase:'SOLE E MARE'}`, the wheel shows value labels (gold RADDOPPIA, black BANCAROTTA, grey NEXT), the category banner reads ESTATE, and the board renders the 14/16/16/14 layout with red blocked cells and white letter cells.
- Drive a player `player:pickConsonant {letter:'R'}` for the current player and confirm matching cells reveal and the score card updates.

Because the preview tab is backgrounded, the wheel **animation** (requestAnimationFrame) will not visibly run — verify board/scores/labels via DOM state and screenshots, exactly as in the v1 verification. Stop the server when done.

- [ ] **Step 4: Update README with the Wheel of Fortune rules**

Replace the "Come si gioca" and "Personalizzare gli spicchi" sections of `README.md` with:

```markdown
## Come si gioca

1. **Schermo principale (PC/TV):** apri `http://<IP>:3000/` — parte il video introduttivo a tutto schermo.
2. **Admin (tuo telefono):** apri `http://<IP>:3000/admin.html`, premi **Inizia** → compare il QR.
3. **Giocatori (max 3):** inquadrano il QR, inseriscono il nome, entrano.
4. Con 3 giocatori, premi **Avvia partita**, poi imposta **categoria** e **frase** del tabellone e premi **Avvia tabellone**.
5. A turno il giocatore **gira la ruota** e chiama una **consonante**:
   - presente → si rivela, guadagna `valore × occorrenze`, continua;
   - assente → passa il turno (punti del turno conservati).
6. Con almeno 500 punti del turno (e dopo aver indovinato una consonante) può **comprare una vocale** (costa 500).
7. Spicchi speciali: **next** passa il turno, **bancarotta** azzera punti turno + banca, **raddoppia** raddoppia i punti del turno se la consonante è presente.
8. Per risolvere, il giocatore dice la frase **a voce**: l'admin preme **Frase indovinata** (rivela tutto, i punti del turno vanno in banca) o **Passa turno** se sbagliata.
9. Si giocano **3 tabelloni**; chi ha più banca alla fine vince.
```

- [ ] **Step 5: Commit**

```bash
cd /Users/mario_dangelo/Documents/Giramoe
git add README.md
git commit -m "docs: update README with Wheel of Fortune rules"
```

---

## Self-Review Notes (author)

- **Spec coverage:** fullscreen video (T5), wheel restyle + pointer (T5/T1-style), category + 14/16/16/14 board (T1, T5), value wheel segments (T3 SEGMENTS, T5 labels), consonant/vowel mechanics + gating (T3, T6), scoring incl. raddoppia/bancarotta/next (T3), round points + bank display (T5/T6/T7), solve + banking (T3/T4), 3 boards + rotation + match end (T4), admin controls (T7), tests (T1-T4, T8). All covered.
- **Pass-turn automation:** rule-based passes happen inside `game.js`; admin `passTurn` only for wrong verbal solve. Matches spec.
- **PICK_VOWEL:** intentionally not a distinct server state; the buy-vowel intent is atomic. Documented in Task 3.
- **Type consistency:** event names and field names (`roundPoints`, `bank`, `usedLetters`, `canBuyVowel`, `turnState`, `currentTurn`, `boardNumber`, `totalBoards`) are consistent across server serialization (T4) and all three clients (T5–T7).
