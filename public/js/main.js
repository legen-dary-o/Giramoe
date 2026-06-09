const socket = io();
let wheel = null;

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

const video = document.getElementById('intro-video');
video.addEventListener('ended', () => showScreen('start-screen'));
video.addEventListener('error', () => showScreen('start-screen'));

socket.emit('main:init');

socket.on('main:state', ({ phase }) => {
  if (phase === 'video') showScreen('video-screen');
  else if (phase === 'lobby') showScreen('lobby-screen');
  else if (phase === 'playing') showScreen('game-screen');
  else if (phase === 'matchEnd') showScreen('matchend-screen');
});

socket.on('main:showLobby', ({ url, players }) => {
  showScreen('lobby-screen');
  QRCode.toCanvas(document.getElementById('qr-canvas'), url, {
    width: 220, margin: 2, color: { dark: '#1a1a1a', light: '#ffffff' }
  });
  updatePlayerSlots(players);
});

socket.on('main:playerJoined', ({ players }) => updatePlayerSlots(players));

socket.on('main:startGame', () => {
  showScreen('game-screen');
});

socket.on('main:gameState', (g) => {
  showScreen('game-screen');
  if (!wheel) initMainWheel(g.segments);
  document.getElementById('board-counter').textContent =
    `Tabellone ${g.boardNumber} / ${g.totalBoards}`;
  document.getElementById('category-banner').textContent = g.board.category;
  renderBoard(g.board.grid);
  renderScores(g.scores, g.currentTurn);
});

socket.on('main:spin', ({ totalAngle, value }) => {
  if (!wheel) return;
  wheel.onSpinEnd = () => showResult(String(value).toUpperCase());
  wheel.spinTo(totalAngle, 6000);
});

socket.on('main:reveal', () => { /* board re-render arrives via main:gameState */ });

socket.on('main:matchEnd', ({ standings }) => {
  showScreen('matchend-screen');
  const el = document.getElementById('standings');
  el.innerHTML = '';
  standings.forEach((s, i) => {
    const row = document.createElement('div');
    row.className = 'standing-row glass-panel' + (i === 0 ? ' winner' : '');
    row.innerHTML = `<span>${i + 1}. ${s.name}</span><span>${s.bank}</span>`;
    el.appendChild(row);
  });
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
  for (const row of grid) {
    for (const cell of row) {
      const div = document.createElement('div');
      if (cell.type === 'blocked') {
        div.className = 'cell blocked';
      } else if (cell.revealed) {
        div.className = 'cell letter revealed';
        div.textContent = cell.letter;
      } else {
        div.className = 'cell letter';
      }
      el.appendChild(div);
    }
  }
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
