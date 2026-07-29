# Compra vocali nel tabellone GIRAMOE — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nel tabellone GIRAMOE il giocatore di turno può comprare una vocale a 500 punti invece di chiamare una consonante — una sola azione per turno, la vocale presente apre la stessa finestra di prenotazione di 5s.

**Architecture:** La logica pura va in `giramoe.js` (nuove `buyVowel`, `canBuyVowel`, `vowelsFinished`), che riusa il flag esistente `calledThisTurn` per rendere le due azioni mutuamente esclusive. `server.js` aggiunge un handler socket `player:giramoeVowel` speculare a `player:giramoeLetter` ed espone `canBuyVowel` nella vista del giocatore. Il client aggiunge alla schermata GIRAMOE lo stesso pulsante + picker vocali già usato nella ruota. Ruota, Express e finale in solitaria non vengono toccati.

**Tech Stack:** Node.js (CommonJS), Socket.IO, test con `node:test` + `node:assert`, front-end vanilla JS.

**Spec:** `docs/superpowers/specs/2026-07-29-giramoe-compra-vocali-design.md`

**Comando test (sempre così — in parallelo la suite si pianta):**

```bash
node --test --test-concurrency=1
```

---

## File Structure

| File | Responsabilità | Cosa cambia |
|---|---|---|
| `giramoe.js` | macchina a stati pura del tabellone GIRAMOE | Task 1, 2: `VOWEL_COST`, `vowelsFinished`, `canBuyVowel`, `buyVowel` |
| `tests/giramoe.test.js` | unit della macchina a stati | Task 1, 2: nuovi test |
| `server.js` | trasporto socket + broadcast | Task 3: handler `player:giramoeVowel`, `canBuyVowel` e messaggi in `playerGiramoeView` |
| `tests/giramoe-vocali.integration.test.js` | smoke socket end-to-end del nuovo flusso | Task 4: file nuovo |
| `public/play.html` | markup schermate telefono | Task 5: pulsante + picker nella schermata GIRAMOE |
| `public/js/player.js` | logica client del telefono | Task 5: costruzione picker, emit, gating |
| `public/js/samiro-faq.js` | base di conoscenza dell'assistente | Task 6: voci fase 4 |
| `docs/samiro-regolamento.md` | regolamento sorgente delle FAQ | Task 6: voci fase 4 |

---

### Task 1: Helper `vowelsFinished` e `canBuyVowel` in `giramoe.js`

**Files:**
- Modify: `giramoe.js` (dopo `consonantsFinished`, riga ~72)
- Test: `tests/giramoe.test.js` (in fondo)

- [ ] **Step 1: Scrivi i test che falliscono**

Aggiungi in fondo a `tests/giramoe.test.js`:

```js
test('canBuyVowel: serve il proprio turno, 500 punti e nessuna azione già fatta', () => {
  const gi = make('CECE BACA');
  giramoe.setMultiplier(gi, 250);
  // prima dello spin nessuno compra: qui lo spin c'è ma P0 ha 0 punti
  assert.strictEqual(giramoe.canBuyVowel(gi, 0), false, 'senza punti non si compra');
  giramoe.callConsonant(gi, 'C'); // 3 occorrenze -> P0 a 750
  assert.strictEqual(gi.players[0].points, 750);
  assert.strictEqual(giramoe.canBuyVowel(gi, 0), false, 'ha già chiamato in questo turno');
  assert.strictEqual(giramoe.canBuyVowel(gi, 1), false, 'non è il suo turno');
  giramoe.timeout(gi); // passa a P1, P0 conserva i 750
  assert.strictEqual(giramoe.canBuyVowel(gi, 1), false, 'P1 non ha punti');
  giramoe.callConsonant(gi, 'Z'); // assente -> passa a P2
  assert.strictEqual(giramoe.canBuyVowel(gi, 2), false);
  assert.strictEqual(giramoe.canBuyVowel(gi, 0), false, 'P0 ha i punti ma non è il suo turno');
});

test('canBuyVowel è vero al turno successivo di chi ha accumulato 500+', () => {
  const gi = make('CECE BACA');
  giramoe.setMultiplier(gi, 250);
  giramoe.callConsonant(gi, 'C'); // P0 -> 750
  giramoe.timeout(gi);            // P1
  giramoe.callConsonant(gi, 'Z'); // assente -> P2
  giramoe.callConsonant(gi, 'Z'); // assente -> torna a P0
  assert.strictEqual(gi.currentTurnIndex, 0);
  assert.strictEqual(giramoe.canBuyVowel(gi, 0), true);
});

test('canBuyVowel è falso prima dello spin e quando le vocali sono finite', () => {
  const gi = make('CECE');
  gi.players[0].points = 1000;
  assert.strictEqual(giramoe.canBuyVowel(gi, 0), false, 'stato AWAIT_SPIN');
  giramoe.setMultiplier(gi, 250);
  assert.strictEqual(giramoe.vowelsFinished(gi), false);
  assert.strictEqual(giramoe.canBuyVowel(gi, 0), true);
  board.revealLetter(gi.board.grid, 'E'); // unica vocale di "CECE"
  assert.strictEqual(giramoe.vowelsFinished(gi), true);
  assert.strictEqual(giramoe.canBuyVowel(gi, 0), false, 'niente più vocali da comprare');
});
```

- [ ] **Step 2: Lancia i test e verifica che falliscano**

```bash
node --test --test-concurrency=1 tests/giramoe.test.js
```

Atteso: FAIL con `TypeError: giramoe.canBuyVowel is not a function`.

- [ ] **Step 3: Implementa gli helper**

In `giramoe.js`, aggiungi la costante subito sotto `const board = require('./board');`:

```js
const VOWEL_COST = 500; // prezzo di una vocale, come negli altri round
```

e, subito dopo la funzione `consonantsFinished`, aggiungi:

```js
// Ogni vocale presente nella frase è stata rivelata -> non c'è più niente da comprare.
function vowelsFinished(gi) {
  return board.boardStatus(gi.board.grid).vowelsFinished;
}

// Il giocatore di turno può comprare una vocale al posto di chiamare una consonante:
// una sola azione per turno, quindi l'acquisto si chiude appena una lettera è stata
// chiamata (e viceversa: callConsonant rifiuta già quando calledThisTurn è vero).
function canBuyVowel(gi, playerIndex) {
  if (gi.state !== 'PLAYING' || gi.calledThisTurn) return false;
  if (playerIndex !== gi.currentTurnIndex) return false;
  if (vowelsFinished(gi)) return false;
  return gi.players[playerIndex].points >= VOWEL_COST;
}
```

Aggiorna l'export in fondo al file:

```js
module.exports = {
  VOWEL_COST,
  createGiramoe, currentPlayer, setMultiplier, passTurn,
  callConsonant, consonantsFinished, vowelsFinished, canBuyVowel,
  buzz, judgeCorrect, judgeWrong, timeout, bankResult
};
```

- [ ] **Step 4: Lancia i test e verifica che passino**

```bash
node --test --test-concurrency=1 tests/giramoe.test.js
```

Atteso: PASS, tutti i test del file inclusi quelli preesistenti.

- [ ] **Step 5: Commit**

```bash
git add giramoe.js tests/giramoe.test.js
git commit -m "feat(giramoe): helper canBuyVowel e vowelsFinished"
```

---

### Task 2: `buyVowel` in `giramoe.js`

**Files:**
- Modify: `giramoe.js` (dopo `callConsonant`)
- Test: `tests/giramoe.test.js` (in fondo)

- [ ] **Step 1: Scrivi i test che falliscono**

Aggiungi in fondo a `tests/giramoe.test.js`:

```js
// Porta il gioco al secondo turno di P0 con 750 punti in tasca e la parola intatta
// tranne le C: P1 e P2 bruciano il turno con una consonante assente.
function primed(phrase = 'CECE BACA') {
  const gi = make(phrase);
  giramoe.setMultiplier(gi, 250);
  giramoe.callConsonant(gi, 'C'); // P0: 3 occorrenze -> 750
  giramoe.timeout(gi);            // -> P1
  giramoe.callConsonant(gi, 'Z'); // assente -> P2
  giramoe.callConsonant(gi, 'Z'); // assente -> P0
  assert.strictEqual(gi.currentTurnIndex, 0);
  assert.strictEqual(gi.players[0].points, 750);
  return gi;
}

test('vocale presente: costa 500, non dà punti, si rivela e apre la prenotazione', () => {
  const gi = primed();
  const res = giramoe.buyVowel(gi, 'E'); // "CECE BACA" -> 2 E
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.present, true);
  assert.strictEqual(res.count, 2);
  assert.strictEqual(gi.players[0].points, 250, '750 - 500, nessun punto per la vocale');
  assert.ok(gi.usedLetters.includes('E'), 'vocale presente bruciata per tutti');
  assert.strictEqual(gi.calledThisTurn, true, 'azione del turno spesa');
  assert.strictEqual(gi.currentTurnIndex, 0, 'il turno non passa');
  assert.strictEqual(giramoe.buzz(gi, 0).ok, true, 'la prenotazione è ora possibile');
});

test('vocale assente: costa comunque 500, passa il turno e resta comprabile', () => {
  const gi = primed(); // in "CECE BACA" la U non c'è
  const res = giramoe.buyVowel(gi, 'U');
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.present, false);
  assert.strictEqual(res.passed, true);
  assert.strictEqual(gi.players[0].points, 250, 'i 500 sono persi');
  assert.ok(!gi.usedLetters.includes('U'), 'la vocale assente non è bruciata');
  assert.strictEqual(gi.currentTurnIndex, 1, 'turno passato');
  assert.strictEqual(gi.calledThisTurn, false);
  assert.strictEqual(giramoe.buzz(gi, 0).ok, false, 'chi ha comprato non si prenota');
});

test('con meno di 500 punti la vocale non si compra', () => {
  const gi = make('CECE BACA');
  giramoe.setMultiplier(gi, 100);
  giramoe.callConsonant(gi, 'C'); // P0 -> 300
  giramoe.timeout(gi);
  giramoe.callConsonant(gi, 'Z');
  giramoe.callConsonant(gi, 'Z'); // -> P0, 300 punti
  assert.strictEqual(giramoe.buyVowel(gi, 'E').ok, false);
  assert.strictEqual(gi.players[0].points, 300, 'niente addebito su un acquisto rifiutato');
});

test('consonante e vocale si escludono nello stesso turno', () => {
  const gi = primed();
  // dopo l'acquisto niente consonante
  assert.strictEqual(giramoe.buyVowel(gi, 'E').ok, true);
  assert.strictEqual(giramoe.callConsonant(gi, 'B').ok, false, 'niente consonante dopo la vocale');
  // e viceversa, in un turno pulito
  const gi2 = primed();
  assert.strictEqual(giramoe.callConsonant(gi2, 'B').ok, true);
  assert.strictEqual(giramoe.buyVowel(gi2, 'E').ok, false, 'niente vocale dopo la consonante');
  assert.strictEqual(gi2.players[0].points, 1000, '750 + 250, nessun addebito');
});

test('non si comprano consonanti, vocali già rivelate né vocali prima dello spin', () => {
  const gi = primed();
  assert.strictEqual(giramoe.buyVowel(gi, 'B').ok, false, 'B non è una vocale');
  assert.strictEqual(giramoe.buyVowel(gi, 'E').ok, true);
  giramoe.timeout(gi);            // -> P1
  giramoe.callConsonant(gi, 'Z'); // -> P2
  giramoe.callConsonant(gi, 'Z'); // -> P0 (250 punti: sotto soglia)
  gi.players[0].points = 900;
  assert.strictEqual(giramoe.buyVowel(gi, 'E').ok, false, 'E è già stata rivelata');
});

test('con le consonanti finite la vocale è opzionale: la prenotazione resta libera', () => {
  const gi = make('CACA'); // unica consonante C, unica vocale A
  giramoe.setMultiplier(gi, 250);
  giramoe.callConsonant(gi, 'C'); // P0 -> 500, consonanti finite
  assert.strictEqual(giramoe.consonantsFinished(gi), true);
  giramoe.timeout(gi); // -> P1, che è a 0 punti
  assert.strictEqual(giramoe.canBuyVowel(gi, 1), false, 'P1 non può comprare');
  assert.strictEqual(giramoe.buzz(gi, 1).ok, true, 'ma si prenota lo stesso, senza spendere');
});
```

- [ ] **Step 2: Lancia i test e verifica che falliscano**

```bash
node --test --test-concurrency=1 tests/giramoe.test.js
```

Atteso: FAIL con `TypeError: giramoe.buyVowel is not a function`.

- [ ] **Step 3: Implementa `buyVowel`**

In `giramoe.js`, subito dopo `callConsonant` (prima di `consonantsFinished`):

```js
// Il giocatore di turno compra una vocale con 500 dei suoi punti giramoe, al posto
// di chiamare una consonante. Presente -> rivelata (nessun punto) e si apre la
// finestra di prenotazione, esattamente come dopo una consonante presente.
// Assente -> i 500 sono persi, niente prenotazione, il turno passa.
function buyVowel(gi, letter) {
  letter = String(letter).toUpperCase();
  if (!canBuyVowel(gi, gi.currentTurnIndex)) return { ok: false };
  if (!board.isVowel(letter) || gi.usedLetters.includes(letter)) return { ok: false };

  const p = currentPlayer(gi);
  p.points -= VOWEL_COST;

  const count = board.countOccurrences(gi.board.grid, letter);
  if (count > 0) {
    const positions = board.letterPositions(gi.board.grid, letter);
    board.revealLetter(gi.board.grid, letter);
    gi.usedLetters.push(letter);
    gi.calledThisTurn = true; // azione del turno spesa: apre la prenotazione
    return { ok: true, present: true, count, positions };
  }
  // Vocale assente: non registrata, resta comprabile più avanti — stessa regola
  // delle consonanti assenti di questo round.
  passTurn(gi);
  return { ok: true, present: false, count: 0, positions: [], passed: true };
}
```

Aggiungi `buyVowel` all'export:

```js
module.exports = {
  VOWEL_COST,
  createGiramoe, currentPlayer, setMultiplier, passTurn,
  callConsonant, buyVowel, consonantsFinished, vowelsFinished, canBuyVowel,
  buzz, judgeCorrect, judgeWrong, timeout, bankResult
};
```

- [ ] **Step 4: Lancia i test e verifica che passino**

```bash
node --test --test-concurrency=1 tests/giramoe.test.js
```

Atteso: PASS su tutto il file.

- [ ] **Step 5: Aggiorna il commento di testa del modulo**

In cima a `giramoe.js`, sostituisci la frase

```
// V; players then take turns calling ONE consonant each (no vowels). A present
```

con

```
// V; players then take turns making ONE move each: call a consonant, or buy a
// vowel for 500 of their giramoe points (reveal only, no points). A present
```

- [ ] **Step 6: Commit**

```bash
git add giramoe.js tests/giramoe.test.js
git commit -m "feat(giramoe): acquisto vocali a 500 nel tabellone giramoe"
```

---

### Task 3: Handler socket e vista giocatore in `server.js`

**Files:**
- Modify: `server.js:540-564` (`playerGiramoeView`)
- Modify: `server.js:928-943` (dopo l'handler `player:giramoeLetter`)

- [ ] **Step 1: Esponi `canBuyVowel` e aggiorna i messaggi in `playerGiramoeView`**

Sostituisci l'intera funzione `playerGiramoeView` (riga ~540) con:

```js
function playerGiramoeView(i) {
  const gi = state.gi;
  const isMyTurn = gi.currentTurnIndex === i;
  const finished = giramoe.consonantsFinished(gi);
  const canCall = isMyTurn && gi.state === 'PLAYING' && !gi.calledThisTurn && !finished;
  // Una sola mossa per turno: o consonante o vocale comprata a 500.
  const canBuyVowel = giramoe.canBuyVowel(gi, i);
  // Once every consonant is out, the current player can buzz straight away.
  const canBuzz = isMyTurn && gi.state === 'PLAYING' && (gi.calledThisTurn || finished);
  let message;
  if (gi.state === 'AWAIT_SPIN') message = 'L\'admin sta per girare la ruota…';
  else if (gi.state === 'BUZZED') message = gi.buzzedBy === i ? 'Di\' la soluzione!' : `${gi.players[gi.buzzedBy].name} risponde…`;
  else if (!isMyTurn) message = `Turno di ${gi.players[gi.currentTurnIndex].name}`;
  else if (finished) message = canBuyVowel
    ? 'Consonanti finite: compra una vocale o prenotati'
    : 'Consonanti finite: prenotati e risolvi!';
  else if (canCall) message = canBuyVowel
    ? 'Tocca a te: chiama una consonante o compra una vocale'
    : 'Tocca a te: chiama una consonante';
  else if (canBuzz) message = 'Prenotati e risolvi, o passa';
  else message = '';
  return {
    isMyTurn, state: gi.state, canCall, canBuyVowel, canBuzz,
    buzzedByMe: gi.buzzedBy === i,
    points: gi.players[i].points,
    multiplier: gi.multiplier,
    usedLetters: gi.usedLetters,
    currentTurnName: gi.players[gi.currentTurnIndex].name,
    message
  };
}
```

- [ ] **Step 2: Aggiungi l'handler `player:giramoeVowel`**

Subito dopo la chiusura dell'handler `socket.on('player:giramoeLetter', ...)` (riga ~943), inserisci:

```js
  // Il giocatore di turno compra una vocale (500) invece di chiamare una consonante.
  socket.on('player:giramoeVowel', ({ letter }) => {
    if (state.phase !== 'giramoe' || !state.gi) return;
    if (socket.playerIndex !== state.gi.currentTurnIndex) return;
    const res = giramoe.buyVowel(state.gi, letter);
    if (!res.ok) return;
    io.to('main').emit('main:letterCalled', { letter: String(letter).toUpperCase() });
    if (res.present) {
      io.to('main').emit('main:revealLetter', { positions: res.positions });
      startGiramoeBuzzWindow();
    } else {
      // Vocale assente: niente finestra, il turno è già passato al giocatore dopo.
      clearGiramoeTimer();
      io.to('main').emit('main:wrong');
    }
    broadcastGiramoe();
  });
```

- [ ] **Step 3: Verifica che il server si carichi e che la suite regga**

```bash
node --test --test-concurrency=1 tests/giramoe.test.js tests/giramoe.integration.test.js
```

Atteso: PASS su entrambi i file (il flusso esistente non deve cambiare).

- [ ] **Step 4: Commit**

```bash
git add server.js
git commit -m "feat(giramoe): evento socket player:giramoeVowel e stato canBuyVowel"
```

---

### Task 4: Smoke socket end-to-end

**Files:**
- Create: `tests/giramoe-vocali.integration.test.js`

Nota: ogni file di integrazione avvia e chiude il proprio server di loopback, quindi il nuovo scenario va in un file a sé invece che dentro `giramoe.integration.test.js` (che chiude `ioServer` alla fine del suo unico test).

- [ ] **Step 1: Scrivi il test che fallisce**

Crea `tests/giramoe-vocali.integration.test.js`:

```js
// End-to-end socket per l'acquisto vocali nel tabellone GIRAMOE. Server di
// loopback autonomo; gap del triplete accorciato e ruota forzata (seam da env)
// per un flusso deterministico.
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

test('giramoe: la vocale costa 500, apre la prenotazione e accende il banner',
  { timeout: 60000 }, async () => {
  await listening();
  const BASE = `http://127.0.0.1:${server.address().port}`;
  const connect = () => io(BASE, { transports: ['websocket'], forceNew: true });

  const admin = connect(), main = connect();
  let adminState = null;
  const m = { reveals: [], status: null, solved: null };
  admin.on('admin:state', s => { adminState = s; });
  main.on('main:revealLetter', d => { m.reveals.push(d); });
  main.on('main:boardStatus', d => { m.status = d; });
  main.on('main:giramoeSolved', d => { m.solved = d; });

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

    // Round 1: 3 tabelloni risolti dall'admin.
    for (let b = 0; b < 3; b++) {
      admin.emit('admin:setBoard', { category: 'X', phrase: 'OK' });
      await wait(100);
      admin.emit('admin:solve');
      await wait(150);
    }
    // Triplete: P1 risolve tutti e tre (banca 5000).
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
    // Express: 3 tabelloni risolti dall'admin.
    for (let b = 0; b < 3; b++) {
      admin.emit('admin:setBoard', { category: 'X', phrase: 'OK' });
      await wait(100);
      admin.emit('admin:solve');
      await wait(150);
    }

    // --- GIRAMOE: "CECE CREME" -> consonanti C x3, R, M; unica vocale E x4 ---
    assert.strictEqual(adminState.phase, 'giramoe', 'siamo nel tabellone giramoe');
    admin.emit('admin:giramoeSetBoard', { category: 'CIBO', phrase: 'CECE CREME' });
    await wait(200);
    admin.emit('admin:giramoeSpin');
    await wait(300);
    assert.strictEqual(adminState.giramoe.multiplier, 250, 'moltiplicatore dallo spin');

    // P1 chiama C (3 occorrenze) -> 750.
    players[0].emit('player:giramoeLetter', { letter: 'C' });
    await wait(200);
    assert.strictEqual(adminState.giramoe.players[0].points, 750);

    // Ha già agito in questo turno: la vocale viene rifiutata, nessun addebito.
    players[0].emit('player:giramoeVowel', { letter: 'E' });
    await wait(150);
    assert.strictEqual(adminState.giramoe.players[0].points, 750, 'acquisto rifiutato dopo la consonante');

    // P1 si prenota e sbaglia -> tocca a P2.
    players[0].emit('player:giramoeBuzz');
    await wait(150);
    admin.emit('admin:giramoeWrong');
    await wait(150);
    assert.strictEqual(adminState.giramoe.currentTurn, 1);

    // P2 è a 0 punti: non può comprare. Poi brucia il turno con una consonante assente.
    players[1].emit('player:giramoeVowel', { letter: 'E' });
    await wait(150);
    assert.strictEqual(adminState.giramoe.players[1].points, 0, 'senza punti non si compra');
    assert.strictEqual(adminState.giramoe.currentTurn, 1, 'e il turno non passa');
    players[1].emit('player:giramoeLetter', { letter: 'Z' });
    await wait(150);
    assert.strictEqual(adminState.giramoe.currentTurn, 2, 'consonante assente: passa a P3');

    // P3 fa lo stesso -> torna a P1, che ha 750 punti e le consonanti R e M ancora libere.
    players[2].emit('player:giramoeLetter', { letter: 'Z' });
    await wait(150);
    assert.strictEqual(adminState.giramoe.currentTurn, 0, 'torna a P1');

    // Senza aver agito, P1 non si può prenotare: le consonanti non sono finite.
    players[0].emit('player:giramoeBuzz');
    await wait(150);
    assert.strictEqual(adminState.giramoe.buzzedBy, null, 'niente prenotazione senza una mossa');

    // P1 compra la E: -500, 4 occorrenze rivelate, vocali finite -> banner.
    const revealsBefore = m.reveals.length;
    players[0].emit('player:giramoeVowel', { letter: 'E' });
    await wait(200);
    assert.strictEqual(adminState.giramoe.players[0].points, 250, '750 - 500, la vocale non dà punti');
    assert.strictEqual(m.reveals.length, revealsBefore + 1, 'lettera rivelata sul tabellone');
    assert.strictEqual(m.reveals[m.reveals.length - 1].positions.length, 4, 'tutte e 4 le E');
    assert.ok(m.status && m.status.vowelsFinished, 'banner vocali finite acceso');

    // L'acquisto ha aperto la finestra: ora la prenotazione passa.
    players[0].emit('player:giramoeBuzz');
    await wait(150);
    assert.strictEqual(adminState.giramoe.buzzedBy, 0, 'prenotazione accettata dopo l\'acquisto');

    admin.emit('admin:giramoeCorrect');
    await wait(200);
    assert.ok(m.solved && m.solved.points === 250, 'P1 risolve con i punti rimasti');
    const byName = Object.fromEntries(adminState.players.map(p => [p.name, p.bank]));
    assert.strictEqual(byName.P1, 5250, '5000 dal triplete + 250 rimasti dopo la vocale');
    assert.strictEqual(byName.P2, 0);
    assert.strictEqual(byName.P3, 0);

    // Lascia scadere il passaggio automatico alla fase finalista prima di chiudere,
    // altrimenti il timer del server scatta a socket già chiuse.
    await wait(2900);
    assert.strictEqual(adminState.phase, 'finalist', 'dopo il giramoe si va al finalista');
  } finally {
    [admin, main, ...players].forEach(s => s.close());
    await new Promise(r => ioServer.close(r));
  }
});
```

- [ ] **Step 2: Lancia il test**

```bash
node --test --test-concurrency=1 tests/giramoe-vocali.integration.test.js
```

Atteso: PASS. Se fallisce sull'asserzione del banner, controlla che `broadcastGiramoe()` venga chiamata alla fine dell'handler `player:giramoeVowel` (è lei a emettere `main:boardStatus` via `emitBoardStatus`).

- [ ] **Step 3: Commit**

```bash
git add tests/giramoe-vocali.integration.test.js
git commit -m "test(giramoe): smoke socket dell'acquisto vocali"
```

---

### Task 5: Pulsante e picker vocali sul telefono

**Files:**
- Modify: `public/play.html:70-81` (schermata `#player-giramoe-screen`)
- Modify: `public/js/player.js:172-201` (`buildGiramoeKeyboard`, `applyGiramoeState`)

- [ ] **Step 1: Aggiungi il markup**

In `public/play.html`, dentro `#player-giramoe-screen`, sostituisci

```html
      <div class="keyboard" id="gi-keyboard"></div>
      <button class="buzz-pill" id="btn-gi-buzz" disabled>PRENOTATI</button>
```

con

```html
      <div class="keyboard" id="gi-keyboard"></div>
      <button class="glass-button" id="btn-gi-vowel" disabled>Compra vocale (500)</button>
      <div class="vowel-picker hidden" id="gi-vowel-picker"></div>
      <button class="buzz-pill" id="btn-gi-buzz" disabled>PRENOTATI</button>
```

Le classi `glass-button`, `vowel-picker` e `key vowel` esistono già in `public/css/style.css` (usate dalla schermata ruota): nessun CSS nuovo.

- [ ] **Step 2: Costruisci il picker in `buildGiramoeKeyboard`**

In `public/js/player.js`, in fondo a `buildGiramoeKeyboard()`, dopo il `forEach` che riempie `#gi-keyboard`, aggiungi:

```js
  const vp = document.getElementById('gi-vowel-picker');
  vp.innerHTML = '';
  VOWELS.forEach(letter => {
    const b = document.createElement('button');
    b.className = 'key vowel';
    b.textContent = letter;
    b.dataset.letter = letter;
    b.addEventListener('click', () => {
      socket.emit('player:giramoeVowel', { letter });
      vp.classList.add('hidden');
    });
    vp.appendChild(b);
  });

  document.getElementById('btn-gi-vowel').addEventListener('click', () => {
    vp.classList.toggle('hidden');
    // Sui telefoni bassi il picker sta sotto la piega: portalo in vista.
    if (!vp.classList.contains('hidden')) vp.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
```

- [ ] **Step 3: Gestisci lo stato in `applyGiramoeState`**

Sempre in `public/js/player.js`, dentro `applyGiramoeState(st)`, subito prima delle righe che gestiscono `btn-gi-buzz`, aggiungi:

```js
  const vowelBtn = document.getElementById('btn-gi-vowel');
  const vp = document.getElementById('gi-vowel-picker');
  vowelBtn.disabled = !st.canBuyVowel;
  if (!st.canBuyVowel) vp.classList.add('hidden');
  document.querySelectorAll('#gi-vowel-picker .key').forEach(b => {
    b.disabled = st.usedLetters.includes(b.dataset.letter);
  });
```

- [ ] **Step 4: Verifica a mano nel browser**

Avvia il server (se resta appeso su "Avvio il server locale…" è iCloud che materializza `node_modules`: lancia prima `node -e "require('express')"`):

```bash
npm start
```

Apri la console admin, il display principale e tre telefoni (o tre schede su `/play.html?room=<codice>`), porta la partita fino al GIRAMOE — oppure verifica solo che la schermata GIRAMOE del telefono mostri il pulsante "Compra vocale (500)" disabilitato e che aprendolo compaiano le cinque vocali. Il flusso completo è già coperto dal test di Task 4.

- [ ] **Step 5: Commit**

```bash
git add public/play.html public/js/player.js
git commit -m "feat(giramoe): pulsante compra vocale sulla schermata del telefono"
```

---

### Task 6: Regolamento di Samiro

**Files:**
- Modify: `public/js/samiro-faq.js:112-121`
- Modify: `docs/samiro-regolamento.md:95-101`

- [ ] **Step 1: Aggiorna le FAQ del client**

In `public/js/samiro-faq.js`, sostituisci la risposta della voce "Come funziona la fase Giramoe?" con:

```js
    a: 'L’admin (Moe) gira una ruota che ha solo punteggi: il valore ottenuto diventa il moltiplicatore. Poi i giocatori a turno fanno una sola mossa ciascuno: chiamano una consonante — ogni consonante presente vale quel moltiplicatore × le sue occorrenze — oppure comprano una vocale a 500 punti. Comprare la vocale esclude la consonante per quel turno, e viceversa.',
```

e sostituisci la risposta della voce "In Giramoe come ci si prenota per rispondere?" con:

```js
    a: 'Dopo aver chiamato una consonante presente o comprato una vocale presente hai pochi secondi (5) per prenotarti e dire la frase. Se la lettera è assente niente prenotazione e passi il turno. Quando tutte le consonanti sono state rivelate ti puoi prenotare subito, senza chiamare né comprare nulla.',
```

Aggiungi subito dopo, prima del commento `// --- Fase 5: Finale ---`, una voce nuova:

```js
  {
    q: 'In Giramoe si possono comprare le vocali?',
    a: 'Sì, costano 500 punti come sempre, scalati dai punti che stai accumulando nel Giramoe (quindi ti serve almeno una consonante presa prima). La vocale viene solo rivelata e non dà punti, ma apre la prenotazione. Se non è nel tabellone i 500 sono persi e passi il turno — e quella vocale resta comprabile da chiunque, come le consonanti assenti.',
    k: ['giramoe vocali', 'comprare vocale giramoe', 'vocale giramoe', 'giramoe 500']
  },
```

- [ ] **Step 2: Aggiorna il regolamento sorgente**

In `docs/samiro-regolamento.md`, nella sezione "Fase 4 — Giramoe", sostituisci le risposte con lo stesso testo dello Step 1 e aggiungi la voce nuova nello stesso formato del file:

```markdown
**D:** In Giramoe si possono comprare le vocali?
**R:** Sì, costano 500 punti come sempre, scalati dai punti che stai accumulando nel Giramoe (quindi ti serve almeno una consonante presa prima). La vocale viene solo rivelata e non dà punti, ma apre la prenotazione. Se non è nel tabellone i 500 sono persi e passi il turno — e quella vocale resta comprabile da chiunque, come le consonanti assenti.
_keyword: giramoe vocali, comprare vocale giramoe, vocale giramoe_
```

- [ ] **Step 3: Commit**

```bash
git add public/js/samiro-faq.js docs/samiro-regolamento.md
git commit -m "docs: regolamento Samiro con le vocali del Giramoe"
```

---

### Task 7: Verifica finale

**Files:** nessuno

- [ ] **Step 1: Lancia tutta la suite**

```bash
node --test --test-concurrency=1
```

Atteso: PASS su tutti i file. Dura 3–4 minuti per via degli `*.integration.test.js` finali: lascia finire, non è appesa.

- [ ] **Step 2: Controlla che non sia rimasto niente fuori**

```bash
git status --short
```

Atteso: nessuna modifica non committata.
