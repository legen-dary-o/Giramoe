const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const PORT = 3000;

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// --- Game State ---

let game = {
  phase: 'video',        // video | lobby | playing
  roomCode: null,
  players: [],            // [{ id, name, socketId, connected }]
  currentTurnIndex: 0,
  segments: [
    'Spicchio 1', 'Spicchio 2', 'Spicchio 3', 'Spicchio 4',
    'Spicchio 5', 'Spicchio 6', 'Spicchio 7', 'Spicchio 8',
    'Spicchio 9', 'Spicchio 10', 'Spicchio 11', 'Spicchio 12',
    'Spicchio 13', 'Spicchio 14', 'Spicchio 15', 'Spicchio 16'
  ],
  spinning: false
};

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function resetGame() {
  game.phase = 'video';
  game.roomCode = null;
  game.players = [];
  game.currentTurnIndex = 0;
  game.spinning = false;
}

function allPlayersConnected() {
  return game.players.length === 3 && game.players.every(p => p.connected);
}

// --- Socket.IO Events ---

io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);

  // ADMIN EVENTS

  socket.on('admin:init', () => {
    socket.join('admin');
    socket.emit('admin:state', game);
  });

  socket.on('admin:inizia', () => {
    game.phase = 'lobby';
    game.roomCode = generateRoomCode();
    const ip = getLocalIP();
    const url = `http://${ip}:${PORT}/play.html?room=${game.roomCode}`;
    io.to('main').emit('main:showLobby', { roomCode: game.roomCode, url, players: game.players });
    socket.emit('admin:state', game);
  });

  socket.on('admin:startGame', () => {
    if (game.players.length === 3) {
      game.phase = 'playing';
      game.currentTurnIndex = 0;
      io.to('main').emit('main:startGame', {
        players: game.players.map(p => p.name),
        currentTurn: 0,
        segments: game.segments
      });
      game.players.forEach(p => {
        io.to(p.socketId).emit('player:gameStarted', {
          currentTurn: 0,
          playerIndex: game.players.indexOf(p),
          players: game.players.map(pp => pp.name)
        });
      });
      io.to('admin').emit('admin:state', game);
    }
  });

  // MAIN SCREEN EVENTS

  socket.on('main:init', () => {
    socket.join('main');
    socket.emit('main:state', game);
  });

  // PLAYER EVENTS

  socket.on('player:join', ({ roomCode, name }) => {
    if (game.roomCode !== roomCode) {
      socket.emit('player:error', 'Codice stanza non valido');
      return;
    }
    if (game.players.length >= 3) {
      socket.emit('player:error', 'Lobby piena');
      return;
    }
    if (game.phase !== 'lobby') {
      socket.emit('player:error', 'La partita non accetta giocatori');
      return;
    }

    const playerIndex = game.players.length;
    game.players.push({
      id: playerIndex,
      name,
      socketId: socket.id,
      connected: true
    });

    socket.join('players');
    socket.playerIndex = playerIndex;
    socket.roomCode = roomCode;

    socket.emit('player:joined', { playerIndex, name });
    io.to('main').emit('main:playerJoined', { players: game.players.map(p => ({ name: p.name, connected: p.connected })) });
    io.to('admin').emit('admin:state', game);
  });

  socket.on('player:spin', () => {
    if (game.phase !== 'playing') return;
    if (game.spinning) return;
    const playerIndex = socket.playerIndex;
    if (playerIndex === undefined || playerIndex !== game.currentTurnIndex) return;

    game.spinning = true;
    const winningSegment = Math.floor(Math.random() * 16);
    const extraRotations = 5 + Math.floor(Math.random() * 3); // 5-7 full rotations
    const totalAngle = extraRotations * 360 + (360 - (winningSegment * 22.5) - 11.25); // land on center of segment

    const spinData = {
      winningSegment,
      totalAngle,
      segmentText: game.segments[winningSegment],
      playerIndex
    };

    io.to('main').emit('main:spin', spinData);
    io.to(socket.id).emit('player:spinResult', spinData);
    io.to('admin').emit('admin:spinning', spinData);

    // After spin animation + display time (6s spin + 3s display = 9s)
    setTimeout(() => {
      game.spinning = false;
      game.currentTurnIndex = (game.currentTurnIndex + 1) % 3;

      const turnData = {
        currentTurn: game.currentTurnIndex,
        players: game.players.map(p => p.name)
      };

      io.to('main').emit('main:nextTurn', turnData);
      game.players.forEach(p => {
        io.to(p.socketId).emit('player:turnUpdate', {
          currentTurn: game.currentTurnIndex,
          playerIndex: p.id
        });
      });
      io.to('admin').emit('admin:state', game);
    }, 9000);
  });

  // DISCONNECTION

  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`);
    const player = game.players.find(p => p.socketId === socket.id);
    if (player) {
      player.connected = false;
      io.to('main').emit('main:playerDisconnected', {
        playerIndex: player.id,
        players: game.players.map(p => ({ name: p.name, connected: p.connected }))
      });
      game.players.forEach(p => {
        if (p.socketId !== socket.id) {
          io.to(p.socketId).emit('player:waitReconnect', { disconnectedPlayer: player.name });
        }
      });
      io.to('admin').emit('admin:state', game);
    }
  });

  // RECONNECTION (player rejoins with same name)

  socket.on('player:reconnect', ({ roomCode, name }) => {
    const player = game.players.find(p => p.name === name && !p.connected);
    if (!player) {
      socket.emit('player:error', 'Impossibile riconnettersi');
      return;
    }
    player.socketId = socket.id;
    player.connected = true;
    socket.playerIndex = player.id;
    socket.roomCode = roomCode;
    socket.join('players');

    socket.emit('player:reconnected', {
      playerIndex: player.id,
      name: player.name,
      phase: game.phase,
      currentTurn: game.currentTurnIndex
    });

    io.to('main').emit('main:playerReconnected', {
      players: game.players.map(p => ({ name: p.name, connected: p.connected }))
    });
    game.players.forEach(p => {
      if (p.socketId !== socket.id) {
        io.to(p.socketId).emit('player:resumeGame', {
          currentTurn: game.currentTurnIndex,
          playerIndex: p.id
        });
      }
    });
    io.to('admin').emit('admin:state', game);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log(`Giramoe server running!`);
  console.log(`Main screen: http://${ip}:${PORT}`);
  console.log(`Admin:       http://${ip}:${PORT}/admin.html`);
});
