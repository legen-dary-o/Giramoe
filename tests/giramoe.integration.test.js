// End-to-end socket test for the GIRAMOE final board. Self-contained loopback
// server; the triplete gap is shortened and the wheel is forced (env seams) so the
// flow is deterministic and fast.
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

test('giramoe: admin spin sets V, consonants score V x occ, only the winner banks',
  { timeout: 60000 }, async () => {
  await listening();
  const BASE = `http://127.0.0.1:${server.address().port}`;
  const connect = () => io(BASE, { transports: ['websocket'], forceNew: true });

  const admin = connect(), main = connect();
  let adminState = null;
  const m = { giramoeStart: null, board: null, buzzed: null, solved: null, matchEnd: null };
  admin.on('admin:state', s => { adminState = s; });
  main.on('main:giramoeStart', d => { m.giramoeStart = d; });
  main.on('main:giramoeBoard', d => { m.board = d; });
  main.on('main:giramoeBuzzed', d => { m.buzzed = d; });
  main.on('main:giramoeSolved', d => { m.solved = d; });
  main.on('main:matchEnd', d => { m.matchEnd = d; });

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

    // Round 1: clear 3 boards.
    for (let b = 0; b < 3; b++) {
      admin.emit('admin:setBoard', { category: 'X', phrase: 'OK' });
      await wait(100);
      admin.emit('admin:solve');
      await wait(150);
    }
    assert.strictEqual(adminState.phase, 'tripleteReady');

    // Triplete: P1 solves all three (banks 5000).
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
    assert.strictEqual(adminState.phase, 'express', 'into express round');

    // Express: clear 3 boards via the admin (no scoring).
    for (let b = 0; b < 3; b++) {
      admin.emit('admin:setBoard', { category: 'X', phrase: 'OK' });
      await wait(100);
      admin.emit('admin:solve');
      await wait(150);
    }

    // --- GIRAMOE ---
    assert.strictEqual(adminState.phase, 'giramoe', 'into the giramoe board');
    assert.ok(m.giramoeStart && m.giramoeStart.segments.every(v => typeof v === 'number'), 'giramoe wheel is all numbers');
    assert.strictEqual(adminState.players[0].bank, 5000, 'P1 carries 5000 from the triplete');

    admin.emit('admin:giramoeSetBoard', { category: 'FILM', phrase: 'CECE BACA' });
    await wait(200);
    assert.ok(m.board && m.board.category === 'FILM', 'giramoe board shown');
    assert.strictEqual(adminState.giramoe.state, 'AWAIT_SPIN', 'waiting for the admin spin');

    // Admin spins once -> V = 250 (forced segment 6). Play opens immediately.
    admin.emit('admin:giramoeSpin');
    await wait(300);
    assert.strictEqual(adminState.giramoe.multiplier, 250, 'multiplier set from the spin');
    assert.strictEqual(adminState.giramoe.state, 'PLAYING');
    assert.strictEqual(adminState.giramoe.currentTurn, 0, 'P1 starts');

    // P1 calls C (3 occurrences in "CECE BACA") -> +750.
    players[0].emit('player:giramoeLetter', { letter: 'C' });
    await wait(200);
    assert.strictEqual(adminState.giramoe.players[0].points, 750, 'C scores 250 x 3');

    // P1 buzzes but is WRONG -> turn passes, P1 keeps the 750 (not yet banked).
    players[0].emit('player:giramoeBuzz');
    await wait(150);
    assert.strictEqual(adminState.giramoe.buzzedBy, 0, 'P1 buzzed');
    admin.emit('admin:giramoeWrong');
    await wait(150);
    assert.strictEqual(adminState.giramoe.currentTurn, 1, 'turn passed to P2');
    assert.strictEqual(adminState.giramoe.players[0].points, 750, 'P1 keeps points, no penalty');

    // P2 calls B (1 occurrence) -> +250, then solves correctly.
    players[1].emit('player:giramoeLetter', { letter: 'B' });
    await wait(200);
    assert.strictEqual(adminState.giramoe.players[1].points, 250, 'B scores 250 x 1');
    players[1].emit('player:giramoeBuzz');
    await wait(150);
    admin.emit('admin:giramoeCorrect');
    await wait(200);

    // Only the winner (P2) banks; P1's 750 giramoe points are NOT banked.
    assert.ok(m.solved && m.solved.points === 250, 'P2 solved for 250');
    assert.ok(m.matchEnd, 'match ended after giramoe');
    const byName = Object.fromEntries(adminState.players.map(p => [p.name, p.bank]));
    assert.strictEqual(byName.P2, 250, 'winner P2 banked 250');
    assert.strictEqual(byName.P1, 5000, 'P1 unchanged — giramoe points not banked for non-winners');
    assert.strictEqual(byName.P3, 0, 'P3 unchanged');
  } finally {
    [admin, main, ...players].forEach(s => s.close());
    await new Promise(r => ioServer.close(r));
  }
});
