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
