// End-to-end socket test for the EXPRESS round. Self-contained: loopback server,
// the triplete gap is shortened and every spin is forced onto the EXPRESS segment
// (index 6) via env seams, so the express path is deterministic and fast.
process.env.PORT = process.env.PORT || '0';
process.env.HOST = '127.0.0.1';
process.env.TRIPLETE_GAP_MS = '300';
process.env.GIRAMOE_FORCE_SEGMENT = '6';

const { test } = require('node:test');
const assert = require('node:assert');
const { io } = require('socket.io-client');
const { server, io: ioServer } = require('../server');

const wait = (ms) => new Promise(r => setTimeout(r, ms));
const listening = () => new Promise(r => (server.listening ? r() : server.once('listening', r)));

test('express: triplete -> express round, +500/occurrence, miss = full bancarotta (bank wiped)',
  { timeout: 60000 }, async () => {
  await listening();
  const BASE = `http://127.0.0.1:${server.address().port}`;
  const connect = () => io(BASE, { transports: ['websocket'], forceNew: true });

  const admin = connect(), main = connect();
  let adminState = null;
  const m = { expressRound: null, gameState: null, bankrupt: null };
  admin.on('admin:state', s => { adminState = s; });
  main.on('main:expressRound', d => { m.expressRound = d; });
  main.on('main:gameState', g => { m.gameState = g; });
  main.on('main:expressBankrupt', d => { m.bankrupt = d; });

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

  // Round 1: clear the 3 wheel boards (no scoring) to reach the Triplete.
  for (let b = 0; b < 3; b++) {
    admin.emit('admin:setBoard', { category: 'X', phrase: 'OK' });
    await wait(100);
    admin.emit('admin:solve');
    await wait(150);
  }
  assert.strictEqual(adminState.phase, 'tripleteReady');

  // Triplete: P1 (index 0) solves all three -> treble bonus 5000 into the bank.
  admin.emit('admin:startTriplete');
  await wait(150);
  admin.emit('admin:tripleteStart', { title: 'T', phrases: ['UNO', 'DUE', 'TRE'] });
  await wait(400);
  for (let b = 0; b < 3; b++) {
    players[0].emit('player:tripleteBuzz');
    await wait(150);
    admin.emit('admin:tripleteCorrect');
    await wait(550); // board gap (300) + margin
  }

  // --- Now in the EXPRESS round ---
  assert.strictEqual(adminState.phase, 'express', 'phase is express after the triplete');
  assert.ok(m.expressRound, 'main got the express round');
  assert.strictEqual(m.expressRound.segments[6], 'express', 'segment 6 is EXPRESS');
  assert.strictEqual(adminState.players[0].bank, 5000, 'P1 carries 5000 from the triplete');

  admin.emit('admin:setBoard', { category: 'CINEMA', phrase: 'CIAO MONDO' });
  await wait(200);
  assert.ok(m.gameState && m.gameState.segments[6] === 'express', 'express board shown with the express wheel');
  assert.strictEqual(adminState.currentTurn, 0, 'P1 to act on express board 1');

  // P1 spins -> forced onto EXPRESS -> express mode. Act immediately (state is set
  // server-side; the score broadcast is only delayed for the wheel animation).
  players[0].emit('player:spin');
  await wait(400);

  // Present consonant C (1 occurrence) -> +500.
  players[0].emit('player:expressLetter', { letter: 'C' });
  await wait(250);
  assert.strictEqual(adminState.players[0].roundPoints, 500, 'express consonant scores 500 x occurrences');

  // Absent letter Z -> full bancarotta: round points AND the 5000 bank wiped, turn passes.
  players[0].emit('player:expressLetter', { letter: 'Z' });
  await wait(250);
  assert.ok(m.bankrupt, 'main got the express bancarotta');
  assert.strictEqual(adminState.players[0].roundPoints, 0, 'round points wiped');
  assert.strictEqual(adminState.players[0].bank, 0, 'whole bank wiped by express bancarotta');
  assert.strictEqual(adminState.currentTurn, 1, 'turn passed to the next player');
  } finally {
    [admin, main, ...players].forEach(s => s.close());
    await new Promise(r => ioServer.close(r));
  }
});
