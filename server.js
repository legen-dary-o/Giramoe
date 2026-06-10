const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');
const game = require('./game');
const board = require('./board');
const triplete = require('./triplete');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const HOST = process.env.HOST || '0.0.0.0';
const TOTAL_BOARDS = 3;
const SPIN_MS = 6000; // wheel animation duration (must match client)

// --- Triplete (bonus round) timing ---
const TRIPLETE_REVEAL_MS = 1500; // a cell appears every 1.5s
const TRIPLETE_FLASH_MS = 1000;  // board 3: a flashed cell stays 1s before vanishing
const TRIPLETE_FLASH_COUNT = 15; // board 3: flashes before the letters stabilize
const TRIPLETE_GAP_MS = 2800;    // pause between boards / before the final standings

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
  phase: 'video',     // video | lobby | playing | tripleteReady | triplete | matchEnd
  roomCode: null,
  lobby: [],          // [{ name, socketId, connected }]
  g: null,            // game object once playing
  t: null             // triplete object during the bonus round
};

let tripleteTimer = null; // single reveal/flash timer for the bonus round

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
        return { type: 'letter', revealed: cell.revealed, letter: cell.revealed ? cell.letter : null };
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
  const inGame = ['playing', 'tripleteReady', 'triplete', 'matchEnd'].includes(state.phase);
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
      : null
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
        return { type: 'letter', revealed: cell.revealed, letter: cell.revealed ? cell.letter : null };
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
    onTripleteBoardEnd(triplete.boardFilled(t)); // filled, nobody solved
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
  state.phase = 'matchEnd';
  const standings = state.g.players
    .map(p => ({ name: p.name, bank: p.bank }))
    .sort((a, b) => b.bank - a.bank);
  io.to('main').emit('main:matchEnd', { standings });
  io.to('admin').emit('admin:state', adminView());
  state.lobby.forEach(p => io.to(p.socketId).emit('player:matchEnd', { standings }));
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

// --- Socket handlers ---

io.on('connection', (socket) => {
  socket.on('admin:init', () => {
    socket.join('admin');
    socket.emit('admin:state', adminView());
  });

  socket.on('main:init', () => {
    socket.join('main');
    socket.emit('main:state', { phase: state.phase });
    if (state.phase === 'playing' || state.phase === 'tripleteReady') {
      socket.emit('main:gameState', mainGameView());
    } else if (state.phase === 'triplete' && state.t) {
      socket.emit('main:tripleteBoard', tripleteBoardView());
      socket.emit('main:tripleteScores', { scores: tripleteScores(), buzzedBy: state.t.buzzedBy });
    }
  });

  socket.on('admin:inizia', () => {
    state.phase = 'lobby';
    state.roomCode = generateRoomCode();
    state.lobby = [];
    const base = process.env.GIRAMOE_PUBLIC_URL || `http://${getLocalIP()}:${PORT}`;
    const url = `${base}/play.html?room=${state.roomCode}`;
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
    if (state.lobby.length !== 3 || !state.lobby.every(p => p.connected)) return;
    state.g = game.createGame(state.lobby.map((p, i) => ({ id: i, name: p.name })));
    state.phase = 'playing';
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
    broadcastBoard();
  });

  socket.on('player:spin', () => {
    if (state.phase !== 'playing' || !state.g || !state.g.board) return;
    const pi = socket.playerIndex;
    if (pi !== state.g.currentTurnIndex) return;
    if (state.g.turnState !== 'MUST_SPIN' && state.g.turnState !== 'CONTINUE') return;

    const winningSegment = Math.floor(Math.random() * 16);
    const spins = 5 + Math.floor(Math.random() * 3);
    const result = game.applySpin(state.g, winningSegment);

    // Each wheel computes the landing rotation from the winning segment + its own
    // current rotation, so it always stops on the segment that matches the result.
    const spinData = { winningSegment, spins, value: state.g.segments[winningSegment], result };
    io.to('main').emit('main:spin', spinData);
    io.to(socket.id).emit('player:spinResult', spinData);

    setTimeout(() => broadcastScores(), SPIN_MS + 200);
  });

  socket.on('player:pickConsonant', ({ letter }) => {
    if (state.phase !== 'playing' || !state.g || !state.g.board) return;
    if (socket.playerIndex !== state.g.currentTurnIndex) return;
    const res = game.applyConsonant(state.g, letter);
    if (!res.ok) return;
    if (res.present) io.to('main').emit('main:revealLetter', { positions: res.positions });
    else io.to('main').emit('main:wrong');
    broadcastScores();
  });

  socket.on('player:buyVowel', ({ letter }) => {
    if (state.phase !== 'playing' || !state.g || !state.g.board) return;
    if (socket.playerIndex !== state.g.currentTurnIndex) return;
    const res = game.applyVowel(state.g, letter);
    if (!res.ok) return;
    if (res.present) io.to('main').emit('main:revealLetter', { positions: res.positions });
    else io.to('main').emit('main:wrong');
    broadcastScores();
  });

  socket.on('admin:solve', () => {
    if (state.phase !== 'playing' || !state.g) return;
    game.applySolve(state.g);
    io.to('main').emit('main:gameState', mainGameView()); // fully-revealed board
    io.to('main').emit('main:solved');

    if (state.g.boardNumber >= TOTAL_BOARDS) {
      // The 3 wheel boards are done: offer the Triplete bonus round (the main
      // screen keeps the solved board; admin shows the "IL TRIPLETE" button).
      state.phase = 'tripleteReady';
      io.to('admin').emit('admin:state', adminView());
    } else {
      state.g.boardNumber += 1;
      broadcastAdminPlayers();
      io.to('admin').emit('admin:boardSolved', { boardNumber: state.g.boardNumber });
    }
  });

  socket.on('admin:passTurn', () => {
    if (state.phase !== 'playing' || !state.g) return;
    game.passTurn(state.g);
    io.to('main').emit('main:wrong');
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
    if (!res.ok) return;
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
    if (state.phase === 'playing' || state.phase === 'triplete' || state.phase === 'tripleteReady') {
      // mid-game: pause the main screen (and the triplete reveal) with the overlay
      if (state.phase === 'triplete') clearTripleteTimer();
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
    if (state.phase === 'playing' && state.g) {
      socket.emit('player:turnState', playerView(socket.playerIndex));
      io.to('main').emit('main:playerReconnected', { players: lobbyPlayers() });
    } else if (state.phase === 'triplete' && state.t) {
      socket.emit('player:tripleteIntro');
      socket.emit('player:tripleteState', playerTripleteView(socket.playerIndex));
      io.to('main').emit('main:playerReconnected', { players: lobbyPlayers() });
      // resume the reveal once everyone is back
      if (state.lobby.every(pl => pl.connected)) startTripleteReveal();
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
