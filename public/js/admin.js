// In sviluppo `?mock=<id>` sostituisce la socket (vedi public/js/dev/mock.js).
// Qui lo script è classico: la finta viene installata prima, dal modulo nel
// <script type="module"> di admin.html.
const socket = window.__mockSocket || io();

// La cornice comune della console: caricata come modulo da admin.html e appesa
// a window, perché questo file è uno script classico (vedi js/admin/shell.js).
const AdminShell = window.AdminShell;

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

// L'admin è un telefono: la socket cade a ogni blocco schermo, cambio app o
// sbalzo di rete, e socket.io si riconnette con una socket NUOVA che non è più
// nella room 'admin'. Senza ri-presentarsi a ogni connect i tasti continuano a
// funzionare ma la schermata non si aggiorna più — è il caso "ho premuto inizia,
// il gioco è partito, ma io ho ancora davanti il form delle frasi".
socket.on('connect', () => socket.emit('admin:init'));

// Stessa cosa quando il telefono torna in primo piano: chiediamo lo stato pieno,
// così quello che vedi è sempre quello vero anche dopo una pausa lunga.
function resync() {
  if (socket.connected) socket.emit('admin:init');
  else socket.connect();
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') resync();
});
window.addEventListener('focus', resync);

document.getElementById('btn-inizia').addEventListener('click', () => socket.emit('admin:inizia'));
document.getElementById('btn-avvia').addEventListener('click', () => socket.emit('admin:startGame'));

document.getElementById('btn-set-board').addEventListener('click', () => {
  const category = document.getElementById('cat-input').value.trim();
  const phrase = document.getElementById('phrase-input').value.trim();
  if (!category || !phrase) { showBoardError('Inserisci categoria e frase'); return; }
  showBoardError('');
  socket.emit('admin:setBoard', { category, phrase });
});

// Anteprima della disposizione mentre si scrive. Il debounce non è cortesia
// verso il server: senza, ogni tasto è un giro di socket e la riga sfarfalla
// fra "ci sta" e "troppo lunga" a ogni lettera di una parola non finita.
let checkTimer = null;
document.getElementById('phrase-input').addEventListener('input', (e) => {
  const phrase = e.target.value;
  clearTimeout(checkTimer);
  checkTimer = setTimeout(() => socket.emit('admin:checkPhrase', { phrase }), 250);
});
socket.on('admin:phraseCheck', (r) => {
  if (r.empty) return setBoardMsg('');
  if (!r.ok) return setBoardMsg(r.error, 'bad');
  const righe = r.rows === 1 ? '1 riga' : `${r.rows} righe`;
  setBoardMsg(`Sta in ${righe} · ${r.letters} lettere`, 'ok');
});

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
    updateLobby(s);
  } else if (s.phase === 'playing' || s.phase === 'express') {
    showScreen('admin-game');
    renderGame(s);
  } else if (s.phase === 'tripleteReady') {
    showScreen('admin-tripleteready');
    renderReady(s.players);
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
  document.getElementById('cat-input').value = '';
  document.getElementById('phrase-input').value = '';
  // Era un alert(): un modale blocca tutta la pagina finché non lo chiudi, e se
  // compare a schermo spento sembra che la console admin si sia piantata.
  showBoardNotice(`Tabellone risolto — imposta il tabellone ${boardNumber}.`);
});

const MAX_PLAYERS = 3;

function updateLobby(s) {
  const players = s.players || [];
  AdminShell.renderTopBar(document.getElementById('lobby-topbar'), {
    title: 'GIRAMOE', gm: true, phase: 'Sala d’attesa'
  });
  document.getElementById('lobby-count').textContent = `${players.length} / ${MAX_PLAYERS}`;
  // L'URL si legge ad alta voce quando il QR non si inquadra: senza schema è
  // più corto da dettare e non cambia niente per chi lo digita.
  const link = document.getElementById('lobby-link');
  link.textContent = s.lobbyUrl ? s.lobbyUrl.replace(/^https?:\/\//, '') : '—';

  const list = document.getElementById('admin-players');
  list.innerHTML = '';
  for (let i = 0; i < MAX_PLAYERS; i++) {
    const p = players[i];
    const dot = document.createElement('span');
    dot.className = 'ar-dot' + (p && p.connected ? '' : ' is-off');
    if (!p) {
      const row = AdminShell.playerRow({ name: 'Slot libero' });
      row.classList.add('is-free');
      row.prepend(dot);
      list.append(row);
      continue;
    }
    const kick = document.createElement('button');
    kick.className = 'ar-kick';
    kick.textContent = '✕';
    kick.title = 'Rimuovi';
    kick.addEventListener('click', () => socket.emit('admin:kick', { name: p.name }));
    const row = AdminShell.playerRow({ name: p.name, extra: kick });
    row.prepend(dot);
    list.append(row);
  }

  const pronti = players.length === MAX_PLAYERS && players.every(p => p.connected);
  document.getElementById('btn-avvia').disabled = !pronti;
  const why = document.getElementById('lobby-why');
  why.hidden = pronti;
  // Dice cosa manca davvero: "serve il terzo" quando manca gente, "qualcuno si è
  // disconnesso" quando ci sono tutti ma uno è caduto.
  const mancanti = MAX_PLAYERS - players.length;
  why.textContent = mancanti > 0
    ? (mancanti === 1 ? 'Serve il terzo giocatore' : `Servono ancora ${mancanti} giocatori`)
    : 'Un giocatore è disconnesso';
}

const STATE_LABEL = {
  MUST_SPIN: 'Deve girare',
  PICK_CONSONANT: 'Consonante',
  PICK_CONSONANT_DOUBLE: 'Consonante ×2',
  CONTINUE: 'Rigira o risolve',
  EXPRESS: 'Raffica'
};

// `turno 1.400 · banca 3.200` — il turno in ciano solo per chi sta giocando:
// è l'unico numero che si muove, gli altri sono zero fino al loro giro.
function scoreCell(p, isTurn) {
  const box = document.createElement('span');
  box.className = 'ar-right';
  const t = document.createElement('b');
  t.textContent = AdminShell.num(p.roundPoints);
  if (isTurn) t.className = 'acc';
  const b = document.createElement('b');
  b.textContent = AdminShell.num(p.bank);
  box.append('turno ', t, ' · banca ', b);
  return box;
}

function renderGame(s) {
  const express = s.phase === 'express';
  AdminShell.renderTopBar(document.getElementById('game-topbar'), {
    title: 'GIRAMOE', gm: true,
    phase: express ? 'Fase 03 · express' : 'Fase 01',
    tone: express ? 'accent' : null,
    pips: { done: s.boardNumber, total: s.totalBoards }
  });
  document.getElementById('admin-board-counter').textContent =
    `${express ? 'Express' : 'Tabellone'} ${s.boardNumber} di ${s.totalBoards}`;
  // "IN CORSO" solo quando un tabellone è davvero in gioco: prima è l'admin che
  // deve muoversi, e dirgli "in corso" lo farebbe aspettare a vuoto.
  const stato = document.getElementById('board-status');
  stato.textContent = s.turnState ? 'IN CORSO' : 'DA IMPOSTARE';

  const turnPlayer = s.players[s.currentTurn];
  document.getElementById('admin-turn-name').textContent = turnPlayer ? turnPlayer.name : '—';
  const tag = document.getElementById('admin-turn-state');
  tag.textContent = STATE_LABEL[s.turnState] || '';
  tag.hidden = !s.turnState;

  const list = document.getElementById('admin-scores');
  list.innerHTML = '';
  s.players.forEach((p, i) => {
    const isTurn = i === s.currentTurn;
    list.append(AdminShell.playerRow({
      name: p.name, right: scoreCell(p, isTurn), tone: isTurn ? 'accent' : null
    }));
  });

  // In express "Passa turno" diventa il tasto della frase sbagliata: lì non si
  // passa, si azzera tutto.
  AdminShell.renderActions(document.getElementById('game-actions'), {
    hint: 'Il giocatore ha detto la frase a voce',
    buttons: [
      { id: 'btn-solve', label: 'Indovinata', tone: 'accent' },
      { id: 'btn-pass', label: express ? 'Frase sbagliata' : 'Passa turno', tone: 'plain' }
    ]
  });
  document.getElementById('btn-solve').addEventListener('click', () => socket.emit('admin:solve'));
  document.getElementById('btn-pass').addEventListener('click', () => socket.emit('admin:passTurn'));
}

// 1q · classifica delle banche prima del bonus round
function renderReady(players) {
  const box = document.getElementById('ready-standings');
  box.innerHTML = '';
  [...(players || [])].sort((a, b) => b.bank - a.bank).forEach(p => {
    const row = document.createElement('div');
    row.className = 'srow';
    const n = document.createElement('span');
    n.className = 'nome';
    n.textContent = p.name;
    const v = document.createElement('span');
    v.className = 'val';
    v.textContent = AdminShell.num(p.bank);
    row.append(n, v);
    box.append(row);
  });
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

// Una riga sola sotto i campi: o l'anteprima della disposizione, o l'errore, o
// la conferma del tabellone risolto. Non capitano mai insieme — appena si
// ricomincia a scrivere l'anteprima prende il posto della conferma, ed è giusto
// così: la conferma vecchia parlerebbe del tabellone precedente.
function setBoardMsg(text, tone) {
  const el = document.getElementById('board-msg');
  el.hidden = !text;
  el.className = 'acheck' + (tone === 'bad' ? ' is-bad' : '');
  el.innerHTML = '';
  if (!text) return;
  const mark = document.createElement('span');
  mark.className = 'mark';
  mark.textContent = tone === 'bad' ? '!' : '✓';
  const txt = document.createElement('span');
  txt.textContent = text;
  el.append(mark, txt);
}
function showBoardError(msg) { setBoardMsg(msg, msg ? 'bad' : null); }
function showBoardNotice(msg) { setBoardMsg(msg, 'ok'); }

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
      <span class="admin-scorenums">P: <b>${p.points}</b> · B: <b>${p.bank != null ? p.bank : 0}</b></span>`;
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
