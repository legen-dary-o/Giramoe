const socket = io();

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

socket.emit('admin:init');

document.getElementById('btn-inizia').addEventListener('click', () => socket.emit('admin:inizia'));
document.getElementById('btn-avvia').addEventListener('click', () => socket.emit('admin:startGame'));

document.getElementById('btn-set-board').addEventListener('click', () => {
  const category = document.getElementById('cat-input').value.trim();
  const phrase = document.getElementById('phrase-input').value.trim();
  if (!category || !phrase) { showBoardError('Inserisci categoria e frase'); return; }
  showBoardError('');
  socket.emit('admin:setBoard', { category, phrase });
});
document.getElementById('btn-solve').addEventListener('click', () => socket.emit('admin:solve'));
document.getElementById('btn-pass').addEventListener('click', () => socket.emit('admin:passTurn'));

// --- Triplete ---
document.getElementById('btn-go-triplete').addEventListener('click', () => socket.emit('admin:startTriplete'));
document.getElementById('btn-triplete-start').addEventListener('click', () => {
  const title = document.getElementById('tr-title').value.trim();
  const phrases = [1, 2, 3].map(i => document.getElementById(`tr-phrase-${i}`).value.trim());
  if (!title || phrases.some(p => !p)) { showTripleteError('Inserisci il titolo e tutte e 3 le frasi'); return; }
  showTripleteError('');
  socket.emit('admin:tripleteStart', { title, phrases });
});
document.getElementById('btn-triplete-correct').addEventListener('click', () => socket.emit('admin:tripleteCorrect'));
document.getElementById('btn-triplete-wrong').addEventListener('click', () => socket.emit('admin:tripleteWrong'));
socket.on('admin:tripleteError', (err) => showTripleteError(err));

socket.on('admin:state', (s) => {
  if (s.phase === 'video') showScreen('admin-pregame');
  else if (s.phase === 'lobby') {
    showScreen('admin-lobby');
    updateLobby(s.players);
  } else if (s.phase === 'playing' || s.phase === 'express') {
    showScreen('admin-game');
    renderGame(s);
  } else if (s.phase === 'tripleteReady') {
    showScreen('admin-tripleteready');
  } else if (s.phase === 'triplete') {
    showScreen('admin-triplete');
    renderTriplete(s.triplete);
  } else if (s.phase === 'matchEnd') {
    showScreen('admin-matchend');
    renderStandings(s.players);
  }
});

socket.on('admin:boardError', (err) => showBoardError(err));
socket.on('admin:boardSolved', ({ boardNumber }) => {
  showBoardError('');
  document.getElementById('cat-input').value = '';
  document.getElementById('phrase-input').value = '';
  alert(`Tabellone risolto! Imposta il tabellone ${boardNumber}.`);
});

function updateLobby(players) {
  const list = document.getElementById('admin-players');
  list.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const p = players[i];
    const item = document.createElement('div');
    item.className = 'admin-player-item glass-panel';
    if (p) {
      const name = document.createElement('span');
      name.className = 'apl-name';
      name.textContent = p.name;
      const right = document.createElement('span');
      right.className = 'apl-right';
      const dot = document.createElement('span');
      dot.className = 'status-dot' + (p.connected ? '' : ' disconnected');
      const kick = document.createElement('button');
      kick.className = 'kick-btn';
      kick.textContent = '✕';
      kick.title = 'Rimuovi';
      kick.addEventListener('click', () => socket.emit('admin:kick', { name: p.name }));
      right.appendChild(dot);
      right.appendChild(kick);
      item.appendChild(name);
      item.appendChild(right);
    } else {
      const name = document.createElement('span');
      name.className = 'apl-name empty';
      name.textContent = 'In attesa...';
      const dot = document.createElement('span');
      dot.className = 'status-dot disconnected';
      item.appendChild(name);
      item.appendChild(dot);
    }
    list.appendChild(item);
  }
  document.getElementById('btn-avvia').disabled =
    !(players.length === 3 && players.every(p => p.connected));
}

const STATE_LABEL = {
  MUST_SPIN: 'deve girare',
  PICK_CONSONANT: 'consonante',
  PICK_CONSONANT_DOUBLE: 'consonante (raddoppia)',
  CONTINUE: 'continua/vocale/risolve',
  EXPRESS: 'EXPRESS (raffica)'
};

let prevScores = {};

function renderGame(s) {
  document.getElementById('admin-board-counter').textContent =
    `${s.phase === 'express' ? 'Express' : 'Tabellone'} ${s.boardNumber} / ${s.totalBoards}`;
  const turnPlayer = s.players[s.currentTurn];
  document.getElementById('admin-turn-name').textContent = turnPlayer ? turnPlayer.name : '—';
  document.getElementById('admin-turn-state').textContent = STATE_LABEL[s.turnState] || '';
  // In express, "Passa turno" becomes the wrong-solution button (full bancarotta).
  document.getElementById('btn-pass').textContent =
    s.turnState === 'EXPRESS' ? 'Frase sbagliata' : 'Passa turno';

  const list = document.getElementById('admin-scores');
  list.innerHTML = '';
  s.players.forEach((p, i) => {
    const prev = prevScores[p.name];
    const changed = prev && (prev.rp !== p.roundPoints || prev.bank !== p.bank);

    const item = document.createElement('div');
    item.className = 'admin-player-item glass-panel' + (changed ? ' score-flash' : '');
    if (i === s.currentTurn) {
      item.style.border = '1px solid rgba(100, 180, 255, 0.5)';
      item.style.boxShadow = '0 0 12px rgba(100, 180, 255, 0.2)';
    }
    item.innerHTML = `<span>${p.name}</span>
      <span class="admin-scorenums">T: <b>${p.roundPoints}</b> · B: <b>${p.bank}</b></span>`;
    list.appendChild(item);
  });

  prevScores = {};
  s.players.forEach(p => { prevScores[p.name] = { rp: p.roundPoints, bank: p.bank }; });
}

function renderStandings(players) {
  const el = document.getElementById('admin-standings');
  el.innerHTML = '';
  players.slice().sort((a, b) => b.bank - a.bank).forEach((p, i) => {
    const item = document.createElement('div');
    item.className = 'admin-player-item glass-panel' + (i === 0 ? ' winner' : '');
    item.innerHTML = `<span>${i + 1}. ${p.name}</span><span><b>${p.bank}</b></span>`;
    el.appendChild(item);
  });
}

function showBoardError(msg) {
  document.getElementById('board-error').textContent = msg;
}

function showTripleteError(msg) {
  document.getElementById('triplete-error').textContent = msg;
}

function renderTriplete(tr) {
  const setup = document.getElementById('triplete-setup');
  const live = document.getElementById('triplete-live');
  const actions = document.getElementById('triplete-actions');

  if (!tr || !tr.started) {
    setup.classList.remove('hidden');
    live.classList.add('hidden');
    actions.classList.add('hidden');
    return;
  }

  setup.classList.add('hidden');
  live.classList.remove('hidden');
  actions.classList.remove('hidden');

  document.getElementById('triplete-board-counter').textContent =
    `Tabellone ${tr.boardNumber} / ${tr.totalBoards}` + (tr.title ? ` — ${tr.title}` : '');

  const buzzed = tr.buzzedBy != null;
  document.getElementById('btn-triplete-correct').disabled = !buzzed;
  document.getElementById('btn-triplete-wrong').disabled = !buzzed;

  const list = document.getElementById('triplete-scores');
  list.innerHTML = '';
  tr.players.forEach((p) => {
    const item = document.createElement('div');
    item.className = 'admin-player-item glass-panel';
    if (p.buzzed) {
      item.style.border = '1px solid rgba(245, 179, 1, 0.7)';
      item.style.boxShadow = '0 0 12px rgba(245, 179, 1, 0.3)';
    }
    const tag = p.buzzed ? ' 🔔' : (p.locked ? ' ⛔' : '');
    item.innerHTML = `<span>${p.name}${tag}</span>
      <span class="admin-scorenums">P: <b>${p.points}</b> · B: <b>${p.bank}</b></span>`;
    list.appendChild(item);
  });
}
