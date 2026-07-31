// In sviluppo `?mock=<id>` sostituisce la socket (vedi public/js/dev/mock.js).
// Qui lo script è classico: la finta viene installata prima, dal modulo nel
// <script type="module"> di admin.html.
const socket = window.__mockSocket || io();

// La cornice comune della console: caricata come modulo da admin.html e appesa
// a window, perché questo file è uno script classico (vedi js/admin/shell.js).
const AdminShell = window.AdminShell;
const pad2 = (n) => String(n).padStart(2, '0');

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
//
// Le due schermate che impostano un tabellone (partita e Giramoe) usano lo
// stesso evento: la risposta va a quella in cui si sta scrivendo, ricordata qui.
let checkTimer = null;
let checkTarget = 'board-msg';

function watchPhrase(inputId, msgId) {
  document.getElementById(inputId).addEventListener('input', (e) => {
    const phrase = e.target.value;
    checkTarget = msgId;
    clearTimeout(checkTimer);
    checkTimer = setTimeout(() => socket.emit('admin:checkPhrase', { phrase }), 250);
  });
}
watchPhrase('phrase-input', 'board-msg');

socket.on('admin:phraseCheck', (r) => {
  const el = document.getElementById(checkTarget);
  if (r.empty) return fillCheck(el, '');
  if (!r.ok) return fillCheck(el, r.error, 'bad');
  const righe = r.rows === 1 ? '1 riga' : `${r.rows} righe`;
  fillCheck(el, `Sta in ${righe} · ${r.letters} lettere`, 'ok');
});

// --- Triplete ---
document.getElementById('btn-go-triplete').addEventListener('click', () => socket.emit('admin:startTriplete'));
function tripleteFields() {
  return {
    title: document.getElementById('tr-title').value.trim(),
    phrases: [1, 2, 3].map(i => document.getElementById(`tr-phrase-${i}`).value.trim())
  };
}

// Il bottone lo costruisce renderTriplete dentro la barra d'azione: qui c'è
// solo quello che riguarda i campi, che invece stanno nell'HTML.
socket.on('admin:tripleteError', (err) => showTripleteError(err));

// Il bottone dice sempre cosa manca, e si accende da solo appena i campi sono
// pieni: senza, l'unico modo di scoprire che manca una frase è premere e
// leggere un errore.
['tr-title', 'tr-phrase-1', 'tr-phrase-2', 'tr-phrase-3'].forEach(id => {
  document.getElementById(id).addEventListener('input', refreshTripleteSetup);
});

function refreshTripleteSetup() {
  const { title, phrases } = tripleteFields();
  const vuote = phrases.filter(p => !p).length;
  const pronto = !!title && vuote === 0;
  const btn = document.getElementById('btn-triplete-start');
  if (btn) btn.disabled = !pronto;
  showTripleteError(pronto ? ''
    : !title ? 'Manca l’argomento'
      : vuote === 1 ? `Manca la ${['prima', 'seconda', 'terza'][phrases.findIndex(p => !p)]} frase`
        : `Mancano ${vuote} frasi`);
}

// --- Giramoe ---
document.getElementById('btn-giramoe-setboard').addEventListener('click', () => {
  const category = document.getElementById('gi-cat').value.trim();
  const phrase = document.getElementById('gi-phrase').value.trim();
  if (!category || !phrase) return setGiramoeMsg('Inserisci categoria e frase', 'bad');
  socket.emit('admin:giramoeSetBoard', { category, phrase });
});
document.getElementById('btn-giramoe-spin').addEventListener('click', () => socket.emit('admin:giramoeSpin'));
socket.on('admin:giramoeError', (err) => setGiramoeMsg(err, 'bad'));

// Stessa anteprima della frase del tabellone normale: la frase del Giramoe
// deve stare nella stessa griglia.
watchPhrase('gi-phrase', 'giramoe-error');

function setGiramoeMsg(text, tone) { fillCheck(document.getElementById('giramoe-error'), text, tone); }

// --- Final game ---
function finalFields() {
  return {
    topic: document.getElementById('fin-topic').value.trim(),
    phrases: [1, 2, 3].map(i => document.getElementById(`fin-phrase-${i}`).value.trim()),
    envelopes: [1, 2, 3].map(i => document.getElementById(`fin-env-${i}`).value.trim())
  };
}

document.getElementById('btn-start-final').addEventListener('click', () => {
  const { topic, phrases, envelopes } = finalFields();
  if (!topic || phrases.some(p => !p) || envelopes.some(e => !e)) return;
  socket.emit('admin:startFinal', { topic, phrases, envelopes });
});
socket.on('admin:finalError', (err) => setFinalWhy(err));

// Sette campi in una schermata sola: i tre passi in cima si accendono man mano
// e il bottone dice quale gruppo manca. Senza, l'unico modo di capire dove sei
// rimasto è scorrere tutto il form.
['fin-topic', 'fin-phrase-1', 'fin-phrase-2', 'fin-phrase-3', 'fin-env-1', 'fin-env-2', 'fin-env-3']
  .forEach(id => document.getElementById(id).addEventListener('input', refreshFinalSetup));

function setFinalWhy(msg) {
  const el = document.getElementById('final-error');
  el.textContent = msg;
  el.hidden = !msg;
}

function refreshFinalSetup() {
  const { topic, phrases, envelopes } = finalFields();
  const fatti = {
    topic: !!topic,
    phrases: phrases.every(p => p),
    env: envelopes.every(e => e)
  };
  document.querySelectorAll('#fin-steps span').forEach(s => {
    s.classList.toggle('is-done', !!fatti[s.dataset.step]);
  });
  const pronto = fatti.topic && fatti.phrases && fatti.env;
  document.getElementById('btn-start-final').disabled = !pronto;
  setFinalWhy(pronto ? ''
    : !fatti.topic ? 'Manca l’argomento'
      : !fatti.phrases ? 'Mancano delle frasi'
        : 'Mancano i contenuti delle buste');
}
refreshFinalSetup();

// Il nome del finalista sta in barra alta anche durante il gioco finale e le
// buste: `adminView().finalist` c'è in tutte e tre le fasi, si tiene da parte.
let adminFinalistName = '';

socket.on('admin:state', (s) => {
  if (s.finalist) adminFinalistName = s.finalist.name;
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
    renderFinalist(s.finalist);
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
    const fatto = c.value != null;
    const card = document.createElement('div');
    card.className = 'tb-card' + (fatto ? ' is-done' : '');

    const av = document.createElement('span');
    av.className = 'tb-av';
    av.textContent = (c.name || '?').charAt(0).toUpperCase();

    const who = document.createElement('div');
    who.className = 'tb-who';
    const nome = document.createElement('span');
    nome.className = 'nome';
    nome.textContent = c.name;
    const st = document.createElement('span');
    st.className = 'st';
    // Tre stati e non due: chi non ha ancora girato e non è nemmeno il suo
    // turno sta solo aspettando, e dirgli "sta girando" sarebbe falso.
    st.textContent = fatto ? 'fatto' : (i === tb.current ? 'sta girando…' : 'aspetta il turno');
    who.append(nome, st);

    const val = document.createElement('span');
    val.className = 'tb-val';
    val.textContent = fatto ? AdminShell.num(c.value) : '—';

    card.append(av, who, val);
    el.append(card);
  });
}

// Una riga sola sotto i campi: o l'anteprima della disposizione, o l'errore, o
// la conferma del tabellone risolto. Non capitano mai insieme — appena si
// ricomincia a scrivere l'anteprima prende il posto della conferma, ed è giusto
// così: la conferma vecchia parlerebbe del tabellone precedente.
function fillCheck(el, text, tone) {
  if (!el) return;
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
function setBoardMsg(text, tone) { fillCheck(document.getElementById('board-msg'), text, tone); }
function showBoardError(msg) { setBoardMsg(msg, msg ? 'bad' : null); }
function showBoardNotice(msg) { setBoardMsg(msg, 'ok'); }

function renderFinalist(fin) {
  AdminShell.renderTopBar(document.getElementById('fin-topbar'), {
    title: 'GIOCO FINALE', phase: 'Fase 05 · setup'
  });
  document.getElementById('fin-av').textContent = fin ? fin.name.charAt(0).toUpperCase() : '?';
  document.getElementById('fin-name').textContent = fin ? fin.name : '—';
  document.getElementById('fin-bank').textContent = AdminShell.num(fin ? fin.bank : 0);
  refreshFinalSetup();
}

const FINAL_STATE_LABEL = {
  PICKING: 'Sta scegliendo le lettere',
  RUNNING: 'Timer in corso',
  BUZZED: 'Si è prenotato — timer in pausa',
  BOARD_DONE: 'Tabellone risolto',
  DONE: 'Gioco finale finito'
};

function keyTile(letter, cls) {
  const k = document.createElement('span');
  k.className = 'k' + (cls ? ' ' + cls : '');
  k.textContent = letter;
  return k;
}

function renderFinal(f) {
  if (!f) return;
  AdminShell.renderTopBar(document.getElementById('fg-topbar'), {
    title: 'GIOCO FINALE',
    phase: adminFinalistName || 'Gioco finale'
  });

  const total = f.total || 60000;
  document.getElementById('fin-timer').textContent = Math.ceil(f.timeLeft / 1000);
  document.getElementById('fin-bar').style.width = (f.timeLeft / total) * 100 + '%';
  document.getElementById('fin-board-counter').textContent =
    `Tabellone ${f.boardIndex + 1} di ${f.totalBoards}`;

  // Tre riquadri: esito se già giocato, "in corso" su quello attuale, "attesa"
  // sugli altri. È l'unico posto in cui l'host vede com'è andata finora.
  const tiles = document.getElementById('fin-results');
  tiles.innerHTML = '';
  f.results.forEach((res, i) => {
    const tile = document.createElement('div');
    const done = res === true || res === false;
    tile.className = 'tile' + (done ? ' is-ok' : (i === f.boardIndex ? ' is-now' : ''));
    const n = document.createElement('span');
    n.className = 'n';
    n.textContent = String(i + 1);
    const st = document.createElement('span');
    st.className = 'st';
    st.textContent = res === true ? 'Presa' : res === false ? 'Persa' : (i === f.boardIndex ? 'In corso' : 'Attesa');
    tile.append(n, st);
    tiles.append(tile);
  });

  const given = document.getElementById('fin-given');
  given.innerHTML = '';
  (f.given || []).forEach(L => given.append(keyTile(L)));
  const picks = document.getElementById('fin-picks');
  picks.innerHTML = '';
  (f.picks || []).forEach(p => picks.append(keyTile(p.letter, p.present ? 'is-pick' : 'is-miss')));

  const live = document.getElementById('fin-state');
  live.hidden = !FINAL_STATE_LABEL[f.state];
  live.querySelector('.tx').textContent = FINAL_STATE_LABEL[f.state] || '';

  AdminShell.renderActions(document.getElementById('final-actions'), {
    hint: f.buzzed ? 'In ogni caso si passa al tabellone dopo' : 'Aspetta che si prenoti',
    buttons: [
      { id: 'btn-final-correct', label: 'Indovinata', tone: 'accent', disabled: !f.buzzed },
      { id: 'btn-final-wrong', label: 'Sbagliata', tone: 'plain', disabled: !f.buzzed }
    ]
  });
  document.getElementById('btn-final-correct').addEventListener('click', () => socket.emit('admin:finalCorrect'));
  document.getElementById('btn-final-wrong').addEventListener('click', () => socket.emit('admin:finalWrong'));
}

function renderAdminEnvelopes(view) {
  AdminShell.renderTopBar(document.getElementById('env-topbar'), {
    title: 'LE BUSTE', phase: 'Fase 06'
  });
  const el = document.getElementById('admin-envelopes-list');
  el.innerHTML = '';
  if (!view) return;

  // Gli esiti del gioco finale decidono quante buste sono verdi: la riga di
  // pip lo mostra, e la frase sotto lo dice a parole per chi non la conosce.
  const pips = document.getElementById('env-pips');
  pips.innerHTML = '';
  const verdi = view.envelopes.filter(e => e.color === 'green').length;
  view.envelopes.forEach((e) => {
    const i = document.createElement('i');
    i.className = e.color === 'green' ? 'is-ok' : 'is-ko';
    pips.append(i);
  });
  document.getElementById('env-recap').textContent = verdi === 0
    ? 'Nessuna verde: niente da scegliere.'
    : verdi === 1
      ? 'Una verde sola: si apre quella, senza cambi.'
      : `${verdi === 2 ? 'Due' : 'Tre'} verdi: il finalista sceglie e ha ${view.changesLeft} cambio.`;
  document.getElementById('env-changes').textContent = String(view.changesLeft);

  view.envelopes.forEach((e, i) => {
    const row = document.createElement('div');
    const aperta = e.revealed;
    const scelta = i === view.current;
    row.className = 'env-row'
      + (aperta && scelta ? ' is-open' : '')
      + (!aperta && e.color === 'red' ? ' is-red' : '')
      + (!aperta && e.color === 'green' ? ' is-green' : '')
      + (e.abandoned ? ' is-gone' : '');

    const n = document.createElement('span');
    n.className = 'n';
    n.textContent = String(i + 1);

    const tx = document.createElement('div');
    tx.className = 'tx';
    const t = document.createElement('span');
    t.className = 't';
    t.textContent = aperta ? (e.content || '—') : 'Nascosta';
    const s = document.createElement('span');
    s.className = 's';
    s.textContent = e.abandoned ? 'Scartata'
      : aperta ? (scelta ? 'Aperta dal finalista' : 'Rivelata')
        : e.color === 'red' ? 'Rossa — la riveli tu'
          : 'Verde — scambiabile';
    tx.append(t, s);
    row.append(n, tx);

    if (!aperta && e.color === 'red') {
      const btn = document.createElement('button');
      btn.className = 'env-reveal';
      btn.textContent = 'Rivela';
      btn.addEventListener('click', () => socket.emit('admin:envelopeRevealRed', { index: i }));
      row.append(btn);
    }
    el.append(row);
  });
}

function showTripleteError(msg) {
  const why = document.getElementById('tr-why');
  if (!why) return;
  why.textContent = msg;
  why.hidden = !msg;
}

function renderGiramoe(gr) {
  const setup = document.getElementById('giramoe-setup');
  const live = document.getElementById('giramoe-live');
  const bar = document.getElementById('giramoe-actions');
  const started = !!(gr && gr.started);

  AdminShell.renderTopBar(document.getElementById('gi-topbar'), {
    title: 'GIRAMOE', phase: 'Fase 04 · tabellone finale', tone: 'accent'
  });
  // La scheda del tabellone resta a schermo anche dopo l'avvio, ma spenta:
  // quando deve giudicare "ha detto la frase" l'host la rilegge da qui, ed è
  // l'unico posto dove sta scritta. Nasconderla lo costringerebbe a ricordarla.
  live.classList.toggle('hidden', !started);
  setup.querySelectorAll('.afield').forEach(f => { f.disabled = started; });
  if (started) {
    // Dopo un refresh i campi sono vuoti ma la partita no: si ripescano dal
    // payload, o l'host resta senza la frase da giudicare.
    document.getElementById('gi-cat').value = gr.category || '';
    document.getElementById('gi-phrase').value = gr.phrase || '';
  }
  document.getElementById('btn-giramoe-setboard').hidden = started;
  setup.querySelector('.alab').textContent = started ? 'Tabellone finale · in gioco' : 'Tabellone finale';
  if (started) fillCheck(document.getElementById('giramoe-error'), '');

  if (!started) { bar.innerHTML = ''; bar.hidden = true; return; }

  // Il giro è uno solo per tutta la fase: a giro fatto il bottone sparisce,
  // resta il valore. Lasciarlo lì spento inviterebbe a premerlo di nuovo.
  document.getElementById('gi-mult').textContent = gr.multiplier ? '×' + AdminShell.num(gr.multiplier) : '—';
  const spin = document.getElementById('btn-giramoe-spin');
  spin.hidden = gr.state !== 'AWAIT_SPIN';
  document.getElementById('gi-spin-note').textContent = gr.state === 'AWAIT_SPIN'
    ? 'Un solo giro, poi vale per tutti'
    : 'Vale per tutti fino alla fine del tabellone';

  document.getElementById('gi-turn-name').textContent = gr.currentName || '—';
  const tag = document.getElementById('gi-turn-tag');
  const buzzed = gr.buzzedBy != null;
  tag.textContent = buzzed ? 'Ha risposto' : '5s per prenotarsi';
  tag.hidden = gr.state !== 'PLAYING' && !buzzed;

  const list = document.getElementById('giramoe-scores');
  list.innerHTML = '';
  gr.players.forEach((p, i) => {
    const move = document.createElement('span');
    move.className = 'ar-move';
    if (p.lastLetter) {
      const b = document.createElement('b');
      b.textContent = AdminShell.num(p.points);
      move.append(`${p.lastLetter} ×${p.lastCount} · `, b);
    } else {
      move.textContent = 'non ha ancora chiamato';
    }
    const isTurn = i === gr.currentTurn;
    list.append(AdminShell.playerRow({
      name: p.name, right: move, tone: (p.id === gr.buzzedBy || isTurn) ? 'accent' : null
    }));
  });

  AdminShell.renderActions(bar, {
    hint: buzzed ? 'Solo chi indovina incassa' : 'Aspetta che qualcuno si prenoti',
    buttons: [
      { id: 'btn-giramoe-correct', label: 'Indovinata', tone: 'accent', disabled: !buzzed },
      { id: 'btn-giramoe-wrong', label: 'Sbagliata', tone: 'plain', disabled: !buzzed }
    ]
  });
  document.getElementById('btn-giramoe-correct').addEventListener('click', () => socket.emit('admin:giramoeCorrect'));
  document.getElementById('btn-giramoe-wrong').addEventListener('click', () => socket.emit('admin:giramoeWrong'));
}

function renderTriplete(tr) {
  const setup = document.getElementById('triplete-setup');
  const live = document.getElementById('triplete-live');
  const bar = document.getElementById('triplete-actions');
  const started = !!(tr && tr.started);

  setup.classList.toggle('hidden', started);
  live.classList.toggle('hidden', !started);

  AdminShell.renderTopBar(document.getElementById('tr-topbar'), {
    title: 'IL TRIPLETE',
    phase: started ? `${pad2(tr.boardNumber)}/${pad2(tr.totalBoards)}` : 'Fase 02 · setup',
    pips: started ? { done: tr.boardNumber, total: tr.totalBoards } : null
  });

  if (!started) {
    AdminShell.renderActions(bar, {
      buttons: [{ id: 'btn-triplete-start', label: 'Avvia il Triplete', tone: 'solid' }]
    });
    const why = document.createElement('span');
    why.className = 'ad-why';
    why.id = 'tr-why';
    bar.append(why);
    document.getElementById('btn-triplete-start').addEventListener('click', () => {
      const { title, phrases } = tripleteFields();
      if (!title || phrases.some(p => !p)) return;
      socket.emit('admin:tripleteStart', { title, phrases });
    });
    refreshTripleteSetup();
    return;
  }

  const chi = tr.buzzedBy != null ? tr.players.find(p => p.id === tr.buzzedBy) : null;
  const alert = document.getElementById('tr-alert');
  alert.classList.toggle('is-idle', !chi);
  document.getElementById('tr-alert-t').textContent =
    chi ? `${chi.name} si è prenotato` : 'Rivelazione in corso';
  document.getElementById('tr-alert-s').textContent = chi
    ? 'rivelazione in pausa'
    : (tr.boardNumber === 3 ? 'lettere che lampeggiano' : 'caselle a caso ogni 1,5s');

  const list = document.getElementById('triplete-scores');
  list.innerHTML = '';
  tr.players.forEach((p) => {
    const pts = document.createElement('span');
    pts.className = 'ar-pts';
    pts.textContent = AdminShell.num(p.points);
    const row = AdminShell.playerRow({ name: p.name });
    if (p.locked) {
      const tag = document.createElement('span');
      tag.className = 'ar-locked';
      tag.textContent = 'Bloccata';
      row.append(tag);
      row.classList.add('is-locked');
    }
    row.append(pts);
    if (p.buzzed) row.classList.add('is-buzzed');
    list.append(row);
  });

  AdminShell.renderActions(bar, {
    hint: chi ? `${chi.name} ha detto la frase` : 'Aspetta che qualcuno si prenoti',
    buttons: [
      { id: 'btn-triplete-correct', label: 'Indovinata', tone: 'accent', disabled: !chi },
      { id: 'btn-triplete-wrong', label: 'Sbagliata', tone: 'plain', disabled: !chi }
    ]
  });
  document.getElementById('btn-triplete-correct').addEventListener('click', () => socket.emit('admin:tripleteCorrect'));
  document.getElementById('btn-triplete-wrong').addEventListener('click', () => socket.emit('admin:tripleteWrong'));
}
