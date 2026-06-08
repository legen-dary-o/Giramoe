# Giramoe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an interactive live party game website with a spinning wheel, real-time sync between a PC display, admin phone, and 3 player phones via Socket.IO.

**Architecture:** Single Node.js server using Express for static files and Socket.IO for real-time communication. Game state lives in server memory. Three HTML views: main display (PC), admin (phone), player (phone). Shared wheel renderer in Canvas.

**Tech Stack:** Node.js, Express, Socket.IO, HTML5 Canvas, CSS3 (liquid glass style), qrcode.js (client-side QR generation)

**Spec:** `docs/superpowers/specs/2026-06-09-giramoe-game-design.md`

---

## File Structure

```
Documents/Giramoe/
├── server.js              # Express server + Socket.IO event handlers + game state
├── package.json           # Dependencies: express, socket.io
├── public/
│   ├── index.html         # Main screen (PC/TV) — display only
│   ├── admin.html         # Admin panel (game master's phone)
│   ├── play.html          # Player view (phone)
│   ├── css/
│   │   └── style.css      # Shared styles: liquid glass, animations, layout
│   ├── js/
│   │   ├── wheel.js       # Wheel renderer (Canvas): draw + animate spin
│   │   ├── main.js        # Main screen: video → lobby → game display
│   │   ├── admin.js       # Admin: inizia → lobby → game controls
│   │   └── player.js      # Player: nickname → lobby → spin interaction
│   └── assets/
│       ├── trailer.mp4    # (already exists — move from root)
│       └── logo.png       # (already exists — move from root)
└── docs/                  # (already exists)
```

---

### Task 1: Project Setup and Server Skeleton

**Files:**
- Create: `package.json`
- Create: `server.js`

- [ ] **Step 1: Initialize package.json**

```bash
cd /Users/mario_dangelo/Documents/Giramoe
npm init -y
```

Then edit `package.json` to:

```json
{
  "name": "giramoe",
  "version": "1.0.0",
  "description": "Interactive live party game with spinning wheel",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.21.0",
    "socket.io": "^4.8.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
cd /Users/mario_dangelo/Documents/Giramoe
npm install
```

Expected: `node_modules` created, `package-lock.json` generated.

- [ ] **Step 3: Move assets into public/assets**

```bash
cd /Users/mario_dangelo/Documents/Giramoe
mkdir -p public/assets public/css public/js
cp trailer.mp4 public/assets/trailer.mp4
cp logo.png public/assets/logo.png
```

- [ ] **Step 4: Write server.js**

```javascript
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
```

- [ ] **Step 5: Verify server starts**

```bash
cd /Users/mario_dangelo/Documents/Giramoe
npm start
```

Expected: Server prints URLs. Stop with Ctrl+C.

- [ ] **Step 6: Commit**

```bash
cd /Users/mario_dangelo/Documents/Giramoe
git init
git add package.json package-lock.json server.js public/assets/
git commit -m "feat: project setup with Express + Socket.IO server and game state"
```

---

### Task 2: Shared CSS — Liquid Glass Style

**Files:**
- Create: `public/css/style.css`

- [ ] **Step 1: Write style.css**

```css
/* === RESET & BASE === */
*, *::before, *::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  font-family: -apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif;
  background: #ffffff;
  color: #1a1a1a;
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
}

/* === LIQUID GLASS === */

.glass-panel {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.7) 0%,
    rgba(255, 255, 255, 0.3) 50%,
    rgba(255, 255, 255, 0.5) 100%
  );
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 24px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    inset 0 -1px 0 rgba(255, 255, 255, 0.3);
}

.glass-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 16px 48px;
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.8) 0%,
    rgba(200, 220, 255, 0.4) 50%,
    rgba(255, 255, 255, 0.6) 100%
  );
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.9);
  border-radius: 18px;
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.1),
    0 2px 4px rgba(0, 0, 0, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 1),
    inset 0 -1px 0 rgba(255, 255, 255, 0.4);
  cursor: pointer;
  transition: all 0.3s ease;
  text-decoration: none;
}

.glass-button:hover {
  transform: translateY(-2px);
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.12),
    0 4px 8px rgba(0, 0, 0, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 1),
    inset 0 -1px 0 rgba(255, 255, 255, 0.4);
}

.glass-button:active {
  transform: translateY(0px);
}

.glass-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* === LAYOUT HELPERS === */

.screen {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: absolute;
  top: 0;
  left: 0;
  transition: opacity 0.6s ease;
}

.screen.hidden {
  opacity: 0;
  pointer-events: none;
}

/* === VIDEO SCREEN === */

#video-screen video {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

/* === LOBBY === */

.lobby-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
}

.qr-container {
  padding: 24px;
}

.qr-container canvas {
  border-radius: 16px;
}

.player-slots {
  display: flex;
  gap: 24px;
  justify-content: center;
}

.player-slot {
  padding: 12px 24px;
  font-size: 18px;
  font-weight: 500;
  min-width: 140px;
  text-align: center;
  border-radius: 14px;
  background: rgba(200, 200, 200, 0.15);
  border: 1px solid rgba(200, 200, 200, 0.3);
  color: #aaa;
  transition: all 0.4s ease;
}

.player-slot.filled {
  background: linear-gradient(
    135deg,
    rgba(100, 200, 255, 0.2) 0%,
    rgba(150, 100, 255, 0.15) 100%
  );
  border: 1px solid rgba(100, 180, 255, 0.5);
  color: #1a1a1a;
}

/* === GAME SCREEN === */

.game-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  width: 100%;
  height: 100%;
  justify-content: center;
}

.players-bar {
  display: flex;
  gap: 24px;
  justify-content: center;
}

.player-name {
  padding: 10px 28px;
  font-size: 20px;
  font-weight: 600;
  border-radius: 14px;
  transition: all 0.4s ease;
  opacity: 0.35;
}

.player-name.active {
  opacity: 1;
  background: linear-gradient(
    135deg,
    rgba(100, 200, 255, 0.25) 0%,
    rgba(150, 100, 255, 0.2) 100%
  );
  border: 1px solid rgba(100, 180, 255, 0.5);
  box-shadow: 0 0 20px rgba(100, 180, 255, 0.3);
}

.wheel-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wheel-indicator {
  position: absolute;
  top: -20px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 14px solid transparent;
  border-right: 14px solid transparent;
  border-top: 28px solid rgba(100, 180, 255, 0.8);
  filter: drop-shadow(0 2px 6px rgba(100, 180, 255, 0.5));
  z-index: 10;
}

/* === RESULT OVERLAY === */

.result-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  z-index: 100;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.5s ease;
}

.result-overlay.visible {
  opacity: 1;
  pointer-events: auto;
}

.result-text {
  font-size: 64px;
  font-weight: 700;
  text-align: center;
  background: linear-gradient(135deg, #4facfe, #a855f7, #ec4899);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: resultPopIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes resultPopIn {
  0% { transform: scale(0.5); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

/* === DISCONNECT OVERLAY === */

.disconnect-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  z-index: 200;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.5s ease;
}

.disconnect-overlay.visible {
  opacity: 1;
  pointer-events: auto;
}

.disconnect-overlay p {
  font-size: 24px;
  font-weight: 500;
  color: #666;
}

/* === PLAYER MOBILE VIEW === */

.mobile-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 20px;
  padding: 20px;
}

.turn-message {
  font-size: 20px;
  font-weight: 600;
  text-align: center;
  padding: 12px 24px;
  border-radius: 14px;
  transition: all 0.4s ease;
}

.turn-message.your-turn {
  color: #4facfe;
  background: linear-gradient(
    135deg,
    rgba(100, 200, 255, 0.15) 0%,
    rgba(150, 100, 255, 0.1) 100%
  );
  box-shadow: 0 0 20px rgba(100, 180, 255, 0.2);
}

.turn-message.waiting {
  color: #aaa;
}

.player-nick {
  font-size: 16px;
  font-weight: 500;
  color: #999;
  position: absolute;
  bottom: 24px;
}

.wheel-container.disabled {
  opacity: 0.35;
  pointer-events: none;
}

/* === ADMIN MOBILE VIEW === */

.admin-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px;
  gap: 20px;
  height: 100%;
  overflow-y: auto;
}

.admin-container h1 {
  font-size: 22px;
  font-weight: 700;
  background: linear-gradient(135deg, #4facfe, #a855f7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.admin-player-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.admin-player-item {
  padding: 14px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 16px;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #4ade80;
}

.status-dot.disconnected {
  background: #f87171;
}

.admin-section {
  width: 100%;
}

.admin-section h2 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 10px;
  color: #666;
}

/* === JOIN FORM === */

.join-form {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: 100%;
  max-width: 300px;
}

.glass-input {
  width: 100%;
  padding: 14px 20px;
  font-size: 18px;
  font-weight: 500;
  text-align: center;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.8) 0%,
    rgba(230, 240, 255, 0.4) 100%
  );
  backdrop-filter: blur(10px);
  border: 1px solid rgba(200, 220, 255, 0.6);
  border-radius: 14px;
  outline: none;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 2px 8px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}

.glass-input:focus {
  border-color: rgba(100, 180, 255, 0.7);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 0 16px rgba(100, 180, 255, 0.2);
}

.glass-input::placeholder {
  color: #bbb;
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/mario_dangelo/Documents/Giramoe
git add public/css/style.css
git commit -m "feat: liquid glass shared CSS styles"
```

---

### Task 3: Wheel Renderer (Canvas)

**Files:**
- Create: `public/js/wheel.js`

- [ ] **Step 1: Write wheel.js**

```javascript
const SEGMENT_COLORS = [
  '#22c55e', '#4ade80', '#a3e635', '#eab308',
  '#f59e0b', '#f97316', '#ef4444', '#f43f5e',
  '#ec4899', '#d946ef', '#a855f7', '#8b5cf6',
  '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4'
];

class Wheel {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.segments = options.segments || 16;
    this.labels = options.labels || [];
    this.showLabels = options.showLabels !== false;
    this.radius = 0;
    this.rotation = 0;
    this.spinning = false;
    this.onSpinEnd = options.onSpinEnd || null;

    this.resize();
    this.draw();
  }

  resize() {
    const container = this.canvas.parentElement;
    const size = Math.min(container.clientWidth, container.clientHeight) * 0.85;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = size * dpr;
    this.canvas.height = size * dpr;
    this.canvas.style.width = size + 'px';
    this.canvas.style.height = size + 'px';
    this.ctx.scale(dpr, dpr);
    this.radius = size / 2 - 4;
    this.centerX = size / 2;
    this.centerY = size / 2;
    this.draw();
  }

  draw() {
    const ctx = this.ctx;
    const cx = this.centerX;
    const cy = this.centerY;
    const r = this.radius;
    const segAngle = (2 * Math.PI) / this.segments;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.rotation);

    for (let i = 0; i < this.segments; i++) {
      const startAngle = i * segAngle - Math.PI / 2;
      const endAngle = startAngle + segAngle;

      // Segment fill
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
      ctx.fill();

      // Segment border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Glass highlight on each segment
      const grad = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
      grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0.15)');
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Label text
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
    }

    // Center circle (glass hub)
    const hubGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.12);
    hubGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    hubGrad.addColorStop(0.7, 'rgba(200, 220, 255, 0.7)');
    hubGrad.addColorStop(1, 'rgba(180, 200, 255, 0.5)');
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.12, 0, 2 * Math.PI);
    ctx.fillStyle = hubGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Outer ring (glass border)
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.restore();
  }

  truncateText(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let truncated = text;
    while (truncated.length > 0 && ctx.measureText(truncated + '…').width > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + '…';
  }

  spinTo(totalAngle, duration = 6000) {
    if (this.spinning) return;
    this.spinning = true;

    const startRotation = this.rotation;
    const targetRotation = startRotation + (totalAngle * Math.PI) / 180;
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Cubic ease-out for natural deceleration
      const eased = 1 - Math.pow(1 - progress, 3);

      this.rotation = startRotation + (targetRotation - startRotation) * eased;
      this.draw();

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.spinning = false;
        if (this.onSpinEnd) this.onSpinEnd();
      }
    };

    requestAnimationFrame(animate);
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/mario_dangelo/Documents/Giramoe
git add public/js/wheel.js
git commit -m "feat: Canvas wheel renderer with spin animation and glass style"
```

---

### Task 4: Main Screen (PC/TV Display)

**Files:**
- Create: `public/index.html`
- Create: `public/js/main.js`

- [ ] **Step 1: Write index.html**

```html
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Giramoe</title>
  <link rel="stylesheet" href="/css/style.css">
  <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js"></script>
</head>
<body>
  <!-- Video Screen -->
  <div id="video-screen" class="screen">
    <video id="intro-video" autoplay muted playsinline>
      <source src="/assets/trailer.mp4" type="video/mp4">
    </video>
  </div>

  <!-- Start Button Screen -->
  <div id="start-screen" class="screen hidden">
    <button class="glass-button" id="start-btn" disabled>Inizia</button>
  </div>

  <!-- Lobby Screen -->
  <div id="lobby-screen" class="screen hidden">
    <div class="lobby-container">
      <div class="qr-container glass-panel">
        <canvas id="qr-canvas"></canvas>
      </div>
      <div class="player-slots" id="player-slots">
        <div class="player-slot" id="slot-0">—</div>
        <div class="player-slot" id="slot-1">—</div>
        <div class="player-slot" id="slot-2">—</div>
      </div>
    </div>
  </div>

  <!-- Game Screen -->
  <div id="game-screen" class="screen hidden">
    <div class="game-container">
      <div class="players-bar" id="players-bar"></div>
      <div class="wheel-container" id="main-wheel-container">
        <div class="wheel-indicator"></div>
        <canvas id="main-wheel-canvas"></canvas>
      </div>
    </div>

    <div class="result-overlay" id="result-overlay">
      <div class="result-text" id="result-text"></div>
    </div>
  </div>

  <!-- Disconnect Overlay -->
  <div class="disconnect-overlay" id="disconnect-overlay">
    <p>In attesa di riconnessione...</p>
  </div>

  <script src="/socket.io/socket.io.js"></script>
  <script src="/js/wheel.js"></script>
  <script src="/js/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write main.js**

```javascript
const socket = io();

let wheel = null;
let currentPlayers = [];

// --- Screen transitions ---

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

// --- Video ---

const video = document.getElementById('intro-video');

video.addEventListener('ended', () => {
  showScreen('start-screen');
});

video.addEventListener('error', () => {
  showScreen('start-screen');
});

// --- Socket events ---

socket.emit('main:init');

socket.on('main:state', (game) => {
  if (game.phase === 'video') {
    showScreen('video-screen');
  } else if (game.phase === 'lobby') {
    showScreen('lobby-screen');
  } else if (game.phase === 'playing') {
    showScreen('game-screen');
  }
});

socket.on('main:showLobby', ({ url, players }) => {
  showScreen('lobby-screen');
  QRCode.toCanvas(document.getElementById('qr-canvas'), url, {
    width: 220,
    margin: 2,
    color: { dark: '#1a1a1a', light: '#ffffff' }
  });
  updatePlayerSlots(players);
});

socket.on('main:playerJoined', ({ players }) => {
  updatePlayerSlots(players);
});

socket.on('main:startGame', ({ players, currentTurn, segments }) => {
  currentPlayers = players;
  showScreen('game-screen');
  renderPlayersBar(players, currentTurn);
  initMainWheel(segments);
});

socket.on('main:spin', ({ totalAngle, winningSegment, segmentText }) => {
  if (wheel) {
    wheel.spinTo(totalAngle, 6000);
    wheel.onSpinEnd = () => {
      showResult(segmentText);
    };
  }
});

socket.on('main:nextTurn', ({ currentTurn, players }) => {
  renderPlayersBar(players, currentTurn);
});

socket.on('main:playerDisconnected', ({ players }) => {
  document.getElementById('disconnect-overlay').classList.add('visible');
  updatePlayersBarStatus(players);
});

socket.on('main:playerReconnected', ({ players }) => {
  document.getElementById('disconnect-overlay').classList.remove('visible');
  updatePlayersBarStatus(players);
});

// --- UI Updates ---

function updatePlayerSlots(players) {
  for (let i = 0; i < 3; i++) {
    const slot = document.getElementById(`slot-${i}`);
    if (players[i]) {
      slot.textContent = players[i].name;
      slot.classList.add('filled');
    } else {
      slot.textContent = '—';
      slot.classList.remove('filled');
    }
  }
}

function renderPlayersBar(players, currentTurn) {
  const bar = document.getElementById('players-bar');
  bar.innerHTML = '';
  players.forEach((name, i) => {
    const el = document.createElement('div');
    el.className = 'player-name glass-panel' + (i === currentTurn ? ' active' : '');
    el.textContent = name;
    el.id = `pbar-${i}`;
    bar.appendChild(el);
  });
}

function updatePlayersBarStatus(players) {
  players.forEach((p, i) => {
    const el = document.getElementById(`pbar-${i}`);
    if (el) {
      el.style.opacity = p.connected ? '' : '0.3';
    }
  });
}

function initMainWheel(segments) {
  const canvas = document.getElementById('main-wheel-canvas');
  wheel = new Wheel(canvas, {
    segments: 16,
    labels: segments,
    showLabels: true
  });

  window.addEventListener('resize', () => wheel.resize());
}

function showResult(text) {
  const overlay = document.getElementById('result-overlay');
  const textEl = document.getElementById('result-text');
  textEl.textContent = text;
  overlay.classList.add('visible');

  setTimeout(() => {
    overlay.classList.remove('visible');
  }, 3000);
}
```

- [ ] **Step 3: Start server and verify main screen loads in browser**

```bash
cd /Users/mario_dangelo/Documents/Giramoe
npm start
```

Open `http://localhost:3000` in browser. Expected: video plays, then "Inizia" button appears after video ends.

- [ ] **Step 4: Commit**

```bash
cd /Users/mario_dangelo/Documents/Giramoe
git add public/index.html public/js/main.js
git commit -m "feat: main screen with video intro, lobby, and game display"
```

---

### Task 5: Admin Panel (Phone)

**Files:**
- Create: `public/admin.html`
- Create: `public/js/admin.js`

- [ ] **Step 1: Write admin.html**

```html
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>Giramoe — Admin</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <!-- Pre-game -->
  <div id="admin-pregame" class="screen">
    <div class="mobile-container">
      <img src="/assets/logo.png" alt="Giramoe" style="width: 120px; margin-bottom: 16px;">
      <h1 style="font-size: 22px; font-weight: 700; margin-bottom: 24px;">Game Master</h1>
      <button class="glass-button" id="btn-inizia">Inizia</button>
    </div>
  </div>

  <!-- Lobby -->
  <div id="admin-lobby" class="screen hidden">
    <div class="admin-container">
      <h1>Giramoe</h1>
      <div class="admin-section">
        <h2>Giocatori</h2>
        <div class="admin-player-list" id="admin-players">
          <div class="admin-player-item glass-panel" id="ap-0"><span>In attesa...</span><span class="status-dot disconnected"></span></div>
          <div class="admin-player-item glass-panel" id="ap-1"><span>In attesa...</span><span class="status-dot disconnected"></span></div>
          <div class="admin-player-item glass-panel" id="ap-2"><span>In attesa...</span><span class="status-dot disconnected"></span></div>
        </div>
      </div>
      <button class="glass-button" id="btn-avvia" disabled>Avvia partita</button>
    </div>
  </div>

  <!-- Game -->
  <div id="admin-game" class="screen hidden">
    <div class="admin-container">
      <h1>Giramoe</h1>
      <div class="admin-section">
        <h2>Turno</h2>
        <div class="glass-panel" style="padding: 16px; text-align: center;">
          <span id="admin-turn-name" style="font-size: 20px; font-weight: 600;">—</span>
        </div>
      </div>
      <div class="admin-section">
        <h2>Giocatori</h2>
        <div class="admin-player-list" id="admin-game-players"></div>
      </div>
      <div class="admin-section">
        <h2>Punteggi</h2>
        <div class="glass-panel" style="padding: 16px; text-align: center; color: #aaa;">
          Prossimamente...
        </div>
      </div>
    </div>
  </div>

  <script src="/socket.io/socket.io.js"></script>
  <script src="/js/admin.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write admin.js**

```javascript
const socket = io();

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

socket.emit('admin:init');

// --- Pre-game ---

document.getElementById('btn-inizia').addEventListener('click', () => {
  socket.emit('admin:inizia');
});

// --- State updates ---

socket.on('admin:state', (game) => {
  if (game.phase === 'video') {
    showScreen('admin-pregame');
  } else if (game.phase === 'lobby') {
    showScreen('admin-lobby');
    updateLobbyPlayers(game.players);
    document.getElementById('btn-avvia').disabled = game.players.length < 3;
  } else if (game.phase === 'playing') {
    showScreen('admin-game');
    updateGamePlayers(game.players, game.currentTurnIndex);
  }
});

socket.on('admin:spinning', ({ segmentText, playerIndex }) => {
  // Could show spinning indicator
});

// --- Lobby ---

function updateLobbyPlayers(players) {
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

// --- Start game ---

document.getElementById('btn-avvia').addEventListener('click', () => {
  socket.emit('admin:startGame');
});

// --- Game ---

function updateGamePlayers(players, currentTurn) {
  const container = document.getElementById('admin-game-players');
  container.innerHTML = '';

  const turnName = document.getElementById('admin-turn-name');
  turnName.textContent = players[currentTurn] ? players[currentTurn].name : '—';

  players.forEach((p, i) => {
    const item = document.createElement('div');
    item.className = 'admin-player-item glass-panel';
    if (i === currentTurn) {
      item.style.border = '1px solid rgba(100, 180, 255, 0.5)';
      item.style.boxShadow = '0 0 12px rgba(100, 180, 255, 0.2)';
    }
    item.innerHTML = `
      <span>${p.name}</span>
      <span class="status-dot ${p.connected ? '' : 'disconnected'}"></span>
    `;
    container.appendChild(item);
  });
}
```

- [ ] **Step 3: Verify admin page loads on phone**

Start server, open `http://<local-ip>:3000/admin.html` on phone. Expected: logo + "Game Master" + "Inizia" button.

- [ ] **Step 4: Commit**

```bash
cd /Users/mario_dangelo/Documents/Giramoe
git add public/admin.html public/js/admin.js
git commit -m "feat: admin panel with lobby management and game controls"
```

---

### Task 6: Player View (Phone)

**Files:**
- Create: `public/play.html`
- Create: `public/js/player.js`

- [ ] **Step 1: Write play.html**

```html
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>Giramoe — Player</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <!-- Join Form -->
  <div id="join-screen" class="screen">
    <div class="mobile-container">
      <img src="/assets/logo.png" alt="Giramoe" style="width: 100px; margin-bottom: 16px;">
      <div class="join-form">
        <input type="text" id="nick-input" class="glass-input" placeholder="Il tuo nome" maxlength="12" autocomplete="off">
        <button class="glass-button" id="btn-join">Entra</button>
      </div>
    </div>
  </div>

  <!-- Waiting Lobby -->
  <div id="wait-screen" class="screen hidden">
    <div class="mobile-container">
      <h2 style="font-size: 20px; font-weight: 600; color: #aaa;">In attesa dell'inizio...</h2>
    </div>
  </div>

  <!-- Game Screen -->
  <div id="player-game-screen" class="screen hidden">
    <div class="mobile-container">
      <div class="turn-message" id="turn-message">Attendi il tuo turno</div>
      <div class="wheel-container" id="player-wheel-container">
        <div class="wheel-indicator"></div>
        <canvas id="player-wheel-canvas"></canvas>
      </div>
      <div class="player-nick" id="player-nick-display"></div>
    </div>
  </div>

  <!-- Disconnect Overlay -->
  <div class="disconnect-overlay" id="disconnect-overlay">
    <p>In attesa di riconnessione...</p>
  </div>

  <script src="/socket.io/socket.io.js"></script>
  <script src="/js/wheel.js"></script>
  <script src="/js/player.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write player.js**

```javascript
const socket = io();

const params = new URLSearchParams(window.location.search);
const roomCode = params.get('room');

let playerWheel = null;
let myIndex = -1;
let myName = '';
let isMyTurn = false;

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
    if (data.roomCode === roomCode) {
      socket.emit('player:reconnect', { roomCode, name: data.name });
      return;
    }
  }

  socket.emit('player:join', { roomCode, name });
});

document.getElementById('nick-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('btn-join').click();
});

// --- Socket events ---

socket.on('player:joined', ({ playerIndex, name }) => {
  myIndex = playerIndex;
  myName = name;
  sessionStorage.setItem('giramoe-player', JSON.stringify({ roomCode, name }));
  showScreen('wait-screen');
});

socket.on('player:error', (msg) => {
  alert(msg);
});

socket.on('player:gameStarted', ({ currentTurn, playerIndex, players }) => {
  myIndex = playerIndex;
  showScreen('player-game-screen');
  document.getElementById('player-nick-display').textContent = myName;
  initPlayerWheel();
  updateTurn(currentTurn);
});

socket.on('player:spinResult', ({ totalAngle, winningSegment }) => {
  if (playerWheel) {
    playerWheel.spinTo(totalAngle, 6000);
  }
});

socket.on('player:turnUpdate', ({ currentTurn, playerIndex }) => {
  myIndex = playerIndex;
  updateTurn(currentTurn);
});

socket.on('player:waitReconnect', ({ disconnectedPlayer }) => {
  document.getElementById('disconnect-overlay').classList.add('visible');
});

socket.on('player:resumeGame', ({ currentTurn, playerIndex }) => {
  myIndex = playerIndex;
  document.getElementById('disconnect-overlay').classList.remove('visible');
  updateTurn(currentTurn);
});

socket.on('player:reconnected', ({ playerIndex, name, phase, currentTurn }) => {
  myIndex = playerIndex;
  myName = name;
  if (phase === 'playing') {
    showScreen('player-game-screen');
    document.getElementById('player-nick-display').textContent = myName;
    initPlayerWheel();
    updateTurn(currentTurn);
  } else {
    showScreen('wait-screen');
  }
});

// --- Wheel ---

function initPlayerWheel() {
  const canvas = document.getElementById('player-wheel-canvas');
  playerWheel = new Wheel(canvas, {
    segments: 16,
    labels: [],
    showLabels: false
  });

  canvas.addEventListener('click', () => {
    if (isMyTurn && !playerWheel.spinning) {
      socket.emit('player:spin');
    }
  });

  window.addEventListener('resize', () => playerWheel.resize());
}

function updateTurn(currentTurn) {
  isMyTurn = currentTurn === myIndex;
  const msg = document.getElementById('turn-message');
  const container = document.getElementById('player-wheel-container');

  if (isMyTurn) {
    msg.textContent = 'Tocca a te! Gira la ruota';
    msg.className = 'turn-message your-turn';
    container.classList.remove('disabled');
  } else {
    msg.textContent = 'Attendi il tuo turno';
    msg.className = 'turn-message waiting';
    container.classList.add('disabled');
  }
}
```

- [ ] **Step 3: Full flow test**

Start server. Open `http://localhost:3000` on PC (main screen). Open `http://<ip>:3000/admin.html` on phone (admin). Tap "Inizia" on admin → PC shows QR. Scan QR with 3 devices (or open `/play.html?room=XXXX` in 3 browser tabs). Enter names, join. Admin taps "Avvia partita". Player 1 taps wheel → both PC and player phone spin. Result text appears on PC. After a few seconds, turn advances to Player 2.

- [ ] **Step 4: Commit**

```bash
cd /Users/mario_dangelo/Documents/Giramoe
git add public/play.html public/js/player.js
git commit -m "feat: player view with join form, wheel spin, and turn management"
```

---

### Task 7: Polish and Integration Testing

**Files:**
- Modify: `public/css/style.css` (any tweaks found during testing)
- Modify: `server.js` (any fixes found during testing)

- [ ] **Step 1: Test complete flow end-to-end**

1. `npm start`
2. Open main screen on PC — video plays, ends, "Inizia" appears
3. Open admin on phone — press "Inizia" — PC transitions to QR lobby
4. Scan QR with phone, enter name, join — PC shows name in slot
5. Repeat for 3 players
6. Admin presses "Avvia partita" — game starts
7. Player 1 taps wheel — wheel spins on PC + Player 1's phone — result appears on PC — auto-advance
8. Player 2 taps — same flow
9. Player 3 taps — same flow — back to Player 1
10. Disconnect a player mid-game — all screens show disconnect overlay
11. Reconnect — game resumes

- [ ] **Step 2: Fix any issues found during testing**

- [ ] **Step 3: Final commit**

```bash
cd /Users/mario_dangelo/Documents/Giramoe
git add -A
git commit -m "feat: Giramoe v1.0 — interactive live party game with spinning wheel"
```

---

## Spec Coverage Check

| Spec Requirement | Task |
|---|---|
| Video autoplay, no controls | Task 4 (index.html) |
| "Inizia" button (liquid glass, admin-triggered) | Task 4 + Task 5 |
| QR code lobby | Task 4 (qrcode.js) + Task 1 (server generates URL) |
| 3 player slots on main screen | Task 4 |
| Main wheel with 16 colored segments + text | Task 3 + Task 4 |
| Player names with active glow | Task 4 (CSS + main.js) |
| Result text animation | Task 4 + Task 2 (CSS) |
| Admin console on phone | Task 5 |
| Player minimal wheel (no text) | Task 6 |
| Turn-based spin (P1→P2→P3→P1) | Task 1 (server) + Task 6 |
| Auto-advance after result | Task 1 (server setTimeout) |
| Spin sync (PC + player phone) | Task 1 (server) + Task 4 + Task 6 |
| Disconnection → pause + overlay | Task 1 (server) + Task 4 + Task 6 |
| Reconnection → resume | Task 1 (server) + Task 6 |
| Liquid glass style | Task 2 (CSS) |
| Scores placeholder | Task 5 (admin panel) |
