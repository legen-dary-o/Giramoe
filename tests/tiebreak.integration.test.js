// Lo spareggio non aveva nessun test: è la fase più difficile da far succedere
// (serve un pareggio esatto in banca) ed è anche l'unica in cui il telefono
// deve mostrare una ruota. Qui il pareggio si costruisce apposta — P1 vince due
// tabelloni del Triplete, P2 uno e poi il Giramoe per esattamente 1000 — così
// la fase parte in modo deterministico.
//
// Il test si ferma al primo giro: risolvere lo spareggio con lo spicchio
// forzato non si può (tutti uscirebbero uguali e si ripartirebbe all'infinito),
// e quello che va verificato è il payload, non chi vince.
process.env.PORT = process.env.PORT || '0';
process.env.HOST = '127.0.0.1';
process.env.TRIPLETE_GAP_MS = '300';
process.env.GIRAMOE_FORCE_SEGMENT = '6'; // GIRAMOE_SEGMENTS[6] = 250

const { test } = require('node:test');
const assert = require('node:assert');
const { io } = require('socket.io-client');
const { server, io: ioServer } = require('../server');

const wait = (ms) => new Promise(r => setTimeout(r, ms));
const listening = () => new Promise(r => (server.listening ? r() : server.once('listening', r)));

test('spareggio: il telefono riceve ruota, contendenti e il giro',
  { timeout: 60000 }, async () => {
  await listening();
  const BASE = `http://127.0.0.1:${server.address().port}`;
  const connect = () => io(BASE, { transports: ['websocket'], forceNew: true });

  const admin = connect(), main = connect();
  let adminState = null;
  admin.on('admin:state', s => { adminState = s; });

  const players = [];
  const tb = [null, null, null];        // ultimo player:tiebreakState per giocatore
  const spins = [null, null, null];     // ultimo player:tiebreakSpinResult
  try {
    admin.emit('admin:init'); main.emit('main:init');
    await wait(150);
    admin.emit('admin:inizia');
    await wait(150);
    const roomCode = adminState.roomCode;

    for (let i = 0; i < 3; i++) {
      const p = connect(); players.push(p);
      p.on('player:tiebreakState', (st) => { tb[i] = st; });
      p.on('player:tiebreakSpinResult', (d) => { spins[i] = d; });
      await wait(60);
      p.emit('player:join', { roomCode, name: 'P' + (i + 1) });
      await wait(100);
    }
    admin.emit('admin:startGame');
    await wait(150);

    // Round 1: tre tabelloni risolti dall'admin, nessuno segna (banche a 0).
    for (let b = 0; b < 3; b++) {
      admin.emit('admin:setBoard', { category: 'X', phrase: 'OK' });
      await wait(100);
      admin.emit('admin:solve');
      await wait(150);
    }

    // Triplete: P1 prende i primi due tabelloni (2000), P2 il terzo (1000).
    admin.emit('admin:startTriplete');
    await wait(150);
    admin.emit('admin:tripleteStart', { title: 'T', phrases: ['UNO', 'DUE', 'TRE'] });
    await wait(400);
    for (const who of [0, 0, 1]) {
      players[who].emit('player:tripleteBuzz');
      await wait(150);
      admin.emit('admin:tripleteCorrect');
      await wait(550);
    }
    const dopoTriplete = Object.fromEntries(adminState.players.map(p => [p.name, p.bank]));
    assert.strictEqual(dopoTriplete.P1, 2000, 'P1 due tabelloni');
    assert.strictEqual(dopoTriplete.P2, 1000, 'P2 uno solo, niente bonus da 5000');

    // Express: tre tabelloni risolti dall'admin, banche invariate.
    for (let b = 0; b < 3; b++) {
      admin.emit('admin:setBoard', { category: 'X', phrase: 'OK' });
      await wait(100);
      admin.emit('admin:solve');
      await wait(150);
    }

    // Giramoe: moltiplicatore 250, la frase ha quattro C — P2 chiama C, fa 1000
    // e risolvendo li incassa. 1000 + 1000 = i 2000 di P1: pareggio.
    assert.strictEqual(adminState.phase, 'giramoe');
    admin.emit('admin:giramoeSetBoard', { category: 'X', phrase: 'CCCC' });
    await wait(200);
    admin.emit('admin:giramoeSpin');
    await wait(300);
    assert.strictEqual(adminState.giramoe.multiplier, 250);
    // Il turno parte da P1: passa senza chiamare per lasciare la mano a P2.
    players[0].emit('player:giramoeLetter', { letter: 'B' });
    await wait(200);
    players[0].emit('player:giramoeBuzz');
    await wait(150);
    admin.emit('admin:giramoeWrong');
    await wait(200);
    assert.strictEqual(adminState.giramoe.currentTurn, 1, 'tocca a P2');

    players[1].emit('player:giramoeLetter', { letter: 'C' });
    await wait(200);
    assert.strictEqual(adminState.giramoe.players[1].points, 1000, 'C vale 250 x 4');
    players[1].emit('player:giramoeBuzz');
    await wait(150);
    admin.emit('admin:giramoeCorrect');
    await wait(200);

    const banche = Object.fromEntries(adminState.players.map(p => [p.name, p.bank]));
    assert.strictEqual(banche.P1, 2000);
    assert.strictEqual(banche.P2, 2000, 'pareggio in banca fra P1 e P2');

    // --- SPAREGGIO ---
    await wait(2900);
    assert.strictEqual(adminState.phase, 'tiebreak', 'due pari in cima: si va allo spareggio');

    // Il telefono di un contendente deve poter disegnare la ruota e sapere
    // quale valore deve battere: prima riceveva solo un messaggio e un bottone.
    assert.ok(tb[0], 'P1 ha ricevuto lo stato dello spareggio');
    assert.strictEqual(tb[0].isContender, true);
    assert.strictEqual(tb[0].segments.length, 16, 'la ruota arriva al telefono');
    assert.ok(tb[0].segments.every(v => typeof v === 'number'), 'nello spareggio sono tutti numeri');
    assert.strictEqual(tb[0].contenders.length, 2, 'due contendenti');
    assert.deepStrictEqual(tb[0].contenders.map(c => c.name), ['P1', 'P2']);
    assert.ok(tb[0].contenders.every(c => c.value === null), 'nessuno ha ancora girato');
    assert.strictEqual(tb[2].isContender, false, 'P3 guarda e basta');
    assert.strictEqual(tb[2].segments.length, 16, 'la ruota arriva anche a chi guarda');

    // Il giro: senza questo evento sul telefono il valore comparirebbe dal nulla.
    players[0].emit('player:tiebreakSpin');
    await wait(300);
    assert.ok(spins[0], 'il contendente vede girare la ruota');
    assert.strictEqual(spins[0].winningSegment, 6, 'lo spicchio è quello forzato');
    assert.ok(spins[0].spins >= 5, 'e quanti giri fare');
    assert.ok(spins[2], 'la vede anche chi non è in gara');
  } finally {
    [admin, main, ...players].forEach(s => s.close());
    await new Promise(r => ioServer.close(r));
  }
});
