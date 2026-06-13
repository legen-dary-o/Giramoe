// Rule: a Triplete board that fills up does NOT auto-advance. It stays on the full
// phrase; a player must still buzz and read it, and the admin's "frase indovinata"
// awards the 1000 points and only then moves to the next board.
process.env.PORT = process.env.PORT || '0';
process.env.HOST = '127.0.0.1';
process.env.TRIPLETE_GAP_MS = '300';
process.env.TRIPLETE_REVEAL_MS = '600';

const { test } = require('node:test');
const assert = require('node:assert');
const { io } = require('socket.io-client');
const { server, io: ioServer } = require('../server');

const wait = (ms) => new Promise(r => setTimeout(r, ms));
const listening = () => new Promise(r => (server.listening ? r() : server.once('listening', r)));

test('triplete: a full board stays put, then a buzz + correct scores and advances', { timeout: 60000 }, async () => {
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
    admin.emit('admin:tripleteStart', { title: 'T', phrases: ['OK', 'SI', 'NO'] });

    // "OK" (2 letters) fills around 1200ms. Wait well past that with nobody buzzing.
    await wait(2200);
    assert.strictEqual(m.board.boardNumber, 1, 'still on board 1 — a full board does NOT auto-advance');
    assert.strictEqual(adminState.triplete.state, 'REVEALING', 'waiting for a buzz on the full board');
    assert.ok(adminState.triplete.players.every(p => p.points === 0), 'no points yet');

    // A player buzzes the full board and reads it; the admin marks it correct.
    players[0].emit('player:tripleteBuzz'); await wait(150);
    assert.strictEqual(adminState.triplete.buzzedBy, 0, 'buzz is accepted on the full board');
    admin.emit('admin:tripleteCorrect'); await wait(150);
    assert.strictEqual(adminState.triplete.players[0].points, 1000, 'reader scores 1000');

    await wait(500); // gap, then board 2 appears
    assert.strictEqual(m.board.boardNumber, 2, 'advances only after the answer');
  } finally {
    [admin, main, ...players].forEach(s => s.close());
    await new Promise(r => ioServer.close(r));
  }
});
