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
