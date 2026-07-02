const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');
const game = require('./game');
const board = require('./board');
const triplete = require('./triplete');
const giramoe = require('./giramoe');
const finalist = require('./finalist');
const finalgame = require('./finalgame');
const envelopes = require('./envelopes');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(require('path').join(__dirname, 'public')));

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const HOST = process.env.HOST || '0.0.0.0';
const TOTAL_BOARDS = 3;
const SPIN_MS = 6000; // wheel animation duration (must match client)

// --- Triplete (bonus round) timing ---
const TRIPLETE_REVEAL_MS = Number(process.env.TRIPLETE_REVEAL_MS) || 1500; // a cell appears every 1.5s
const TRIPLETE_FLASH_MS = 1000;  // board 3: a flashed cell stays 1s before vanishing
const TRIPLETE_FLASH_COUNT = 15; // board 3: flashes before the letters stabilize
const TRIPLETE_GAP_MS = Number(process.env.TRIPLETE_GAP_MS) || 2800; // pause between boards / before standings

// Optional test/debug hook: force every wheel spin onto a fixed segment index.
const FORCE_SEGMENT = process.env.GIRAMOE_FORCE_SEGMENT != null && process.env.GIRAMOE_FORCE_SEGMENT !== ''
  ? Number(process.env.GIRAMOE_FORCE_SEGMENT) : null;

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
  phase: 'video',     // ... | tiebreak | finalist | final | envelopes
  roomCode: null,
  lobby: [],          // [{ name, socketId, connected }]
  g: null,            // game object once playing
  t: null,            // triplete object during the bonus round
  gi: null,           // giramoe object during the final wheel board
  tiebreak: null,     // { contenders:[ids], spins:{id:value}, current } during a tie-break
  finalistId: null,   // the player who reached the final game
  fg: null,           // final game object
  finalTimeLeft: 0,   // ms remaining on the final's shared timer
  envelopeContents: null, // the 3 envelope texts entered with the final setup
  env: null           // envelope game object
};

let tripleteTimer = null;  // single reveal/flash timer for the bonus round
let giramoeTimer = null;   // 5s buzz window timer for the giramoe board
const GIRAMOE_BUZZ_MS = 5000;

// True while a wheel spin is animating on screen. The spin result is applied to
// the game state immediately, but clients aren't told (scores/turn) until the
// animation ends ~SPIN_MS later. Without this lock the turn passes server-side
// at once, so the next player could spin again — stacking spins on the same
// animation. We refuse any new wheel action until the animation (and its
// broadcast) completes.
let wheelSpinning = false;

let finalTimer = null;     // 60s countdown interval for the final game
const FINAL_TIME_MS = Number(process.env.FINAL_TIME_MS) || 60000;
const FINAL_TICK_MS = 250;
const FINAL_PENALTY_MS = 3000; // board 3: a wrong letter costs 3s

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
    grid: state.g.board.grid.map(row => row.map(cell => {
      if (cell.type === 'letter') {
        return { type: 'letter', revealed: cell.revealed, letter: cell.revealed ? (cell.display || cell.letter) : null };
      }
      return { type: cell.type }; // 'blocked' or 'edge'
    }))
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
  const inGame = ['playing', 'express', 'tripleteReady', 'triplete', 'giramoe', 'tiebreak', 'finalist', 'final', 'envelopes'].includes(state.phase);
  return {
    phase: state.phase,
    roomCode: state.roomCode,
    players: inGame
      ? publicScores()
      : state.lobby.map((p, i) => ({ id: i, name: p.name, connected: p.connected })),
    boardNumber: state.g ? state.g.boardNumber : 0,
    totalBoards: TOTAL_BOARDS,
    currentTurn: state.g ? state.g.currentTurnIndex : 0,
    turnState: state.g ? state.g.turnState : null,
    triplete: state.phase === 'triplete'
      ? (state.t
          ? {
              started: true,
              title: state.t.title,
              boardNumber: state.t.boardIndex + 1,
              totalBoards: triplete.TOTAL_BOARDS,
              state: state.t.state,
              buzzedBy: state.t.buzzedBy,
              players: tripleteScores()
            }
          : { started: false })
      : null,
    giramoe: state.phase === 'giramoe'
      ? (state.gi
          ? {
              started: true,
              category: state.gi.board.category,
              multiplier: state.gi.multiplier,
              state: state.gi.state,
              currentTurn: state.gi.currentTurnIndex,
              buzzedBy: state.gi.buzzedBy,
              currentName: state.gi.players[state.gi.currentTurnIndex].name,
              players: giramoeScores()
            }
          : { started: false })
      : null,
    tiebreak: state.phase === 'tiebreak' && state.tiebreak ? tiebreakView() : null,
    finalist: state.finalistId != null && ['finalist', 'final', 'envelopes'].includes(state.phase)
      ? { id: state.finalistId, name: state.g.players[state.finalistId].name }
      : null,
    final: state.phase === 'final' && state.fg
      ? {
          category: state.fg.category,
          boardIndex: state.fg.boardIndex,
          totalBoards: 3,
          state: state.fg.state,
          results: state.fg.results.slice(),
          timeLeft: state.finalTimeLeft,
          buzzed: state.fg.state === 'BUZZED'
        }
      : null,
    envelopes: state.phase === 'envelopes' && state.env ? envelopesView() : null
  };
}

// --- Triplete serialization ---

function tripleteBoardView() {
  const b = state.t.boards[state.t.boardIndex];
  return {
    category: b.category,
    boardNumber: state.t.boardIndex + 1,
    totalBoards: triplete.TOTAL_BOARDS,
    grid: b.grid.map(row => row.map(cell => {
      if (cell.type === 'letter') {
        return { type: 'letter', revealed: cell.revealed, letter: cell.revealed ? (cell.display || cell.letter) : null };
      }
      return { type: cell.type };
    }))
  };
}

function tripleteScores() {
  return state.t.players.map((p, i) => ({
    id: p.id,
    name: p.name,
    points: p.points,
    bank: state.g.players[i] ? state.g.players[i].bank : 0,
    locked: state.t.lockedOut.includes(p.id),
    buzzed: state.t.buzzedBy === p.id
  }));
}

function playerTripleteView(i) {
  const t = state.t;
  const canBuzz = t.state === 'REVEALING' && t.buzzedBy === null && !t.lockedOut.includes(i);
  let message;
  if (t.state === 'BUZZED') {
    message = t.buzzedBy === i ? 'Tocca a te: di\' la frase!' : `Sta rispondendo ${t.players[t.buzzedBy].name}`;
  } else if (t.lockedOut.includes(i)) {
    message = 'Hai sbagliato — aspetta il prossimo giro';
  } else {
    message = 'Prenotati appena sai la frase!';
  }
  return {
    canBuzz,
    buzzedByMe: t.buzzedBy === i,
    locked: t.lockedOut.includes(i),
    state: t.state,
    message,
    points: t.players[i].points,
    boardNumber: t.boardIndex + 1,
    totalBoards: triplete.TOTAL_BOARDS
  };
}

function emitTripleteBoard() {
  io.to('main').emit('main:tripleteBoard', tripleteBoardView());
}

function emitTripleteState() {
  io.to('main').emit('main:tripleteScores', { scores: tripleteScores(), buzzedBy: state.t.buzzedBy });
  io.to('admin').emit('admin:state', adminView());
  state.lobby.forEach((p, i) => io.to(p.socketId).emit('player:tripleteState', playerTripleteView(i)));
}

// --- Triplete reveal loop (server-driven so all clients stay in sync) ---

function clearTripleteTimer() {
  if (tripleteTimer) { clearTimeout(tripleteTimer); tripleteTimer = null; }
}

function scheduleTripleteTick(ms) {
  clearTripleteTimer();
  tripleteTimer = setTimeout(tripleteTick, ms);
}

function startTripleteReveal() {
  if (state.t && state.t.state === 'REVEALING') scheduleTripleteTick(TRIPLETE_REVEAL_MS);
}

function tripleteTick() {
  tripleteTimer = null;
  const t = state.t;
  if (!t || t.state !== 'REVEALING') return;
  const isBoard3 = t.boardIndex === triplete.TOTAL_BOARDS - 1;

  // Board 3, flash phase: a cell appears for 1s then vanishes, no repeats yet.
  if (isBoard3 && t.flashCount < TRIPLETE_FLASH_COUNT) {
    const cell = triplete.flashNext(t);
    if (cell) {
      io.to('main').emit('main:tripleteFlash', { cell, ms: TRIPLETE_FLASH_MS });
      scheduleTripleteTick(TRIPLETE_REVEAL_MS);
    } else {
      t.flashCount = TRIPLETE_FLASH_COUNT; // nothing new to flash -> stabilize now
      scheduleTripleteTick(0);
    }
    return;
  }

  // Boards 1-2, and board-3 stabilize phase: reveal one cell and keep it.
  const cell = triplete.revealNext(t);
  if (!cell) {
    // Board full: stop here and stay on it. It never auto-advances — a player must
    // still buzz and read the (now fully shown) phrase, and the admin's "frase
    // indovinata" awards the 1000 points and only then moves to the next board.
    return;
  }
  io.to('main').emit('main:tripleteReveal', { cell });
  scheduleTripleteTick(TRIPLETE_REVEAL_MS);
}

// Advance to the next board after a short pause, or finish the round.
function onTripleteBoardEnd(res) {
  clearTripleteTimer();
  if (!res || !res.ok) return;
  if (res.finished) {
    setTimeout(finishTriplete, TRIPLETE_GAP_MS);
  } else {
    setTimeout(() => {
      if (state.phase !== 'triplete' || !state.t) return;
      triplete.nextBoard(state.t);
      emitTripleteBoard();
      emitTripleteState();
      startTripleteReveal();
    }, TRIPLETE_GAP_MS);
  }
}

function finishTriplete() {
  if (!state.t || !state.g) return;
  clearTripleteTimer();
  triplete.applyToBank(state.t, state.g.players);
  startExpressRound();
}

// --- Express round: 3 more wheel boards, one segment is EXPRESS ---

function isWheelPhase() {
  return state.phase === 'playing' || state.phase === 'express';
}

function startExpressRound() {
  state.phase = 'express';
  state.g.segments = game.EXPRESS_SEGMENTS.slice();
  state.g.boardNumber = 1;
  state.g.board = null;
  state.g.currentTurnIndex = 0;
  state.g.turnState = 'MUST_SPIN';
  state.g.usedLetters = [];
  state.g.players.forEach(p => { p.roundPoints = 0; });
  io.to('main').emit('main:expressRound', { segments: state.g.segments });
  io.to('admin').emit('admin:state', adminView());
  state.lobby.forEach(p => io.to(p.socketId).emit('player:expressRound'));
}

// Advance after a solved wheel board (normal solve or express auto-complete),
// or close out the round when the 3 boards are done.
function advanceWheelBoard() {
  if (state.phase === 'playing' && state.g.boardNumber >= TOTAL_BOARDS) {
    state.phase = 'tripleteReady';
    io.to('admin').emit('admin:state', adminView());
  } else if (state.phase === 'express' && state.g.boardNumber >= TOTAL_BOARDS) {
    startGiramoe();
  } else {
    state.g.boardNumber += 1;
    broadcastAdminPlayers();
    io.to('admin').emit('admin:boardSolved', { boardNumber: state.g.boardNumber });
  }
}

// --- Finalist: the highest bank advances to the final game (tie -> wheel spin) ---

function startFinalist() {
  const top = finalist.topPlayers(state.g.players);
  if (top.length === 1) declareFinalist(top[0]);
  else startTiebreak(top);
}

function declareFinalist(id) {
  state.phase = 'finalist';
  state.finalistId = id;
  state.tiebreak = null;
  const f = state.g.players.find(p => p.id === id);
  io.to('main').emit('main:finalist', { id, name: f.name });
  io.to('admin').emit('admin:state', adminView());
  state.lobby.forEach((p, i) => io.to(p.socketId).emit('player:finalist', { id, name: f.name, isMe: i === id }));
}

function tiebreakView() {
  const tb = state.tiebreak;
  return {
    current: tb.current,
    currentId: tb.contenders[tb.current] != null ? tb.contenders[tb.current] : null,
    contenders: tb.contenders.map(id => ({
      id, name: state.g.players[id].name, value: tb.spins[id] != null ? tb.spins[id] : null
    }))
  };
}

function startTiebreak(contenderIds) {
  state.phase = 'tiebreak';
  state.tiebreak = { contenders: contenderIds.slice(), spins: {}, current: 0 };
  io.to('main').emit('main:tiebreakStart', { segments: game.GIRAMOE_SEGMENTS, contenders: tiebreakView().contenders });
  broadcastTiebreak();
}

function broadcastTiebreak() {
  io.to('main').emit('main:tiebreakState', tiebreakView());
  io.to('admin').emit('admin:state', adminView());
  const tb = state.tiebreak;
  state.lobby.forEach((p, i) => {
    const isContender = tb.contenders.includes(i);
    io.to(p.socketId).emit('player:tiebreakState', {
      isContender,
      canSpin: isContender && tb.contenders[tb.current] === i && tb.spins[i] == null,
      myValue: tb.spins[i] != null ? tb.spins[i] : null,
      message: !isContender ? 'Spareggio in corso…'
        : tb.contenders[tb.current] === i && tb.spins[i] == null ? 'Spareggio! Gira la ruota'
        : 'Aspetta il tuo turno…'
    });
  });
}

function evaluateTiebreak() {
  const tb = state.tiebreak;
  const res = finalist.evaluateSpins(tb.contenders, tb.spins);
  if (res.winner != null) declareFinalist(res.winner);
  else startTiebreak(res.tied); // sudden death among the tied-top
}

// --- FINAL game: 3 boards, one shared 60s countdown (solo finalist) ---

function finalBoardView() {
  const b = state.fg.boards[state.fg.boardIndex];
  return {
    category: b.category,
    boardIndex: state.fg.boardIndex,
    totalBoards: 3,
    grid: b.grid.map(row => row.map(cell => {
      if (cell.type === 'letter') {
        return { type: 'letter', revealed: cell.revealed, letter: cell.revealed ? (cell.display || cell.letter) : null };
      }
      return { type: cell.type };
    }))
  };
}

function playerFinalView() {
  const fg = state.fg;
  const board1 = fg.boardIndex === 0;
  const board3 = fg.boardIndex === 2;
  const canPickConsonant = (board1 && fg.state === 'PICKING' && fg.consonantPicks < finalgame.BOARD1_CONSONANTS)
    || (board3 && fg.state === 'RUNNING');
  const canPickVowel = (board1 && fg.state === 'PICKING' && !fg.vowelPicked)
    || (board3 && fg.state === 'RUNNING' && !fg.vowelPicked);
  let message;
  if (fg.state === 'BUZZED') message = 'Di\' la soluzione!';
  else if (board1 && fg.state === 'PICKING') message = `Scegli ${finalgame.BOARD1_CONSONANTS - fg.consonantPicks} consonanti e ${fg.vowelPicked ? 0 : 1} vocale`;
  else if (board3) message = 'Chiama consonanti (−3s se sbagli) o prenotati';
  else message = 'Prenotati e risolvi!';
  return {
    boardIndex: fg.boardIndex, totalBoards: 3, state: fg.state,
    canPickConsonant, canPickVowel, canBuzz: fg.state === 'RUNNING',
    usedLetters: fg.usedLetters, message
  };
}

function broadcastFinal() {
  io.to('main').emit('main:finalBoard', finalBoardView());
  io.to('main').emit('main:finalTimer', { ms: state.finalTimeLeft });
  io.to('admin').emit('admin:state', adminView());
  if (state.finalistId != null && state.lobby[state.finalistId]) {
    io.to(state.lobby[state.finalistId].socketId).emit('player:finalState', playerFinalView());
  }
}

function clearFinalTimer() {
  if (finalTimer) { clearInterval(finalTimer); finalTimer = null; }
}

function startFinalCountdown() {
  if (finalTimer || !state.fg || state.fg.state !== 'RUNNING') return;
  finalTimer = setInterval(() => {
    state.finalTimeLeft = Math.max(0, state.finalTimeLeft - FINAL_TICK_MS);
    io.to('main').emit('main:finalTimer', { ms: state.finalTimeLeft });
    if (state.finalTimeLeft <= 0) { clearFinalTimer(); finalgame.expire(state.fg); endFinal(); }
  }, FINAL_TICK_MS);
}

function endFinal() {
  clearFinalTimer();
  startEnvelopes(state.fg.results.slice());
}

// --- ENVELOPES: the final reveal, coloured by the 3 final results ---

function startEnvelopes(results) {
  state.phase = 'envelopes';
  state.env = envelopes.createEnvelopes(results, state.envelopeContents || ['', '', '']);
  broadcastEnvelopes(true);
}

function envelopesView() {
  const env = state.env;
  return {
    envelopes: env.envelopes.map(e => ({
      color: e.color,
      revealed: e.revealed,
      abandoned: e.abandoned,
      content: e.revealed ? e.content : null
    })),
    current: env.current,
    changesLeft: env.changesLeft,
    state: env.state
  };
}

function broadcastEnvelopes(intro) {
  io.to('main').emit('main:envelopes', envelopesView());
  io.to('admin').emit('admin:state', adminView());
  state.lobby.forEach((p, i) => {
    const ev = intro ? 'player:envelopesStart' : 'player:envelopesState';
    io.to(p.socketId).emit(ev, { view: envelopesView(), isFinalist: i === state.finalistId });
  });
}

// --- GIRAMOE: the final wheel board (admin spins once; round-robin consonants) ---

function startGiramoe() {
  state.phase = 'giramoe';
  state.gi = null;
  clearGiramoeTimer();
  io.to('main').emit('main:giramoeStart', { segments: game.GIRAMOE_SEGMENTS });
  io.to('admin').emit('admin:state', adminView());
  state.lobby.forEach(p => io.to(p.socketId).emit('player:giramoeIntro'));
}

function clearGiramoeTimer() {
  if (giramoeTimer) { clearTimeout(giramoeTimer); giramoeTimer = null; }
}

function giramoeBoardView() {
  const b = state.gi.board;
  return {
    category: b.category,
    grid: b.grid.map(row => row.map(cell => {
      if (cell.type === 'letter') {
        return { type: 'letter', revealed: cell.revealed, letter: cell.revealed ? (cell.display || cell.letter) : null };
      }
      return { type: cell.type };
    }))
  };
}

function giramoeScores() {
  return state.gi.players.map(p => {
    const gp = state.g.players.find(x => x.id === p.id);
    return { id: p.id, name: p.name, points: p.points, bank: gp ? gp.bank : 0 };
  });
}

function playerGiramoeView(i) {
  const gi = state.gi;
  const isMyTurn = gi.currentTurnIndex === i;
  const finished = giramoe.consonantsFinished(gi);
  const canCall = isMyTurn && gi.state === 'PLAYING' && !gi.calledThisTurn && !finished;
  // Once every consonant is out, the current player can buzz straight away.
  const canBuzz = isMyTurn && gi.state === 'PLAYING' && (gi.calledThisTurn || finished);
  let message;
  if (gi.state === 'AWAIT_SPIN') message = 'L\'admin sta per girare la ruota…';
  else if (gi.state === 'BUZZED') message = gi.buzzedBy === i ? 'Di\' la soluzione!' : `${gi.players[gi.buzzedBy].name} risponde…`;
  else if (!isMyTurn) message = `Turno di ${gi.players[gi.currentTurnIndex].name}`;
  else if (finished) message = 'Consonanti finite: prenotati e risolvi!';
  else if (canCall) message = 'Tocca a te: chiama una consonante';
  else if (canBuzz) message = 'Prenotati e risolvi, o passa';
  else message = '';
  return {
    isMyTurn, state: gi.state, canCall, canBuzz,
    buzzedByMe: gi.buzzedBy === i,
    points: gi.players[i].points,
    multiplier: gi.multiplier,
    usedLetters: gi.usedLetters,
    currentTurnName: gi.players[gi.currentTurnIndex].name,
    message
  };
}

function broadcastGiramoe() {
  io.to('main').emit('main:giramoeScores', { scores: giramoeScores(), currentTurn: state.gi.currentTurnIndex, multiplier: state.gi.multiplier });
  emitBoardStatus(state.gi.board.grid);
  io.to('admin').emit('admin:state', adminView());
  state.lobby.forEach((p, i) => io.to(p.socketId).emit('player:giramoeState', playerGiramoeView(i)));
}

function startGiramoeBuzzWindow() {
  clearGiramoeTimer();
  giramoeTimer = setTimeout(() => {
    giramoeTimer = null;
    if (state.phase !== 'giramoe' || !state.gi) return;
    if (giramoe.timeout(state.gi).ok) {
      io.to('main').emit('main:giramoeResume');
      broadcastGiramoe();
    }
  }, GIRAMOE_BUZZ_MS);
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

function mainScoresView() {
  return { scores: publicScores(), currentTurn: state.g.currentTurnIndex };
}

function lobbyPlayers() {
  return state.lobby.map(p => ({ name: p.name, connected: p.connected }));
}

function lobbyUrl() {
  const base = process.env.GIRAMOE_PUBLIC_URL || `http://${getLocalIP()}:${PORT}`;
  return `${base}/play.html?room=${state.roomCode}`;
}

function broadcastAdminPlayers() {
  io.to('admin').emit('admin:state', adminView());
  state.g.players.forEach((p, i) => {
    io.to(state.lobby[i].socketId).emit('player:turnState', playerView(i));
  });
}

// "Consonanti/vocali finite" badge for the main display (wheel + express + giramoe
// boards only — the triplete and final have their own screens and are excluded).
function emitBoardStatus(grid) {
  io.to('main').emit('main:boardStatus',
    grid ? board.boardStatus(grid) : { consonantsFinished: false, vowelsFinished: false });
}

// Routine update: scores/turn only — never redraws the main board.
function broadcastScores() {
  io.to('main').emit('main:scores', mainScoresView());
  emitBoardStatus(state.g && state.g.board ? state.g.board.grid : null);
  broadcastAdminPlayers();
}

// Full board redraw on the main display (new board / reconnect).
function broadcastBoard() {
  io.to('main').emit('main:gameState', mainGameView());
  emitBoardStatus(state.g && state.g.board ? state.g.board.grid : null);
  broadcastAdminPlayers();
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
    if (state.phase === 'lobby') {
      socket.emit('main:showLobby', { roomCode: state.roomCode, url: lobbyUrl(), players: lobbyPlayers() });
    } else if ((state.phase === 'playing' || state.phase === 'tripleteReady' || state.phase === 'express') && state.g && state.g.board) {
      socket.emit('main:gameState', mainGameView());
      socket.emit('main:boardStatus', board.boardStatus(state.g.board.grid));
    } else if (state.phase === 'triplete' && state.t) {
      socket.emit('main:tripleteBoard', tripleteBoardView());
      socket.emit('main:tripleteScores', { scores: tripleteScores(), buzzedBy: state.t.buzzedBy });
    } else if (state.phase === 'giramoe' && state.gi && state.gi.board) {
      socket.emit('main:giramoeStart', { segments: game.GIRAMOE_SEGMENTS });
      socket.emit('main:giramoeBoard', giramoeBoardView());
      socket.emit('main:giramoeScores', { scores: giramoeScores(), currentTurn: state.gi.currentTurnIndex, multiplier: state.gi.multiplier });
      socket.emit('main:boardStatus', board.boardStatus(state.gi.board.grid));
    } else if (state.phase === 'tiebreak' && state.tiebreak) {
      socket.emit('main:tiebreakStart', { segments: game.GIRAMOE_SEGMENTS, contenders: tiebreakView().contenders });
      socket.emit('main:tiebreakState', tiebreakView());
    } else if (state.phase === 'finalist' && state.finalistId != null) {
      socket.emit('main:finalist', { id: state.finalistId, name: state.g.players[state.finalistId].name });
    } else if (state.phase === 'final' && state.fg) {
      socket.emit('main:finalBoard', finalBoardView());
      socket.emit('main:finalTimer', { ms: state.finalTimeLeft });
    } else if (state.phase === 'envelopes' && state.env) {
      socket.emit('main:envelopes', envelopesView());
    }
  });

  socket.on('admin:inizia', () => {
    state.phase = 'lobby';
    state.roomCode = generateRoomCode();
    state.lobby = [];
    io.to('main').emit('main:showLobby', { roomCode: state.roomCode, url: lobbyUrl(), players: [] });
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
    if (state.lobby.length !== 3 || !state.lobby.every(p => p.connected)) return;
    state.g = game.createGame(state.lobby.map((p, i) => ({ id: i, name: p.name })));
    state.phase = 'playing';
    io.to('main').emit('main:startGame');
    state.lobby.forEach(p => io.to(p.socketId).emit('player:gameStarted'));
    io.to('admin').emit('admin:state', adminView());
  });

  socket.on('admin:setBoard', ({ category, phrase }) => {
    if (!isWheelPhase() && state.phase !== 'lobby') return;
    if (!state.g) return;
    wheelSpinning = false; // fresh board — clear any lingering spin lock
    const startIndex = (state.g.boardNumber - 1) % state.g.players.length;
    const r = game.startBoard(state.g, category, phrase, startIndex, state.g.boardNumber);
    if (!r.ok) return io.to('admin').emit('admin:boardError', r.error);
    broadcastBoard();
  });

  socket.on('player:spin', () => {
    if (!isWheelPhase() || !state.g || !state.g.board) return;
    if (wheelSpinning) return; // a previous spin is still animating — ignore
    const pi = socket.playerIndex;
    if (pi !== state.g.currentTurnIndex) return;
    if (state.g.turnState !== 'MUST_SPIN' && state.g.turnState !== 'CONTINUE') return;

    wheelSpinning = true;
    const winningSegment = FORCE_SEGMENT != null ? FORCE_SEGMENT : Math.floor(Math.random() * 16);
    const spins = 5 + Math.floor(Math.random() * 3);
    const result = game.applySpin(state.g, winningSegment);

    // Each wheel computes the landing rotation from the winning segment + its own
    // current rotation, so it always stops on the segment that matches the result.
    const spinData = { winningSegment, spins, value: state.g.segments[winningSegment], result };
    io.to('main').emit('main:spin', spinData);
    io.to(socket.id).emit('player:spinResult', spinData);

    setTimeout(() => {
      wheelSpinning = false; // animation finished — turn/scores are now broadcast
      broadcastScores();
      // Landed on EXPRESS: play the "EXPRESS" animation, player is now in rapid-fire mode.
      if (result.type === 'express') io.to('main').emit('main:expressStart');
    }, SPIN_MS + 200);
  });

  socket.on('player:pickConsonant', ({ letter }) => {
    if (!isWheelPhase() || !state.g || !state.g.board) return;
    if (socket.playerIndex !== state.g.currentTurnIndex) return;
    const res = game.applyConsonant(state.g, letter);
    if (!res.ok) return;
    io.to('main').emit('main:letterCalled', { letter: String(letter).toUpperCase() });
    if (res.present) io.to('main').emit('main:revealLetter', { positions: res.positions });
    else io.to('main').emit('main:wrong');
    broadcastScores();
  });

  socket.on('player:buyVowel', ({ letter }) => {
    if (!isWheelPhase() || !state.g || !state.g.board) return;
    if (socket.playerIndex !== state.g.currentTurnIndex) return;
    const res = game.applyVowel(state.g, letter);
    if (!res.ok) return;
    io.to('main').emit('main:letterCalled', { letter: String(letter).toUpperCase() });
    if (res.present) io.to('main').emit('main:revealLetter', { positions: res.positions });
    else io.to('main').emit('main:wrong');
    broadcastScores();
  });

  // Express rapid-fire: a present consonant scores 500/occurrence and keeps the turn;
  // a vowel is bought for 500; any absent letter is a full bancarotta.
  socket.on('player:expressLetter', ({ letter }) => {
    if (!isWheelPhase() || !state.g || !state.g.board) return;
    if (socket.playerIndex !== state.g.currentTurnIndex) return;
    if (state.g.turnState !== 'EXPRESS') return;
    const actingName = game.currentPlayer(state.g).name;
    const res = game.applyExpressLetter(state.g, letter);
    if (!res.ok) return;
    io.to('main').emit('main:letterCalled', { letter: String(letter).toUpperCase() });
    if (res.present) {
      io.to('main').emit('main:revealLetter', { positions: res.positions });
      if (res.solved) {
        game.applySolve(state.g); // banks the express points
        io.to('main').emit('main:gameState', mainGameView());
        io.to('main').emit('main:solved');
        advanceWheelBoard();
        return;
      }
    } else {
      io.to('main').emit('main:expressBankrupt', { name: actingName });
    }
    broadcastScores();
  });

  socket.on('admin:solve', () => {
    if (!isWheelPhase() || !state.g) return;
    game.applySolve(state.g);
    io.to('main').emit('main:gameState', mainGameView()); // fully-revealed board
    io.to('main').emit('main:solved');
    advanceWheelBoard();
  });

  socket.on('admin:passTurn', () => {
    if (!isWheelPhase() || !state.g) return;
    if (state.g.turnState === 'EXPRESS') {
      // In express, "Frase sbagliata" is a wrong solution attempt -> full bancarotta.
      const bust = game.currentPlayer(state.g).name;
      game.applyExpressWrongSolve(state.g);
      io.to('main').emit('main:expressBankrupt', { name: bust });
    } else {
      game.passTurn(state.g);
      io.to('main').emit('main:wrong');
    }
    broadcastScores();
  });

  // --- Triplete (bonus round) ---

  // Admin presses "IL TRIPLETE": play the title animation, then show the content form.
  socket.on('admin:startTriplete', () => {
    if (state.phase !== 'tripleteReady' || !state.g) return;
    state.phase = 'triplete';
    state.t = null; // created once the admin submits the title + phrases
    io.to('main').emit('main:tripleteTitle');
    io.to('admin').emit('admin:state', adminView());
    state.lobby.forEach(p => io.to(p.socketId).emit('player:tripleteIntro'));
  });

  // Admin submits the shared title + 3 phrases and the first board starts revealing.
  socket.on('admin:tripleteStart', ({ title, phrases }) => {
    if (state.phase !== 'triplete' || !state.g || state.t) return;
    const players = state.g.players.map(p => ({ id: p.id, name: p.name }));
    const r = triplete.createTriplete(players, title, phrases);
    if (!r.ok) return io.to('admin').emit('admin:tripleteError', r.error);
    state.t = r.t;
    io.to('admin').emit('admin:tripleteError', '');
    emitTripleteBoard();
    emitTripleteState();
    startTripleteReveal();
  });

  // A player books in.
  socket.on('player:tripleteBuzz', () => {
    if (state.phase !== 'triplete' || !state.t) return;
    const pi = socket.playerIndex;
    if (pi == null) return;
    const res = triplete.buzz(state.t, pi);
    if (!res.ok) {
      // The buzz was refused (not revealing, already buzzed, or this player is
      // locked out). Re-send this player's real state so a stale-enabled button
      // (e.g. after a reconnect or a missed update) snaps back in sync.
      socket.emit('player:tripleteState', playerTripleteView(pi));
      return;
    }
    clearTripleteTimer(); // freeze the reveal while the player answers
    const name = state.g.players[pi] ? state.g.players[pi].name : '';
    io.to('main').emit('main:tripleteBuzzed', { playerIndex: pi, name });
    emitTripleteState();
  });

  socket.on('admin:tripleteCorrect', () => {
    if (state.phase !== 'triplete' || !state.t) return;
    const res = triplete.judgeCorrect(state.t);
    if (!res.ok) return;
    io.to('main').emit('main:tripleteSolved', {
      board: tripleteBoardView(), playerIndex: res.playerId, name: res.name, points: res.points
    });
    emitTripleteState();
    onTripleteBoardEnd(res);
  });

  socket.on('admin:tripleteWrong', () => {
    if (state.phase !== 'triplete' || !state.t) return;
    const res = triplete.judgeWrong(state.t);
    if (!res.ok) return;
    io.to('main').emit('main:tripleteResume', { reset: res.reset });
    emitTripleteState();
    startTripleteReveal(); // resume from where it left off
  });

  // --- GIRAMOE (final wheel board) ---

  socket.on('admin:giramoeSetBoard', ({ category, phrase }) => {
    if (state.phase !== 'giramoe' || !state.g) return;
    const players = state.g.players.map(p => ({ id: p.id, name: p.name }));
    const r = giramoe.createGiramoe(players, category, phrase);
    if (!r.ok) return io.to('admin').emit('admin:giramoeError', r.error);
    state.gi = r.gi;
    io.to('admin').emit('admin:giramoeError', '');
    io.to('main').emit('main:giramoeBoard', giramoeBoardView());
    broadcastGiramoe();
  });

  // Admin spins the wheel once -> the per-occurrence multiplier, then play opens.
  socket.on('admin:giramoeSpin', () => {
    if (state.phase !== 'giramoe' || !state.gi || state.gi.state !== 'AWAIT_SPIN') return;
    const seg = FORCE_SEGMENT != null ? FORCE_SEGMENT : Math.floor(Math.random() * 16);
    const spins = 5 + Math.floor(Math.random() * 3);
    const value = game.GIRAMOE_SEGMENTS[seg];
    giramoe.setMultiplier(state.gi, value);
    io.to('main').emit('main:spin', { winningSegment: seg, spins, value, result: { type: 'number', value } });
    setTimeout(() => { if (state.phase === 'giramoe' && state.gi) broadcastGiramoe(); }, SPIN_MS + 200);
    io.to('admin').emit('admin:state', adminView());
  });

  // Current player calls one consonant; the 5s buzz window opens after it.
  socket.on('player:giramoeLetter', ({ letter }) => {
    if (state.phase !== 'giramoe' || !state.gi) return;
    if (socket.playerIndex !== state.gi.currentTurnIndex) return;
    const res = giramoe.callConsonant(state.gi, letter);
    if (!res.ok) return;
    io.to('main').emit('main:letterCalled', { letter: String(letter).toUpperCase() });
    if (res.present) {
      io.to('main').emit('main:revealLetter', { positions: res.positions });
      startGiramoeBuzzWindow();
    } else {
      // Absent consonant: no buzz window — the turn already passed to the next player.
      clearGiramoeTimer();
      io.to('main').emit('main:wrong');
    }
    broadcastGiramoe();
  });

  socket.on('player:giramoeBuzz', () => {
    if (state.phase !== 'giramoe' || !state.gi) return;
    const res = giramoe.buzz(state.gi, socket.playerIndex);
    if (!res.ok) return;
    clearGiramoeTimer();
    const name = state.gi.players[socket.playerIndex].name;
    io.to('main').emit('main:giramoeBuzzed', { playerIndex: socket.playerIndex, name });
    broadcastGiramoe();
  });

  socket.on('admin:giramoeCorrect', () => {
    if (state.phase !== 'giramoe' || !state.gi) return;
    const res = giramoe.judgeCorrect(state.gi);
    if (!res.ok) return;
    clearGiramoeTimer();
    giramoe.bankResult(state.gi, state.g.players); // only the winner banks
    io.to('main').emit('main:giramoeBoard', giramoeBoardView());
    io.to('main').emit('main:giramoeSolved', { name: res.name, points: res.points });
    io.to('main').emit('main:solved');
    io.to('admin').emit('admin:state', adminView()); // refresh banks on the admin console
    setTimeout(() => { if (state.phase === 'giramoe') startFinalist(); }, 2600);
  });

  // Tie-break: each tied contender spins once; highest value wins (not banked).
  socket.on('player:tiebreakSpin', () => {
    if (state.phase !== 'tiebreak' || !state.tiebreak) return;
    const tb = state.tiebreak;
    const currentId = tb.contenders[tb.current];
    if (socket.playerIndex !== currentId || tb.spins[currentId] != null) return;
    const seg = FORCE_SEGMENT != null ? FORCE_SEGMENT : Math.floor(Math.random() * 16);
    const spins = 5 + Math.floor(Math.random() * 3);
    const value = game.GIRAMOE_SEGMENTS[seg];
    tb.spins[currentId] = value;
    io.to('main').emit('main:spin', { winningSegment: seg, spins, value, result: { type: 'number', value } });
    setTimeout(() => {
      if (state.phase !== 'tiebreak' || state.tiebreak !== tb) return;
      tb.current += 1;
      if (tb.current >= tb.contenders.length) evaluateTiebreak();
      else broadcastTiebreak();
    }, SPIN_MS + 200);
  });

  // --- FINAL game ---

  // Admin starts the final with the shared topic + 3 phrases (board 1 awaits picks).
  socket.on('admin:startFinal', ({ topic, phrases, envelopes: envTexts }) => {
    if (state.phase !== 'finalist' || state.finalistId == null) return;
    if (!Array.isArray(envTexts) || envTexts.length !== 3 || envTexts.some(t => !String(t || '').trim())) {
      return io.to('admin').emit('admin:finalError', 'Inserisci anche i 3 testi delle buste');
    }
    const r = finalgame.createFinalGame(topic, phrases);
    if (!r.ok) return io.to('admin').emit('admin:finalError', r.error);
    state.fg = r.fg;
    state.envelopeContents = envTexts.map(t => String(t).trim());
    state.finalTimeLeft = FINAL_TIME_MS;
    state.phase = 'final';
    io.to('admin').emit('admin:finalError', '');
    state.lobby.forEach((p, i) => io.to(p.socketId).emit('player:finalStart', { isFinalist: i === state.finalistId }));
    broadcastFinal();
  });

  // Finalist picks a letter (board 1: 3 consonants + 1 vowel then the timer starts;
  // board 3: unlimited consonants + 1 vowel, a wrong letter docks 3s).
  socket.on('player:finalPick', ({ letter }) => {
    if (state.phase !== 'final' || !state.fg) return;
    if (socket.playerIndex !== state.finalistId) return;
    const res = finalgame.pick(state.fg, letter);
    if (!res.ok) return;
    // Board 1 sends no positions until all 4 picks are in (then flips them together).
    if (res.positions && res.positions.length) io.to('main').emit('main:finalReveal', { positions: res.positions });
    if (res.wrong) {
      state.finalTimeLeft = Math.max(0, state.finalTimeLeft - FINAL_PENALTY_MS);
      io.to('main').emit('main:finalTimer', { ms: state.finalTimeLeft });
      io.to('main').emit('main:wrong');
      if (state.finalTimeLeft <= 0) { clearFinalTimer(); finalgame.expire(state.fg); return endFinal(); }
    }
    if (res.startTimer) startFinalCountdown(); // board 1 picks complete
    broadcastFinal();
  });

  socket.on('player:finalBuzz', () => {
    if (state.phase !== 'final' || !state.fg) return;
    if (socket.playerIndex !== state.finalistId) return;
    const res = finalgame.buzz(state.fg);
    if (!res.ok) return;
    clearFinalTimer(); // stop the clock while answering
    io.to('main').emit('main:finalBuzzed');
    broadcastFinal();
  });

  socket.on('admin:finalCorrect', () => finalJudge(true));
  socket.on('admin:finalWrong', () => finalJudge(false));
  function finalJudge(correct) {
    if (state.phase !== 'final' || !state.fg || state.fg.state !== 'BUZZED') return;
    const res = finalgame.resolve(state.fg, correct);
    if (!res.ok) return;
    io.to('main').emit('main:finalBoard', finalBoardView());      // the just-resolved board, revealed
    io.to('main').emit(correct ? 'main:solved' : 'main:wrong');
    io.to('admin').emit('admin:state', adminView());
    if (res.finished) { endFinal(); return; }
    // brief pause on the solved board, then advance and resume the carried time
    setTimeout(() => {
      if (state.phase !== 'final' || !state.fg) return;
      finalgame.advance(state.fg);
      broadcastFinal();
      startFinalCountdown();
    }, 1600);
  }

  // --- ENVELOPES ---

  socket.on('player:envelopeOpen', ({ index }) => {
    if (state.phase !== 'envelopes' || !state.env) return;
    if (socket.playerIndex !== state.finalistId) return;
    if (!envelopes.openEnvelope(state.env, index).ok) return;
    broadcastEnvelopes(false);
  });

  socket.on('player:envelopeChange', ({ index }) => {
    if (state.phase !== 'envelopes' || !state.env) return;
    if (socket.playerIndex !== state.finalistId) return;
    if (!envelopes.changeEnvelope(state.env, index).ok) return;
    broadcastEnvelopes(false);
  });

  socket.on('player:envelopeKeep', () => {
    if (state.phase !== 'envelopes' || !state.env) return;
    if (socket.playerIndex !== state.finalistId) return;
    if (!envelopes.keepEnvelope(state.env).ok) return;
    broadcastEnvelopes(false);
  });

  socket.on('admin:envelopeRevealRed', ({ index }) => {
    if (state.phase !== 'envelopes' || !state.env) return;
    if (!envelopes.revealRed(state.env, index).ok) return;
    broadcastEnvelopes(false);
  });

  socket.on('admin:giramoeWrong', () => {
    if (state.phase !== 'giramoe' || !state.gi) return;
    const res = giramoe.judgeWrong(state.gi);
    if (!res.ok) return;
    clearGiramoeTimer();
    io.to('main').emit('main:giramoeResume');
    broadcastGiramoe();
  });

  // Admin removes a player during the lobby (frees the slot).
  socket.on('admin:kick', ({ name }) => {
    if (state.phase !== 'lobby') return;
    const idx = state.lobby.findIndex(pl => pl.name === name);
    if (idx === -1) return;
    const [removed] = state.lobby.splice(idx, 1);
    if (removed.connected) io.to(removed.socketId).emit('player:kicked');
    io.to('main').emit('main:playerJoined', { players: lobbyPlayers() });
    io.to('admin').emit('admin:state', adminView());
  });

  socket.on('disconnect', () => {
    const p = state.lobby.find(pl => pl.socketId === socket.id);
    if (!p) return;
    p.connected = false;
    const midGame = isWheelPhase() || ['triplete', 'tripleteReady', 'giramoe', 'tiebreak', 'final', 'envelopes'].includes(state.phase);
    if (midGame) {
      // mid-game: pause the main screen (and any reveal/buzz timer) with the overlay
      if (state.phase === 'triplete') clearTripleteTimer();
      if (state.phase === 'giramoe') clearGiramoeTimer();
      if (state.phase === 'final') clearFinalTimer();
      io.to('main').emit('main:playerDisconnected', { players: lobbyPlayers() });
    } else {
      // lobby: keep the QR visible, just refresh the slots
      io.to('main').emit('main:playerJoined', { players: lobbyPlayers() });
    }
    io.to('admin').emit('admin:state', adminView());
  });

  socket.on('player:reconnect', ({ roomCode, name }) => {
    if (state.roomCode !== roomCode) return socket.emit('player:error', 'Sessione scaduta');
    const p = state.lobby.find(pl => pl.name === name);
    if (!p) return socket.emit('player:error', 'Impossibile riconnettersi');
    p.socketId = socket.id;
    p.connected = true;
    socket.playerIndex = state.lobby.indexOf(p);
    socket.emit('player:reconnected', { playerIndex: socket.playerIndex, name, phase: state.phase });
    if (isWheelPhase() && state.g) {
      socket.emit('player:turnState', playerView(socket.playerIndex));
      io.to('main').emit('main:playerReconnected', { players: lobbyPlayers() });
    } else if (state.phase === 'triplete' && state.t) {
      socket.emit('player:tripleteIntro');
      socket.emit('player:tripleteState', playerTripleteView(socket.playerIndex));
      io.to('main').emit('main:playerReconnected', { players: lobbyPlayers() });
      // resume the reveal once everyone is back
      if (state.lobby.every(pl => pl.connected)) startTripleteReveal();
    } else if (state.phase === 'giramoe' && state.gi) {
      socket.emit('player:giramoeIntro');
      socket.emit('player:giramoeState', playerGiramoeView(socket.playerIndex));
      io.to('main').emit('main:playerReconnected', { players: lobbyPlayers() });
    } else if (state.phase === 'tiebreak' && state.tiebreak) {
      broadcastTiebreak();
      io.to('main').emit('main:playerReconnected', { players: lobbyPlayers() });
    } else if (state.phase === 'finalist' && state.finalistId != null) {
      const f = state.g.players.find(pl => pl.id === state.finalistId);
      socket.emit('player:finalist', { id: f.id, name: f.name, isMe: socket.playerIndex === f.id });
      io.to('main').emit('main:playerReconnected', { players: lobbyPlayers() });
    } else if (state.phase === 'final' && state.fg) {
      socket.emit('player:finalStart', { isFinalist: socket.playerIndex === state.finalistId });
      if (socket.playerIndex === state.finalistId) socket.emit('player:finalState', playerFinalView());
      io.to('main').emit('main:playerReconnected', { players: lobbyPlayers() });
      if (state.lobby.every(pl => pl.connected)) startFinalCountdown(); // resume if it was running
    } else if (state.phase === 'envelopes' && state.env) {
      socket.emit('player:envelopesStart', { view: envelopesView(), isFinalist: socket.playerIndex === state.finalistId });
      io.to('main').emit('main:playerReconnected', { players: lobbyPlayers() });
    } else {
      io.to('main').emit('main:playerJoined', { players: lobbyPlayers() });
    }
    io.to('admin').emit('admin:state', adminView());
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log('Giramoe server running!');
  console.log(`Main screen: http://${ip}:${PORT}`);
  console.log(`Admin:       http://${ip}:${PORT}/admin.html`);
  if (process.env.GIRAMOE_PUBLIC_URL) {
    console.log(`Online:      ${process.env.GIRAMOE_PUBLIC_URL} (QR per i giocatori)`);
  }
});

module.exports = { app, server, io };
