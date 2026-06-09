const socket = io();
const params = new URLSearchParams(window.location.search);
const roomCode = params.get('room');

const CONSONANTS = 'BCDFGHJKLMNPQRSTVWXYZ'.split('');
const VOWELS = 'AEIOU'.split('');

let playerWheel = null;
let myIndex = -1;
let myName = '';

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
    if (data.roomCode === roomCode) { socket.emit('player:reconnect', { roomCode, name: data.name }); return; }
  }
  socket.emit('player:join', { roomCode, name });
});
document.getElementById('nick-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-join').click();
});

// --- Connection events ---
socket.on('player:joined', ({ playerIndex, name }) => {
  myIndex = playerIndex; myName = name;
  sessionStorage.setItem('giramoe-player', JSON.stringify({ roomCode, name }));
  showScreen('wait-screen');
});
socket.on('player:error', msg => alert(msg));
socket.on('player:gameStarted', () => {
  showScreen('player-game-screen');
  document.getElementById('player-nick-display').textContent = myName;
  initWheel();
  buildKeyboard();
});
socket.on('player:reconnected', ({ playerIndex, name, phase }) => {
  myIndex = playerIndex; myName = name;
  if (phase === 'playing') {
    showScreen('player-game-screen');
    document.getElementById('player-nick-display').textContent = myName;
    initWheel();
    buildKeyboard();
  } else showScreen('wait-screen');
});

socket.on('player:spinResult', ({ totalAngle }) => {
  if (playerWheel) playerWheel.spinTo(totalAngle, 6000);
});

socket.on('player:turnState', (st) => {
  document.getElementById('round-points').textContent = st.roundPoints;
  document.getElementById('bank-points').textContent = st.bank;
  applyTurnState(st);
});

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
