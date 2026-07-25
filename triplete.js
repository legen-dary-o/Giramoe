const board = require('./board');

// "IL TRIPLETE" — the bonus round after the 3 wheel boards. Three boards on the
// same topic: letters auto-appear, players buzz and solve by voice. Each board is
// worth 1000; solving all three is worth 5000 (not 3000). Pure state machine — the
// timers that drive the reveal (and the board-3 flash) live in server.js.

const BOARD_POINTS = 1000;
const SWEEP_BONUS = 5000;
const TOTAL_BOARDS = 3;

function cellKey(c) { return c.row + ',' + c.col; }

// players: [{ id, name }]. title is shared by all three boards; phrases has 3 entries.
function createTriplete(players, title, phrases) {
  if (!Array.isArray(phrases) || phrases.length !== TOTAL_BOARDS) {
    return { ok: false, error: `Servono ${TOTAL_BOARDS} frasi` };
  }
  const boards = [];
  for (let i = 0; i < phrases.length; i++) {
    const r = board.createBoard(title, phrases[i]);
    if (!r.ok) return { ok: false, error: `Frase ${i + 1}: ${r.error}` };
    boards.push(r.board);
  }
  return {
    ok: true,
    t: {
      title: boards[0].category,
      boards,                                 // each { category, phrase, grid }
      boardIndex: 0,
      state: 'REVEALING',                     // REVEALING | BUZZED | BOARD_DONE | FINISHED
      players: players.map(p => ({ id: p.id, name: p.name, points: 0, solved: 0 })),
      lockedOut: [],                          // player ids locked for the current board
      buzzedBy: null,                         // player id currently being judged
      flashCount: 0,                          // board-3 flashes performed this board
      flashed: [],                            // board-3 cell keys already flashed
      flashDone: false                        // board-3: every letter has flashed once
    }
  };
}

function currentGrid(t) { return t.boards[t.boardIndex].grid; }
function player(t, id) { return t.players.find(p => p.id === id); }
function isLastBoard(t) { return t.boardIndex >= TOTAL_BOARDS - 1; }

// A player books in. Allowed only while revealing, when nobody else is mid-buzz,
// and only if this player isn't locked out for the current board.
function buzz(t, playerId) {
  if (t.state !== 'REVEALING') return { ok: false };
  if (t.buzzedBy !== null) return { ok: false };
  if (t.lockedOut.includes(playerId)) return { ok: false };
  t.buzzedBy = playerId;
  t.state = 'BUZZED';
  return { ok: true, playerId };
}

// Reveal one random hidden cell and keep it (boards 1-2, and board-3 stabilize phase).
// Returns the revealed { row, col, letter } or null when the board is already full.
function revealNext(t, rng = Math.random) {
  const cells = board.hiddenLetterCells(currentGrid(t));
  if (cells.length === 0) return null;
  const cell = cells[Math.floor(rng() * cells.length)];
  board.revealCellAt(currentGrid(t), cell.row, cell.col);
  return cell;
}

// Pick one random hidden cell that hasn't been flashed yet, WITHOUT revealing it
// (board-3 flash phase). Returns { row, col, letter } or null when nothing new
// remains to flash (caller then switches to the stabilize phase).
function flashNext(t, rng = Math.random) {
  const cells = board.hiddenLetterCells(currentGrid(t)).filter(c => !t.flashed.includes(cellKey(c)));
  if (cells.length === 0) return null;
  const cell = cells[Math.floor(rng() * cells.length)];
  t.flashed.push(cellKey(cell));
  t.flashCount += 1;
  return cell;
}

// Admin: the buzzed player said the phrase and it was right.
function judgeCorrect(t) {
  if (t.state !== 'BUZZED') return { ok: false };
  const p = player(t, t.buzzedBy);
  p.solved += 1;
  p.points += BOARD_POINTS;
  if (p.solved === TOTAL_BOARDS) p.points = SWEEP_BONUS; // treble: jumps to 5000
  board.revealAll(currentGrid(t));
  const finished = isLastBoard(t);
  t.buzzedBy = null;
  t.state = finished ? 'FINISHED' : 'BOARD_DONE';
  return { ok: true, playerId: p.id, name: p.name, points: p.points, solved: p.solved, finished };
}

// Admin: the buzzed player was wrong. They're locked out until everyone has missed;
// when all players are locked, the locks reset and everyone can buzz again.
function judgeWrong(t) {
  if (t.state !== 'BUZZED') return { ok: false };
  const id = t.buzzedBy;
  if (!t.lockedOut.includes(id)) t.lockedOut.push(id);
  t.buzzedBy = null;
  let reset = false;
  if (t.lockedOut.length >= t.players.length) { t.lockedOut = []; reset = true; }
  t.state = 'REVEALING';
  return { ok: true, playerId: id, reset };
}

// Move on to the next board (resets locks and the board-3 flash tracking).
function nextBoard(t) {
  if (isLastBoard(t)) return { ok: false };
  t.boardIndex += 1;
  t.lockedOut = [];
  t.buzzedBy = null;
  t.flashCount = 0;
  t.flashed = [];
  t.flashDone = false;
  t.state = 'REVEALING';
  return { ok: true, boardIndex: t.boardIndex };
}

// At the end, the triplete points of each player are added to their game bank.
function applyToBank(t, gamePlayers) {
  t.players.forEach(tp => {
    const gp = gamePlayers.find(g => g.id === tp.id);
    if (gp) gp.bank += tp.points;
  });
}

module.exports = {
  BOARD_POINTS, SWEEP_BONUS, TOTAL_BOARDS,
  createTriplete, currentGrid, player, isLastBoard,
  buzz, revealNext, flashNext, judgeCorrect, judgeWrong, nextBoard, applyToBank
};
