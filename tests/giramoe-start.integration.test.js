// End-to-end: il Giramoe lo apre chi esce dall'Express con la banca più alta,
// non chi è primo in lobby. Server di loopback autonomo, gap del triplete
// accorciato per un flusso veloce e deterministico.
process.env.PORT = process.env.PORT || '0';
process.env.HOST = '127.0.0.1';
process.env.TRIPLETE_GAP_MS = '300';

const { test } = require('node:test');
const assert = require('node:assert');
const { io } = require('socket.io-client');
const { server, io: ioServer } = require('../server');

const wait = (ms) => new Promise(r => setTimeout(r, ms));
const listening = () => new Promise(r => (server.listening ? r() : server.once('listening', r)));

test('giramoe: parte il giocatore con più punti in banca, non il primo della lobby',
  { timeout: 60000 }, async () => {
  await listening();
  const BASE = `http://127.0.0.1:${server.address().port}`;
  const connect = () => io(BASE, { transports: ['websocket'], forceNew: true });

  const admin = connect(), main = connect();
  let adminState = null;
  admin.on('admin:state', s => { adminState = s; });

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
    const giState = [];
    players.forEach((p, i) => p.on('player:giramoeState', st => { giState[i] = st; }));

    admin.emit('admin:startGame');
    await wait(150);

    // Round 1: tre tabelloni risolti dall'admin, banche a zero per tutti.
    for (let b = 0; b < 3; b++) {
      admin.emit('admin:setBoard', { category: 'X', phrase: 'OK' });
      await wait(100);
      admin.emit('admin:solve');
      await wait(150);
    }

    // Triplete: risolve tutto P2 (banca 5000) — P1 e P3 restano a zero.
    admin.emit('admin:startTriplete');
    await wait(150);
    admin.emit('admin:tripleteStart', { title: 'T', phrases: ['UNO', 'DUE', 'TRE'] });
    await wait(400);
    for (let b = 0; b < 3; b++) {
      players[1].emit('player:tripleteBuzz');
      await wait(150);
      admin.emit('admin:tripleteCorrect');
      await wait(550);
    }

    // Express: tre tabelloni risolti dall'admin, banche invariate.
    for (let b = 0; b < 3; b++) {
      admin.emit('admin:setBoard', { category: 'X', phrase: 'OK' });
      await wait(100);
      admin.emit('admin:solve');
      await wait(150);
    }

    assert.strictEqual(adminState.phase, 'giramoe');
    const banche = Object.fromEntries(adminState.players.map(p => [p.name, p.bank]));
    assert.deepStrictEqual(banche, { P1: 0, P2: 5000, P3: 0 }, 'solo P2 ha banca uscendo dall\'express');

    admin.emit('admin:giramoeSetBoard', { category: 'FILM', phrase: 'CECE BACA' });
    await wait(200);
    assert.strictEqual(adminState.giramoe.currentTurn, 1, 'apre P2, la banca più alta');
    // E i telefoni lo sanno già prima dello spin: il turno non è di P1.
    assert.strictEqual(giState[0].isMyTurn, false, 'P1 non è di turno');
    assert.strictEqual(giState[1].isMyTurn, true, 'P2 è di turno');
    assert.strictEqual(giState[2].currentTurnName, 'P2', 'la TV del telefono nomina P2');
  } finally {
    [admin, main, ...players].forEach(s => s.close());
    await new Promise(r => ioServer.close(r));
  }
});
