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
    if (state.lobby.length !== 3) return;
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
    const extra = 5 + Math.floor(Math.random() * 3);
    const totalAngle = extra * 360 + (360 - winningSegment * 22.5 - 11.25);
    const result = game.applySpin(state.g, winningSegment);

    const spinData = { winningSegment, totalAngle, value: state.g.segments[winningSegment], result };
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

  socket.on('admin:passTurn', () => {
    if (state.phase !== 'playing' || !state.g) return;
    game.passTurn(state.g);
    io.to('main').emit('main:wrong');
    broadcastScores();
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
  if (process.env.GIRAMOE_PUBLIC_URL) {
    console.log(`Online:      ${process.env.GIRAMOE_PUBLIC_URL} (QR per i giocatori)`);
  }
});

module.exports = { app, server };
