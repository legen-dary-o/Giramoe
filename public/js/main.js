import { initCursor } from './fx/cursor.js';
import { Wheel3D } from './fx/wheel3d.js';
import { HomeWheel } from './fx/homewheel.js';
import { Stage3D } from './fx/stage3d.js';
import { RoundScenes } from './fx/roundscenes.js';

initCursor();
// Animazioni di round a schermo intero (sostituiscono la vecchia title animation
// nei cinque stacchi: Triplete, Express, Giramoe, Finalista, Buste).
const scenes = new RoundScenes(document.getElementById('round-scene'));
window.__scenes = scenes; // hook di verifica manuale (__scenes.play('triplete'))
let home = null;
try {
  home = new HomeWheel(document.getElementById('home-canvas'));
  window.__home = home; // hook di verifica manuale
} catch (err) {
  console.warn('HomeWheel non disponibile (WebGL?):', err);
}
let stage = null;
try {
  stage = new Stage3D(document.getElementById('stage-canvas'));
  document.body.classList.add('webgl-stage');
  window.__stage = stage; // hook di verifica manuale
} catch (err) {
  console.warn('Stage3D non disponibile, fallback DOM:', err);
}
window.addEventListener('resize', () => { if (home) home.resize(); if (stage) stage.resize(); });

const socket = io();
let wheel = null;
let started = false;
let currentPhase = 'video'; // il server chiama ancora 'video' la fase pre-lobby
let tripleteBoardReady = false;
let lastSegmentsKey = '';

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
  if (home) home.setEnabled(id === 'start-tap-screen');
  if (stage) {
    const modes = {
      'lobby-screen': 'ambient',
      'triplete-title-screen': 'ambient',
      'finalist-screen': 'ambient',
      'game-screen': 'board',
      'triplete-screen': 'board',
      'final-screen': 'board',
      'envelopes-screen': 'envelopes'
    };
    stage.setMode(modes[id] || 'hidden');
  }
}

// --- Tap to start: sblocca audio, title animation GIRAMOE, poi fase corrente ---
document.getElementById('tap-start-btn').addEventListener('click', startMainDisplay);
function startMainDisplay() {
  if (started) return;
  started = true;
  Sfx.unlock();
  document.getElementById('start-tap-screen').classList.add('waiting');
  playTitleAnimation('GIRAMOE');
  setTimeout(() => applyPhaseScreen(), 3000);
}

function applyPhaseScreen() {
  if (!started) return; // resta sull'intro finché l'utente non tocca
  if (currentPhase === 'video') showScreen('start-tap-screen'); // in attesa dell'host
  else if (currentPhase === 'lobby') showScreen('lobby-screen');
  else if (currentPhase === 'playing') showScreen('game-screen');
  else if (currentPhase === 'express') showScreen('game-screen');
  else if (currentPhase === 'giramoe') showScreen('game-screen');
  else if (currentPhase === 'tripleteReady') showScreen('game-screen');
  else if (currentPhase === 'triplete') showScreen(tripleteBoardReady ? 'triplete-screen' : 'triplete-title-screen');
  else if (currentPhase === 'tiebreak') showScreen('game-screen');
  else if (currentPhase === 'finalist') showScreen('finalist-screen');
  else if (currentPhase === 'final') showScreen('final-screen');
  else if (currentPhase === 'envelopes') showScreen('envelopes-screen');
}

// Ri-presentarsi a OGNI connessione, non solo al primo caricamento: socket.io si
// riconnette con una socket nuova, che non è più nella room 'main' e quindi non
// riceverebbe più niente fino a un refresh manuale.
socket.on('connect', () => socket.emit('main:init'));

socket.on('main:state', ({ phase }) => {
  currentPhase = phase;
  // Refresh a partita in corso: si riprende da dov'era, senza gate del tap né
  // intro GIRAMOE. L'audio vuole un gesto utente, quindi si sblocca al primo
  // tocco o tasto che capita.
  if (!started && phase !== 'video' && phase !== 'lobby') {
    started = true;
    document.getElementById('start-tap-screen').classList.add('waiting');
    const unlock = () => Sfx.unlock();
    document.addEventListener('click', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
  }
  applyPhaseScreen();
});

socket.on('main:showLobby', ({ url, players }) => {
  currentPhase = 'lobby';
  QRCode.toCanvas(document.getElementById('qr-canvas'), url, {
    width: 220, margin: 2, color: { dark: '#000000', light: '#f5f5f7' }
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
  if (stage) stage.pulse('spin');
  if (!wheel) return;
  setWheelZoom(true);
  Sfx.startSpin();
  wheel.onSpinEnd = () => {
    Sfx.stopSpin();
    setWheelZoom(false); // si torna al tabellone quando la ruota si ferma
    showResult(String(value).toUpperCase());
  };
  wheel.spinTo(winningSegment, spins, 6000);
  setTimeout(() => { Sfx.stopSpin(); setWheelZoom(false); }, 6800); // fallback se rAF è stato throttlato
});

function setWheelZoom(on) {
  const c = document.querySelector('#game-screen .game-container');
  if (on) {
    c.classList.remove('wheel-unzoom');
    c.classList.add('wheel-zoom');
  } else if (c.classList.contains('wheel-zoom')) {
    c.classList.remove('wheel-zoom');
    c.classList.add('wheel-unzoom'); // flip di ritorno; nessuna animazione al primo load
  }
}

// Una lettera è stata chiamata (consonante o vocale): la mostro a schermo come per i
// punti, così anche chi non gioca quel turno vede la lettera (poi se presente si rivela
// sul tabellone). Attivo in ruota/express/giramoe, non nel triplete né nel finale.
socket.on('main:letterCalled', ({ letter }) => showResult(String(letter).toUpperCase()));

// "CONSONANTI/VOCALI FINITE": tutte quelle presenti nel tabellone sono state chiamate.
socket.on('main:boardStatus', updateBoardStatus);
function updateBoardStatus(st) {
  const el = document.getElementById('board-status');
  if (!el) return;
  const tags = [];
  if (st && st.consonantsFinished) tags.push('CONSONANTI FINITE');
  if (st && st.vowelsFinished) tags.push('VOCALI FINITE');
  el.innerHTML = tags.map(t => `<span class="board-status-tag">${t}</span>`).join('');
  el.classList.toggle('hidden', tags.length === 0);
}

socket.on('main:revealLetter', ({ positions }) => revealSequence(positions));

socket.on('main:solved', () => { if (stage) stage.pulse('correct'); Sfx.play('correct'); fxVeil('correct'); });

socket.on('main:wrong', () => { if (stage) stage.pulse('wrong'); Sfx.play('wrong'); fxVeil('wrong'); });

// --- Feedback bordo schermo: velo verde/rosso + shake sull'errore ---
function fxVeil(kind) {
  const veil = document.getElementById('fx-veil');
  veil.classList.remove('correct', 'wrong');
  void veil.offsetWidth;
  veil.classList.add(kind);
  if (kind === 'wrong') {
    const scr = document.querySelector('.screen:not(.hidden)');
    if (scr) {
      scr.classList.add('shake');
      setTimeout(() => scr.classList.remove('shake'), 450);
    }
  }
}

// --- Tie-break + finalist ---
socket.on('main:tiebreakStart', ({ segments, contenders }) => {
  currentPhase = 'tiebreak';
  if (wheel) updateWheelLabels(segments);
  document.getElementById('main-wheel-indicator').style.display = '';
  document.getElementById('category-banner').textContent = 'SPAREGGIO';
  document.getElementById('board-grid').innerHTML = '';
  if (stage) stage.board.clear();
  updateBoardStatus(null);
  renderTiebreak(contenders, -1);
  applyPhaseScreen();
});

socket.on('main:tiebreakState', (tb) => renderTiebreak(tb.contenders, tb.current));

socket.on('main:finalist', ({ name, standings }) => {
  const entering = currentPhase !== 'finalist'; // su riconnessione non si rigioca l'animazione
  currentPhase = 'finalist';
  document.getElementById('finalist-name').textContent = name;
  showScreen('finalist-screen');
  if (entering) scenes.play('finalista', { name, standings });
});

// --- Final game ---
socket.on('main:finalBoard', (b) => {
  currentPhase = 'final';
  hideBuzz();
  document.getElementById('final-category').textContent = b.category;
  document.getElementById('final-board-tag').textContent = `Tabellone ${b.boardIndex + 1}/${b.totalBoards}`;
  renderFinalBoard(b.grid);
  applyPhaseScreen();
});

socket.on('main:finalTimer', ({ ms }) => {
  const el = document.getElementById('final-timer');
  el.textContent = Math.ceil(ms / 1000);
  el.classList.toggle('low', ms <= 10000);
});

socket.on('main:finalReveal', ({ positions }) => {
  positions.forEach((pos, i) => {
    setTimeout(() => {
      const cell = document.querySelector(`#final-board-grid .cell[data-row="${pos.row}"][data-col="${pos.col}"]`);
      if (cell) { cell.classList.add('letter', 'revealed'); cell.classList.remove('blocked', 'edge'); cell.textContent = pos.letter; }
      Sfx.play('letter');
      if (stage) stage.board.reveal(pos);
    }, i * 420);
  });
});

socket.on('main:finalBuzzed', () => {
  Sfx.play('buzzer');
  showBuzz('Risponde!');
});

socket.on('main:envelopes', (view) => {
  const entering = currentPhase !== 'envelopes'; // solo la prima volta: poi sono aggiornamenti
  currentPhase = 'envelopes';
  hideBuzz();
  renderEnvelopes(document.getElementById('envelopes-row'), view);
  applyPhaseScreen();
  if (entering) scenes.play('buste');
});

// Render display-only delle 3 buste (la TV principale).
function renderEnvelopes(row, view) {
  row.innerHTML = '';
  view.envelopes.forEach((e, i) => {
    const el = document.createElement('div');
    el.className = 'envelope ' + e.color
      + (e.revealed ? ' open' : '')
      + (i === view.current ? ' current' : '')
      + (e.abandoned ? ' abandoned' : '')
      + (view.state === 'KEPT' && i !== view.current && !e.revealed ? ' gone' : '');
    el.innerHTML = e.revealed
      ? `<div class="env-num">${i + 1}</div><div class="env-content">${e.content || ''}</div>`
      : `<div class="env-num">${i + 1}</div><div class="env-q">?</div>`;
    row.appendChild(el);
  });
  if (stage) stage.envelopes.set(view);
}

function renderFinalBoard(grid) {
  const el = document.getElementById('final-board-grid');
  el.innerHTML = '';
  grid.forEach((row, r) => {
    row.forEach((cell, c) => {
      const div = document.createElement('div');
      div.dataset.row = r;
      div.dataset.col = c;
      if (cell.type === 'edge') div.className = 'cell edge';
      else if (cell.type === 'blocked') div.className = 'cell blocked';
      else if (cell.revealed) { div.className = 'cell letter revealed'; div.textContent = cell.letter; }
      else div.className = 'cell letter';
      el.appendChild(div);
    });
  });
  if (stage) { stage.board.setTarget(el); stage.board.setBoard(grid); }
}

function renderTiebreak(contenders, current) {
  const bar = document.getElementById('players-bar');
  bar.innerHTML = '';
  contenders.forEach((c, i) => {
    const el = document.createElement('div');
    el.className = 'player-name glass-panel' + (i === current ? ' active' : '');
    el.innerHTML = `<div class="pn-avatar">${c.name.charAt(0).toUpperCase()}</div>
      <div class="pn-info">
        <div class="pn-name">${c.name}</div>
        <div class="pn-score">${c.value != null ? c.value : '—'}</div>
      </div>`;
    bar.appendChild(el);
  });
}

socket.on('main:playerDisconnected', () =>
  document.getElementById('disconnect-overlay').classList.add('visible'));
socket.on('main:playerReconnected', () =>
  document.getElementById('disconnect-overlay').classList.remove('visible'));

// --- rendering helpers ---

function updatePlayerSlots(players) {
  for (let i = 0; i < 3; i++) {
    const slot = document.getElementById(`slot-${i}`);
    const p = players[i];
    slot.innerHTML = `${p ? p.name : '—'}<span class="slot-idx">P${i + 1}</span>`;
    if (p) {
      slot.classList.add('filled');
      slot.classList.toggle('reconnecting', p.connected === false);
    } else {
      slot.classList.remove('filled', 'reconnecting');
    }
  }
}

function initMainWheel(segments) {
  const canvas = document.getElementById('main-wheel-canvas');
  const indicator = document.getElementById('main-wheel-indicator');
  // Ruota 3D con fallback alla 2D se WebGL non è disponibile
  try {
    wheel = new Wheel3D(canvas, { segments: 16, labels: segments, showLabels: true, indicator });
  } catch (err) {
    console.warn('Wheel3D non disponibile, fallback 2D:', err);
    wheel = new Wheel(canvas, { segments: 16, labels: segments, showLabels: true });
  }
  window.__wheel = wheel; // hook di verifica manuale
  lastSegmentsKey = (segments || []).join('|');
  window.addEventListener('resize', () => wheel.resize());
}

// Il round express cambia le etichette della ruota (un PASSA diventa EXPRESS); ridisegna solo se cambiano.
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
  if (stage) { stage.board.setTarget(el); stage.board.setBoard(grid); }
}

function cellAt(row, col) {
  return document.querySelector(`#board-grid .cell[data-row="${row}"][data-col="${col}"]`);
}

// Rivela ogni occorrenza una alla volta (TL->BR), con il suono flip.
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
      if (stage) stage.board.reveal(pos);
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
  showTitleCard('IL TRIPLETE');   // carta d'attesa sotto l'animazione
  applyPhaseScreen();
  scenes.play('triplete').then(applyPhaseScreen);
});

// --- Express round ---
// Stacco di apertura: la ruota atterra sullo spicchio rosa EXPRESS, poi si torna
// al tabellone. Serve anche a coprire il passaggio dal Triplete, che prima era un
// taglio secco sulla schermata di gioco.
socket.on('main:expressRound', ({ segments }) => {
  const entering = currentPhase !== 'express'; // su riconnessione non si rigioca l'animazione
  currentPhase = 'express';
  updateWheelLabels(segments);
  document.getElementById('main-wheel-indicator').style.display = '';
  document.getElementById('category-banner').textContent = '';
  document.getElementById('board-grid').innerHTML = '';
  if (stage) stage.board.clear(); // via le tessere del Triplete, non c'è più il suo tabellone
  updateBoardStatus(null);
  if (!entering) return applyPhaseScreen();
  showTitleCard('EXPRESS');
  scenes.play('expressWheel').then(() => { if (currentPhase === 'express') showScreen('game-screen'); });
});

socket.on('main:expressStart', () => {
  showTitleCard('EXPRESS');
  scenes.play('express').then(() => { if (currentPhase === 'express') showScreen('game-screen'); });
});

socket.on('main:expressBankrupt', () => {
  if (stage) stage.pulse('wrong');
  Sfx.play('wrong');
  fxVeil('wrong');
  showResult('BANCAROTTA');
});

// --- GIRAMOE (final wheel board) ---
socket.on('main:giramoeStart', ({ segments }) => {
  const entering = currentPhase !== 'giramoe'; // su riconnessione il server rimanda l'evento
  currentPhase = 'giramoe';
  if (wheel) updateWheelLabels(segments);
  document.getElementById('main-wheel-indicator').style.display = '';
  document.getElementById('category-banner').textContent = '';
  document.getElementById('board-grid').innerHTML = '';
  if (stage) stage.board.clear();
  updateBoardStatus(null);
  if (!entering) return applyPhaseScreen();
  showTitleCard('GIRAMOE');
  scenes.play('giramoe').then(() => { if (currentPhase === 'giramoe') showScreen('game-screen'); });
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
  showBuzz(`${name} risponde!`);
});

socket.on('main:giramoeResume', () => hideBuzz());

socket.on('main:giramoeSolved', ({ name, points }) => {
  if (stage) stage.pulse('correct');
  hideBuzz();
  fxVeil('correct');
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
        <div class="pn-bank">Banca: ${s.bank != null ? s.bank : 0}</div>
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
  showBuzz(`${name} si è prenotato!`);
});

socket.on('main:tripleteResume', () => {
  if (stage) stage.pulse('wrong');
  Sfx.play('wrong');
  fxVeil('wrong');
  hideBuzz();
});

socket.on('main:tripleteSolved', ({ board, name, points }) => {
  if (stage) stage.pulse('correct');
  hideBuzz();
  renderTripleteBoard(board.grid);
  Sfx.play('correct');
  fxVeil('correct');
  showTripleteResult(`${name} +${points}`);
});

// --- Title animation: eyebrow contestuale + wordmark con glint + punti convergenti.
//     Ora serve solo all'intro GIRAMOE del tap iniziale: i cinque stacchi di round
//     hanno le animazioni dedicate di fx/roundscenes.js. ---
const TITLE_EYEBROWS = {
  'GIRAMOE': 'Giramoe Studio presenta',
  'IL TRIPLETE': 'Bonus round',
  'EXPRESS': 'Bonus round'
};
function playTitleAnimation(word) {
  showTitleCard(word);
  if (stage) stage.title.show(word);
}

// La stessa schermata, ma statica: sta sotto l'animazione di round e resta come
// carta d'attesa quando l'animazione finisce (es. mentre l'host scrive le frasi).
function showTitleCard(word) {
  const titleStage = document.getElementById('title-stage');
  document.getElementById('title-eyebrow').textContent = TITLE_EYEBROWS[word] || 'Bonus round';
  document.getElementById('triplete-title').textContent = word;
  showScreen('triplete-title-screen');
  // riavvia le animazioni di entrata
  titleStage.classList.remove('play');
  void titleStage.offsetWidth;
  titleStage.classList.add('play');
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
  if (stage) { stage.board.setTarget(el); stage.board.setBoard(grid); }
}

function tripleteCellAt(row, col) {
  return document.querySelector(`#triplete-board-grid .cell[data-row="${row}"][data-col="${col}"]`);
}

// Board 1-2 e stabilizzazione board 3: rivela una cella e la tiene.
function revealTripleteCell(cell) {
  const el = tripleteCellAt(cell.row, cell.col);
  if (!el) return;
  el.classList.remove('flash', 'blocked', 'edge');
  el.classList.add('letter', 'revealed');
  el.textContent = cell.letter;
  Sfx.play('letter');
  if (stage) stage.board.reveal(cell);
}

// Fase flash board 3: cella visibile per `ms`, poi nascosta di nuovo (a meno che
// nel frattempo non sia stata rivelata per sempre).
function flashTripleteCell(cell, ms) {
  const el = tripleteCellAt(cell.row, cell.col);
  if (!el || el.classList.contains('revealed')) return;
  el.classList.add('letter', 'flash');
  el.textContent = cell.letter;
  Sfx.play('letter');
  if (stage) stage.board.flash(cell, ms);
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
