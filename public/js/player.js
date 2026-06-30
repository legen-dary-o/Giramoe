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
let expressMode = false; // when true the keyboard fires express letters, no spinning

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

// Express round: back to the wheel game screen (board/keyboard already built).
socket.on('player:expressRound', () => {
  showScreen('player-game-screen');
  document.getElementById('player-nick-display').textContent = myName;
});

socket.on('player:reconnected', ({ playerIndex, name, phase }) => {
  myIndex = playerIndex; myName = name;
  reconnecting = false;
  saveSession(name);
  if (phase === 'playing' || phase === 'express') {
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

// --- Giramoe (final wheel board) ---
let giKbBuilt = false;
socket.on('player:giramoeIntro', () => {
  showScreen('player-giramoe-screen');
  document.getElementById('gi-nick').textContent = myName;
  buildGiramoeKeyboard();
});

socket.on('player:giramoeState', (st) => applyGiramoeState(st));

document.getElementById('btn-gi-buzz').addEventListener('click', () => socket.emit('player:giramoeBuzz'));

function buildGiramoeKeyboard() {
  if (giKbBuilt) return;
  giKbBuilt = true;
  const kb = document.getElementById('gi-keyboard');
  kb.innerHTML = '';
  CONSONANTS.forEach(letter => {
    const b = document.createElement('button');
    b.className = 'key';
    b.textContent = letter;
    b.dataset.letter = letter;
    b.addEventListener('click', () => socket.emit('player:giramoeLetter', { letter }));
    kb.appendChild(b);
  });
}

function applyGiramoeState(st) {
  document.getElementById('gi-points').textContent = st.points;
  document.getElementById('gi-mult').textContent = st.multiplier ? '×' + st.multiplier : '×—';
  const msg = document.getElementById('gi-message');
  msg.textContent = st.message;
  msg.className = 'turn-message ' + (st.isMyTurn ? 'your-turn' : 'waiting');
  const kb = document.getElementById('gi-keyboard');
  kb.classList.toggle('disabled', !st.canCall);
  document.querySelectorAll('#gi-keyboard .key').forEach(b => {
    b.disabled = !st.canCall || st.usedLetters.includes(b.dataset.letter);
  });
  const buzz = document.getElementById('btn-gi-buzz');
  buzz.disabled = !st.canBuzz;
  buzz.classList.toggle('armed', st.canBuzz);
}

// --- Tie-break + finalist ---
document.getElementById('btn-tb-spin').addEventListener('click', () => socket.emit('player:tiebreakSpin'));

socket.on('player:tiebreakState', (st) => {
  showScreen('player-tiebreak-screen');
  document.getElementById('tb-message').textContent = st.message;
  const btn = document.getElementById('btn-tb-spin');
  btn.disabled = !st.canSpin;
  btn.classList.toggle('armed', st.canSpin);
});

socket.on('player:finalist', ({ name, isMe }) => {
  showScreen('player-finalist-screen');
  document.getElementById('player-finalist-title').textContent =
    isMe ? 'Sei il finalista! 🏆' : `${name} va alla finale`;
});

// --- Final game (finalist only) ---
let finalKbBuilt = false;
document.getElementById('btn-final-buzz').addEventListener('click', () => socket.emit('player:finalBuzz'));

socket.on('player:finalStart', ({ isFinalist }) => {
  if (!isFinalist) return; // others keep spectating on the finalist screen
  showScreen('player-final-screen');
  buildFinalKeyboard();
});

socket.on('player:finalState', (st) => applyFinalState(st));

// --- Envelopes ---
let amFinalist = false;
let lastEnvView = null;
let envChangeArmed = false; // true once CAMBIA is pressed with 2+ greens to pick from

document.getElementById('btn-env-keep').addEventListener('click', () => {
  envChangeArmed = false;
  socket.emit('player:envelopeKeep');
});
document.getElementById('btn-env-change').addEventListener('click', () => {
  if (!lastEnvView) return;
  const avail = availableGreens(lastEnvView);
  if (avail.length === 1) {
    socket.emit('player:envelopeChange', { index: avail[0] }); // only one option: go
  } else if (avail.length > 1) {
    envChangeArmed = true;             // let the finalist tap WHICH green to switch to
    applyEnvelopes(lastEnvView);
  }
});

socket.on('player:envelopesStart', ({ view, isFinalist }) => {
  amFinalist = isFinalist;
  envChangeArmed = false;
  showScreen('player-envelopes-screen');
  applyEnvelopes(view);
});
socket.on('player:envelopesState', ({ view, isFinalist }) => {
  amFinalist = isFinalist;
  applyEnvelopes(view);
});

// Closed green envelopes the finalist could still switch into (not the held one).
function availableGreens(view) {
  return view.envelopes
    .map((e, i) => ({ e, i }))
    .filter(({ e, i }) => e.color === 'green' && !e.revealed && !e.abandoned && i !== view.current)
    .map(({ i }) => i);
}

function applyEnvelopes(view) {
  lastEnvView = view;
  const avail = availableGreens(view);
  const canChange = amFinalist && view.state === 'OPENED' && view.changesLeft > 0 && avail.length > 0;
  if (!canChange) envChangeArmed = false;

  const msg = document.getElementById('env-message');
  if (!amFinalist) msg.textContent = 'Apertura buste…';
  else if (view.state === 'NONE') msg.textContent = 'Nessuna busta verde';
  else if (view.state === 'CHOOSING') msg.textContent = 'Tocca una busta verde per aprirla';
  else if (view.state === 'KEPT') msg.textContent = 'È la tua busta!';
  else if (envChangeArmed) msg.textContent = 'Tocca la busta verde su cui spostarti';
  else if (canChange) msg.textContent = 'Tieni questa o cambia';
  else msg.textContent = 'È la tua busta!';

  const row = document.getElementById('player-envelopes-row');
  row.innerHTML = '';
  view.envelopes.forEach((e, i) => {
    const el = document.createElement('div');
    el.className = 'envelope ' + e.color
      + (e.revealed ? ' open' : '')
      + (i === view.current ? ' current' : '')
      + (e.abandoned ? ' abandoned' : '')
      + (view.state === 'KEPT' && i !== view.current ? ' gone' : '');
    el.innerHTML = e.revealed
      ? `<div class="env-num">${i + 1}</div><div class="env-content">${e.content || ''}</div>`
      : `<div class="env-num">${i + 1}</div><div class="env-q">?</div>`;
    if (amFinalist && view.state === 'CHOOSING' && e.color === 'green' && !e.revealed) {
      el.classList.add('pickable');
      el.addEventListener('click', () => socket.emit('player:envelopeOpen', { index: i }));
    } else if (envChangeArmed && avail.includes(i)) {
      el.classList.add('pickable');
      el.addEventListener('click', () => {
        envChangeArmed = false;
        socket.emit('player:envelopeChange', { index: i });
      });
    }
    row.appendChild(el);
  });

  // TIENI + CAMBIA are shown together once an envelope is opened; arming CAMBIA hides
  // them while the finalist taps the green to move to.
  const keepBtn = document.getElementById('btn-env-keep');
  const changeBtn = document.getElementById('btn-env-change');
  const showButtons = amFinalist && view.state === 'OPENED' && !envChangeArmed;
  keepBtn.style.display = showButtons ? '' : 'none';
  changeBtn.style.display = showButtons && canChange ? '' : 'none';
  changeBtn.textContent = `CAMBIA (${view.changesLeft})`;
}

function buildFinalKeyboard() {
  if (finalKbBuilt) return;
  finalKbBuilt = true;
  const kb = document.getElementById('final-keyboard');
  kb.innerHTML = '';
  CONSONANTS.forEach(letter => {
    const b = document.createElement('button');
    b.className = 'key';
    b.textContent = letter;
    b.dataset.letter = letter;
    b.addEventListener('click', () => socket.emit('player:finalPick', { letter }));
    kb.appendChild(b);
  });
  const vr = document.getElementById('final-vowels');
  vr.innerHTML = '';
  VOWELS.forEach(letter => {
    const b = document.createElement('button');
    b.className = 'key vowel';
    b.textContent = letter;
    b.dataset.letter = letter;
    b.addEventListener('click', () => socket.emit('player:finalPick', { letter }));
    vr.appendChild(b);
  });
}

function applyFinalState(st) {
  const msg = document.getElementById('final-message');
  msg.textContent = st.message;
  msg.className = 'turn-message your-turn';
  document.querySelectorAll('#final-keyboard .key').forEach(b => {
    b.disabled = !st.canPickConsonant || st.usedLetters.includes(b.dataset.letter);
  });
  document.querySelectorAll('#final-vowels .key').forEach(b => {
    b.disabled = !st.canPickVowel || st.usedLetters.includes(b.dataset.letter);
  });
  const buzz = document.getElementById('btn-final-buzz');
  buzz.disabled = !st.canBuzz;
  buzz.classList.toggle('armed', st.canBuzz);
}

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
  // Lock the controls right away: the server ignores spins until this animation
  // ends, and the next turn-state update (~6s later) re-enables what's allowed.
  document.getElementById('btn-spin').disabled = true;
  document.getElementById('player-wheel-container').classList.add('disabled');
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
    b.addEventListener('click', () => {
      if (expressMode) socket.emit('player:expressLetter', { letter });
      else socket.emit('player:pickConsonant', { letter });
    });
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
      if (expressMode) socket.emit('player:expressLetter', { letter });
      else socket.emit('player:buyVowel', { letter });
      vp.classList.add('hidden');
    });
    vp.appendChild(b);
  });

  document.getElementById('btn-vowel').addEventListener('click', () => {
    const vp = document.getElementById('vowel-picker');
    vp.classList.toggle('hidden');
    // On short phones the picker sits below the fold; pull it into view when opened.
    if (!vp.classList.contains('hidden')) vp.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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
  expressMode = st.isMyTurn && st.turnState === 'EXPRESS';

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

  if (state === 'EXPRESS') {
    // Rapid-fire: no wheel, keyboard always live, vowels buyable at >= 500.
    spinBtn.disabled = true;
    container.classList.add('disabled');
    kb.classList.remove('disabled');
    vowelBtn.disabled = st.roundPoints < 500;
    vp.classList.add('hidden');
    msg.textContent = '🚄 EXPRESS! Spara consonanti o compra vocali';
    return;
  }

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
