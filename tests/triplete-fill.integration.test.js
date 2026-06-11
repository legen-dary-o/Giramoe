// Regression: once a Triplete board is full, a late buzz must NOT be accepted (it
// would otherwise let a player "solve" the already-revealed board for 1000 points and
// stall the auto-advance). A filled board should advance on its own with no score.
process.env.PORT = process.env.PORT || '0';
process.env.HOST = '127.0.0.1';
process.env.TRIPLETE_GAP_MS = '1200';
process.env.TRIPLETE_REVEAL_MS = '600';

const { test } = require('node:test');
const assert = require('node:assert');
const { io } = require('socket.io-client');
const { server, io: ioServer } = require('../server');

const wait = (ms) => new Promise(r => setTimeout(r, ms));
const listening = () => new Promise(r => (server.listening ? r() : server.once('listening', r)));

test('triplete: a full board rejects a late buzz and advances with no score', { timeout: 60000 }, async () => {
  await listening();
  const BASE = `http://127.0.0.1:${server.address().port}`;
  const connect = () => io(BASE, { transports: ['websocket'], forceNew: true });

  const admin = connect(), main = connect();
  let adminState = null;
  const m = { board: null };
  admin.on('admin:state', s => { adminState = s; });
  main.on('main:tripleteBoard', b => { m.board = b; });

  const players = [];
  try {
    admin.emit('admin:init'); main.emit('main:init'); await wait(150);
    admin.emit('admin:inizia'); await wait(150);
    const roomCode = adminState.roomCode;
    for (let i = 0; i < 3; i++) { const p = connect(); players.push(p); await wait(60); p.emit('player:join', { roomCode, name: 'P' + (i + 1) }); await wait(100); }
    admin.emit('admin:startGame'); await wait(150);
    for (let b = 0; b < 3; b++) { admin.emit('admin:setBoard', { category: 'X', phrase: 'OK' }); await wait(100); admin.emit('admin:solve'); await wait(150); }
    assert.strictEqual(adminState.phase, 'tripleteReady');

    admin.emit('admin:startTriplete'); await wait(150);
    // board 1 = "OK" (2 letters): fills around 1200ms (2 reveals at 600ms)
    admin.emit('admin:tripleteStart', { title: 'T', phrases: ['OK', 'SI', 'NO'] });
    await wait(1500); // board is now full; nobody buzzed in time

    // A late buzz on the full board must be ignored.
    players[0].emit('player:tripleteBuzz');
    await wait(150);
    assert.strictEqual(adminState.triplete.buzzedBy, null, 'late buzz on a full board is rejected');
    assert.notStrictEqual(adminState.triplete.state, 'BUZZED');

    // It advances on its own, with nobody scoring.
    await wait(1300);
    assert.strictEqual(m.board.boardNumber, 2, 'advanced to board 2 by itself');
    assert.ok(adminState.triplete.players.every(p => p.points === 0), 'nobody scored on the unsolved board');
  } finally {
    [admin, main, ...players].forEach(s => s.close());
    await new Promise(r => ioServer.close(r));
  }
});
