# Giramoe v3 — Audio, Sequential Reveal & Board Shape Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add main-display audio (intro video sound + four effects), a Wheel-of-Fortune one-letter-at-a-time reveal, a tap-to-start audio-unlock screen, and short top/bottom board rows.

**Architecture:** New pure helpers in `board.js`/`game.js` compute reveal positions (unit-tested). `server.js` splits its main-room broadcasts into board / scores / reveal / solved / wrong events. The main display gets a tap-to-start gate that unlocks audio and plays the unmuted video, an `audio.js` sound module, and a sequential reveal animation. Admin and player views are untouched.

**Tech Stack:** Node.js, Express, Socket.IO, HTML5 Canvas, HTML5 Audio. Tests: `node --test`.

**Spec:** `docs/superpowers/specs/2026-06-09-giramoe-audio-and-reveal-design.md`

**Working directory for all commands:** `/Users/mario_dangelo/Documents/Giramoe`

---

## File Structure

| File | Change |
|------|--------|
| `public/assets/*.mp3` (move) | The four sounds moved here from the project root. |
| `board.js` | `buildGrid` marks short-row corners as `edge`; new `letterPositions(grid, letter)`. |
| `game.js` | `applyConsonant`/`applyVowel` include ordered `positions` in their result. |
| `server.js` | `boardView` passes `edge` through; split main broadcasts into `main:gameState` / `main:scores` / `main:revealLetter` / `main:solved` / `main:wrong`. |
| `public/js/audio.js` (new) | The four `Audio` objects + `Sfx` (unlock/play/startSpin/stopSpin). |
| `public/index.html` | Tap-to-start screen; video unmuted + gesture-played; load `audio.js`. |
| `public/js/main.js` | Start gate, audio wiring, new protocol handlers, reveal animation, `edge` rendering. |
| `public/css/style.css` | `.cell.edge` transparent; reveal pop animation; tap-screen sizing. |
| `tests/board.test.js`, `tests/game.test.js`, `tests/integration.test.js` | Updated/added tests. |

---

## Task 1: Consolidate assets into public/assets

**Files:** move `*.mp3` + `teaser.png` into `public/assets/`, remove root duplicates.

- [ ] **Step 1: Move the audio + image into public/assets**

```bash
cd /Users/mario_dangelo/Documents/Giramoe
mv spinning-wheel.mp3 lettera_rivelata.mp3 risposta_corretta.mp3 risposta_o_lettera_sbagliata.mp3 public/assets/
mv teaser.png public/assets/ 2>/dev/null || true
```

- [ ] **Step 2: Remove the root duplicates already present in public/assets**

`logo.png` and `trailer.mp4` already exist in `public/assets/` (committed in v1). Remove the untracked root copies:

```bash
cd /Users/mario_dangelo/Documents/Giramoe
rm -f logo.png trailer.mp4
```

- [ ] **Step 3: Verify the assets are in place**

Run: `ls public/assets/`
Expected output includes: `lettera_rivelata.mp3  logo.png  risposta_corretta.mp3  risposta_o_lettera_sbagliata.mp3  spinning-wheel.mp3  teaser.png  trailer.mp4`

Run: `ls *.mp3 *.png *.mp4 2>/dev/null || echo "root clean"`
Expected: `root clean` (no media left in the project root).

- [ ] **Step 4: Commit**

```bash
cd /Users/mario_dangelo/Documents/Giramoe
git add public/assets/
git commit -m "chore: consolidate audio + media into public/assets"
```

---

## Task 2: board.js — edge cells + letterPositions

**Files:**
- Modify: `board.js`
- Modify: `tests/board.test.js`

- [ ] **Step 1: Update the board tests**

In `tests/board.test.js`, replace the existing test named `'row capacities are 14/16/16/14 with blocked corners on rows 0 and 3'` (the whole `test(...)` block) with:

```javascript
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
```

Then append these tests to `tests/board.test.js`:

```javascript
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
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `node --test tests/board.test.js`
Expected: FAIL — `grid[0][0].type` is `'blocked'` not `'edge'`, and `board.letterPositions is not a function`.

- [ ] **Step 3: Update buildGrid and add letterPositions in board.js**

In `board.js`, replace the entire `buildGrid` function with:

```javascript
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
```

Then add this function (next to `revealLetter`):

```javascript
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
```

Then update the `module.exports` to include `letterPositions`. Change the exports object so its first line reads:

```javascript
module.exports = {
  normalize, layoutPhrase, buildGrid, createBoard,
  countOccurrences, revealLetter, letterPositions, isSolved, revealAll, isVowel, isConsonant,
  VOWELS, ROW_CAPACITIES, GRID_WIDTH
};
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `node --test tests/board.test.js`
Expected: PASS — all board tests green (the updated corner test + the three new ones).

- [ ] **Step 5: Commit**

```bash
cd /Users/mario_dangelo/Documents/Giramoe
git add board.js tests/board.test.js
git commit -m "feat: board edge cells for short rows + letterPositions"
```

---

## Task 3: game.js — thread reveal positions

**Files:**
- Modify: `game.js`
- Modify: `tests/game.test.js`

- [ ] **Step 1: Append failing tests**

Append to `tests/game.test.js`:

```javascript
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
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `node --test tests/game.test.js`
Expected: FAIL — `res.positions` is `undefined`.

- [ ] **Step 3: Add positions to applyConsonant and applyVowel**

In `game.js`, in `applyConsonant`, replace the `if (count > 0) { ... }` block and the trailing `passTurn`/return with:

```javascript
  if (count > 0) {
    const positions = board.letterPositions(game.board.grid, letter);
    board.revealLetter(game.board.grid, letter);
    game.usedLetters.push(letter);
    if (doubling) {
      p.roundPoints = p.roundPoints * 2;
    } else {
      p.roundPoints += game.lastSpinValue * count;
    }
    game.hasScoredConsonant = true;
    game.turnState = 'CONTINUE';
    return { ok: true, present: true, count, positions, solved: board.isSolved(game.board.grid) };
  }
  passTurn(game);
  return { ok: true, present: false, count: 0, positions: [] };
```

In `applyVowel`, replace the `if (count > 0) { ... }` block and the trailing `passTurn`/return with:

```javascript
  if (count > 0) {
    const positions = board.letterPositions(game.board.grid, letter);
    board.revealLetter(game.board.grid, letter);
    game.usedLetters.push(letter);
    game.turnState = 'CONTINUE';
    return { ok: true, present: true, count, positions, solved: board.isSolved(game.board.grid) };
  }
  passTurn(game);
  return { ok: true, present: false, count: 0, positions: [] };
```

(Compute `positions` BEFORE `revealLetter`, since `letterPositions` only returns unrevealed cells.)

- [ ] **Step 4: Run tests, verify they pass**

Run: `node --test tests/board.test.js tests/game.test.js`
Expected: PASS — board + game unit tests green.

- [ ] **Step 5: Commit**

```bash
cd /Users/mario_dangelo/Documents/Giramoe
git add game.js tests/game.test.js
git commit -m "feat: thread reveal positions through game consonant/vowel results"
```

---

## Task 4: server.js — split main-room protocol + integration test

**Files:**
- Modify: `server.js`
- Modify: `tests/integration.test.js`

- [ ] **Step 1: Pass edge through boardView**

In `server.js`, replace the `boardView` function with:

```javascript
function boardView() {
  return {
    category: state.g.board.category,
    grid: state.g.board.grid.map(row => row.map(cell => {
      if (cell.type === 'letter') {
        return { type: 'letter', revealed: cell.revealed, letter: cell.revealed ? cell.letter : null };
      }
      return { type: cell.type }; // 'blocked' or 'edge'
    }))
  };
}
```

- [ ] **Step 2: Add a scores serializer and split the broadcast helpers**

In `server.js`, replace the `broadcastPlaying` function with these three helpers plus a scores view:

```javascript
function mainScoresView() {
  return { scores: publicScores(), currentTurn: state.g.currentTurnIndex };
}

function broadcastAdminPlayers() {
  io.to('admin').emit('admin:state', adminView());
  state.g.players.forEach((p, i) => {
    io.to(state.lobby[i].socketId).emit('player:turnState', playerView(i));
  });
}

// Routine update: scores/turn only — never redraws the main board.
function broadcastScores() {
  io.to('main').emit('main:scores', mainScoresView());
  broadcastAdminPlayers();
}

// Full board redraw on the main display (new board / reconnect).
function broadcastBoard() {
  io.to('main').emit('main:gameState', mainGameView());
  broadcastAdminPlayers();
}
```

- [ ] **Step 3: Rewire the handlers**

In `server.js`:

(a) `admin:setBoard` — change the success line `broadcastPlaying();` to `broadcastBoard();`. The handler becomes:

```javascript
  socket.on('admin:setBoard', ({ category, phrase }) => {
    if (state.phase !== 'playing' && state.phase !== 'lobby') return;
    if (!state.g) return;
    const startIndex = (state.g.boardNumber - 1) % state.g.players.length;
    const r = game.startBoard(state.g, category, phrase, startIndex, state.g.boardNumber);
    if (!r.ok) return io.to('admin').emit('admin:boardError', r.error);
    broadcastBoard();
  });
```

(b) `player:spin` — change the trailing timeout to `broadcastScores`:

```javascript
    setTimeout(() => broadcastScores(), SPIN_MS + 200);
```

(c) `player:pickConsonant` — replace the whole handler with:

```javascript
  socket.on('player:pickConsonant', ({ letter }) => {
    if (state.phase !== 'playing' || !state.g || !state.g.board) return;
    if (socket.playerIndex !== state.g.currentTurnIndex) return;
    const res = game.applyConsonant(state.g, letter);
    if (!res.ok) return;
    if (res.present) io.to('main').emit('main:revealLetter', { positions: res.positions });
    else io.to('main').emit('main:wrong');
    broadcastScores();
  });
```

(d) `player:buyVowel` — replace the whole handler with:

```javascript
  socket.on('player:buyVowel', ({ letter }) => {
    if (state.phase !== 'playing' || !state.g || !state.g.board) return;
    if (socket.playerIndex !== state.g.currentTurnIndex) return;
    const res = game.applyVowel(state.g, letter);
    if (!res.ok) return;
    if (res.present) io.to('main').emit('main:revealLetter', { positions: res.positions });
    else io.to('main').emit('main:wrong');
    broadcastScores();
  });
```

(e) `admin:solve` — replace the whole handler with:

```javascript
  socket.on('admin:solve', () => {
    if (state.phase !== 'playing' || !state.g) return;
    game.applySolve(state.g);
    io.to('main').emit('main:gameState', mainGameView()); // fully-revealed board
    io.to('main').emit('main:solved');

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
      broadcastAdminPlayers();
      io.to('admin').emit('admin:boardSolved', { boardNumber: state.g.boardNumber });
    }
  });
```

(f) `admin:passTurn` — replace the whole handler with:

```javascript
  socket.on('admin:passTurn', () => {
    if (state.phase !== 'playing' || !state.g) return;
    game.passTurn(state.g);
    io.to('main').emit('main:wrong');
    broadcastScores();
  });
```

The `main:init` handler is unchanged (it still emits `main:gameState` on reconnect while playing, which is the full redraw we want).

- [ ] **Step 4: Replace the integration test**

Replace the ENTIRE contents of `tests/integration.test.js` with:

```javascript
const { test } = require('node:test');
const assert = require('node:assert');
const { io } = require('socket.io-client');

const BASE = 'http://localhost:3000';
const wait = (ms) => new Promise(r => setTimeout(r, ms));
function connect() { return io(BASE, { transports: ['websocket'], forceNew: true }); }

test('main protocol: edge cells, wrong on pass, solved on solve, board advances', async () => {
  const admin = connect();
  const main = connect();
  let adminState = null, mainGame = null, mainScores = null, gotWrong = false, gotSolved = false;
  admin.on('admin:state', s => { adminState = s; });
  main.on('main:gameState', g => { mainGame = g; });
  main.on('main:scores', s => { mainScores = s; });
  main.on('main:wrong', () => { gotWrong = true; });
  main.on('main:solved', () => { gotSolved = true; });

  admin.emit('admin:init'); main.emit('main:init');
  await wait(200);
  admin.emit('admin:inizia');
  await wait(200);
  const roomCode = adminState.roomCode;

  const players = [];
  for (let i = 0; i < 3; i++) {
    const p = connect();
    players.push(p);
    await wait(100);
    p.emit('player:join', { roomCode, name: 'P' + (i + 1) });
    await wait(150);
  }
  admin.emit('admin:startGame');
  await wait(200);

  admin.emit('admin:setBoard', { category: 'TEST', phrase: 'SOLE' });
  await wait(200);
  // edge cells at the corners of the short top row
  assert.strictEqual(mainGame.board.grid[0][0].type, 'edge');
  assert.strictEqual(mainGame.board.grid[0][15].type, 'edge');
  // and a middle row has no edge cells
  assert.ok(mainGame.board.grid[1].every(c => c.type !== 'edge'));

  // passing the turn plays the "wrong" sound and pushes a scores update
  admin.emit('admin:passTurn');
  await wait(200);
  assert.strictEqual(gotWrong, true);
  assert.ok(mainScores, 'received main:scores');

  // solving reveals the board, plays "solved", and advances the board number
  admin.emit('admin:solve');
  await wait(200);
  assert.strictEqual(gotSolved, true);
  assert.strictEqual(adminState.boardNumber, 2);
  assert.ok(mainGame.board.grid.flat().some(c => c.type === 'letter' && c.revealed), 'solved board revealed');

  [admin, main, ...players].forEach(s => s.close());
  await wait(100);
});
```

- [ ] **Step 5: Run the integration test against a live server**

```bash
cd /Users/mario_dangelo/Documents/Giramoe
node server.js > /tmp/giramoe-it.log 2>&1 &
SERVER_PID=$!
sleep 2
node --test tests/integration.test.js
TEST_EXIT=$?
kill $SERVER_PID 2>/dev/null
echo "integration exit: $TEST_EXIT"
```

Expected: PASS, `integration exit: 0`. (If port 3000 is busy: `lsof -ti:3000 | xargs kill -9`, then retry.) Always kill the background server.

- [ ] **Step 6: Verify unit suites still pass**

Run: `node --test tests/board.test.js tests/game.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd /Users/mario_dangelo/Documents/Giramoe
git add server.js tests/integration.test.js
git commit -m "feat: split main-room protocol into gameState/scores/revealLetter/solved/wrong"
```

---

## Task 5: Audio module + tap-to-start screen + unmuted video

**Files:**
- Create: `public/js/audio.js`
- Modify: `public/index.html`
- Modify: `public/css/style.css`

- [ ] **Step 1: Create the audio module**

Create `public/js/audio.js`:

```javascript
// Sound effects for the MAIN display only. A single user gesture (the tap-to-start
// click) unlocks playback for the whole page.
const SOUNDS = {
  spin: new Audio('/assets/spinning-wheel.mp3'),
  letter: new Audio('/assets/lettera_rivelata.mp3'),
  correct: new Audio('/assets/risposta_corretta.mp3'),
  wrong: new Audio('/assets/risposta_o_lettera_sbagliata.mp3')
};
SOUNDS.spin.loop = true;

const Sfx = {
  // Prime each sound inside a user gesture so later programmatic play() is allowed.
  unlock() {
    Object.values(SOUNDS).forEach(a => {
      a.muted = true;
      const p = a.play();
      if (p && p.then) {
        p.then(() => { a.pause(); a.currentTime = 0; a.muted = false; })
         .catch(() => { a.muted = false; });
      } else {
        a.muted = false;
      }
    });
  },
  play(name) {
    const a = SOUNDS[name];
    if (!a) return;
    try { a.currentTime = 0; } catch (e) {}
    a.play().catch(() => {});
  },
  startSpin() {
    try { SOUNDS.spin.currentTime = 0; } catch (e) {}
    SOUNDS.spin.play().catch(() => {});
  },
  stopSpin() {
    SOUNDS.spin.pause();
    try { SOUNDS.spin.currentTime = 0; } catch (e) {}
  }
};

window.Sfx = Sfx;
```

- [ ] **Step 2: Add the tap screen, unmute the video, load audio.js in index.html**

In `public/index.html`, replace this block:

```html
  <!-- Video Screen -->
  <div id="video-screen" class="screen">
    <video id="intro-video" autoplay muted playsinline>
      <source src="/assets/trailer.mp4" type="video/mp4">
    </video>
  </div>
```

with:

```html
  <!-- Tap-to-start (unlocks audio, plays the intro video with sound) -->
  <div id="start-tap-screen" class="screen">
    <div class="mobile-container">
      <img src="/assets/logo.png" alt="Giramoe" style="width: 220px; margin-bottom: 28px;">
      <button class="glass-button" id="tap-start-btn">Tocca per iniziare</button>
    </div>
  </div>

  <!-- Video Screen -->
  <div id="video-screen" class="screen hidden">
    <video id="intro-video" playsinline>
      <source src="/assets/trailer.mp4" type="video/mp4">
    </video>
  </div>
```

Then, in `public/index.html`, change the scripts block at the bottom from:

```html
  <script src="/socket.io/socket.io.js"></script>
  <script src="/js/wheel.js"></script>
  <script src="/js/main.js"></script>
```

to:

```html
  <script src="/socket.io/socket.io.js"></script>
  <script src="/js/audio.js"></script>
  <script src="/js/wheel.js"></script>
  <script src="/js/main.js"></script>
```

- [ ] **Step 3: Add CSS for the edge cells, reveal pop, and tap screen**

Append to the END of `public/css/style.css`:

```css
/* === BOARD EDGE CELLS (short rows render as 14 centered squares) === */
.cell.edge {
  background: transparent;
  border: none;
  box-shadow: none;
}

/* Reveal pop when a letter flips */
.cell.letter.revealed {
  animation: cellPop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
@keyframes cellPop {
  0% { transform: scale(0.55); }
  100% { transform: scale(1); }
}

/* Tap-to-start */
#start-tap-screen .glass-button { font-size: 24px; padding: 18px 56px; }
```

- [ ] **Step 4: Verify**

Run: `node --check public/js/audio.js`
Expected: no output (valid syntax).

- [ ] **Step 5: Commit**

```bash
cd /Users/mario_dangelo/Documents/Giramoe
git add public/js/audio.js public/index.html public/css/style.css
git commit -m "feat: audio module + tap-to-start screen with unmuted intro video"
```

---

## Task 6: main.js — start gate, audio wiring, reveal animation, edge rendering

**Files:**
- Modify: `public/js/main.js`

- [ ] **Step 1: Replace main.js entirely**

Replace the ENTIRE contents of `public/js/main.js` with:

```javascript
const socket = io();
let wheel = null;
let started = false;
let currentPhase = 'video';

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

const video = document.getElementById('intro-video');
video.addEventListener('ended', () => showScreen('start-screen'));
video.addEventListener('error', () => showScreen('start-screen'));

// --- Tap to start: unlock audio, play the intro video with sound ---
document.getElementById('tap-start-btn').addEventListener('click', startMainDisplay);
function startMainDisplay() {
  if (started) return;
  started = true;
  Sfx.unlock();
  if (currentPhase === 'video') {
    showScreen('video-screen');
    video.muted = false;
    video.play().catch(() => showScreen('start-screen'));
  } else {
    applyPhaseScreen();
  }
}

function applyPhaseScreen() {
  if (!started) return; // stay on the tap screen until the user taps
  if (currentPhase === 'video') showScreen('video-screen');
  else if (currentPhase === 'lobby') showScreen('lobby-screen');
  else if (currentPhase === 'playing') showScreen('game-screen');
  else if (currentPhase === 'matchEnd') showScreen('matchend-screen');
}

socket.emit('main:init');

socket.on('main:state', ({ phase }) => { currentPhase = phase; applyPhaseScreen(); });

socket.on('main:showLobby', ({ url, players }) => {
  currentPhase = 'lobby';
  QRCode.toCanvas(document.getElementById('qr-canvas'), url, {
    width: 220, margin: 2, color: { dark: '#1a1a1a', light: '#ffffff' }
  });
  updatePlayerSlots(players);
  applyPhaseScreen();
});

socket.on('main:playerJoined', ({ players }) => updatePlayerSlots(players));

socket.on('main:startGame', () => { currentPhase = 'playing'; applyPhaseScreen(); });

socket.on('main:gameState', (g) => {
  currentPhase = 'playing';
  if (!wheel) initMainWheel(g.segments);
  document.getElementById('board-counter').textContent =
    `Tabellone ${g.boardNumber} / ${g.totalBoards}`;
  document.getElementById('category-banner').textContent = g.board.category;
  renderBoard(g.board.grid);
  renderScores(g.scores, g.currentTurn);
  applyPhaseScreen();
});

socket.on('main:scores', ({ scores, currentTurn }) => renderScores(scores, currentTurn));

socket.on('main:spin', ({ totalAngle, value }) => {
  if (!wheel) return;
  Sfx.startSpin();
  wheel.onSpinEnd = () => { Sfx.stopSpin(); showResult(String(value).toUpperCase()); };
  wheel.spinTo(totalAngle, 6000);
  setTimeout(() => Sfx.stopSpin(), 6500); // fallback if rAF was throttled
});

socket.on('main:revealLetter', ({ positions }) => revealSequence(positions));

socket.on('main:solved', () => Sfx.play('correct'));

socket.on('main:wrong', () => Sfx.play('wrong'));

socket.on('main:matchEnd', ({ standings }) => {
  // Delay so the solved phrase + correct sound register before the standings.
  setTimeout(() => {
    currentPhase = 'matchEnd';
    showScreen('matchend-screen');
    const el = document.getElementById('standings');
    el.innerHTML = '';
    standings.forEach((s, i) => {
      const row = document.createElement('div');
      row.className = 'standing-row glass-panel' + (i === 0 ? ' winner' : '');
      row.innerHTML = `<span>${i + 1}. ${s.name}</span><span>${s.bank}</span>`;
      el.appendChild(row);
    });
  }, 3000);
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
  grid.forEach((row, r) => {
    row.forEach((cell, c) => {
      const div = document.createElement('div');
      div.dataset.row = r;
      div.dataset.col = c;
      if (cell.type === 'edge') {
        div.className = 'cell edge';
      } else if (cell.type === 'blocked') {
        div.className = 'cell blocked';
      } else if (cell.revealed) {
        div.className = 'cell letter revealed';
        div.textContent = cell.letter;
      } else {
        div.className = 'cell letter';
      }
      el.appendChild(div);
    });
  });
}

function cellAt(row, col) {
  return document.querySelector(`#board-grid .cell[data-row="${row}"][data-col="${col}"]`);
}

// Reveal each occurrence one at a time (TL->BR), with the flip sound.
function revealSequence(positions) {
  positions.forEach((pos, i) => {
    setTimeout(() => {
      const cell = cellAt(pos.row, pos.col);
      if (cell) {
        cell.classList.add('letter', 'revealed');
        cell.classList.remove('blocked', 'edge');
        cell.textContent = pos.letter;
      }
      Sfx.play('letter');
    }, i * 420);
  });
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

- [ ] **Step 2: Verify**

Run: `node --check public/js/main.js`
Expected: no output (valid syntax).

- [ ] **Step 3: Commit**

```bash
cd /Users/mario_dangelo/Documents/Giramoe
git add public/js/main.js
git commit -m "feat: main display start gate, audio, sequential reveal, edge rendering"
```

---

## Task 7: Final integration + browser smoke test + docs

**Files:** verification, then `README.md`.

- [ ] **Step 1: Full unit + integration run**

```bash
cd /Users/mario_dangelo/Documents/Giramoe
node --test tests/board.test.js tests/game.test.js
node server.js > /tmp/giramoe-it.log 2>&1 &
SERVER_PID=$!
sleep 2
node --test tests/integration.test.js
kill $SERVER_PID 2>/dev/null
```
Expected: all unit tests pass; integration test passes.

- [ ] **Step 2: Browser smoke test (preview)**

Start the server and, with the preview/browser tools, verify on the main display:
1. The first screen is the tap-to-start (logo + "Tocca per iniziare"); the video does not autoplay before the click.
2. After clicking start, the video screen shows and `document.getElementById('intro-video').muted === false`.
3. Drive admin → start game → `admin:setBoard {category:'STAGIONI', phrase:'SOLE E MARE'}`. The board renders with the short top/bottom rows showing transparent corners (the `.cell.edge` cells have no red background); inspect that `#board-grid .cell.edge` cells exist and their computed `background-color` is transparent.
4. Emit a present consonant for the current player and confirm `main:revealLetter` drives a sequential reveal: the matching cells gain the `revealed` class one after another and show their letters.
5. Confirm the four `Audio` objects exist (`window.Sfx`) and `Sfx.play`/`startSpin`/`stopSpin` are functions. (Actual audio output is environment-dependent in the headless preview; verify wiring, not sound.)

Because the preview tab is backgrounded, `requestAnimationFrame` (the wheel spin) and audio output may not run; verify board/DOM state and the presence of the audio API as in earlier verifications. Stop the server when done.

- [ ] **Step 3: Update README**

In `README.md`, replace the "## Note" section's content with:

```markdown
## Note

- **Audio:** l'audio (video iniziale + effetti) parte **solo dal main display** e si attiva al primo tocco sulla schermata "Tocca per iniziare" (i browser bloccano l'audio senza un click). I 4 suoni sono in `public/assets/`.
- L'animazione della ruota e l'audio girano solo con la scheda del main display **in primo piano** (limite del browser su `requestAnimationFrame`/autoplay).
- La libreria QR è inclusa localmente (`public/js/qrcode.min.js`), quindi funziona anche senza internet.
- Servono sempre 3 giocatori: se uno si disconnette la partita si mette in pausa e attende la riconnessione.
```

- [ ] **Step 4: Commit**

```bash
cd /Users/mario_dangelo/Documents/Giramoe
git add README.md
git commit -m "docs: note main-display audio and tap-to-start"
```

---

## Self-Review Notes (author)

- **Spec coverage:** assets→public/assets (T1); edge cells + letterPositions (T2); positions in game results (T3); boardView edge + protocol split gameState/scores/revealLetter/solved/wrong + solve emits revealed gameState (T4); audio module + tap-to-start + unmuted video (T5); start gate, four sounds wired (spin start/stop, letter per-flip, correct on solved, wrong on absent/passTurn), sequential reveal TL→BR, edge rendering, matchEnd delay (T6); tests + browser + docs (T7). All covered.
- **Audio-only-on-main:** `audio.js` is loaded only by `index.html`; `play.html`/`admin.html` are untouched.
- **Reveal not clobbered:** routine updates use `main:scores` (no board redraw); the board is redrawn only by `main:gameState` (new board / solve / reconnect). The sequential animation runs off `main:revealLetter`.
- **Type/name consistency:** event names (`main:gameState`, `main:scores`, `main:revealLetter`, `main:solved`, `main:wrong`, `main:spin`, `main:matchEnd`) and payload fields (`positions:[{row,col,letter}]`, `scores`, `currentTurn`) match between `server.js` (T4) and `main.js` (T6). `Sfx.unlock/play/startSpin/stopSpin` match between `audio.js` (T5) and `main.js` (T6). Cell types `edge|blocked|letter` match across `board.js` (T2), `boardView` (T4), and `renderBoard` (T6).
- **Pre-existing limitation (unchanged):** if the main display connects mid-lobby it gets `phase:'lobby'` without the QR url (no `main:showLobby` replay); the normal flow opens the main display first. Out of scope.
