const socket = io();
let wheel = null;
let started = false;
let currentPhase = 'video';
let tripleteBoardReady = false;
let lastSegmentsKey = '';

// Same 16 colours as the wheel segments — reused for the "IL TRIPLETE" title.
const TRIPLETE_COLORS = [
  '#22c55e', '#4ade80', '#a3e635', '#eab308',
  '#f59e0b', '#f97316', '#ef4444', '#f43f5e',
  '#ec4899', '#d946ef', '#a855f7', '#8b5cf6',
  '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4'
];

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
  else if (currentPhase === 'express') showScreen('game-screen');
  else if (currentPhase === 'giramoe') showScreen('game-screen');
  else if (currentPhase === 'tripleteReady') showScreen('game-screen');
  else if (currentPhase === 'triplete') showScreen(tripleteBoardReady ? 'triplete-screen' : 'triplete-title-screen');
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
  if (currentPhase !== 'express') currentPhase = 'playing';
  if (!wheel) initMainWheel(g.segments);
  else updateWheelLabels(g.segments);
  document.getElementById('main-wheel-indicator').style.display = '';
  document.getElementById('category-banner').textContent = g.board.category;
  renderBoard(g.board.grid);
  renderScores(g.scores, g.currentTurn);
  applyPhaseScreen();
});

socket.on('main:scores', ({ scores, currentTurn }) => renderScores(scores, currentTurn));

socket.on('main:spin', ({ winningSegment, spins, value }) => {
  if (!wheel) return;
  setWheelZoom(true);
  Sfx.startSpin();
  wheel.onSpinEnd = () => {
    Sfx.stopSpin();
    setWheelZoom(false); // back to the board once the wheel stops
    showResult(String(value).toUpperCase());
  };
  wheel.spinTo(winningSegment, spins, 6000);
  setTimeout(() => { Sfx.stopSpin(); setWheelZoom(false); }, 6800); // fallback if rAF was throttled
});

function setWheelZoom(on) {
  document.querySelector('#game-screen .game-container').classList.toggle('wheel-zoom', on);
}

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
    const p = players[i];
    if (p) {
      slot.textContent = p.name;
      slot.classList.add('filled');
      slot.classList.toggle('reconnecting', p.connected === false);
    } else {
      slot.textContent = '—';
      slot.classList.remove('filled', 'reconnecting');
    }
  }
}

function initMainWheel(segments) {
  const canvas = document.getElementById('main-wheel-canvas');
  wheel = new Wheel(canvas, { segments: 16, labels: segments, showLabels: true });
  lastSegmentsKey = (segments || []).join('|');
  window.addEventListener('resize', () => wheel.resize());
}

// The express round swaps the wheel labels (one PASSA becomes EXPRESS); redraw only on change.
function updateWheelLabels(segments) {
  const key = (segments || []).join('|');
  if (key !== lastSegmentsKey) { lastSegmentsKey = key; if (wheel) wheel.setLabels(segments); }
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
    el.innerHTML = `<div class="pn-avatar">${s.name.charAt(0).toUpperCase()}</div>
      <div class="pn-info">
        <div class="pn-name">${s.name}</div>
        <div class="pn-score">Turno: ${s.roundPoints}</div>
        <div class="pn-bank">Banca: ${s.bank}</div>
      </div>`;
    bar.appendChild(el);
  });
}

function showResult(text) {
  const overlay = document.getElementById('result-overlay');
  document.getElementById('result-text').textContent = text;
  overlay.classList.add('visible');
  setTimeout(() => overlay.classList.remove('visible'), 2500);
}

// ===================== IL TRIPLETE (bonus round) =====================

socket.on('main:tripleteTitle', () => {
  currentPhase = 'triplete';
  tripleteBoardReady = false;
  playTitleAnimation('IL TRIPLETE');
  applyPhaseScreen();
});

// --- Express round ---
socket.on('main:expressRound', ({ segments }) => {
  currentPhase = 'express';
  updateWheelLabels(segments);
  document.getElementById('main-wheel-indicator').style.display = '';
  document.getElementById('category-banner').textContent = '';
  document.getElementById('board-grid').innerHTML = '';
  applyPhaseScreen();
});

socket.on('main:expressStart', () => {
  playTitleAnimation('EXPRESS');
  showScreen('triplete-title-screen');
  setTimeout(() => { if (currentPhase === 'express') showScreen('game-screen'); }, 2800);
});

socket.on('main:expressBankrupt', () => {
  Sfx.play('wrong');
  showResult('BANCAROTTA');
});

// --- GIRAMOE (final wheel board) ---
socket.on('main:giramoeStart', ({ segments }) => {
  currentPhase = 'giramoe';
  if (wheel) updateWheelLabels(segments);
  document.getElementById('main-wheel-indicator').style.display = '';
  document.getElementById('category-banner').textContent = '';
  document.getElementById('board-grid').innerHTML = '';
  playTitleAnimation('GIRAMOE');
  showScreen('triplete-title-screen');
  setTimeout(() => { if (currentPhase === 'giramoe') showScreen('game-screen'); }, 2800);
});

socket.on('main:giramoeBoard', (b) => {
  currentPhase = 'giramoe';
  document.getElementById('category-banner').textContent = b.category;
  renderBoard(b.grid);
  applyPhaseScreen();
});

socket.on('main:giramoeScores', ({ scores, currentTurn }) => renderGiramoeScores(scores, currentTurn));

socket.on('main:giramoeBuzzed', ({ name }) => {
  Sfx.play('buzzer');
  showBuzz(`🔔 ${name} risponde!`);
});

socket.on('main:giramoeResume', () => hideBuzz());

socket.on('main:giramoeSolved', ({ name, points }) => {
  hideBuzz();
  showResult(`${name} +${points}`);
});

function renderGiramoeScores(scores, currentTurn) {
  const bar = document.getElementById('players-bar');
  bar.innerHTML = '';
  scores.forEach((s, i) => {
    const el = document.createElement('div');
    el.className = 'player-name glass-panel' + (i === currentTurn ? ' active' : '');
    el.innerHTML = `<div class="pn-avatar">${s.name.charAt(0).toUpperCase()}</div>
      <div class="pn-info">
        <div class="pn-name">${s.name}</div>
        <div class="pn-score">Punti: ${s.points}</div>
      </div>`;
    bar.appendChild(el);
  });
}

socket.on('main:tripleteBoard', (b) => {
  currentPhase = 'triplete';
  tripleteBoardReady = true;
  document.getElementById('triplete-category').textContent = b.category;
  document.getElementById('triplete-board-tag').textContent = `IL TRIPLETE · ${b.boardNumber}/${b.totalBoards}`;
  renderTripleteBoard(b.grid);
  hideBuzz();
  applyPhaseScreen();
});

socket.on('main:tripleteReveal', ({ cell }) => revealTripleteCell(cell));
socket.on('main:tripleteFlash', ({ cell, ms }) => flashTripleteCell(cell, ms));
socket.on('main:tripleteScores', ({ scores }) => renderTripleteScores(scores));

socket.on('main:tripleteBuzzed', ({ name }) => {
  Sfx.play('buzzer');
  showBuzz(`🔔 ${name} si è prenotato!`);
});

socket.on('main:tripleteResume', () => {
  Sfx.play('wrong');
  hideBuzz();
});

socket.on('main:tripleteSolved', ({ board, name, points }) => {
  hideBuzz();
  renderTripleteBoard(board.grid);
  Sfx.play('correct');
  showTripleteResult(`${name} +${points}`);
});

// --- Title animation: spinning rainbow "spicchi" fan + glass plate + popped-in letters.
//     Reused for IL TRIPLETE, EXPRESS, GIRAMOE — just pass the word. ---
function playTitleAnimation(word) {
  const stage = document.querySelector('#triplete-title-screen .triplete-stage');
  const fan = document.querySelector('#triplete-title-screen .triplete-fan');
  const titleEl = document.getElementById('triplete-title');

  const seg = 360 / TRIPLETE_COLORS.length;
  fan.style.background = 'conic-gradient(from -90deg, ' +
    TRIPLETE_COLORS.map((c, i) => `${c} ${(i * seg).toFixed(2)}deg ${((i + 1) * seg).toFixed(2)}deg`).join(', ') + ')';

  titleEl.innerHTML = '';
  let ci = 0;
  for (const ch of word) {
    if (ch === ' ') {
      const sp = document.createElement('span');
      sp.className = 'sp';
      titleEl.appendChild(sp);
      continue;
    }
    const span = document.createElement('span');
    span.className = 'tl';
    span.textContent = ch;
    span.style.color = TRIPLETE_COLORS[(ci * 3) % TRIPLETE_COLORS.length];
    span.style.animationDelay = (0.5 + ci * 0.085) + 's';
    titleEl.appendChild(span);
    ci++;
  }

  // restart the intro/pop animations
  stage.classList.remove('play');
  void stage.offsetWidth;
  stage.classList.add('play');
}

function renderTripleteBoard(grid) {
  const el = document.getElementById('triplete-board-grid');
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

function tripleteCellAt(row, col) {
  return document.querySelector(`#triplete-board-grid .cell[data-row="${row}"][data-col="${col}"]`);
}

// Boards 1-2 and board-3 stabilize: reveal one cell and keep it.
function revealTripleteCell(cell) {
  const el = tripleteCellAt(cell.row, cell.col);
  if (!el) return;
  el.classList.remove('flash', 'blocked', 'edge');
  el.classList.add('letter', 'revealed');
  el.textContent = cell.letter;
  Sfx.play('letter');
}

// Board 3 flash phase: pop a cell in for `ms`, then hide it again (unless it has
// since been permanently revealed).
function flashTripleteCell(cell, ms) {
  const el = tripleteCellAt(cell.row, cell.col);
  if (!el || el.classList.contains('revealed')) return;
  el.classList.add('letter', 'flash');
  el.textContent = cell.letter;
  Sfx.play('letter');
  setTimeout(() => {
    if (el.classList.contains('revealed')) return;
    el.classList.remove('flash');
    el.textContent = '';
  }, ms);
}

function renderTripleteScores(scores) {
  const bar = document.getElementById('triplete-players-bar');
  bar.innerHTML = '';
  scores.forEach((s) => {
    const el = document.createElement('div');
    let cls = 'player-name glass-panel';
    if (s.buzzed) cls += ' buzzed';
    else if (s.locked) cls += ' locked';
    el.className = cls;
    el.innerHTML = `<div class="pn-avatar">${s.name.charAt(0).toUpperCase()}</div>
      <div class="pn-info">
        <div class="pn-name">${s.name}</div>
        <div class="pn-score">Triplete: ${s.points}</div>
        <div class="pn-bank">Banca: ${s.bank}</div>
      </div>`;
    bar.appendChild(el);
  });
}

function showBuzz(text) {
  document.getElementById('buzz-banner-text').textContent = text;
  document.getElementById('buzz-banner').classList.add('visible');
}
function hideBuzz() {
  document.getElementById('buzz-banner').classList.remove('visible');
}

function showTripleteResult(text) {
  const overlay = document.getElementById('triplete-result-overlay');
  document.getElementById('triplete-result-text').textContent = text;
  overlay.classList.add('visible');
  setTimeout(() => overlay.classList.remove('visible'), 2500);
}
