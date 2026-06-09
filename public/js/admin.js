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

socket.on('admin:state', (s) => {
  if (s.phase === 'video') showScreen('admin-pregame');
  else if (s.phase === 'lobby') {
    showScreen('admin-lobby');
    updateLobby(s.players);
    document.getElementById('btn-avvia').disabled = s.players.length < 3;
  } else if (s.phase === 'playing') {
    showScreen('admin-game');
    renderGame(s);
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

const STATE_LABEL = {
  MUST_SPIN: 'deve girare',
  PICK_CONSONANT: 'consonante',
  PICK_CONSONANT_DOUBLE: 'consonante (raddoppia)',
  CONTINUE: 'continua/vocale/risolve'
};

function renderGame(s) {
  document.getElementById('admin-board-counter').textContent =
    `Tabellone ${s.boardNumber} / ${s.totalBoards}`;
  const turnPlayer = s.players[s.currentTurn];
  document.getElementById('admin-turn-name').textContent = turnPlayer ? turnPlayer.name : '—';
  document.getElementById('admin-turn-state').textContent = STATE_LABEL[s.turnState] || '';

  const list = document.getElementById('admin-scores');
  list.innerHTML = '';
  s.players.forEach((p, i) => {
    const item = document.createElement('div');
    item.className = 'admin-player-item glass-panel';
    if (i === s.currentTurn) {
      item.style.border = '1px solid rgba(100, 180, 255, 0.5)';
      item.style.boxShadow = '0 0 12px rgba(100, 180, 255, 0.2)';
    }
    item.innerHTML = `<span>${p.name}</span>
      <span class="admin-scorenums">T: <b>${p.roundPoints}</b> · B: <b>${p.bank}</b></span>`;
    list.appendChild(item);
  });
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
