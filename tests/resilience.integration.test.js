// Robustezza della partita dal vivo: il server non deve morire per un tasto premuto
// nel momento sbagliato, e la console admin non deve restare indietro.
//
// Entrambi i casi qui sotto sono bug osservati dal vivo: il server cadeva (e con lui
// tutta la partita) premendo "Frase indovinata" prima di aver impostato il tabellone,
// e l'admin restava con una schermata vecchia finché non si ricaricava la pagina.
process.env.PORT = process.env.PORT || '0';
process.env.HOST = '127.0.0.1';

const { test, after } = require('node:test');
const assert = require('node:assert');
const { io } = require('socket.io-client');
const { server, io: ioServer } = require('../server');

const wait = (ms) => new Promise(r => setTimeout(r, ms));
const listening = () => new Promise(r => (server.listening ? r() : server.once('listening', r)));

// Un solo server per il file: si chiude alla fine, non dentro i singoli test.
after(() => new Promise(r => ioServer.close(r)));

// Porta la partita fino a "3 giocatori in gioco, nessun tabellone impostato".
async function startedGame(connect) {
  const admin = connect(), main = connect();
  let adminState = null;
  admin.on('admin:state', s => { adminState = s; });
  admin.emit('admin:init'); main.emit('main:init');
  await wait(150);
  admin.emit('admin:inizia');
  await wait(150);
  const roomCode = adminState.roomCode;

  const players = [];
  for (let i = 0; i < 3; i++) {
    const p = connect(); players.push(p);
    await wait(60);
    p.emit('player:join', { roomCode, name: 'P' + (i + 1) });
    await wait(100);
  }
  admin.emit('admin:startGame');
  await wait(150);
  return { admin, main, players, get state() { return adminState; } };
}

test('i tasti dell\'admin senza tabellone non buttano giù il server', { timeout: 30000 }, async () => {
  await listening();
  const BASE = `http://127.0.0.1:${server.address().port}`;
  const connect = () => io(BASE, { transports: ['websocket'], forceNew: true });

  const s = await startedGame(connect);
  try {
    assert.strictEqual(s.state.phase, 'playing');

    // Partita avviata ma nessun tabellone: game.board è null. Prima questi due
    // eventi entravano in game.applySolve()/passTurn() e l'eccezione non gestita
    // usciva dall'handler socket.io -> processo terminato -> partita da rifare.
    s.admin.emit('admin:solve');
    await wait(200);
    s.admin.emit('admin:passTurn');
    await wait(200);

    // Il server è ancora vivo e risponde: impostiamo davvero un tabellone.
    s.admin.emit('admin:setBoard', { category: 'TEST', phrase: 'SOLE' });
    await wait(250);
    assert.strictEqual(s.state.phase, 'playing', 'il server risponde ancora');
    assert.strictEqual(s.state.boardNumber, 1, 'nessun avanzamento fantasma di tabellone');
    assert.ok(s.admin.connected, 'la console admin è ancora connessa');
  } finally {
    [s.admin, s.main, ...s.players].forEach(x => x.close());
    await wait(100);
  }
});

test('la console admin riceve lo stato dopo ogni azione, anche senza emit dedicata',
  { timeout: 30000 }, async () => {
  await listening();
  const BASE = `http://127.0.0.1:${server.address().port}`;
  const connect = () => io(BASE, { transports: ['websocket'], forceNew: true });

  const s = await startedGame(connect);
  try {
    s.admin.emit('admin:setBoard', { category: 'TEST', phrase: 'SOLE' });
    await wait(250);

    // Azione di un giocatore che il server rifiuta (non è il suo turno): non cambia
    // nulla, ma l'admin non deve comunque perdere il passo.
    let updates = 0;
    s.admin.on('admin:state', () => { updates += 1; });
    s.players[1].emit('player:spin');
    await wait(300);
    assert.ok(updates > 0, 'l\'admin riceve uno stato aggiornato dopo un evento di gioco');
  } finally {
    [s.admin, s.main, ...s.players].forEach(x => x.close());
    await wait(100);
  }
});
