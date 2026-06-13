// End-to-end socket test for the FINAL game. Self-contained loopback server; the
// triplete gap is shortened, the wheel is forced, and the final timer is left long
// so it never expires mid-test.
process.env.PORT = process.env.PORT || '0';
process.env.HOST = '127.0.0.1';
process.env.TRIPLETE_GAP_MS = '300';
process.env.GIRAMOE_FORCE_SEGMENT = '6';
process.env.FINAL_TIME_MS = '60000';

const { test } = require('node:test');
const assert = require('node:assert');
const { io } = require('socket.io-client');
const { server, io: ioServer } = require('../server');

const wait = (ms) => new Promise(r => setTimeout(r, ms));
const listening = () => new Promise(r => (server.listening ? r() : server.once('listening', r)));

test('final: picks/timer/carry/-3s, then envelopes (open, blind change, admin reveals red)',
  { timeout: 60000 }, async () => {
  await listening();
  const BASE = `http://127.0.0.1:${server.address().port}`;
  const connect = () => io(BASE, { transports: ['websocket'], forceNew: true });

  const admin = connect(), main = connect();
  let adminState = null;
  const m = { board: null, timer: null, buzzed: 0, wrong: 0, env: null };
  admin.on('admin:state', s => { adminState = s; });
  main.on('main:finalBoard', d => { m.board = d; });
  main.on('main:finalTimer', d => { m.timer = d.ms; });
  main.on('main:finalBuzzed', () => { m.buzzed++; });
  main.on('main:wrong', () => { m.wrong++; });
  main.on('main:envelopes', d => { m.env = d; });

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

    // Round 1.
    for (let b = 0; b < 3; b++) { admin.emit('admin:setBoard', { category: 'X', phrase: 'OK' }); await wait(100); admin.emit('admin:solve'); await wait(150); }
    // Triplete: P1 solves all three -> 5000.
    admin.emit('admin:startTriplete'); await wait(150);
    admin.emit('admin:tripleteStart', { title: 'T', phrases: ['UNO', 'DUE', 'TRE'] }); await wait(400);
    for (let b = 0; b < 3; b++) { players[0].emit('player:tripleteBuzz'); await wait(150); admin.emit('admin:tripleteCorrect'); await wait(550); }
    // Express: clear 3 boards.
    for (let b = 0; b < 3; b++) { admin.emit('admin:setBoard', { category: 'X', phrase: 'OK' }); await wait(100); admin.emit('admin:solve'); await wait(150); }
    // Giramoe: P1 wins the board, stays the highest bank.
    assert.strictEqual(adminState.phase, 'giramoe');
    admin.emit('admin:giramoeSetBoard', { category: 'C', phrase: 'CECE' }); await wait(150);
    admin.emit('admin:giramoeSpin'); await wait(300);
    players[0].emit('player:giramoeLetter', { letter: 'C' }); await wait(150);
    players[0].emit('player:giramoeBuzz'); await wait(150);
    admin.emit('admin:giramoeCorrect'); await wait(2900);
    assert.strictEqual(adminState.phase, 'finalist', 'P1 is the finalist');

    // --- FINAL ---
    admin.emit('admin:startFinal', {
      topic: 'TEST', phrases: ['CENTRO NORD', 'PRIMA SERA', 'SOLE'],
      envelopes: ['BUSTA UNO', 'BUSTA DUE', 'BUSTA TRE']
    });
    await wait(250);
    assert.strictEqual(adminState.phase, 'final');
    assert.strictEqual(m.board.boardIndex, 0, 'board 1 shown');
    assert.strictEqual(adminState.final.state, 'PICKING', 'board 1 waits for picks');
    // "CENTRO NORD" -> N,R,T,E revealed up front
    const revealed1 = m.board.grid.flat().filter(c => c.type === 'letter' && c.revealed).map(c => c.letter).sort();
    assert.deepStrictEqual([...new Set(revealed1)], ['E', 'N', 'R', 'T'], 'N R T E revealed on board 1');

    // Pick 3 consonants + 1 vowel -> the timer starts.
    players[0].emit('player:finalPick', { letter: 'C' }); await wait(80);
    players[0].emit('player:finalPick', { letter: 'D' }); await wait(80);
    players[0].emit('player:finalPick', { letter: 'B' }); await wait(80);
    assert.strictEqual(adminState.final.state, 'PICKING', 'still picking after 3 consonants');
    players[0].emit('player:finalPick', { letter: 'O' }); await wait(120);
    assert.strictEqual(adminState.final.state, 'RUNNING', 'timer running after the vowel');
    await wait(400);
    assert.ok(m.timer < 60000, 'timer is counting down');

    // Buzz + correct -> board 1 green, carry time to board 2.
    players[0].emit('player:finalBuzz'); await wait(120);
    assert.strictEqual(m.buzzed, 1);
    assert.strictEqual(adminState.final.state, 'BUZZED');
    admin.emit('admin:finalCorrect'); await wait(1800);
    assert.strictEqual(adminState.final.boardIndex, 1, 'advanced to board 2');
    assert.strictEqual(adminState.final.results[0], true, 'board 1 green');
    // board 2: first+last of each word revealed
    const revealed2 = m.board.grid.flat().filter(c => c.type === 'letter' && c.revealed).map(c => c.letter).sort();
    assert.deepStrictEqual(revealed2, ['A', 'A', 'P', 'S'], 'first/last of PRIMA SERA');

    // Board 2: no picks, buzz + wrong -> red, carry to board 3.
    assert.strictEqual(players[0] && true, true);
    players[0].emit('player:finalBuzz'); await wait(120);
    admin.emit('admin:finalWrong'); await wait(1800);
    assert.strictEqual(adminState.final.boardIndex, 2, 'advanced to board 3');
    assert.strictEqual(adminState.final.results[1], false, 'board 2 red');

    // Board 3 (empty): a wrong letter docks ~3s.
    players[0].emit('player:finalPick', { letter: 'S' }); await wait(120); // present in SOLE
    const before = m.timer;
    players[0].emit('player:finalPick', { letter: 'Z' }); await wait(120); // absent -> -3s + main:wrong
    assert.ok(m.wrong >= 1, 'wrong sound on the bad letter');
    assert.ok(before - m.timer >= 2500, `timer docked ~3s (was ${before}, now ${m.timer})`);

    // Buzz + correct on board 3 -> finished with [green, red, green] -> ENVELOPES.
    players[0].emit('player:finalBuzz'); await wait(120);
    admin.emit('admin:finalCorrect'); await wait(300);
    assert.strictEqual(adminState.phase, 'envelopes', 'final flows into the envelopes');
    assert.deepStrictEqual(m.env.envelopes.map(e => e.color), ['green', 'red', 'green'], 'colours from the results');
    assert.strictEqual(m.env.state, 'CHOOSING');
    assert.strictEqual(m.env.changesLeft, 1, '2 greens -> 1 change');

    // Finalist (P1) opens envelope 1 (green), sees its content.
    players[0].emit('player:envelopeOpen', { index: 0 }); await wait(150);
    assert.strictEqual(m.env.current, 0);
    assert.strictEqual(m.env.envelopes[0].revealed, true);
    assert.strictEqual(m.env.envelopes[0].content, 'BUSTA UNO');

    // Blind change -> the other green (3); the first is abandoned, no changes left.
    players[0].emit('player:envelopeChange'); await wait(150);
    assert.strictEqual(m.env.current, 2);
    assert.strictEqual(m.env.envelopes[2].content, 'BUSTA TRE');
    assert.strictEqual(m.env.envelopes[0].abandoned, true);
    assert.strictEqual(m.env.changesLeft, 0);

    // The red one stays hidden to the player; only the admin can reveal it.
    assert.strictEqual(m.env.envelopes[1].revealed, false);
    admin.emit('admin:envelopeRevealRed', { index: 1 }); await wait(150);
    assert.strictEqual(m.env.envelopes[1].revealed, true);
    assert.strictEqual(m.env.envelopes[1].content, 'BUSTA DUE');
  } finally {
    [admin, main, ...players].forEach(s => s.close());
    await new Promise(r => ioServer.close(r));
  }
});
