const socket = io();
const params = new URLSearchParams(window.location.search);
const roomCode = params.get('room');
const SAVED_KEY = 'giramoe-player';

const CONSONANTS = 'BCDFGHJKLMNPQRSTVWXYZ'.split('');
const VOWELS = 'AEIOU'.split('');

let playerWheel = null;
let myIndex = -1;
let myName = '';
let reconnecting = false;

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

// --- Device session (localStorage: survives reloads, tab close, app switch) ---
function saveSession(name) { try { localStorage.setItem(SAVED_KEY, JSON.stringify({ roomCode, name })); } catch (e) {} }
function loadSession() { try { const d = JSON.parse(localStorage.getItem(SAVED_KEY)); return (d && d.roomCode === roomCode) ? d : null; } catch (e) { return null; } }
function clearSession() { try { localStorage.removeItem(SAVED_KEY); } catch (e) {} }

// Auto-reconnect: if this device already joined this room, rejoin without re-typing the name.
const _saved = loadSession();
if (_saved) {
  myName = _saved.name;
  reconnecting = true;
  showScreen('reconnect-screen');
  socket.emit('player:reconnect', { roomCode, name: _saved.name });
}

// --- Join ---
document.getElementById('btn-join').addEventListener('click', () => {
  const name = document.getElementById('nick-input').value.trim();
  if (!name) return;
  myName = name;
  socket.emit('player:join', { roomCode, name });
});
document.getElementById('nick-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-join').click();
});

// --- Connection events ---
socket.on('player:joined', ({ playerIndex, name }) => {
  myIndex = playerIndex; myName = name;
  reconnecting = false;
  saveSession(name);
  showScreen('wait-screen');
});

socket.on('player:error', msg => {
  if (reconnecting) { reconnecting = false; clearSession(); showScreen('join-screen'); return; }
  alert(msg);
});

socket.on('player:kicked', () => {
  clearSession();
  reconnecting = false;
  showScreen('join-screen');
  alert('Sei stato rimosso dalla lobby.');
});

socket.on('player:gameStarted', () => {
  showScreen('player-game-screen');
  document.getElementById('player-nick-display').textContent = myName;
  initWheel();
  buildKeyboard();
});

socket.on('player:reconnected', ({ playerIndex, name, phase }) => {
  myIndex = playerIndex; myName = name;
  reconnecting = false;
  saveSession(name);
  if (phase === 'playing') {
    showScreen('player-game-screen');
    document.getElementById('player-nick-display').textContent = myName;
    initWheel();
    buildKeyboard();
  } else {
    showScreen('wait-screen');
  }
});

socket.on('player:spinResult', ({ winningSegment, spins }) => {
  if (playerWheel) playerWheel.spinTo(winningSegment, spins, 6000);
});

socket.on('player:turnState', (st) => {
  document.getElementById('round-points').textContent = st.roundPoints;
  document.getElementById('bank-points').textContent = st.bank;
  applyTurnState(st);
});

// --- Triplete ---
socket.on('player:tripleteIntro', () => {
  showScreen('player-triplete-screen');
  document.getElementById('tr-nick').textContent = myName;
});

socket.on('player:tripleteState', (st) => applyTripleteState(st));

document.getElementById('btn-buzz').addEventListener('click', () => socket.emit('player:tripleteBuzz'));

function applyTripleteState(st) {
  document.getElementById('tr-points').textContent = st.points;
  document.getElementById('tr-board').textContent = `Tabellone ${st.boardNumber}/${st.totalBoards}`;
  const msg = document.getElementById('tr-message');
  msg.textContent = st.message;
  msg.className = 'turn-message ' + (st.buzzedByMe ? 'your-turn' : (st.locked ? 'waiting' : ''));
  const btn = document.getElementById('btn-buzz');
  btn.disabled = !st.canBuzz;
  btn.classList.toggle('buzzed', st.buzzedByMe);
}

socket.on('player:matchEnd', ({ standings }) => {
  showScreen('player-matchend');
  const el = document.getElementById('player-standings');
  el.innerHTML = '';
  standings.forEach((s, i) => {
    const row = document.createElement('div');
    row.className = 'standing-row glass-panel' + (i === 0 ? ' winner' : '');
    row.innerHTML = `<span>${i + 1}. ${s.name}</span><span>${s.bank}</span>`;
    el.appendChild(row);
  });
});

// --- Wheel + spin ---
function initWheel() {
  const canvas = document.getElementById('player-wheel-canvas');
  playerWheel = new Wheel(canvas, { segments: 16, labels: [], showLabels: false });
  canvas.addEventListener('click', spin);
  window.addEventListener('resize', () => playerWheel.resize());
}
document.getElementById('btn-spin').addEventListener('click', spin);
function spin() {
  socket.emit('player:spin');
}

// --- Keyboard ---
// The consonant keyboard (#keyboard) is built once and never rebuilt; turn-state
// updates only toggle disabled states. The vowel picker (#vowel-picker) is a
// separate element shown/hidden by the "Compra vocale" button.
function buildKeyboard() {
  const kb = document.getElementById('keyboard');
  kb.innerHTML = '';
  CONSONANTS.forEach(letter => {
    const b = document.createElement('button');
    b.className = 'key';
    b.textContent = letter;
    b.dataset.letter = letter;
    b.addEventListener('click', () => socket.emit('player:pickConsonant', { letter }));
    kb.appendChild(b);
  });

  const vp = document.getElementById('vowel-picker');
  vp.innerHTML = '';
  VOWELS.forEach(letter => {
    const b = document.createElement('button');
    b.className = 'key vowel';
    b.textContent = letter;
    b.dataset.letter = letter;
    b.addEventListener('click', () => {
      socket.emit('player:buyVowel', { letter });
      vp.classList.add('hidden');
    });
    vp.appendChild(b);
  });

  document.getElementById('btn-vowel').addEventListener('click', () => {
    document.getElementById('vowel-picker').classList.toggle('hidden');
  });
}

function markUsedLetters(used) {
  document.querySelectorAll('#keyboard .key, #vowel-picker .key').forEach(b => {
    b.disabled = used.includes(b.dataset.letter);
  });
}

// --- Turn state gating ---
function applyTurnState(st) {
  const msg = document.getElementById('turn-message');
  const spinBtn = document.getElementById('btn-spin');
  const vowelBtn = document.getElementById('btn-vowel');
  const kb = document.getElementById('keyboard');
  const vp = document.getElementById('vowel-picker');
  const container = document.getElementById('player-wheel-container');

  markUsedLetters(st.usedLetters);

  if (!st.isMyTurn) {
    msg.textContent = `Turno di ${st.currentTurnName}`;
    msg.className = 'turn-message waiting';
    spinBtn.disabled = true;
    vowelBtn.disabled = true;
    kb.classList.add('disabled');
    vp.classList.add('hidden');
    container.classList.add('disabled');
    return;
  }

  container.classList.remove('disabled');
  msg.className = 'turn-message your-turn';

  const state = st.turnState;
  const canSpin = state === 'MUST_SPIN' || state === 'CONTINUE';
  const mustConsonant = state === 'PICK_CONSONANT' || state === 'PICK_CONSONANT_DOUBLE';

  spinBtn.disabled = !canSpin;
  vowelBtn.disabled = !st.canBuyVowel;
  kb.classList.toggle('disabled', !mustConsonant);
  if (state !== 'CONTINUE') vp.classList.add('hidden');

  if (state === 'MUST_SPIN') msg.textContent = 'Tocca a te! Gira la ruota';
  else if (mustConsonant) msg.textContent = state === 'PICK_CONSONANT_DOUBLE'
    ? 'RADDOPPIA! Scegli una consonante' : 'Scegli una consonante';
  else if (state === 'CONTINUE') msg.textContent = 'Rigira, compra vocale o risolvi a voce';
}
