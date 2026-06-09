const { test } = require('node:test');
const assert = require('node:assert');
const { io } = require('socket.io-client');

const BASE = 'http://localhost:3000';
const wait = (ms) => new Promise(r => setTimeout(r, ms));
function connect() { return io(BASE, { transports: ['websocket'], forceNew: true }); }

test('main protocol: edge cells, wrong on pass, solved on solve, board advances', async () => {
  const admin = connect();
  const main = connect();
  let adminState = null, mainGame = null, mainScores = null, gotWrong = false, gotSolved = false;
  admin.on('admin:state', s => { adminState = s; });
  main.on('main:gameState', g => { mainGame = g; });
  main.on('main:scores', s => { mainScores = s; });
  main.on('main:wrong', () => { gotWrong = true; });
  main.on('main:solved', () => { gotSolved = true; });

  admin.emit('admin:init'); main.emit('main:init');
  await wait(200);
  admin.emit('admin:inizia');
  await wait(200);
  const roomCode = adminState.roomCode;

  const players = [];
  for (let i = 0; i < 3; i++) {
    const p = connect();
    players.push(p);
    await wait(100);
    p.emit('player:join', { roomCode, name: 'P' + (i + 1) });
    await wait(150);
  }
  admin.emit('admin:startGame');
  await wait(200);

  admin.emit('admin:setBoard', { category: 'TEST', phrase: 'SOLE' });
  await wait(200);
  assert.strictEqual(mainGame.board.grid[0][0].type, 'edge');
  assert.strictEqual(mainGame.board.grid[0][15].type, 'edge');
  assert.ok(mainGame.board.grid[1].every(c => c.type !== 'edge'));

  admin.emit('admin:passTurn');
  await wait(200);
  assert.strictEqual(gotWrong, true);
  assert.ok(mainScores, 'received main:scores');

  admin.emit('admin:solve');
  await wait(200);
  assert.strictEqual(gotSolved, true);
  assert.strictEqual(adminState.boardNumber, 2);
  assert.ok(mainGame.board.grid.flat().some(c => c.type === 'letter' && c.revealed), 'solved board revealed');

  [admin, main, ...players].forEach(s => s.close());
  await wait(100);
});
