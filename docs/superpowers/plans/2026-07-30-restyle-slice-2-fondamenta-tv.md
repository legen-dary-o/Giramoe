# Restyle slice 2 — Fondamenta TV e fase 01

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mettere in piedi la cornice comune delle schermate TV (barra alta con le 6 chip di fase, barra bassa giocatori, campo halftone mascherato, celle del tabellone, categoria) e completare la `1c` — primo gioco — coi tre moduli `Spicchio` / `Lettera` / `Occorrenze`.

**Architecture:** Tre parti in sequenza, ognuna con la sua review. **A** costruisce l'harness `?mock=`, che sostituisce la socket con un oggetto della stessa API e rigioca payload d'esempio: serve a raggiungere ogni schermata senza montare una partita. **B** spezza `style.css` in cinque file per superficie, e usa l'harness per dimostrare che non è cambiato **nessun** valore calcolato. **C** costruisce la cornice TV e la `1c`. L'ordine non è negoziabile: B senza A non è verificabile.

**Tech Stack:** HTML statico, CSS senza bundler, moduli ES per la TV (`main.js` è già `type="module"`), Socket.IO, `node --test`.

**Spec:** `docs/superpowers/specs/2026-07-30-restyle-giramoe-design.md`
**Riferimento visivo:** `design_handoff_tv_screens/README.md` (§ Cornice comune, § Tabellone, § 1c), `design_handoff_tv_screens/screenshots/1c-primo-gioco.png`

**Nota sul formato:** dove un passo **sposta** codice esistente senza modificarlo, il piano dice quali righe e dove, non le ricopia. Dove il codice è **nuovo**, il piano lo contiene per intero — con una sola eccezione dichiarata: i due renderer di `tv/shell.js` (Task C1), di cui il piano fissa la firma e il CSS che ne determina la struttura, ma non il corpo. È una deviazione voluta: il corpo è DOM di costruzione, interamente determinato dalle classi elencate nello Step 2, e ricopiarlo qui vorrebbe dire scriverlo due volte.

---

# Parte A — Harness `?mock=`

## Task A1: Socket finta e primo fixture

**Files:**
- Create: `public/js/dev/mock.js`
- Create: `public/js/dev/fixtures.js`
- Modify: `public/js/main.js:29`

- [x] **Step 1: Creare `public/js/dev/mock.js`**

```js
// Socket finta per lo sviluppo delle schermate: stessa API di socket.io
// (`on`, `emit`, `id`, `connected`), ma invece di parlare col server rigioca i
// payload di fixtures.js. Non duplica il rendering: chiama gli handler veri, gli
// stessi che riceverebbero i dati dalla partita. Se una schermata viene giusta
// col fixture, viene giusta col payload reale.
//
// Uso: index.html?mock=1c · play.html?mock=1e · admin.html?mock=1v
//      &freeze=<stato> tiene fermo uno stato transitorio (vedi fixtures.js)

class MockSocket {
  constructor() {
    this.id = 'mock-socket';
    this.connected = true;
    this._handlers = new Map();
  }
  on(event, fn) {
    if (!this._handlers.has(event)) this._handlers.set(event, []);
    this._handlers.get(event).push(fn);
    return this;
  }
  off(event, fn) {
    const list = this._handlers.get(event);
    if (list) this._handlers.set(event, list.filter(f => f !== fn));
    return this;
  }
  // il client emette verso il server: in mock non c'è nessuno che ascolti
  emit(event, ...args) {
    console.debug('[mock] emit ignorato:', event, ...args);
    return this;
  }
  // consegna un payload agli handler registrati, come farebbe il server
  deliver(event, payload) {
    const list = this._handlers.get(event) || [];
    if (!list.length) console.warn('[mock] nessun handler per', event);
    list.forEach(fn => fn(payload));
  }
}

// Rigioca una sequenza [event, payload][] con una pausa fra i passi, così le
// animazioni di ingresso partono come in partita.
async function replay(socket, steps, stepMs) {
  for (const [event, payload] of steps) {
    socket.deliver(event, payload);
    if (stepMs) await new Promise(r => setTimeout(r, stepMs));
  }
}

export async function installMock(surface) {
  const params = new URLSearchParams(location.search);
  const screen = params.get('mock');
  if (!screen) return null;

  const socket = new MockSocket();
  window.__mockSocket = socket;

  const { sequenceFor } = await import('./fixtures.js');
  const steps = sequenceFor(surface, screen, params.get('freeze'));
  if (!steps) {
    console.error(`[mock] nessun fixture per ${surface}/${screen}`);
    return socket;
  }
  // gli handler si registrano quando il modulo della superficie viene eseguito:
  // il replay parte al tick successivo, e `connect` per primo come fa socket.io
  setTimeout(async () => {
    socket.deliver('connect');
    await replay(socket, steps, Number(params.get('step')) || 0);
    console.info(`[mock] ${surface}/${screen} pronto`, steps.length, 'passi');
  }, 0);
  return socket;
}
```

- [x] **Step 2: Creare il generatore delle griglie**

`scripts/gen-fixtures.js` — gira in Node, usa `board.js` (lo stesso modulo del server) e scrive
un file di dati per il browser. Va rieseguito se cambiano le frasi d'esempio.

```js
// Genera le griglie dei fixture usando board.js, così il markup dell'harness è
// identico a quello che produce il server. Uso: node scripts/gen-fixtures.js
const fs = require('fs');
const path = require('path');
const board = require('../board');

// [frase, categoria, lettere già rivelate]
const CASES = [
  ['NON TUTTE LE CIAMBELLE RIESCONO CON IL BUCO', 'PROVERBI', 'NTE'],
  ['MEGLIO UN UOVO OGGI CHE UNA GALLINA DOMANI', 'SAGGEZZA POPOLARE', ''],
  ['IL GIRO DEL MONDO IN OTTANTA GIORNI', 'VIAGGI', 'TONI'],
  ['LE CINQUE TERRE DELLA LIGURIA', 'GEOGRAFIA', 'LRC'],
  ['MI RITORNI IN MENTE BELLA COME SEI', 'CANZONI ITALIANE', 'NRTELMCI']
];

const out = {};
for (const [phrase, category, revealed] of CASES) {
  const res = board.createBoard(category, phrase);
  if (!res.ok) throw new Error(`board.createBoard ha rifiutato "${phrase}": ${res.error}`);
  for (const ch of revealed) board.revealLetter(res.board.grid, ch);
  // stessa proiezione di boardView() in server.js
  const grid = res.board.grid.map(row => row.map(cell =>
    cell.type === 'letter'
      ? { type: 'letter', revealed: cell.revealed, letter: cell.revealed ? (cell.display || cell.letter) : null }
      : { type: cell.type }));
  out[phrase] = Object.assign(out[phrase] || {}, { [revealed || 'VUOTO']: grid });
}

const dest = path.join(__dirname, '..', 'public', 'js', 'dev', 'boards.generated.js');
fs.writeFileSync(dest,
  '// GENERATO da scripts/gen-fixtures.js — non modificare a mano.\n' +
  '// Le griglie vengono da board.js, lo stesso modulo del server.\n' +
  'export const GRIDS = ' + JSON.stringify(out, null, 1) + ';\n');
console.log('scritto', dest, Object.keys(out).length, 'frasi');
```

⚠ La firma di `board.revealLetter` va verificata su `board.js` prima di scrivere questo file: se
è `revealLetter(board, letter)` invece di `(grid, letter)`, o se ritorna un oggetto con
`positions`, il codice qui sopra va adeguato. È l'unico punto del piano che dipende da una firma
non verificata.

```bash
node scripts/gen-fixtures.js
```

Atteso: `scritto …/boards.generated.js 5 frasi`.

- [x] **Step 3: Creare `public/js/dev/fixtures.js` con il solo fixture `1c`**

I contenuti sono quelli dei mockup: categoria `PROVERBI`, frase
`NON TUTTE LE CIAMBELLE RIESCONO CON IL BUCO`, lettere rivelate `N T E`, Marco 1.400/3.200,
Giulia 5.800, Elia 2.100, turno di Marco, spicchio 500, lettera `T`, 3 occorrenze.

```js
// Contenuti d'esempio dei mockup, nella forma ESATTA dei payload del server
// (mainGameView, playerGiramoeView, envelopesView, …). Se una forma qui non
// combacia con quella di server.js, il fixture è sbagliato: la forma giusta è
// quella del server.

export const PLAYERS = [
  { id: 0, name: 'Marco',  roundPoints: 1400, bank: 3200, connected: true },
  { id: 1, name: 'Giulia', roundPoints: 0,    bank: 5800, connected: true },
  { id: 2, name: 'Elia',   roundPoints: 0,    bank: 2100, connected: true }
];

// Le griglie NON si scrivono a mano: le genera scripts/gen-fixtures.js usando
// board.js, cioè lo stesso codice del server. Una griglia scritta a occhio che
// non combacia con board.js renderebbe il fixture bugiardo, e il confronto col
// render di riferimento senza valore.
import { GRIDS } from './boards.generated.js';

const PROVERBIO = 'NON TUTTE LE CIAMBELLE RIESCONO CON IL BUCO';

// Gli stessi 16 spicchi di game.js
const SEGMENTS = [1000, 'bancarotta', 'raddoppia', 200, 400, 500, 'next', 400,
                  300, 700, 500, 'next', 400, 300, 500, 'next'];

const TV = {
  // 1c · primo gioco, turno di Marco, ha appena chiamato T con 3 occorrenze
  '1c': (freeze) => {
    const steps = [
      ['main:state', { phase: 'playing' }],
      ['main:gameState', {
        board: { category: 'PROVERBI', grid: GRIDS[PROVERBIO].NTE },
        scores: PLAYERS,
        currentTurn: 0,
        boardNumber: 1,
        totalBoards: 3,
        segments: SEGMENTS
      }],
      ['main:boardStatus', { revealed: 12, total: 33 }]
    ];
    // stato transitorio: spicchio 500, lettera T, ×3. Con &freeze=letter i
    // moduli Lettera/Occorrenze restano a schermo oltre i 3,5s.
    if (freeze !== 'none') {
      steps.push(['main:spin', { segmentIndex: 5, value: 500, type: 'points' }]);
      steps.push(['main:letterCalled', { letter: 'T' }]);
      steps.push(['main:revealLetter', { positions: [[0, 6], [0, 8], [0, 9]] }]);
    }
    return steps;
  }
};

const PHONE = {};
const ADMIN = {};

const BY_SURFACE = { tv: TV, phone: PHONE, admin: ADMIN };

export function sequenceFor(surface, screen, freeze) {
  const build = (BY_SURFACE[surface] || {})[screen];
  return build ? build(freeze) : null;
}
```

- [x] **Step 4: Innestare l'harness in `main.js`**

La riga 29 è `const socket = io();`. Va sostituita con:

```js
// In sviluppo, `?mock=<id>` sostituisce la socket con una finta che rigioca i
// payload d'esempio (public/js/dev/mock.js, servito solo fuori produzione).
const socket = new URLSearchParams(location.search).has('mock')
  ? await (await import('./dev/mock.js')).installMock('tv')
  : io();
```

⚠ Due `await`: uno per l'`import()` dinamico, uno per `installMock`, che è `async` e quindi
ritorna una Promise. Con un solo `await` si assegnerebbe la Promise a `socket` e ogni
`socket.on(...)` sotto esploderebbe con `socket.on is not a function`.

⚠ `await` al livello superiore del modulo: `main.js` è caricato con
`<script type="module">`, quindi il top-level await è consentito. `installMock` ritorna la socket
**subito** (il replay parte in un `setTimeout`), quindi gli `socket.on(...)` più sotto si
registrano prima che arrivi il primo payload.

- [x] **Step 5: Verificare che senza il parametro non cambi nulla**

Avvia il server con la configurazione `giramoe` di `.claude/launch.json`, apri
`http://localhost:3000/` e controlla la console: nessun errore, la schermata `Tocca per iniziare`
compare come prima, e in rete **non** compare `dev/mock.js`.

- [x] **Step 6: Verificare la `1c` col fixture**

Apri `http://localhost:3000/?mock=1c` a 1920×1080.

Atteso: la schermata di gioco **attuale** (pre-restyle) con categoria `PROVERBI`, il tabellone che
mostra `N`, `T`, `E` rivelate, le tre pillole punteggio di Marco/Giulia/Elia, la ruota. Nessun
errore in console. Nessun `[mock] nessun handler per …`.

Se compare qualche `[mock] nessun handler per X`, il fixture emette un evento che `main.js` non
ascolta: va corretto il nome dell'evento, non aggiunto un handler.

- [x] **Step 7: Commit**

```bash
git add public/js/dev/mock.js public/js/dev/fixtures.js public/js/main.js
git commit -m "chore(dev): harness ?mock= con socket finta e fixture della 1c"
```

---

## Task A2: Fixture per tutte le schermate attuali

Servono a coprire il CSS con markup rappresentativo, perché la Parte B possa dimostrare che lo
split non cambia niente. Sono le schermate **di oggi**, non quelle nuove.

**Files:**
- Modify: `public/js/dev/fixtures.js`
- Modify: `public/js/player.js:1`
- Modify: `public/js/admin.js:1`

- [x] **Step 1: Aggiungere i fixture TV**

Aggiungi a `TV` in `fixtures.js`, con la stessa forma dei payload del server
(`tripleteBoardView`, `finalBoardView`, `envelopesView`, `tiebreakView`, `giramoeBoardView`):

- `1b` — `main:showLobby` con `{ roomCode:'ABCD', url:'http://192.168.1.72:3000', players:[Marco, Giulia] }`
- `1e` — `main:tripleteBoard` (`MEGLIO UN UOVO OGGI CHE UNA GALLINA DOMANI`, categoria `SAGGEZZA POPOLARE`) + `main:tripleteScores` con `buzzedBy: 0` + `main:tripleteBuzzed`
- `1f` — come `1c` più `main:expressRound` e `main:expressStart` (frase `IL GIRO DEL MONDO IN OTTANTA GIORNI`, rivelate `TONI`)
- `1g` — `main:giramoeStart` + `main:giramoeBoard` (`LE CINQUE TERRE DELLA LIGURIA`, rivelate `LRC`) + `main:giramoeScores` con `multiplier: 500`
- `1h` — `main:finalist` + `main:finalBoard` (`MI RITORNI IN MENTE BELLA COME SEI`, rivelate `NRTELMCI`, categoria `CANZONI ITALIANE`) + `main:finalTimer` con `{ ms: 42000 }`
- `1j` — `main:envelopes` con `{ envelopes:[{color:'green',revealed:true,content:'Viaggio a New York'},{color:'red',revealed:false},{color:'green',revealed:false}], current:0, changesLeft:1, state:'CHOOSING' }`
- `tiebreak` — `main:tiebreakStart` + `main:tiebreakState` con due contendenti, uno col valore uscito

- [x] **Step 2: Aggiungere i fixture telefono**

Popola `PHONE` con: `1a` (nessun payload: è il form di ingresso), `1b`
(`player:gameStarted`), `1c`/`1d` (`player:turnState` con `turnState:'SPIN'` e `'PICK_CONSONANT'`),
`1e` (`player:expressRound` + `player:turnState`), `1f`/`1g`
(`player:tripleteState` con `canBuzz:true` e con `locked:true`), `1h`
(`player:giramoeState`), `1i` (`player:tiebreakState`), `1j` (`player:finalist`),
`1k` (`player:finalState`), `1l` (`player:envelopesState`).

Le forme sono quelle di `playerView`, `playerTripleteView`, `playerGiramoeView`,
`playerFinalView`, `envelopesView` in `server.js`.

- [x] **Step 3: Aggiungere i fixture admin**

Popola `ADMIN` con un `admin:state` per fase: `1n` (`phase:'pregame'`), `1o` (`'lobby'`),
`1p` (`'playing'`), `1q` (`'tripleteReady'`), `1r`/`1s` (`'triplete'` con `triplete.started`
false/true), `1t` (`'giramoe'`), `1u` (`'tiebreak'`), `1v` (`'finalist'`), `1w` (`'final'`),
`1x` (`'envelopes'`). La forma è quella di `adminView()`.

- [x] **Step 4: Innestare l'harness nel telefono e nell'admin**

`player.js` e `admin.js` sono script **classici**, non moduli: non possono usare `await import`.
La riga 1 di entrambi (`const socket = io();`) diventa:

```js
// In sviluppo `?mock=<id>` sostituisce la socket (vedi public/js/dev/mock.js).
// Qui lo script è classico: la finta viene installata prima, da un modulo nel
// tag <script type="module"> di play.html / admin.html.
const socket = window.__mockSocket || io();
```

E in `play.html`, **prima** di `<script src="/js/player.js">`:

```html
  <script type="module">
    if (new URLSearchParams(location.search).has('mock')) {
      const { installMock } = await import('/js/dev/mock.js');
      await installMock('phone');
    }
  </script>
```

⚠ Un `<script type="module">` è **deferred**: verrebbe eseguito *dopo* `player.js`, che è classico
e sincrono. Quindi `window.__mockSocket` non esisterebbe ancora. Per garantire l'ordine, in
`play.html` anche `player.js` va reso deferred:

```html
  <script src="/js/player.js" defer></script>
```

`defer` mantiene l'ordine relativo fra script deferred, quindi il modulo dell'harness gira prima.
Stessa modifica in `admin.html` (`surface: 'admin'`) e per `samiro-faq.js` / `samiro.js`, che
dipendono da `player.js`.

- [x] **Step 5: Verificare tutte le schermate**

Per ogni id, aprire l'URL e controllare: la schermata giusta è visibile, ha contenuto, console
senza errori e senza `[mock] nessun handler`.

```
http://localhost:3000/?mock=1b   1e  1f  1g  1h  1j  tiebreak
http://localhost:3000/play.html?mock=1a  1b  1c  1d  1e  1f  1g  1h  1i  1j  1k  1l
http://localhost:3000/admin.html?mock=1n  1o  1p  1q  1r  1s  1t  1u  1v  1w  1x
```

- [x] **Step 6: Commit**

```bash
git add public/js/dev/fixtures.js public/js/player.js public/js/admin.js public/play.html public/admin.html
git commit -m "chore(dev): fixture per tutte le schermate attuali, harness su telefono e admin"
```

---

## Task A3: Consegna della Parte A

- [x] **Step 1: Screenshot di controllo**

Una griglia con le schermate raggiunte via harness, per mostrare che l'attrezzo funziona.

- [x] **Step 2: Aspettare l'ok prima della Parte B**

---

# Parte B — Split del CSS, zero cambio visivo

Questa parte **non deve cambiare un pixel**. È un refactor, e va dimostrato, non affermato.

## Task B1: Baseline dei valori calcolati

**Files:**
- Create: `public/js/dev/stylesnap.js`

- [x] **Step 1: Creare `public/js/dev/stylesnap.js`**

```js
// Impronta dei valori calcolati di ogni elemento della pagina. Serve a dimostrare
// che uno split del CSS non ha cambiato niente: si esegue prima, si esegue dopo,
// e il diff deve essere vuoto. Guarda i valori CALCOLATI, non le regole, quindi
// non gli importa in quale file stia una dichiarazione.
//
// Uso dalla console: __styleSnap()  → stringa JSON da confrontare

const PROPS = [
  'display','position','top','right','bottom','left','width','height',
  'margin','padding','border','border-radius','box-shadow','outline',
  'background-color','background-image','background-size','background-position',
  'color','opacity','font-family','font-size','font-weight','line-height',
  'letter-spacing','text-transform','text-align','white-space',
  'flex-direction','flex-wrap','justify-content','align-items','align-content','gap','flex',
  'grid-template-columns','grid-template-rows','aspect-ratio',
  'transform','transform-origin','transition','animation','z-index','overflow',
  'mask-image','-webkit-mask-image','filter','visibility','pointer-events'
];

function path(el) {
  const bits = [];
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    let b = n.tagName.toLowerCase();
    if (n.id) { bits.unshift(b + '#' + n.id); break; }
    if (n.className && typeof n.className === 'string') b += '.' + n.className.trim().split(/\s+/).join('.');
    const sibs = n.parentElement ? [...n.parentElement.children].filter(c => c.tagName === n.tagName) : [];
    if (sibs.length > 1) b += `:nth(${sibs.indexOf(n)})`;
    bits.unshift(b);
  }
  return bits.join('>');
}

window.__styleSnap = () => {
  const out = [];
  // ogni .screen a turno visibile: altrimenti i valori calcolati dei nascosti
  // collassano e il confronto non copre niente
  const screens = [...document.querySelectorAll('.screen')];
  const was = screens.map(s => s.classList.contains('hidden'));
  for (let i = 0; i < screens.length; i++) {
    screens.forEach((s, j) => s.classList.toggle('hidden', j !== i));
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      out.push(`${screens[i].id}|${path(el)}|` + PROPS.map(p => cs.getPropertyValue(p)).join('§'));
    }
  }
  screens.forEach((s, j) => s.classList.toggle('hidden', was[j]));
  return out.sort().join('\n');
};
console.info('[stylesnap] pronto: __styleSnap()');
```

- [x] **Step 2: Caricarlo dall'harness**

In `mock.js`, dentro `installMock`, prima del `setTimeout`:

```js
  await import('./stylesnap.js');
```

- [x] **Step 3: Prendere la baseline delle tre superfici**

Per ognuna delle tre pagine, con un fixture ricco (`?mock=1c`, `play.html?mock=1c`,
`admin.html?mock=1p`), eseguire `__styleSnap()` dalla console e salvare l'output in
`scratchpad/snap-<superficie>-prima.txt`.

- [x] **Step 4: Commit dello strumento**

```bash
git add public/js/dev/stylesnap.js public/js/dev/mock.js
git commit -m "chore(dev): impronta dei valori calcolati, per verificare refactor di CSS"
```

---

## Task B2: Lo split

**Files:**
- Create: `public/css/tokens.css`, `public/css/shell.css`, `public/css/tv.css`, `public/css/phone.css`, `public/css/admin.css`
- Delete: `public/css/style.css`
- Modify: `public/index.html:7`, `public/play.html:7`, `public/admin.html:7`

- [x] **Step 1: Spostare i blocchi, verbatim**

Le dichiarazioni **non si toccano**: si spostano. Ripartizione per sezione di `style.css`
(numeri di riga della versione attuale):

| Destinazione | Sezioni |
|---|---|
| `tokens.css` | intestazione + `FONT` (6–25), `TOKENS` (26–57), `RESET & BASE` (58–94) |
| `shell.css` | `PRIMITIVE` (95–213), `LAYOUT` (214–268), `DISCONNECT OVERLAY` (789–812), `.matchend-title` (815–823), `ENVELOPES` (935–969), ruota condivisa (490–517) |
| `tv.css` | `INTRO` (269–320), `TITLE SCREEN` (321–336), `ROUND SCENES` (337–354), `LOBBY` (355–460), `GAME LAYOUT` (461–489), `Ruota TV` (518–588), `CATEGORIA` (589–623), `BOARD` (624–668), `PLAYERS BAR` (669–734), `RESULT OVERLAY` (735–759), `FEEDBACK` (760–788), `FINAL GAME` (852–889), `TRIPLETE` (890–934), `CURSORE` (1243–1278) |
| `phone.css` | `PLAYER PHONE` (970–1122) |
| `admin.css` | `ADMIN` (1123–1242) |

Tre blocchi servono a **due** superfici (`index.html` e `play.html`), quindi non stanno né in
`tv.css` né in `phone.css`: vanno in `shell.css`, che le due pagine caricano entrambe. Sono già
esclusi dalla tabella qui sopra:

- `ENVELOPES` (935–969) — `.envelopes-row` e `.envelope*` sono nel markup di entrambe
- `.matchend-title` (815–823) — resto di `FINALIST / MATCH END` (824–851) in `tv.css`
- `.wheel-container`, `.wheel-indicator`, `#main-wheel-canvas, #player-wheel-canvas` (490–517)

`REDUCED MOTION` (1279–1301) va **spezzato**: ogni regola segue il file del suo proprietario, in un
`@media (prefers-reduced-motion: reduce)` in coda a ciascun file. Le regole che riguardano
primitive condivise (`.wm`, `.screen`) vanno in `shell.css`.

- [x] **Step 2: Aggiornare i tre `<link>`**

`public/index.html` riga 7 — al posto di `<link rel="stylesheet" href="/css/style.css">`:

```html
  <link rel="stylesheet" href="/css/tokens.css">
  <link rel="stylesheet" href="/css/shell.css">
  <link rel="stylesheet" href="/css/tv.css">
```

`public/play.html` riga 7:

```html
  <link rel="stylesheet" href="/css/tokens.css">
  <link rel="stylesheet" href="/css/shell.css">
  <link rel="stylesheet" href="/css/phone.css">
```

`public/admin.html` riga 7:

```html
  <link rel="stylesheet" href="/css/tokens.css">
  <link rel="stylesheet" href="/css/shell.css">
  <link rel="stylesheet" href="/css/admin.css">
```

L'ordine conta: `tokens` definisce le variabili, `shell` le usa, il file di superficie sovrascrive.

- [x] **Step 3: Cancellare `style.css`**

```bash
git rm public/css/style.css
```

- [x] **Step 4: Verificare che nessun riferimento sia rimasto**

```bash
grep -rn "style.css" public/ docs/ README.md server.js
```

Atteso: nessuna riga in `public/`. Le occorrenze in `docs/` e `README.md` sono descrizioni da
aggiornare nello Step 6.

- [x] **Step 5: Il diff dei valori calcolati deve essere vuoto**

Ricarica le tre pagine con gli stessi fixture della baseline, esegui `__styleSnap()`, salva in
`scratchpad/snap-<superficie>-dopo.txt` e confronta:

```bash
for s in tv phone admin; do echo "== $s"; diff "$SCRATCH/snap-$s-prima.txt" "$SCRATCH/snap-$s-dopo.txt" && echo "identico"; done
```

Atteso: `identico` per tutte tre. **Qualunque riga di diff è un blocco spostato nel file
sbagliato**: va corretta prima di committare, non giustificata.

- [x] **Step 6: Aggiornare la struttura nel README**

In `README.md`, la voce `public/css/style.css — stile liquid glass condiviso` diventa l'elenco dei
cinque file con una riga a testa su cosa contengono.

- [x] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(css): split per superficie, valori calcolati identici"
```

---

## Task B3: Togliere il CSS orfano

Tre blocchi non sono referenziati da nessun HTML né da nessun JS.

**Files:**
- Modify: `public/css/tv.css`

- [x] **Step 1: Confermare che sono orfani**

```bash
for c in standing-row final-results final-result-box; do
  echo "== .$c"; grep -rn "$c" public/*.html public/js/ | grep -v '/dev/' || echo "  nessun uso"
done
```

Atteso: `nessun uso` per `.standing-row` e `.final-results`. `.final-result-box` va verificato:
se `admin.js` o `main.js` lo generano, **non** è orfano e resta.

- [x] **Step 2: Rimuovere solo quelli confermati orfani**

Cancella da `tv.css` i blocchi corrispondenti (in `style.css` erano alle righe 839, 873, 874 e
relative varianti `.green` / `.red`).

- [x] **Step 3: Rieseguire il diff dei valori calcolati**

Stessa procedura del Task B2 Step 5. Atteso: ancora `identico` — se una regola era davvero
orfana, non toccava nessun elemento.

- [x] **Step 4: Commit**

```bash
git add public/css/tv.css
git commit -m "refactor(css): via i blocchi orfani (.standing-row, .final-results)"
```

---

## Task B4: Consegna della Parte B

- [x] **Step 1: Riportare l'esito del diff**

Non screenshot: il numero di righe confrontate e `identico` per le tre superfici.

- [ ] **Step 2: Aspettare l'ok prima della Parte C**

---

# Parte C — Cornice TV e fase 01

Qui cambia l'aspetto. Riferimento: `design_handoff_tv_screens/README.md` § Cornice comune,
§ Tabellone, § 1c, e `screenshots/1c-primo-gioco.png`.

## Task C1: La cornice — `tv/shell.js`

**Files:**
- Create: `public/js/tv/shell.js`
- Modify: `public/index.html` (markup della barra alta e bassa in `#game-screen`)
- Modify: `public/css/tv.css`

- [ ] **Step 1: Definire l'API, una sola funzione**

```js
// public/js/tv/shell.js
// Cornice comune delle schermate TV: barra alta (wordmark, 6 chip di fase, pip
// del tabellone, "Live") e barra bassa giocatori. La usano 1b, 1c, 1e, 1f, 1g,
// 1h, 1j: una funzione invece di sei copie di markup.

export const PHASES = [
  ['01', 'Tabelloni'], ['02', 'Triplete'], ['03', 'Express'],
  ['04', 'Giramoe'],   ['05', 'Finale'],   ['06', 'Buste']
];

// opts:
//   phase        1..6, quale chip è attiva
//   compact      true → una sola etichetta "Fase 0N · <nome>" invece delle 6 chip
//   accent       'accent' | 'express' — tinta della chip/etichetta attiva
//   board        { number, total } → "Tabellone" + pip + contatore 01/03
//   right        stringa libera al posto di board (es. "Un solo tabellone · una consonante a testa")
//   live         false per nascondere "● Live"
export function renderTopBar(host, opts) { /* … */ }

// players: [{ name, roundPoints, bank, state, tone }]
//   state  'In attesa' | 'Al turno' | 'Prenotato' | 'Bloccata' | 'Usata' | 'Prenotabile'
//   tone   null | 'active' | 'express' | 'locked' | 'buzzed'
// cols: etichette delle due colonne numeriche, es. ['Turno','Banca'] o ['Giramoe','Banca']
export function renderPlayersBar(host, players, cols = ['Turno', 'Banca']) { /* … */ }
```

L'implementazione costruisce il DOM con `document.createElement` e le classi definite nello
Step 2; i valori numerici vanno formattati `it-IT` (`(1400).toLocaleString('it-IT')` → `1.400`).

- [ ] **Step 2: Il CSS della cornice**

In `tv.css`, sostituendo la sezione `PLAYERS BAR` attuale. Valori dal handoff § Cornice comune:
barra alta `height:88px`, `padding:0 56px`, `border-bottom:1px solid rgba(255,255,255,.10)`,
sfondo `linear-gradient(180deg, rgba(10,10,12,.94), rgba(10,10,12,.2))`; chip Space Mono 600 11px
`letter-spacing:3px` uppercase `rgba(235,235,245,.3)`, numero in `<em>` non corsivo
`margin-right:9px` `rgba(235,235,245,.22)`, chip attiva testo `--ink` + numero `--accent` +
`padding-bottom:3px` + `border-bottom:2px solid var(--accent)`; pip `26×4px` `border-radius:2px`;
barra bassa `height:184px`, `padding:0 56px`, `border-top:1px solid rgba(255,255,255,.10)`,
`display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:22px; align-items:center`.

⚠ `minmax(0,1fr)` è obbligatorio: con `flex:1` le schede tracimano (annotato nel handoff).

Scheda giocatore: `padding:24px 26px`, `border-radius:18px`, `background:#16161a`,
`border:1px solid rgba(255,255,255,.10)`, `min-width:0`; avatar 58px cerchio
`linear-gradient(150deg,#3c3c40,#232327)` con `inset 0 1px 0 rgba(255,255,255,.12)` e iniziale
`-apple-system` 600 23px; nome 25px; stato Space Mono 600 10.5px `letter-spacing:3px` uppercase;
due colonne a destra `gap:26px` con etichetta 10.5px `--ink-faint` e numero Syne 800 36–40px.
Varianti: `.active` (`linear-gradient(180deg, rgba(48,184,255,.13), #16161a)`, bordo
`rgba(48,184,255,.50)`, `box-shadow:0 0 40px rgba(48,184,255,.14)`, pallino 14px `--accent` con
`border:3px solid #10151a` in basso a destra dell'avatar, punti turno in `--accent`);
`.locked` (`opacity:.30`); `.buzzed` (`background:rgba(40,40,44,.9)`, bordo
`rgba(255,255,255,.45)`, `box-shadow:0 0 44px rgba(255,255,255,.10)`);
`.express` (come `.active` con `#f43f7f` / `rgba(244,63,127,.14)`).

- [ ] **Step 3: Cablarla in `main.js` per la 1c**

Dove oggi `renderScores` riempie `#players-bar`, chiamare `renderPlayersBar`. Dove oggi non c'è
niente, chiamare `renderTopBar` con `phase: 1` e `board: { number, total }` da `main:gameState`.

- [ ] **Step 4: Verificare**

`http://localhost:3000/?mock=1c` a 1920×1080, confronto con
`design_handoff_tv_screens/screenshots/1c-primo-gioco.png`: barra alta con `01 TABELLONI` attiva,
i pip a `01/03`, `● Live`; barra bassa con Marco attivo `1.400` / `3.200`, Giulia `5.800`,
Elia `2.100`.

- [ ] **Step 5: Verificare che `#round-scene` resti sopra**

`__scenes.play('triplete')` dalla console: la scena deve coprire barra alta e bassa.

- [ ] **Step 6: Commit**

```bash
git add public/js/tv/shell.js public/index.html public/css/tv.css public/js/main.js
git commit -m "feat(tv): cornice comune, barra alta con le chip di fase e barra bassa giocatori"
```

---

## Task C2: Campo halftone mascherato, celle e categoria

**Files:**
- Modify: `public/css/tv.css`
- Modify: `public/index.html`
- Modify: `public/js/main.js`

- [ ] **Step 1: Il campo halftone**

È il problema dichiarato dal committente: oggi il tappeto di punti passa dietro al testo. Nuova
regola, da `tv.css`:

```css
/* Campo halftone: anello perimetrale, buco al centro dove vive il contenuto.
   Regola generale: nessun punto dietro un blocco di testo. */
.hf-field {
  position: absolute; inset: 0; pointer-events: none;
  background-image: radial-gradient(circle 1.6px at 50% 50%, rgba(255,255,255,.55) 99%, transparent 100%);
  background-size: 7px 7px;
  opacity: .34;
  -webkit-mask-image: radial-gradient(ellipse 56% 46% at 50% 50%, transparent 58%, #000 92%);
          mask-image: radial-gradient(ellipse 56% 46% at 50% 50%, transparent 58%, #000 92%);
}
#lobby-screen .hf-field { opacity: .40;
  -webkit-mask-image: radial-gradient(ellipse 44% 40% at 50% 52%, transparent 52%, #000 88%);
          mask-image: radial-gradient(ellipse 44% 40% at 50% 52%, transparent 52%, #000 88%); }
#triplete-screen .hf-field {
  -webkit-mask-image: radial-gradient(ellipse 52% 44% at 54% 48%, transparent 56%, #000 90%);
          mask-image: radial-gradient(ellipse 52% 44% at 54% 48%, transparent 56%, #000 90%); }
#final-screen .hf-field { opacity: .32;
  -webkit-mask-image: radial-gradient(ellipse 54% 44% at 50% 48%, transparent 56%, #000 90%);
          mask-image: radial-gradient(ellipse 54% 44% at 50% 48%, transparent 56%, #000 90%); }
#envelopes-screen .hf-field {
  -webkit-mask-image: radial-gradient(ellipse 50% 42% at 50% 52%, transparent 54%, #000 88%);
          mask-image: radial-gradient(ellipse 50% 42% at 50% 52%, transparent 54%, #000 88%); }
```

E un `<div class="hf-field" aria-hidden="true"></div>` come primo figlio di `#lobby-screen`,
`#game-screen`, `#triplete-screen`, `#final-screen`, `#envelopes-screen`.

- [ ] **Step 2: Le celle del tabellone**

Struttura logica invariata (4×16, capienze `[14,16,16,14]`, `edge`/`blocked`/`letter` da
`board.js`): cambia solo la resa. In `tv.css`, sostituendo la sezione `BOARD`:

```css
.board-grid {
  display: grid; grid-template-columns: repeat(16, 1fr);
  gap: 7px; width: 1120px;
}
.board-grid .cell { aspect-ratio: .78; border-radius: 5px;
  font-family: 'Space Mono', monospace; font-weight: 700; font-size: 44px;
  display: flex; align-items: center; justify-content: center; }
.board-grid .cell.edge     { background: transparent; }
.board-grid .cell.blocked  { background: var(--petrol); }
.board-grid .cell.letter   { background: rgba(245,245,247,.88); color: transparent;
                             box-shadow: inset 0 2px 0 rgba(255,255,255,.9); }
.board-grid .cell.letter.revealed { background: #fff; color: #000;
                             box-shadow: 0 4px 16px rgba(0,0,0,.55); }
```

`cellFlip .5s var(--ease-out)` sulla rivelazione **resta come oggi**.

Le larghezze e i font per schermata (`1e` 1280/8/50, `1h` 1040/8/42) si applicano con
`#triplete-screen .board-grid { width:1280px; gap:8px }` ecc., ognuna nella slice che costruisce
quella schermata; qui basta la variante `1c`.

- [ ] **Step 3: La categoria**

Sostituisce `.category-banner` a pillola. Due varianti; qui serve la (a):

```css
/* (a) etichetta + nome allineato a sinistra — 1c, 1f, 1g */
.category { display: flex; flex-direction: column; gap: 6px; }
.category .lab { font: 600 10.5px/1 'Space Mono', monospace; letter-spacing: 2.5px;
                 text-transform: uppercase; color: var(--ink-faint); }
.category .name { font: 800 46px/1 'Syne', sans-serif; letter-spacing: -.02em; }
```

- [ ] **Step 4: Verificare**

`?mock=1c`: nessun punto halftone dietro categoria, tabellone o barre; celle bianche col rilievo,
`blocked` in petrolio, `edge` invisibili; categoria `PROVERBI` in Syne 800 46px a sinistra.

- [ ] **Step 5: Commit**

```bash
git add public/css/tv.css public/index.html public/js/main.js
git commit -m "feat(tv): campo halftone col buco al centro, celle e categoria nuove"
```

---

## Task C3: I tre moduli e il timer da 3,5s

**Files:**
- Create: `public/js/tv/callout.js`
- Modify: `public/index.html`
- Modify: `public/css/tv.css`
- Modify: `public/js/main.js`

- [ ] **Step 1: Il markup**

Sotto la ruota, in `#game-screen`:

```html
      <div class="wheel-modules">
        <div class="wm-mod wm-mod--wedge"><span class="lab">Spicchio</span><b id="mod-wedge">—</b></div>
        <div class="wm-mod"><span class="lab">Lettera</span><b id="mod-letter">—</b></div>
        <div class="wm-mod"><span class="lab">Occorrenze</span><b id="mod-count">—</b></div>
      </div>
```

- [ ] **Step 2: Il CSS**

```css
.wheel-modules { display: flex; gap: 12px; }
.wm-mod { flex: 1; padding: 16px 22px; border-radius: 14px;
          background: rgba(22,22,26,.9); border: 1px solid rgba(255,255,255,.10);
          display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.wm-mod--wedge { flex: 1.3;
  background: linear-gradient(180deg, rgba(48,184,255,.12), rgba(22,22,26,.9));
  border-color: rgba(48,184,255,.45); }
.wm-mod .lab { font: 600 10.5px/1 'Space Mono', monospace; letter-spacing: 2.5px;
               text-transform: uppercase; color: var(--ink-faint); }
.wm-mod b { font: 800 46px/1 'Syne', sans-serif; }
.wm-mod--wedge b { color: var(--accent); }
.wm-mod.is-empty b { color: rgba(245,245,247,.22); }
```

- [ ] **Step 3: La logica dei 3,5s**

```js
// public/js/tv/callout.js
// I moduli sotto la ruota. `Spicchio` tiene il valore per tutto il turno: è il
// contesto del punteggio. `Lettera` e `Occorrenze` sono una notifica e si
// svuotano dopo 3,5s — quel tanto che basta al giocatore dopo per accorgersi che
// una lettera è già stata provata, senza restare a schermo per sempre.
// `×0` è previsto: una lettera assente non lascia traccia sul tabellone.

const HOLD_MS = 3500;
const EMPTY = '—';

let timer = null;

const el = (id) => document.getElementById(id);
const set = (id, value) => {
  const node = el(id);
  if (!node) return;
  node.textContent = value == null ? EMPTY : String(value);
  node.parentElement.classList.toggle('is-empty', value == null);
};

// `?freeze=letter` tiene i moduli a schermo: serve a confrontarli col render
const frozen = () => new URLSearchParams(location.search).get('freeze') === 'letter';

export function showWedge(value) {
  set('mod-wedge', value);
}

export function clearWedge() {
  set('mod-wedge', null);
}

export function showLetter(letter) {
  clearTimeout(timer);
  set('mod-letter', letter);
  set('mod-count', null);
}

// occurrences: numero di occorrenze; 0 se la lettera è assente
export function showOccurrences(occurrences) {
  clearTimeout(timer);
  set('mod-count', '×' + occurrences);
  if (frozen()) return;
  timer = setTimeout(() => {
    set('mod-letter', null);
    set('mod-count', null);
  }, HOLD_MS);
}

export function reset() {
  clearTimeout(timer);
  set('mod-wedge', null);
  set('mod-letter', null);
  set('mod-count', null);
}
```

- [ ] **Step 4: Cablarlo in `main.js`**

Negli handler esistenti:

- `main:spin` → `showWedge(data.value)` (per gli spicchi speciali, il simbolo: `✕` bancarotta,
  `→` passa, `×2` raddoppia, `»` express);
- `main:letterCalled` → `showLetter(letter)`;
- `main:revealLetter` → `showOccurrences(positions.length)`;
- `main:wrong` → `showOccurrences(0)`;
- `main:gameState` quando cambia `currentTurn` → `reset()`.

- [ ] **Step 5: Verificare i tre stati**

1. `?mock=1c&freeze=letter` → `Spicchio 500`, `Lettera T`, `Occorrenze ×3`, confronto col render.
2. `?mock=1c` → dopo 3,5s `Lettera` e `Occorrenze` tornano a `—`, `Spicchio` resta `500`.
3. Dalla console con `?mock=1c`: `__mockSocket.deliver('main:wrong', {})` → `Occorrenze ×0`,
   e dopo 3,5s si svuota.

- [ ] **Step 6: Commit**

```bash
git add public/js/tv/callout.js public/index.html public/css/tv.css public/js/main.js
git commit -m "feat(tv): moduli spicchio/lettera/occorrenze, i due transitori a 3,5s"
```

---

## Task C4: Consegna della slice 2

- [ ] **Step 1: Test di logica**

```bash
node --test --test-concurrency=1 tests/board.test.js tests/boardlayout.test.js tests/game.test.js tests/triplete.test.js tests/giramoe.test.js tests/finalist.test.js tests/finalgame.test.js tests/envelopes.test.js tests/lobby.test.js tests/wheelgeom.test.js
```

Atteso: 121 PASS. Questa slice non tocca la logica.

- [ ] **Step 2: Screenshot di confronto**

`?mock=1c&freeze=letter` a 1920×1080 accanto a `screenshots/1c-primo-gioco.png`.

- [ ] **Step 3: Controllo reduced motion**

Con reduced motion attivo: nessun glint, nessuna rotazione, nessun pulse; le barre e i moduli
restano leggibili.

- [ ] **Step 4: Aspettare l'ok prima della slice 3**

---

## Fuori scope in questa slice

- `1a` start e `1b` lobby: slice 3. La ruota della `1a` (`fx/homewheel.js`) **non si tocca**,
  per decisione del committente.
- `1e`, `1f`, `1g`: slice 4 — la cornice costruita qui viene riusata, non riscritta.
- Larghezze del tabellone diverse dalla `1c` (1280 per il Triplete, 1040 per il gioco finale):
  ognuna nella slice della sua schermata.
- Campi nuovi sul server: nessuno serve alla `1c`, che usa `main:spin`, `main:letterCalled`,
  `main:revealLetter` e `main:wrong` così come sono.
- `wheel.js` (ruota del telefono): slice 6.
