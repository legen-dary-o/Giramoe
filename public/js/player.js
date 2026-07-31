// In sviluppo `?mock=<id>` sostituisce la socket (vedi public/js/dev/mock.js).
// Qui lo script è classico: la finta viene installata prima, dal modulo nel
// <script type="module"> di play.html.
const socket = window.__mockSocket || io();
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

// La cornice comune del telefono: caricata come modulo da play.html e appesa a
// window, perché questo file è uno script classico (vedi js/phone/shell.js).
const PhoneShell = window.PhoneShell;

// Le lettere sparate nella raffica in corso. Le tiene il telefono: per il
// server l'express è un turno normale con un moltiplicatore diverso, e nessun
// payload le porta indietro.
const raffica = [];

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
  // La pelle express vive sul body (ci sta anche Samiro) e la spegne solo un
  // player:turnState: uscendo dal gioco quello non arriva più, e il magenta
  // resterebbe addosso al Triplete.
  if (id !== 'player-game-screen') document.body.classList.remove('is-express');
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
  document.getElementById('rc-avatar').textContent = myName.charAt(0).toUpperCase();
  showScreen('reconnect-screen');
}

// Il riaggancio va rifatto a OGNI connessione, non solo al caricamento della
// pagina. Quando la socket cade (schermo bloccato, cambio app, rete) socket.io
// torna su con una socket nuova che per il server è un anonimo senza
// playerIndex: i tasti restano accesi ma ogni tocco viene ignorato, e sembra che
// il telefono si sia impallato finché non si ricarica la pagina.
let silentResync = false;
let attached = false; // il server sa chi siamo su QUESTA socket

function reattach() {
  const saved = loadSession();
  if (!saved) return;
  myName = saved.name;
  // già in partita: riaggancio invisibile, senza passare dalla schermata d'attesa
  if (myIndex >= 0) silentResync = true;
  socket.emit('player:reconnect', { roomCode, name: saved.name });
}

socket.on('connect', reattach);
socket.on('disconnect', () => { attached = false; });

// Il telefono torna in mano: ci riagganciamo solo se serve davvero. Un
// player:reconnect a vuoto farebbe ripartire i timer di round lato server.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (!socket.connected) socket.connect();
  else if (!attached) reattach();
});

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

// --- Lobby: quanti posti restano e chi è già dentro ---
// Arriva anche a chi non è ancora entrato: è l'unico modo perché la schermata
// d'ingresso sappia quanti posti mancano.
let lobbyView = { players: [], max: 3 };
socket.on('player:lobby', (v) => { lobbyView = v; renderLobby(); });

function renderLobby() {
  const n = lobbyView.players.length;
  const max = lobbyView.max || 3;
  const seats = document.getElementById('join-seats');
  if (seats) {
    // Chi legge sta per entrare: il posto che prenderebbe è il prossimo.
    seats.textContent = n >= max
      ? `Lobby piena — ${max} di ${max}`
      : `Posto ${n + 1} di ${max} · servono ${max} giocatori`;
  }

  const list = document.getElementById('wait-list');
  if (!list) return;
  list.innerHTML = '';
  for (let i = 0; i < max; i++) {
    const p = lobbyView.players[i];
    const row = document.createElement('div');
    row.className = 'wrow ' + (p ? 'is-in' : 'is-free');
    const dot = document.createElement('span');
    dot.className = 'dot';
    const nome = document.createElement('span');
    nome.className = 'nome';
    nome.textContent = p ? p.name : 'In attesa…';
    row.append(dot, nome);
    if (p && p.name === myName) {
      const tu = document.createElement('span');
      tu.className = 'tu';
      tu.textContent = 'TU';
      row.append(tu);
    }
    list.append(row);
  }
}
renderLobby();

// --- Connection events ---
socket.on('player:joined', ({ playerIndex, name }) => {
  myIndex = playerIndex; myName = name;
  attached = true;
  reconnecting = false;
  saveSession(name);
  renderLobby();
  showScreen('wait-screen');
});

socket.on('player:error', msg => {
  // Riaggancio silenzioso fallito: siamo già in partita e visibilmente a posto,
  // non ha senso sparare un alert in faccia al giocatore.
  if (silentResync) { silentResync = false; return; }
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
  initWheel();
  buildKeyboard();
});

// Express round: back to the wheel game screen (board/keyboard already built).
socket.on('player:expressRound', () => {
  showScreen('player-game-screen');
});

socket.on('player:reconnected', ({ playerIndex, name, phase }) => {
  const wasSilent = silentResync;
  silentResync = false;
  myIndex = playerIndex; myName = name;
  attached = true;
  reconnecting = false;
  saveSession(name);
  // Riaggancio a partita in corso: il server manda subito dopo l'evento di fase
  // giusto, qui non tocchiamo la schermata per non far sfarfallare il telefono.
  if (wasSilent) return;
  if (phase === 'playing' || phase === 'express') {
    showScreen('player-game-screen');
    initWheel();
    buildKeyboard();
  } else {
    showScreen('wait-screen');
  }
});

socket.on('player:spinResult', ({ winningSegment, spins }) => {
  if (playerWheel) playerWheel.spinTo(winningSegment, spins, 6000);
});

// Gli spicchi della ruota: ridisegnare la faccia costa qualche migliaio di
// punti, quindi si rifà solo quando cambiano davvero (una volta per round).
let lastSegments = [];
function setWheelSegments(segments) {
  if (!segments) return;
  const key = segments.join('|');
  if (key === lastSegments.join('|')) return;
  lastSegments = segments.slice();
  if (playerWheel) playerWheel.setLabels(lastSegments);
}

socket.on('player:turnState', (st) => {
  setWheelSegments(st.segments);
  applyTurnState(st);
});

// --- Triplete ---
socket.on('player:tripleteIntro', () => showScreen('player-triplete-screen'));

socket.on('player:tripleteState', (st) => applyTripleteState(st));

document.getElementById('btn-buzz').addEventListener('click', () => socket.emit('player:tripleteBuzz'));

function applyTripleteState(st) {
  PhoneShell.renderTopBar(document.getElementById('tr-topbar'), {
    name: myName,
    phase: `Il Triplete · ${pad2(st.boardNumber)}/${pad2(st.totalBoards)}`
  });

  // Da bloccato le schede e i pip non servono: il turno è finito comunque, e
  // al loro posto va la lista di chi è ancora in gioco.
  const stats = document.getElementById('tr-stats');
  stats.hidden = st.locked;
  if (!st.locked) {
    PhoneShell.renderStats(stats, [
      { lab: 'Triplete', value: st.points, tone: st.buzzedByMe ? 'accent' : null },
      { lab: 'Banca', value: st.bank }
    ]);
  }

  PhoneShell.renderBanner(document.getElementById('tr-banner'), st.locked
    ? { text: 'Frase sbagliata — sei bloccato', tone: 'negative' }
    : st.buzzedByMe ? { text: st.message, tone: 'accent' } : {});

  const say = document.getElementById('tr-say');
  say.hidden = st.buzzedByMe;
  say.textContent = st.locked
    ? 'Torni in gioco quando anche gli altri hanno sbagliato'
    : 'Appena sai la frase, prenotati e dilla a voce';

  const btn = document.getElementById('btn-buzz');
  btn.disabled = !st.canBuzz;
  btn.classList.toggle('buzzed', st.buzzedByMe);
  document.getElementById('bz-sub').textContent = st.locked ? 'Non disponibile'
    : st.buzzedByMe ? 'Dilla a voce' : 'Tieni premuto per sicurezza';

  const pips = document.getElementById('tr-pips');
  pips.hidden = st.locked;
  pips.innerHTML = '';
  for (let i = 1; i <= st.totalBoards; i++) {
    const pip = document.createElement('i');
    if (i <= st.boardNumber) pip.className = 'is-done';
    pips.append(pip);
  }
  document.getElementById('tr-note').hidden = st.locked;

  const list = document.getElementById('tr-list');
  list.hidden = !st.locked;
  list.innerHTML = '';
  (st.players || []).forEach(p => {
    list.append(playerRow(p.name, p.locked ? 'Bloccato' : 'In gioco', p.locked));
  });
}

// Riga nome + badge: la usano il Triplete bloccato e lo spareggio.
function playerRow(name, badge, out) {
  const row = document.createElement('div');
  row.className = 'prow' + (out ? ' is-out' : '');
  const n = document.createElement('span');
  n.className = 'nome';
  n.textContent = name;
  const b = document.createElement('span');
  b.className = 'badge';
  b.textContent = badge;
  row.append(n, b);
  return row;
}

// --- Giramoe (final wheel board) ---
let giKbBuilt = false;
socket.on('player:giramoeIntro', () => {
  showScreen('player-giramoe-screen');
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

  const vp = document.getElementById('gi-vowel-picker');
  vp.innerHTML = '';
  VOWELS.forEach(letter => {
    const b = document.createElement('button');
    b.className = 'key vowel';
    b.textContent = letter;
    b.dataset.letter = letter;
    b.addEventListener('click', () => {
      socket.emit('player:giramoeVowel', { letter });
      vp.classList.add('hidden');
    });
    vp.appendChild(b);
  });

  document.getElementById('btn-gi-vowel').addEventListener('click', () => {
    const card = document.getElementById('gi-vowel-card');
    card.classList.toggle('hidden');
    // Sui telefoni bassi il picker sta sotto la piega: portalo in vista.
    if (!card.classList.contains('hidden')) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}

function applyGiramoeState(st) {
  PhoneShell.renderTopBar(document.getElementById('gi-topbar'), {
    name: myName, phase: 'Giramoe', tone: 'accent'
  });
  PhoneShell.renderStats(document.getElementById('gi-stats'), [
    { lab: 'Moltiplicatore', value: st.multiplier ? '×' + PhoneShell.num(st.multiplier) : '×—', tone: 'accent' },
    { lab: 'Tuoi punti', value: st.points }
  ]);
  PhoneShell.renderBanner(document.getElementById('gi-banner'), {
    text: st.canCall ? 'Una sola consonante' : st.message,
    tone: st.isMyTurn ? 'accent' : null
  });

  const kb = document.getElementById('gi-keyboard');
  kb.classList.toggle('disabled', !st.canCall);
  document.querySelectorAll('#gi-keyboard .key').forEach(b => {
    b.disabled = !st.canCall || st.usedLetters.includes(b.dataset.letter);
  });
  // Nel Giramoe la vocale è una mossa alternativa alla consonante, non un extra
  // sempre disponibile: quando non si può comprare il bottone sparisce invece di
  // restare lì spento a occupare il posto del conto alla rovescia.
  const vowelBtn = document.getElementById('btn-gi-vowel');
  vowelBtn.hidden = !st.canBuyVowel;
  vowelBtn.disabled = !st.canBuyVowel;
  vowelBtn.classList.toggle('is-ghost', !st.canBuyVowel);
  vowelBtn.classList.toggle('is-secondary', st.canBuyVowel);
  if (!st.canBuyVowel) document.getElementById('gi-vowel-card').classList.add('hidden');
  document.querySelectorAll('#gi-vowel-picker .key').forEach(b => {
    b.disabled = st.usedLetters.includes(b.dataset.letter);
  });

  const buzz = document.getElementById('btn-gi-buzz');
  buzz.disabled = !st.canBuzz;
  buzz.classList.toggle('is-ghost', !st.canBuzz);
  startGiramoeClock(st.canBuzz ? st.windowMs : 0, st.windowTotal);
}

// L'anello dei 5 secondi. Il server manda quanto resta (anche a chi si
// riaggancia a finestra aperta), il telefono scala da solo: un evento al
// decimo di secondo per tre telefoni sarebbe traffico per niente.
let giClockTimer = null;
function startGiramoeClock(ms, total) {
  clearInterval(giClockTimer);
  const box = document.getElementById('gi-clock');
  if (!ms || !total) { box.hidden = true; return; }
  box.hidden = false;
  const until = Date.now() + ms;
  const ring = document.getElementById('gi-ring');
  const n = document.getElementById('gi-ring-n');
  const tick = () => {
    const left = Math.max(0, until - Date.now());
    ring.style.setProperty('--deg', (left / total) * 360 + 'deg');
    n.textContent = Math.ceil(left / 1000);
    if (left <= 0) { clearInterval(giClockTimer); box.hidden = true; }
  };
  tick();
  giClockTimer = setInterval(tick, 100);
}

// --- Tie-break + finalist ---
document.getElementById('btn-tb-spin').addEventListener('click', (e) => {
  socket.emit('player:tiebreakSpin');
  // Il server ignora un secondo giro, ma il bottone deve dirlo subito: lo
  // stato nuovo arriva solo a fine animazione, sei secondi dopo.
  e.currentTarget.disabled = true;
  e.currentTarget.classList.add('is-ghost');
});

let tbWheel = null;
socket.on('player:tiebreakState', (st) => {
  showScreen('player-tiebreak-screen');
  if (!tbWheel) {
    tbWheel = new Wheel(document.getElementById('tb-wheel-canvas'),
      { segments: (st.segments || []).length || 16, labels: st.segments || [], showLabels: true });
    window.addEventListener('resize', () => tbWheel.resize());
  }

  const list = document.getElementById('tb-list');
  list.innerHTML = '';
  (st.contenders || []).forEach(c => {
    const row = document.createElement('div');
    row.className = 'prow';
    const n = document.createElement('span');
    n.className = 'nome';
    n.textContent = c.name;
    const v = document.createElement('span');
    v.className = 'valore' + (c.value == null ? ' is-empty' : '');
    v.textContent = c.value == null ? '—' : PhoneShell.num(c.value);
    row.append(n, v);
    list.append(row);
  });

  const btn = document.getElementById('btn-tb-spin');
  btn.disabled = !st.canSpin;
  btn.classList.toggle('is-ghost', !st.canSpin);
});

socket.on('player:tiebreakSpinResult', ({ winningSegment, spins }) => {
  if (tbWheel) tbWheel.spinTo(winningSegment, spins, 6000);
});

socket.on('player:finalist', ({ name, isMe, bank, myBank }) => {
  showScreen('player-finalist-screen');
  document.getElementById('fin-win').hidden = !isMe;
  document.getElementById('fin-lose').hidden = isMe;
  if (isMe) {
    document.getElementById('fin-bank').textContent = PhoneShell.num(bank || 0);
  } else {
    document.getElementById('fin-who').textContent = `Va ${name} al gioco finale`;
    document.getElementById('fin-mine').textContent =
      `Hai chiuso con ${PhoneShell.num(myBank || 0)} punti. Grazie per aver giocato!`;
  }
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

  PhoneShell.renderTopBar(document.getElementById('env-topbar'), { name: myName, phase: 'Le buste' });

  const open = view.envelopes[view.current];
  const isOpen = !!(open && open.revealed);
  const title = document.getElementById('env-title');
  const sub = document.getElementById('env-sub');
  if (!amFinalist) {
    title.textContent = 'Apertura buste';
    sub.textContent = 'Il finalista sta scegliendo. Guarda lo schermo grande.';
  } else if (view.state === 'NONE') {
    title.textContent = 'Nessuna busta verde';
    sub.textContent = 'Niente da aprire questa volta.';
  } else if (view.state === 'CHOOSING') {
    title.textContent = 'Scegli una busta';
    sub.textContent = 'Tocca una busta verde per aprirla.';
  } else if (envChangeArmed) {
    title.textContent = 'Su quale ti sposti?';
    sub.textContent = 'Tocca la busta verde che vuoi al posto di questa.';
  } else if (view.state === 'KEPT') {
    title.textContent = `È la tua busta`;
    sub.textContent = 'Non si cambia più.';
  } else {
    title.textContent = `Hai aperto la busta ${view.current + 1}`;
    sub.textContent = canChange
      ? `Puoi tenerla o cambiarla alla cieca. Hai ${view.changesLeft} ${view.changesLeft === 1 ? 'cambio' : 'cambi'}.`
      : 'Non ci sono altre buste su cui spostarsi.';
  }

  const card = document.getElementById('env-open');
  card.hidden = !isOpen;
  if (isOpen) {
    document.getElementById('env-open-lab').textContent = `Busta ${view.current + 1}`;
    document.getElementById('env-open-prize').textContent = open.content || '';
  }

  // Le buste ancora chiuse: riquadri col numero e lo stato, in fila.
  const others = document.getElementById('env-others');
  others.innerHTML = '';
  view.envelopes.forEach((e, i) => {
    if (isOpen && i === view.current) return;               // già nella scheda sopra
    if (view.state === 'KEPT') return;                      // scelta fatta, spariscono
    const canOpen = amFinalist && view.state === 'CHOOSING' && e.color === 'green' && !e.revealed;
    const canSwap = envChangeArmed && avail.includes(i);
    const swappable = canOpen || canSwap || (canChange && avail.includes(i));
    const box = document.createElement('div');
    box.className = 'env-box'
      + (swappable ? ' is-swap' : '')
      + (canOpen || canSwap ? ' is-pickable' : '')
      + (e.abandoned ? ' is-gone' : '');
    const n = document.createElement('span');
    n.className = 'n';
    n.textContent = String(i + 1);
    const st = document.createElement('span');
    st.className = 'st';
    st.textContent = e.abandoned ? 'Scartata' : canOpen ? 'Da aprire' : swappable ? 'Scambiabile' : 'Chiusa';
    box.append(n, st);
    if (canOpen) box.addEventListener('click', () => socket.emit('player:envelopeOpen', { index: i }));
    else if (canSwap) box.addEventListener('click', () => {
      envChangeArmed = false;
      socket.emit('player:envelopeChange', { index: i });
    });
    others.append(box);
  });

  // TIENI + CAMBIA compaiono insieme a busta aperta; armando CAMBIA spariscono
  // mentre il finalista tocca la verde su cui spostarsi.
  const keepBtn = document.getElementById('btn-env-keep');
  const changeBtn = document.getElementById('btn-env-change');
  const showButtons = amFinalist && view.state === 'OPENED' && !envChangeArmed;
  keepBtn.hidden = !showButtons;
  changeBtn.hidden = !(showButtons && canChange);
  document.getElementById('env-note').hidden = !(showButtons && canChange);
  // Con una sola alternativa l'etichetta dice già quale: non c'è niente da scegliere.
  changeBtn.textContent = avail.length === 1 ? `Cambia con la ${avail[0] + 1}` : 'Cambia';
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
  PhoneShell.renderTopBar(document.getElementById('fg-topbar'), {
    name: myName, phase: `Gioco finale · ${pad2(st.boardIndex + 1)}/${pad2(st.totalBoards)}`
  });

  const total = st.total || 60000;
  const left = st.timeLeft != null ? st.timeLeft : total;
  document.getElementById('fg-num').textContent = Math.ceil(left / 1000);
  document.getElementById('fg-bar-fill').style.width = (left / total) * 100 + '%';
  document.getElementById('fg-lab').textContent = st.state === 'PICKING'
    ? 'Il timer parte quando hai scelto' : 'Secondi rimasti';

  document.getElementById('fg-task-t').textContent = st.message;
  // I quadratini: tre consonanti più la vocale, staccata perché è un'altra scelta.
  const boxes = document.getElementById('fg-boxes');
  const picks = st.picks || { consonants: 0, maxConsonants: 3, vowel: false };
  boxes.innerHTML = '';
  boxes.hidden = st.state !== 'PICKING';
  for (let i = 0; i < picks.maxConsonants; i++) {
    const b = document.createElement('i');
    if (i < picks.consonants) b.className = 'is-done';
    boxes.append(b);
  }
  const v = document.createElement('i');
  v.className = 'is-vowel' + (picks.vowel ? ' is-done' : '');
  boxes.append(v);

  const mine = picks.letters || [];
  document.querySelectorAll('#final-keyboard .key').forEach(b => {
    b.disabled = !st.canPickConsonant || st.usedLetters.includes(b.dataset.letter);
    b.classList.toggle('is-picked', mine.includes(b.dataset.letter));
  });
  document.querySelectorAll('#final-vowels .key').forEach(b => {
    b.disabled = !st.canPickVowel || st.usedLetters.includes(b.dataset.letter);
    b.classList.toggle('is-picked', mine.includes(b.dataset.letter));
  });

  // Il primario spento dice sempre perché: qui aspetta che la scelta sia finita.
  const buzz = document.getElementById('btn-final-buzz');
  buzz.disabled = !st.canBuzz;
  buzz.classList.toggle('is-ghost', !st.canBuzz);
  const why = document.getElementById('fg-why');
  why.hidden = st.canBuzz;
  why.textContent = 'Prima scegli le lettere';
}

// --- Wheel + spin ---
function initWheel() {
  const canvas = document.getElementById('player-wheel-canvas');
  playerWheel = new Wheel(canvas, { segments: 16, labels: lastSegments, showLabels: true });
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
      pickLetter(b);
      if (expressMode) { raffica.push(letter); socket.emit('player:expressLetter', { letter }); }
      else socket.emit('player:pickConsonant', { letter });
      renderRaffica();
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
      pickLetter(b);
      if (expressMode) { raffica.push(letter); socket.emit('player:expressLetter', { letter }); }
      else socket.emit('player:buyVowel', { letter });
      renderRaffica();
      closeVowelCard();
    });
    vp.appendChild(b);
  });

  document.getElementById('btn-vowel').addEventListener('click', () => {
    const card = document.getElementById('vowel-card');
    card.classList.toggle('hidden');
    document.getElementById('pg-note').hidden = card.classList.contains('hidden');
    // On short phones the picker sits below the fold; pull it into view when opened.
    if (!card.classList.contains('hidden')) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}

function closeVowelCard() {
  document.getElementById('vowel-card').classList.add('hidden');
  document.getElementById('pg-note').hidden = true;
}

// Il tasto appena premuto resta acceso finché non arriva il turno nuovo: senza,
// il tocco non lascia traccia e in raffica si finisce per premere due volte.
function pickLetter(btn) {
  document.querySelectorAll('#keyboard .is-picked, #vowel-picker .is-picked')
    .forEach(b => b.classList.remove('is-picked'));
  btn.classList.add('is-picked');
}

function renderRaffica() {
  document.getElementById('pg-raffica-letters').textContent = raffica.join(' ');
}

function markUsedLetters(used) {
  document.querySelectorAll('#keyboard .key, #vowel-picker .key').forEach(b => {
    b.disabled = used.includes(b.dataset.letter);
    if (b.disabled) b.classList.remove('is-picked');
  });
}

// --- Turn state gating ---
const pad2 = (n) => String(n).padStart(2, '0');

const TURN_BANNER = {
  MUST_SPIN: 'Tocca a te — gira la ruota',
  PICK_CONSONANT: 'Scegli una consonante',
  PICK_CONSONANT_DOUBLE: 'Raddoppia! Scegli una consonante',
  CONTINUE: 'Rigira, compra vocale o risolvi a voce'
};

function applyTurnState(st) {
  const screen = document.getElementById('player-game-screen');
  const spinBtn = document.getElementById('btn-spin');
  const vowelBtn = document.getElementById('btn-vowel');
  const kb = document.getElementById('keyboard');
  const container = document.getElementById('player-wheel-container');
  const state = st.turnState;
  const express = state === 'EXPRESS';
  const mustConsonant = state === 'PICK_CONSONANT' || state === 'PICK_CONSONANT_DOUBLE';

  markUsedLetters(st.usedLetters);
  expressMode = st.isMyTurn && express;

  // La pelle magenta va su tutto il telefono, Samiro compreso.
  screen.classList.toggle('is-express', express);
  screen.classList.toggle('is-picking', st.isMyTurn && mustConsonant);
  document.body.classList.toggle('is-express', express);
  if (!express) raffica.length = 0;
  renderRaffica();

  PhoneShell.renderTopBar(document.getElementById('pg-topbar'), {
    name: myName,
    phase: express ? 'Express' : `Fase 01 · ${pad2(st.boardNumber)}/${pad2(st.totalBoards)}`,
    tone: express ? 'express' : null
  });

  // Seconda scheda: banca, oppure quanto vale la lettera che sto per chiamare.
  const second = express ? { lab: 'A lettera', value: st.expressValue }
    : (st.isMyTurn && mustConsonant && st.wedge) ? { lab: 'Spicchio', value: st.wedge }
      : { lab: 'Banca', value: st.bank };
  PhoneShell.renderStats(document.getElementById('pg-stats'), [
    { lab: 'Punti turno', value: st.roundPoints, tone: express ? 'express' : (st.isMyTurn ? 'accent' : null) },
    second
  ]);

  // In raffica il blocco d'avviso prende il posto del banner: la regola del
  // gioco è cambiata, e dirlo con un banner uguale agli altri non basta.
  const banner = document.getElementById('pg-banner');
  document.getElementById('pg-warn').hidden = !expressMode;
  document.getElementById('pg-raffica').hidden = !expressMode;
  PhoneShell.renderBanner(banner, expressMode ? {} : {
    text: st.isMyTurn ? (TURN_BANNER[state] || '') : `Turno di ${st.currentTurnName}`,
    tone: st.isMyTurn ? (express ? 'express' : 'accent') : null
  });

  if (!st.isMyTurn) {
    spinBtn.disabled = true;
    kb.classList.add('disabled');
    container.classList.add('disabled');
    setVowelButton(true);
    closeVowelCard();
    return;
  }

  container.classList.toggle('disabled', express);

  if (express) {
    // Raffica: niente ruota, tastiera sempre viva, vocali da 500 in su.
    spinBtn.disabled = true;
    kb.classList.remove('disabled');
    setVowelButton(st.roundPoints < 500);
    closeVowelCard();
    return;
  }

  spinBtn.disabled = !(state === 'MUST_SPIN' || state === 'CONTINUE');
  kb.classList.toggle('disabled', !mustConsonant);
  setVowelButton(!st.canBuyVowel);
  if (state !== 'CONTINUE') closeVowelCard();
}

// Ghost da spento, secondario da acceso: la differenza fra "non ora" e "puoi".
function setVowelButton(disabled) {
  const b = document.getElementById('btn-vowel');
  b.disabled = disabled;
  b.classList.toggle('is-ghost', disabled);
  b.classList.toggle('is-secondary', !disabled);
}
