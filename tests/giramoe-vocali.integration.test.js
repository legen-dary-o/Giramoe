// End-to-end socket per l'acquisto vocali nel tabellone GIRAMOE. Server di
// loopback autonomo; gap del triplete accorciato e ruota forzata (seam da env)
// per un flusso deterministico.
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

test('giramoe: la vocale costa 500, apre la prenotazione e accende il banner',
  { timeout: 60000 }, async () => {
  await listening();
  const BASE = `http://127.0.0.1:${server.address().port}`;
  const connect = () => io(BASE, { transports: ['websocket'], forceNew: true });

  const admin = connect(), main = connect();
  let adminState = null;
  const m = { reveals: [], status: null, solved: null };
  admin.on('admin:state', s => { adminState = s; });
  main.on('main:revealLetter', d => { m.reveals.push(d); });
  main.on('main:boardStatus', d => { m.status = d; });
  main.on('main:giramoeSolved', d => { m.solved = d; });

  const players = [];
  try {
    admin.emit('admin:init'); main.emit('main:init');
    await wait(150);
    admin.emit('admin:inizia');
    await wait(150);
    const roomCode = adminState.roomCode;

    for (let i = 0; i < 3; i++) {
      const p = connect(); players.push(p);
      await wait(60);
      p.emit('player:join', { roomCode, name: 'P' + (i + 1) });
      await wait(100);
    }
    admin.emit('admin:startGame');
    await wait(150);

    // Round 1: 3 tabelloni risolti dall'admin.
    for (let b = 0; b < 3; b++) {
      admin.emit('admin:setBoard', { category: 'X', phrase: 'OK' });
      await wait(100);
      admin.emit('admin:solve');
      await wait(150);
    }
    // Triplete: P1 risolve tutti e tre (banca 5000).
    admin.emit('admin:startTriplete');
    await wait(150);
    admin.emit('admin:tripleteStart', { title: 'T', phrases: ['UNO', 'DUE', 'TRE'] });
    await wait(400);
    for (let b = 0; b < 3; b++) {
      players[0].emit('player:tripleteBuzz');
      await wait(150);
      admin.emit('admin:tripleteCorrect');
      await wait(550);
    }
    // Express: 3 tabelloni risolti dall'admin.
    for (let b = 0; b < 3; b++) {
      admin.emit('admin:setBoard', { category: 'X', phrase: 'OK' });
      await wait(100);
      admin.emit('admin:solve');
      await wait(150);
    }

    // --- GIRAMOE: "CECE CREME" -> consonanti C x3, R, M; unica vocale E x4 ---
    assert.strictEqual(adminState.phase, 'giramoe', 'siamo nel tabellone giramoe');
    admin.emit('admin:giramoeSetBoard', { category: 'CIBO', phrase: 'CECE CREME' });
    await wait(200);
    admin.emit('admin:giramoeSpin');
    await wait(300);
    assert.strictEqual(adminState.giramoe.multiplier, 250, 'moltiplicatore dallo spin');

    // P1 chiama C (3 occorrenze) -> 750.
    players[0].emit('player:giramoeLetter', { letter: 'C' });
    await wait(200);
    assert.strictEqual(adminState.giramoe.players[0].points, 750);

    // Ha già agito in questo turno: la vocale viene rifiutata, nessun addebito.
    players[0].emit('player:giramoeVowel', { letter: 'E' });
    await wait(150);
    assert.strictEqual(adminState.giramoe.players[0].points, 750, 'acquisto rifiutato dopo la consonante');

    // P1 si prenota e sbaglia -> tocca a P2.
    players[0].emit('player:giramoeBuzz');
    await wait(150);
    admin.emit('admin:giramoeWrong');
    await wait(150);
    assert.strictEqual(adminState.giramoe.currentTurn, 1);

    // P2 è a 0 punti: non può comprare. Poi brucia il turno con una consonante assente.
    players[1].emit('player:giramoeVowel', { letter: 'E' });
    await wait(150);
    assert.strictEqual(adminState.giramoe.players[1].points, 0, 'senza punti non si compra');
    assert.strictEqual(adminState.giramoe.currentTurn, 1, 'e il turno non passa');
    players[1].emit('player:giramoeLetter', { letter: 'Z' });
    await wait(150);
    assert.strictEqual(adminState.giramoe.currentTurn, 2, 'consonante assente: passa a P3');

    // P3 fa lo stesso -> torna a P1, che ha 750 punti e le consonanti R e M ancora libere.
    players[2].emit('player:giramoeLetter', { letter: 'Z' });
    await wait(150);
    assert.strictEqual(adminState.giramoe.currentTurn, 0, 'torna a P1');

    // Senza aver agito, P1 non si può prenotare: le consonanti non sono finite.
    players[0].emit('player:giramoeBuzz');
    await wait(150);
    assert.strictEqual(adminState.giramoe.buzzedBy, null, 'niente prenotazione senza una mossa');

    // P1 compra la E: -500, 4 occorrenze rivelate, vocali finite -> banner.
    const revealsBefore = m.reveals.length;
    players[0].emit('player:giramoeVowel', { letter: 'E' });
    await wait(200);
    assert.strictEqual(adminState.giramoe.players[0].points, 250, '750 - 500, la vocale non dà punti');
    assert.strictEqual(m.reveals.length, revealsBefore + 1, 'lettera rivelata sul tabellone');
    assert.strictEqual(m.reveals[m.reveals.length - 1].positions.length, 4, 'tutte e 4 le E');
    assert.ok(m.status && m.status.vowelsFinished, 'banner vocali finite acceso');

    // L'acquisto ha aperto la finestra: ora la prenotazione passa.
    players[0].emit('player:giramoeBuzz');
    await wait(150);
    assert.strictEqual(adminState.giramoe.buzzedBy, 0, 'prenotazione accettata dopo l\'acquisto');

    admin.emit('admin:giramoeCorrect');
    await wait(200);
    assert.ok(m.solved && m.solved.points === 250, 'P1 risolve con i punti rimasti');
    const byName = Object.fromEntries(adminState.players.map(p => [p.name, p.bank]));
    assert.strictEqual(byName.P1, 5250, '5000 dal triplete + 250 rimasti dopo la vocale');
    assert.strictEqual(byName.P2, 0);
    assert.strictEqual(byName.P3, 0);

    // Lascia scadere il passaggio automatico alla fase finalista prima di chiudere,
    // altrimenti il timer del server scatta a socket già chiuse.
    await wait(2900);
    assert.strictEqual(adminState.phase, 'finalist', 'dopo il giramoe si va al finalista');
  } finally {
    [admin, main, ...players].forEach(s => s.close());
    await new Promise(r => ioServer.close(r));
  }
});
