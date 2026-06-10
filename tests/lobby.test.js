const { test } = require('node:test');
const assert = require('node:assert');
const { io } = require('socket.io-client');

const BASE = 'http://localhost:3000';
const wait = ms => new Promise(r => setTimeout(r, ms));
const connect = () => io(BASE, { transports: ['websocket'], forceNew: true });

test('lobby: disconnect keeps slot + no overlay; kick frees slot; reconnect by name', async () => {
  const admin = connect();
  const main = connect();
  let adminState = null, lobbySlots = null, overlayShown = false;
  admin.on('admin:state', s => { adminState = s; });
  main.on('main:playerJoined', d => { lobbySlots = d.players; });   // lobby slot refresh
  main.on('main:playerDisconnected', () => { overlayShown = true; }); // overlay (should NOT fire in lobby)

  admin.emit('admin:init'); main.emit('main:init');
  await wait(200);
  admin.emit('admin:inizia');
  await wait(200);
  const room = adminState.roomCode;

  // 3 players join
  const p = [];
  for (let i = 0; i < 3; i++) { const s = connect(); p.push(s); await wait(80); s.emit('player:join', { roomCode: room, name: 'P' + (i + 1) }); await wait(120); }
  assert.strictEqual(adminState.players.length, 3, '3 players in lobby');
  assert.ok(adminState.players.every(x => x.connected), 'all connected');

  // P2 drops (connection lost) — slot must stay, overlay must NOT show in lobby
  p[1].close();
  await wait(400);
  assert.strictEqual(overlayShown, false, 'no reconnect overlay during lobby');
  assert.strictEqual(adminState.players.length, 3, 'slot kept after lobby disconnect');
  assert.strictEqual(adminState.players[1].connected, false, 'P2 marked disconnected');
  assert.ok(lobbySlots && lobbySlots.length === 3, 'main slots refreshed');

  // startGame must be blocked (not all connected)
  admin.emit('admin:startGame');
  await wait(200);
  assert.notStrictEqual(adminState.phase, 'playing', 'cannot start with a disconnected player');

  // P2 reconnects by name (new socket, same device session)
  const p2b = connect();
  let recon = null;
  p2b.on('player:reconnected', d => { recon = d; });
  await wait(100);
  p2b.emit('player:reconnect', { roomCode: room, name: 'P2' });
  await wait(300);
  assert.ok(recon, 'P2 reconnected');
  assert.strictEqual(recon.name, 'P2');
  assert.strictEqual(adminState.players[1].connected, true, 'P2 connected again');

  // admin kicks P3 → slot frees to 2
  admin.emit('admin:kick', { name: 'P3' });
  await wait(250);
  assert.strictEqual(adminState.players.length, 2, 'P3 kicked, 2 players left');
  assert.ok(!adminState.players.find(x => x.name === 'P3'), 'P3 gone');

  // a 4th can now take the freed slot
  const p4 = connect();
  await wait(80);
  p4.emit('player:join', { roomCode: room, name: 'P4' });
  await wait(200);
  assert.strictEqual(adminState.players.length, 3, 'slot refilled to 3');

  // now all 3 connected → start works
  admin.emit('admin:startGame');
  await wait(250);
  assert.strictEqual(adminState.phase, 'playing', 'starts with 3 connected');

  [admin, main, ...p, p2b, p4].forEach(s => { try { s.close(); } catch (e) {} });
  await wait(100);
});
