// Socket finta per lo sviluppo delle schermate: stessa API di socket.io
// (`on`, `emit`, `id`, `connected`), ma invece di parlare col server rigioca i
// payload di fixtures.js. Non duplica il rendering: chiama gli handler veri, gli
// stessi che riceverebbero i dati dalla partita. Se una schermata viene giusta
// col fixture, viene giusta col payload reale.
//
// Uso: index.html?mock=1c · play.html?mock=1e · admin.html?mock=1v
//      &freeze=<stato> tiene fermo uno stato transitorio (vedi fixtures.js)
//      &step=<ms> mette una pausa fra i passi del replay

class MockSocket {
  constructor() {
    this.id = 'mock-socket';
    this.connected = true;
    this._handlers = new Map();
  }
  on(event, fn) {
    if (!this._handlers.has(event)) this._handlers.set(event, []);
    this._handlers.get(event).push(fn);
    return this;
  }
  off(event, fn) {
    const list = this._handlers.get(event);
    if (list) this._handlers.set(event, list.filter(f => f !== fn));
    return this;
  }
  // il client emette verso il server: in mock non c'è nessuno che ascolti
  emit(event, ...args) {
    console.debug('[mock] emit ignorato:', event, ...args);
    return this;
  }
  // consegna un payload agli handler registrati, come farebbe il server
  deliver(event, payload) {
    const list = this._handlers.get(event) || [];
    if (!list.length) console.warn('[mock] nessun handler per', event);
    list.forEach(fn => fn(payload));
  }
}

// Rigioca una sequenza [event, payload][] con una pausa fra i passi, così le
// animazioni di ingresso partono come in partita.
async function replay(socket, steps, stepMs) {
  for (const [event, payload] of steps) {
    socket.deliver(event, payload);
    if (stepMs) await new Promise(r => setTimeout(r, stepMs));
  }
}

// `autoStart: true` (default) fa partire il replay al tick successivo: va bene
// per una superficie che è già un modulo e registra i suoi handler in modo
// sincrono subito dopo aver creato la socket (main.js). Le superfici i cui script
// vengono INIETTATI dopo (play.html, admin.html) devono passare `autoStart: false`
// e chiamare `socket.start()` quando gli script sono caricati: un setTimeout(0)
// scatterebbe prima che la rete abbia consegnato lo script, e il replay finirebbe
// su una socket senza nessun handler registrato.
export async function installMock(surface, { autoStart = true } = {}) {
  const params = new URLSearchParams(location.search);
  const screen = params.get('mock');
  if (!screen) return null;

  const socket = new MockSocket();
  window.__mockSocket = socket;

  // impronta dei valori calcolati, per verificare i refactor di CSS
  await import('./stylesnap.js');

  const { sequenceFor } = await import('./fixtures.mjs');
  const steps = sequenceFor(surface, screen, params.get('freeze'));
  if (!steps) {
    console.error(`[mock] nessun fixture per ${surface}/${screen}`);
    socket.start = () => {};
    return socket;
  }

  let started = false;
  socket.start = async () => {
    if (started) return;
    started = true;
    socket.deliver('connect');
    await replay(socket, steps, Number(params.get('step')) || 0);
    // Le scene di round coprono lo schermo per 5-6s: in mock si saltano, così la
    // schermata è subito confrontabile col render. `&scenes=1` le lascia partire.
    if (!params.has('scenes') && window.__scenes) window.__scenes.skip();

    // La TV resta sull'intro finché qualcuno non tocca: è un gate vero, non un
    // dettaglio. Le fasi di gioco lo scavalcano da sole (chi ricarica a partita
    // in corso non deve ritoccare), la lobby no. Qui il tocco lo dà l'harness,
    // passando dal bottone come farebbe una persona.
    const tap = document.getElementById('tap-start-btn');
    if (tap && !document.getElementById('start-tap-screen').classList.contains('hidden')) {
      tap.click();
      await new Promise(r => setTimeout(r, 3200)); // l'intro dura 3s
    }
    console.info(`[mock] ${surface}/${screen} pronto`, steps.length, 'passi');
  };

  if (autoStart) setTimeout(socket.start, 0);
  return socket;
}
