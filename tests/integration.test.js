const { test } = require('node:test');
const assert = require('node:assert');
const { io } = require('socket.io-client');

const BASE = 'http://localhost:3000';
const wait = (ms) => new Promise(r => setTimeout(r, ms));
function connect() { return io(BASE, { transports: ['websocket'], forceNew: true }); }

test('full 1-board flow: lobby, set board, spin, score, solve', async () => {
  const admin = connect();
  const main = connect();
  let adminState = null, mainGame = null, lastSpin = null;
  admin.on('admin:state', s => { adminState = s; });
  main.on('main:gameState', g => { mainGame = g; });
  main.on('main:spin', d => { lastSpin = d; });

  admin.emit('admin:init'); main.emit('main:init');
  await wait(200);
  admin.emit('admin:inizia');
  await wait(200);
  const roomCode = adminState.roomCode;
  assert.ok(roomCode);

  const players = [];
  const pstate = [];
  for (let i = 0; i < 3; i++) {
    const p = connect();
    const st = { turn: null, joined: null };
    p.on('player:joined', d => { st.joined = d; });
    p.on('player:turnState', d => { st.turn = d; });
    players.push(p); pstate.push(st);
    await wait(100);
    p.emit('player:join', { roomCode, name: 'P' + (i + 1) });
    await wait(150);
  }
  admin.emit('admin:startGame');
  await wait(200);

  admin.emit('admin:setBoard', { category: 'TEST', phrase: 'SOLE' });
  await wait(200);
  assert.strictEqual(mainGame.board.category, 'TEST');
  assert.strictEqual(mainGame.boardNumber, 1);

  players[0].emit('player:spin');
  await wait(6500);
  assert.ok(lastSpin, 'main received a spin');
  assert.ok(mainGame.scores, 'scores present');

  admin.emit('admin:solve');
  await wait(200);
  assert.strictEqual(adminState.boardNumber, 2);

  [admin, main, ...players].forEach(s => s.close());
  await wait(100);
});
