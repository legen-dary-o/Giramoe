// End-to-end socket test for the Triplete bonus round. Self-contained: it starts
// the server on a loopback ephemeral port (HOST/PORT env), so it runs anywhere with
// `node --test tests/triplete.integration.test.js` — no separate server needed.
process.env.PORT = process.env.PORT || '0';
process.env.HOST = '127.0.0.1';

const { test } = require('node:test');
const assert = require('node:assert');
const { io } = require('socket.io-client');
const { server, io: ioServer } = require('../server');

const wait = (ms) => new Promise(r => setTimeout(r, ms));

function listening() {
  return new Promise(r => {
    if (server.listening) return r();
    server.once('listening', r);
  });
}

test('triplete: title, reveal, buzz/lockout, board flow, 5000 treble, then standings',
  { timeout: 60000 }, async () => {
  await listening();
  const BASE = `http://127.0.0.1:${server.address().port}`;
  const connect = () => io(BASE, { transports: ['websocket'], forceNew: true });

  const admin = connect(), main = connect();
  let adminState = null;
  const m = { title: 0, board: null, reveal: 0, flash: 0, buzzed: null, solved: null, matchEnd: null };
  const intro = [false, false, false];

  admin.on('admin:state', s => { adminState = s; });
  main.on('main:tripleteTitle', () => m.title++);
  main.on('main:tripleteBoard', b => { m.board = b; });
  main.on('main:tripleteReveal', () => m.reveal++);
  main.on('main:tripleteFlash', () => m.flash++);
  main.on('main:tripleteBuzzed', d => { m.buzzed = d; });
  main.on('main:tripleteSolved', d => { m.solved = d; });
  main.on('main:matchEnd', d => { m.matchEnd = d; });

  admin.emit('admin:init'); main.emit('main:init');
  await wait(200);
  admin.emit('admin:inizia');
  await wait(200);
  const roomCode = adminState.roomCode;

  const players = [];
  for (let i = 0; i < 3; i++) {
    const p = connect(); players.push(p);
    p.on('player:tripleteIntro', () => { intro[i] = true; });
    await wait(80);
    p.emit('player:join', { roomCode, name: 'P' + (i + 1) });
    await wait(120);
  }
  admin.emit('admin:startGame');
  await wait(200);

  // Clear the 3 wheel boards to reach the Triplete offer.
  for (let b = 0; b < 3; b++) {
    admin.emit('admin:setBoard', { category: 'X', phrase: 'OK' });
    await wait(120);
    admin.emit('admin:solve');
    await wait(180);
  }
  assert.strictEqual(adminState.phase, 'tripleteReady', 'phase tripleteReady after 3 boards');

  // Enter the Triplete: title animation + setup form.
  admin.emit('admin:startTriplete');
  await wait(250);
  assert.strictEqual(m.title, 1, 'title animation played once');
  assert.ok(intro.every(Boolean), 'all players got the intro');
  assert.ok(adminState.triplete && !adminState.triplete.started, 'admin shows the setup form');

  admin.emit('admin:tripleteStart', { title: 'CINEMA', phrases: ['IL PADRINO', 'PULP FICTION', 'MATRIX'] });
  await wait(1900);
  assert.strictEqual(m.board.boardNumber, 1, 'board 1 shown');
  assert.strictEqual(m.board.category, 'CINEMA', 'shared title as category');
  assert.ok(m.reveal >= 1, 'cells auto-reveal on board 1');

  // Board 1: P1 wrong (locked), P2 correct (+1000).
  players[0].emit('player:tripleteBuzz');
  await wait(200);
  assert.strictEqual(adminState.triplete.buzzedBy, 0, 'P1 buzz registered');
  admin.emit('admin:tripleteWrong');
  await wait(200);
  assert.strictEqual(adminState.triplete.players[0].locked, true, 'P1 locked after wrong');
  assert.strictEqual(adminState.triplete.state, 'REVEALING', 'reveal resumed');

  players[1].emit('player:tripleteBuzz');
  await wait(200);
  admin.emit('admin:tripleteCorrect');
  await wait(250);
  assert.strictEqual(m.solved.points, 1000, 'board 1: P2 +1000');

  // Board 2.
  await wait(3000);
  assert.strictEqual(m.board.boardNumber, 2, 'advanced to board 2');
  players[1].emit('player:tripleteBuzz');
  await wait(200);
  admin.emit('admin:tripleteCorrect');
  await wait(250);
  assert.strictEqual(m.solved.points, 2000, 'board 2: running total 2000');

  // Board 3 (flashing) -> treble 5000.
  await wait(3000);
  assert.strictEqual(m.board.boardNumber, 3, 'advanced to board 3');
  await wait(1700);
  assert.ok(m.flash >= 1, 'board 3 flashes letters');
  players[1].emit('player:tripleteBuzz');
  await wait(200);
  admin.emit('admin:tripleteCorrect');
  await wait(250);
  assert.strictEqual(m.solved.points, 5000, 'treble bonus: 5000 not 3000');

  await wait(3000);
  assert.ok(m.matchEnd, 'match ended');
  assert.deepStrictEqual(m.matchEnd.standings[0], { name: 'P2', bank: 5000 }, 'P2 tops with 5000');

  [admin, main, ...players].forEach(s => s.close());
  await new Promise(r => ioServer.close(r)); // release the server so the test process can exit
});
