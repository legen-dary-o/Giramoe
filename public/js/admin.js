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

// --- Giramoe ---
document.getElementById('btn-giramoe-setboard').addEventListener('click', () => {
  const category = document.getElementById('gi-cat').value.trim();
  const phrase = document.getElementById('gi-phrase').value.trim();
  if (!category || !phrase) { document.getElementById('giramoe-error').textContent = 'Inserisci categoria e frase'; return; }
  document.getElementById('giramoe-error').textContent = '';
  socket.emit('admin:giramoeSetBoard', { category, phrase });
});
document.getElementById('btn-giramoe-spin').addEventListener('click', () => socket.emit('admin:giramoeSpin'));
document.getElementById('btn-giramoe-correct').addEventListener('click', () => socket.emit('admin:giramoeCorrect'));
document.getElementById('btn-giramoe-wrong').addEventListener('click', () => socket.emit('admin:giramoeWrong'));
socket.on('admin:giramoeError', (err) => { document.getElementById('giramoe-error').textContent = err; });

// --- Final game ---
document.getElementById('btn-start-final').addEventListener('click', () => {
  const topic = document.getElementById('fin-topic').value.trim();
  const phrases = [1, 2, 3].map(i => document.getElementById(`fin-phrase-${i}`).value.trim());
  const envelopes = [1, 2, 3].map(i => document.getElementById(`fin-env-${i}`).value.trim());
  if (!topic || phrases.some(p => !p)) { document.getElementById('final-error').textContent = 'Inserisci argomento e 3 frasi'; return; }
  if (envelopes.some(e => !e)) { document.getElementById('final-error').textContent = 'Inserisci anche i 3 testi delle buste'; return; }
  document.getElementById('final-error').textContent = '';
  socket.emit('admin:startFinal', { topic, phrases, envelopes });
});
document.getElementById('btn-final-correct').addEventListener('click', () => socket.emit('admin:finalCorrect'));
document.getElementById('btn-final-wrong').addEventListener('click', () => socket.emit('admin:finalWrong'));
socket.on('admin:finalError', (err) => { document.getElementById('final-error').textContent = err; });

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
  } else if (s.phase === 'giramoe') {
    showScreen('admin-giramoe');
    renderGiramoe(s.giramoe);
  } else if (s.phase === 'tiebreak') {
    showScreen('admin-tiebreak');
    renderTiebreak(s.tiebreak);
  } else if (s.phase === 'finalist') {
    showScreen('admin-finalist');
    document.getElementById('admin-finalist-name').innerHTML =
      s.finalist ? `<span>🏆 ${s.finalist.name}</span><span>finale</span>` : '';
  } else if (s.phase === 'final') {
    showScreen('admin-final');
    renderFinal(s.final);
  } else if (s.phase === 'envelopes') {
    showScreen('admin-envelopes');
    renderAdminEnvelopes(s.envelopes);
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

function renderTiebreak(tb) {
  const el = document.getElementById('admin-tiebreak-list');
  el.innerHTML = '';
  if (!tb) return;
  tb.contenders.forEach((c, i) => {
    const item = document.createElement('div');
    item.className = 'admin-player-item glass-panel';
    if (i === tb.current) {
      item.style.border = '1px solid rgba(100, 180, 255, 0.5)';
      item.style.boxShadow = '0 0 12px rgba(100, 180, 255, 0.2)';
    }
    const tag = i === tb.current ? ' ▶' : '';
    item.innerHTML = `<span>${c.name}${tag}</span>
      <span class="admin-scorenums"><b>${c.value != null ? c.value : '—'}</b></span>`;
    el.appendChild(item);
  });
}

function showBoardError(msg) {
  document.getElementById('board-error').textContent = msg;
}

const FINAL_STATE_LABEL = {
  PICKING: 'sceglie le lettere',
  RUNNING: 'timer in corso',
  BUZZED: 'si è prenotato — giudica',
  BOARD_DONE: 'tabellone risolto',
  DONE: 'fine'
};

function renderFinal(f) {
  if (!f) return;
  document.getElementById('fin-board-counter').textContent = `Tabellone ${f.boardIndex + 1} / ${f.totalBoards}`;
  document.getElementById('fin-timer').textContent = Math.ceil(f.timeLeft / 1000) + 's';
  document.getElementById('fin-state').textContent = (f.category ? f.category + ' · ' : '') + (FINAL_STATE_LABEL[f.state] || '');
  document.getElementById('btn-final-correct').disabled = !f.buzzed;
  document.getElementById('btn-final-wrong').disabled = !f.buzzed;

  const list = document.getElementById('fin-results');
  list.innerHTML = '';
  f.results.forEach((res, i) => {
    const item = document.createElement('div');
    item.className = 'admin-player-item glass-panel';
    const label = res === true ? '✅ indovinato' : res === false ? '❌ sbagliato' : (i === f.boardIndex ? '▶ in corso' : '—');
    item.innerHTML = `<span>Tabellone ${i + 1}</span><span>${label}</span>`;
    list.appendChild(item);
  });
}

function renderAdminEnvelopes(view) {
  const el = document.getElementById('admin-envelopes-list');
  el.innerHTML = '';
  if (!view) return;
  view.envelopes.forEach((e, i) => {
    const item = document.createElement('div');
    item.className = 'admin-player-item glass-panel';
    const dot = e.color === 'green' ? '🟢' : '🔴';
    const right = document.createElement('span');
    if (e.revealed) {
      right.innerHTML = `<b>${e.content || ''}</b>`;
    } else if (e.color === 'red') {
      const btn = document.createElement('button');
      btn.className = 'glass-button';
      btn.style.padding = '4px 12px';
      btn.textContent = 'Rivela';
      btn.addEventListener('click', () => socket.emit('admin:envelopeRevealRed', { index: i }));
      right.appendChild(btn);
    } else {
      right.textContent = i === view.current ? 'scelta' : (e.abandoned ? 'scartata' : 'verde');
    }
    item.innerHTML = `<span>${dot} Busta ${i + 1}</span>`;
    item.appendChild(right);
    el.appendChild(item);
  });
}

function showTripleteError(msg) {
  document.getElementById('triplete-error').textContent = msg;
}

function renderGiramoe(gr) {
  const setup = document.getElementById('giramoe-setup');
  const live = document.getElementById('giramoe-live');
  const actions = document.getElementById('giramoe-actions');

  if (!gr || !gr.started) {
    setup.classList.remove('hidden');
    live.classList.add('hidden');
    actions.classList.add('hidden');
    return;
  }

  setup.classList.add('hidden');
  live.classList.remove('hidden');
  actions.classList.remove('hidden');

  document.getElementById('gi-turn-name').textContent = gr.currentName || '—';
  document.getElementById('gi-mult-tag').textContent =
    gr.multiplier ? '×' + gr.multiplier : (gr.state === 'AWAIT_SPIN' ? 'gira la ruota' : '');
  document.getElementById('btn-giramoe-spin').disabled = gr.state !== 'AWAIT_SPIN';

  const buzzed = gr.buzzedBy != null;
  document.getElementById('btn-giramoe-correct').disabled = !buzzed;
  document.getElementById('btn-giramoe-wrong').disabled = !buzzed;

  const list = document.getElementById('giramoe-scores');
  list.innerHTML = '';
  gr.players.forEach((p, i) => {
    const item = document.createElement('div');
    item.className = 'admin-player-item glass-panel';
    if (p.id === gr.buzzedBy) {
      item.style.border = '1px solid rgba(245, 179, 1, 0.7)';
      item.style.boxShadow = '0 0 12px rgba(245, 179, 1, 0.3)';
    } else if (i === gr.currentTurn) {
      item.style.border = '1px solid rgba(100, 180, 255, 0.5)';
    }
    const tag = p.id === gr.buzzedBy ? ' 🔔' : (i === gr.currentTurn ? ' ▶' : '');
    item.innerHTML = `<span>${p.name}${tag}</span>
      <span class="admin-scorenums">P: <b>${p.points}</b></span>`;
    list.appendChild(item);
  });
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
