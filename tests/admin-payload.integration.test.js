// La console del game master mostra cose che finora nessun payload portava:
// se la frase ci sta nel tabellone, l'ultima mossa di ciascuno nel Giramoe, le
// lettere del gioco finale e la banca del finalista. Qui si controlla che
// arrivino davvero — sono proiezioni di stato già esistente, ma se una si
// perde per strada la schermata resta muta senza dare errore.
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

test('console admin: anteprima della frase, ultima mossa nel Giramoe, lettere e banca del finale',
  { timeout: 60000 }, async () => {
  await listening();
  const BASE = `http://127.0.0.1:${server.address().port}`;
  const connect = () => io(BASE, { transports: ['websocket'], forceNew: true });

  const admin = connect(), main = connect();
  let adminState = null, check = null;
  admin.on('admin:state', s => { adminState = s; });
  admin.on('admin:phraseCheck', d => { check = d; });

  const players = [];
  try {
    admin.emit('admin:init'); main.emit('main:init');
    await wait(150);

    // --- anteprima della disposizione: non serve nemmeno una partita ---
    admin.emit('admin:checkPhrase', { phrase: 'NON TUTTE LE CIAMBELLE RIESCONO CON IL BUCO' });
    await wait(120);
    assert.deepStrictEqual(check, { ok: true, rows: 4, letters: 36 },
      'una frase che ci sta dice righe e lettere');

    admin.emit('admin:checkPhrase', { phrase: 'PAROLALUNGHISSIMACHENONCISTA' });
    await wait(120);
    assert.strictEqual(check.ok, false, 'la parola troppo lunga viene bocciata');
    assert.match(check.error, /troppo lunga/);

    admin.emit('admin:checkPhrase', { phrase: '   ' });
    await wait(120);
    assert.deepStrictEqual(check, { ok: false, empty: true }, 'campo vuoto: nessun errore rosso');

    // --- partita fino al gioco finale ---
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

    for (let b = 0; b < 3; b++) {
      admin.emit('admin:setBoard', { category: 'X', phrase: 'OK' });
      await wait(100);
      admin.emit('admin:solve');
      await wait(150);
    }
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
    for (let b = 0; b < 3; b++) {
      admin.emit('admin:setBoard', { category: 'X', phrase: 'OK' });
      await wait(100);
      admin.emit('admin:solve');
      await wait(150);
    }

    // --- Giramoe: l'ultima mossa di chi chiama ---
    assert.strictEqual(adminState.phase, 'giramoe');
    admin.emit('admin:giramoeSetBoard', { category: 'X', phrase: 'CECE' });
    await wait(200);
    admin.emit('admin:giramoeSpin');
    await wait(300);
    players[0].emit('player:giramoeLetter', { letter: 'C' });
    await wait(200);
    const p1 = adminState.giramoe.players[0];
    assert.strictEqual(p1.lastLetter, 'C', 'la console sa che lettera ha chiamato');
    assert.strictEqual(p1.lastCount, 2, 'e quante volte compariva');
    assert.strictEqual(p1.points, 500, '250 x 2');
    assert.strictEqual(adminState.giramoe.players[1].lastLetter, null, 'chi non ha ancora chiamato non ha mossa');

    players[0].emit('player:giramoeBuzz');
    await wait(150);
    admin.emit('admin:giramoeCorrect');
    await wait(200);

    // --- finalista: nome e banca ---
    await wait(2900);
    assert.strictEqual(adminState.phase, 'finalist');
    assert.strictEqual(adminState.finalist.name, 'P1');
    assert.strictEqual(adminState.finalist.bank, 5500, 'banca del finalista: 5000 triplete + 500 giramoe');

    // --- gioco finale: tempo pieno e lettere ---
    admin.emit('admin:startFinal', {
      topic: 'CANZONI',
      phrases: ['MI RITORNI IN MENTE', 'NEL BLU DIPINTO DI BLU', 'VOLARE OH OH'],
      envelopes: ['Uno', 'Due', 'Tre']
    });
    await wait(300);
    assert.strictEqual(adminState.phase, 'final');
    assert.strictEqual(adminState.final.total, 60000, 'la barra del timer ha bisogno del tempo pieno');
    assert.deepStrictEqual(adminState.final.given, ['N', 'R', 'T', 'E'], 'le quattro regalate dal tabellone');
    assert.deepStrictEqual(adminState.final.picks, [], 'il finalista non ha ancora scelto');

    players[0].emit('player:finalPick', { letter: 'M' });
    await wait(200);
    assert.deepStrictEqual(adminState.final.picks, [{ letter: 'M', present: true }],
      'la scelta compare fra le chiamate, con la sua sorte');
  } finally {
    [admin, main, ...players].forEach(s => s.close());
    await new Promise(r => ioServer.close(r));
  }
});
