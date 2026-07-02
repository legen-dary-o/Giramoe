const board = require('./board');

// The FINAL game: the finalist plays 3 boards on the same topic with one shared 60s
// timer (carried across boards). Board 1: N R T E are revealed, the player picks 3
// more consonants + 1 vowel, then the timer starts. Board 2: first+last letter of
// each word revealed, no picks. Board 3: empty, unlimited consonants + 1 vowel, each
// wrong letter costs 3s. The player buzzes (stops the timer) and answers; correct or
// wrong, the game moves to the next board keeping the time. Each board solved = green.
// Pure logic — the countdown timer lives in server.js.

const BOARD1_REVEAL = ['N', 'R', 'T', 'E'];
const BOARD1_CONSONANTS = 3;

function createFinalGame(category, phrases) {
  if (!Array.isArray(phrases) || phrases.length !== 3) return { ok: false, error: 'Servono 3 frasi' };
  const boards = [];
  for (let i = 0; i < 3; i++) {
    const r = board.createBoard(category, phrases[i]);
    if (!r.ok) return { ok: false, error: `Frase ${i + 1}: ${r.error}` };
    boards.push(r.board);
  }
  const fg = {
    category: boards[0].category,
    boards,
    boardIndex: 0,
    results: [null, null, null],   // true = solved (green), false = lost (red)
    state: null,                   // PICKING | RUNNING | BUZZED | DONE
    usedLetters: [],
    consonantPicks: 0,
    vowelPicked: false
  };
  enterBoard(fg);
  return { ok: true, fg };
}

function currentGrid(fg) { return fg.boards[fg.boardIndex].grid; }

// Set up the board the game just moved onto: reveal its preset letters and pick the
// starting state (board 1 needs picks first; boards 2 and 3 run immediately).
function enterBoard(fg) {
  const grid = currentGrid(fg);
  fg.usedLetters = [];
  fg.consonantPicks = 0;
  fg.vowelPicked = false;
  if (fg.boardIndex === 0) {
    BOARD1_REVEAL.forEach(L => { board.revealLetter(grid, L); fg.usedLetters.push(L); });
    fg.state = 'PICKING';
  } else if (fg.boardIndex === 1) {
    board.revealFirstLast(grid);
    fg.state = 'RUNNING';
  } else {
    fg.state = 'RUNNING'; // board 3 starts empty
  }
}

// Player picks a letter. Board 1 (PICKING): up to 3 consonants + 1 vowel; when the
// 4th is in, `startTimer` is set. Board 3 (RUNNING): unlimited consonants + 1 vowel;
// an absent letter sets `wrong` (the server then docks 3s). Board 2 takes no picks.
function pick(fg, letter) {
  letter = String(letter).toUpperCase();
  if (!/^[A-Z]$/.test(letter)) return { ok: false };
  const grid = currentGrid(fg);
  const vowel = board.isVowel(letter);

  if (fg.boardIndex === 0) {
    if (fg.state !== 'PICKING' || fg.usedLetters.includes(letter)) return { ok: false };
    if (vowel ? fg.vowelPicked : fg.consonantPicks >= BOARD1_CONSONANTS) return { ok: false };
    fg.usedLetters.push(letter);
    const count = board.countOccurrences(grid, letter);
    if (vowel) fg.vowelPicked = true; else fg.consonantPicks += 1;
    const complete = fg.consonantPicks >= BOARD1_CONSONANTS && fg.vowelPicked;
    // Board 1 keeps every pick hidden until all 4 (3 consonants + 1 vowel) are in,
    // then flips them onto the board together — not one cell at a time.
    if (!complete) return { ok: true, present: count > 0, positions: [], complete: false, startTimer: false };
    fg.state = 'RUNNING';
    let positions = [];
    fg.usedLetters.forEach(L => {
      if (BOARD1_REVEAL.includes(L)) return; // the preset N R T E are already shown
      const pos = board.letterPositions(grid, L);
      if (pos.length) { board.revealLetter(grid, L); positions = positions.concat(pos); }
    });
    return { ok: true, present: count > 0, positions, complete: true, startTimer: true };
  }

  if (fg.boardIndex === 2) {
    if (fg.state !== 'RUNNING' || fg.usedLetters.includes(letter)) return { ok: false };
    if (vowel && fg.vowelPicked) return { ok: false };
    fg.usedLetters.push(letter);
    const count = board.countOccurrences(grid, letter);
    const positions = board.letterPositions(grid, letter);
    if (count > 0) board.revealLetter(grid, letter);
    if (vowel) fg.vowelPicked = true;
    return { ok: true, present: count > 0, positions, wrong: count === 0 };
  }

  return { ok: false }; // board 2 has no picking
}

function buzz(fg) {
  if (fg.state !== 'RUNNING') return { ok: false };
  fg.state = 'BUZZED';
  return { ok: true };
}

// Admin judges the buzzed answer (board solved = green). Reveals the board but does
// NOT advance yet — the server shows it briefly, then calls advance().
function resolve(fg, correct) {
  if (fg.state !== 'BUZZED') return { ok: false };
  board.revealAll(currentGrid(fg));
  fg.results[fg.boardIndex] = !!correct;
  if (fg.boardIndex >= 2) {
    fg.state = 'DONE';
    return { ok: true, finished: true, results: fg.results.slice() };
  }
  fg.state = 'BOARD_DONE';
  return { ok: true, finished: false };
}

// Move onto the next board (after the brief reveal pause).
function advance(fg) {
  if (fg.state !== 'BOARD_DONE') return { ok: false };
  fg.boardIndex += 1;
  enterBoard(fg);
  return { ok: true, boardIndex: fg.boardIndex, state: fg.state };
}

// The timer ran out: the current board and any remaining boards are lost.
function expire(fg) {
  for (let i = fg.boardIndex; i < 3; i++) if (fg.results[i] === null) fg.results[i] = false;
  fg.state = 'DONE';
  return { ok: true, results: fg.results.slice() };
}

module.exports = {
  BOARD1_REVEAL, BOARD1_CONSONANTS,
  createFinalGame, currentGrid, enterBoard, pick, buzz, resolve, advance, expire
};
