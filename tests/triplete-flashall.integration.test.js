// Rule: on Triplete board 3 EVERY letter flashes once (appears ~1s, then vanishes),
// one at a time, before the board starts stabilizing. No cap on the flash count.
process.env.PORT = process.env.PORT || '0';
process.env.HOST = '127.0.0.1';
process.env.TRIPLETE_GAP_MS = '300';
process.env.TRIPLETE_REVEAL_MS = '120';

const { test } = require('node:test');
const assert = require('node:assert');
const { io } = require('socket.io-client');
const { server, io: ioServer } = require('../server');

const wait = (ms) => new Promise(r => setTimeout(r, ms));
const listening = () => new Promise(r => (server.listening ? r() : server.once('listening', r)));

test('triplete board 3: every letter flashes once before the letters stabilize',
  { timeout: 60000 }, async () => {
  await listening();
  const BASE = `http://127.0.0.1:${server.address().port}`;
  const connect = () => io(BASE, { transports: ['websocket'], forceNew: true });

  const admin = connect(), main = connect();
  let adminState = null;
  const board3 = { flash: [], reveal: [], started: false };
  admin.on('admin:state', s => { adminState = s; });
  main.on('main:tripleteBoard', b => { if (b.boardNumber === 3) board3.started = true; });
  main.on('main:tripleteFlash', ({ cell }) => { if (board3.started) board3.flash.push(cell); });
  main.on('main:tripleteReveal', ({ cell }) => { if (board3.started) board3.reveal.push(cell); });

  const players = [];
  try {
    admin.emit('admin:init'); main.emit('main:init'); await wait(150);
    admin.emit('admin:inizia'); await wait(150);
    const roomCode = adminState.roomCode;
    for (let i = 0; i < 3; i++) {
      const p = connect(); players.push(p);
      await wait(60);
      p.emit('player:join', { roomCode, name: 'P' + (i + 1) });
      await wait(100);
    }
    admin.emit('admin:startGame'); await wait(150);
    for (let b = 0; b < 3; b++) {
      admin.emit('admin:setBoard', { category: 'X', phrase: 'OK' }); await wait(100);
      admin.emit('admin:solve'); await wait(150);
    }
    assert.strictEqual(adminState.phase, 'tripleteReady');

    admin.emit('admin:startTriplete'); await wait(150);
    // board 3 has 8 letters: they must ALL flash before anything stabilizes
    admin.emit('admin:tripleteStart', { title: 'T', phrases: ['OK', 'SI', 'SEI FORTE'] });

    // boards 1 and 2: fill, then a buzz + correct to move on
    for (let b = 0; b < 2; b++) {
      await wait(600);
      players[0].emit('player:tripleteBuzz'); await wait(150);
      admin.emit('admin:tripleteCorrect'); await wait(500);
    }
    assert.ok(board3.started, 'reached board 3');

    await wait(1600); // ~13 ticks at 120ms: well past the 8 flashes
    const keys = board3.flash.map(c => c.row + ',' + c.col);
    assert.strictEqual(keys.length, 8, 'all 8 letters flashed');
    assert.strictEqual(new Set(keys).size, 8, 'no letter flashed twice');
    assert.ok(board3.reveal.length > 0, 'the board stabilizes once every letter has flashed');
  } finally {
    [admin, main, ...players].forEach(s => s.close());
    await new Promise(r => ioServer.close(r));
  }
});
