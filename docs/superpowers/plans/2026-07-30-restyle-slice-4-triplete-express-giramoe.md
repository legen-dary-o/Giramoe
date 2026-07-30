# Restyle slice 4 — Triplete, Express, Giramoe

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Rifare le tre schermate TV `1e` (Triplete), `1f` (Express) e `1g` (Giramoe) sulla
cornice costruita nella slice 2 — `renderTopBar`, `renderPlayersBar`, palco logico `--u` —
senza riscriverla.

**Architecture:** `1f` e `1g` vivono sullo stesso `#game-screen` della `1c`: cambiano per
classe di stato (`.is-express`, `.is-giramoe`), non per schermata nuova. La `1e` ha il suo
`#triplete-screen`, che viene rifatto da zero. Tre campi nuovi sul server (`expressValue`,
`expressActive` in `mainGameView()`, evento `main:giramoeWindow`): servono perché la TV possa
ricostruire lo stato intero da un refresh, che oggi non può.

**Spec:** `docs/superpowers/specs/2026-07-30-restyle-giramoe-design.md`
**Riferimento visivo:** `design_handoff_tv_screens/README.md` §1e §1f §1g; sorgente del mockup
`Giramoe TV Screens.dc.html` righe 244–310 (1e), 313–391 (1f), 394–460 (1g).

**Verifica:** `?mock=1e`, `?mock=1f&freeze=raffica`, `?mock=1g` a 1920×1080 contro
`screenshots/1e-triplete.png`, `1f-express.png`, `1g-giramoe.png`.

---

## Decisioni prese prima di scrivere codice

**1. L'accento magenta segue `turnState === 'EXPRESS'`, non `phase === 'express'`.**
Appunto n. 2 del committente: i mockup dell'express mostrano solo lo stato *dopo* che un
giocatore ci è entrato; nel caso normale la schermata è quella del primo gioco. La fase
`express` dura tre tabelloni interi durante i quali si gioca normalmente: legare il magenta
alla fase colorerebbe di rosa mezza partita. La chip `03 Express` in barra alta resta accesa
per tutta la fase (è vera); la pillola `EXPRESS · 500 A LETTERA`, le righe di velocità, il
modulo e i tre riquadri compaiono solo con un giocatore dentro.

**2. Niente copy che deduce il genere dal nome.** Il mockup scrive `Prenotato` / `Bloccata` /
`In express`, e `Marco si è prenotato!`. Un nome non dice il genere di chi gioca. Si usano
forme invariabili: `Ha prenotato` · `Prenotazione bloccata` · `Può prenotarsi`, e il banner
diventa `Marco ha prenotato!`.

**3. Il valore express (500) arriva dal server.** È `EXPRESS_VALUE` in `game.js`. Scriverlo a
mano nella TV sarebbe un secondo posto da cambiare; viaggia in `mainGameView()`.

**4. `Usata` / `Prenotabile` nella barra bassa della `1g`** si derivano da `currentTurn`:
`giramoeScores()` non porta un flag per giocatore, e il turno corrente è esattamente chi non
ha ancora speso la sua consonante.

---

## Task 1: Estensioni alla cornice

**Files:** `public/js/tv/shell.js`, `public/css/tv.css`

- [ ] **Step 1: `renderTopBar` — tre opzioni nuove**

```
leftTone  'ink' (default) | 'dim' | 'accent'   tinta di `left`
pill      { name, note }                        pillola al posto delle chip (1f)
board     { number, total, label, pips }        label default 'Tabellone', pips default true
```

`board.label` serve alla `1f`, che a destra scrive `Fase 03` invece di `Tabellone` e non mostra
i pip. Il ramo `board` diventa: etichetta (`board.label || 'Tabellone'`) → pip solo se
`pips !== false` → contatore `02/03`.

La pillola è `<span class="tb-pill"><b>EXPRESS</b><i></i><span>500 A LETTERA</span></span>`,
costruita con `createElement` come tutto il resto: `name` e `note` sono dati, non markup.

- [ ] **Step 2: CSS delle tre opzioni** (sezione CORNICE COMUNE di `tv.css`)

```css
.tb-one.is-dim { color: rgba(245, 245, 247, 0.42); }
.tb-one.is-accent { color: var(--accent); }
.tb-pill {
  display: flex; align-items: center; gap: calc(12 * var(--u));
  padding: calc(8 * var(--u)) calc(20 * var(--u)); border-radius: 999px;
  background: rgba(244, 63, 127, 0.14); border: 1px solid rgba(244, 63, 127, 0.55);
}
.tb-pill b { font-family: var(--font-display); font-weight: 800;
  font-size: calc(16 * var(--u)); letter-spacing: calc(3 * var(--u)); color: var(--express-soft); }
.tb-pill i { width: 1px; height: calc(14 * var(--u)); background: rgba(255, 255, 255, 0.2); }
.tb-pill span { font-family: var(--font-mono); font-weight: 700;
  font-size: calc(11 * var(--u)); letter-spacing: calc(2.5 * var(--u)); color: var(--ink); }
```

- [ ] **Step 3: `node --test --test-concurrency=1` verde, commit**

---

## Task 2: `1e` · Il Triplete

**Files:** `public/index.html`, `public/css/tv.css`, `public/js/main.js`

- [ ] **Step 1: markup di `#triplete-screen`**

Struttura: barra alta condivisa, corpo a due colonne fra 88 e 184, barra bassa condivisa.
Sparisce `#triplete-board-tag` (il numero del tabellone lo dicono i pip in barra alta) e
sparisce `.category-banner` a pillola (categoria centrata spaziata).

```html
<div id="triplete-screen" class="screen hidden">
  <header class="tv-topbar" id="triplete-topbar"></header>
  <div class="tri-container">
    <aside class="tri-rules">
      <div class="tri-head">
        <span class="eyebrow">Bonus round</span>
        <span class="wm tri-wm">IL<br>TRIPLETE</span>
        <span class="tri-hair"></span>
      </div>
      <div class="tri-list">
        <div class="tri-row"><b>1.000</b><span>per ogni tabellone risolto</span></div>
        <div class="tri-row"><b class="is-accent">5.000</b><span>se li indovini tutti e tre</span></div>
        <div class="tri-row"><b>1,5s</b><span>passo di comparsa delle caselle</span></div>
      </div>
      <div class="tri-note">
        <span class="lab">Prenotati e dillo a voce</span>
        <p>Chi sbaglia resta bloccato finch&eacute; non sbagliano tutti.</p>
      </div>
    </aside>
    <div class="tri-board">
      <div class="cat-spaced"><span class="hair"></span><span id="triplete-category"></span><span class="hair"></span></div>
      <div class="board-grid" id="triplete-board-grid"></div>
      <div class="tri-status" id="triplete-status"><span class="dot"></span><span id="triplete-status-text"></span></div>
    </div>
  </div>
  <footer class="tv-players" id="triplete-players-bar"></footer>
  <!-- buzz-banner e result-overlay restano dove sono -->
</div>
```

- [ ] **Step 2: CSS della `1e`** (nuova sezione TRIPLETE, misure in `--u`)

Dal mockup: contenitore `top:88 bottom:184; display:flex; gap:56; padding:44 56 0`.
Colonna sinistra `width:420; gap:34; padding-top:78`. Titolo Syne 800 **52px**,
`line-height:.98`, `letter-spacing:-.03em` (oltre i ~54 il testo esce dalla colonna e
`background-clip:text` lo taglia: il limite è del handoff, non un'opinione). Filetto `90×1px`
`rgba(48,184,255,.8)`. Righe regola `padding:20px 0` separate da hairline, numero Syne 800 34px
`min-width:110px`, testo `-apple-system` 15px/1.4 `--ink-soft`. Riquadro finale `padding:20 24`,
`border-radius:14`, `background:rgba(48,184,255,.08)`, `border:1px solid rgba(48,184,255,.30)`.

Colonna destra centrata, `gap:40; padding-top:34`. Categoria: due filetti `120×1px` in gradiente
ciano ai lati, nome Syne 800 32px `letter-spacing:10px`, `gap:26`. Tabellone
`width:1280; gap:8; font-size:50`, celle `border-radius:6`. Riga di stato Space Mono 600 12px
`letter-spacing:3px` `--ink-faint`, dot `9px` `--accent` con `liveBlink 1.2s`.

Banner prenotazione: `top:calc(132*var(--u))`, `padding:17 40`, `background:rgba(24,24,27,.92)`,
`border:1px solid rgba(255,255,255,.30)`, `box-shadow:0 24px 70px rgba(0,0,0,.6)`, icona 26px,
testo `-apple-system` 600 26px. `position: absolute` dentro la schermata, non `fixed`: sul palco
logico `fixed` misurerebbe la finestra, non i 1920×1080.

- [ ] **Step 3: `main.js` — barra alta, categoria, riga di stato, barra bassa**

`main:tripleteBoard` chiama `renderTopBar(#triplete-topbar, { left: 'Fase 02 · Bonus round',
leftTone: 'dim', board: { number: b.boardNumber, total: b.totalBoards } })` e scrive la
categoria in `#triplete-category`.

`renderTripleteScores` passa a `renderPlayersBar` con **una sola colonna**:

```js
renderPlayersBar(document.getElementById('triplete-players-bar'), scores.map(s => ({
  name: s.name,
  values: [s.points],
  state: s.buzzed ? 'Ha prenotato' : s.locked ? 'Prenotazione bloccata' : 'Può prenotarsi',
  tone: s.buzzed ? 'buzzed' : s.locked ? 'locked' : null
})), ['Triplete']);
```

Riga di stato: `setTripleteStatus(paused)` scrive
`Rivelazione in pausa — prenotazione in corso` oppure `Rivelazione in corso`. La chiamano
`showBuzz`/`hideBuzz` del Triplete (`main:tripleteBuzzed` → true, `main:tripleteResume` e
`main:tripleteBoard` → false).

Banner: `showBuzz(\`${name} ha prenotato!\`)` (vedi decisione 2).

- [ ] **Step 4: verifica `?mock=1e` a 1920×1080** contro `screenshots/1e-triplete.png`;
      `node --test --test-concurrency=1` verde; commit

---

## Task 3: `1f` · Express

**Files:** `server.js`, `public/index.html`, `public/css/tv.css`, `public/js/tv/express.js` (nuovo),
`public/js/main.js`, `public/js/dev/fixtures.mjs`, `tests/fixtures.test.js`

- [ ] **Step 1: due campi nuovi in `mainGameView()`**

```js
    // Il magenta segue il giocatore dentro l'express, non la fase: la fase dura
    // tre tabelloni durante i quali si gioca normalmente. Nello stato perché
    // dopo un refresh la TV non ha nessun altro modo di saperlo.
    expressActive: state.g.turnState === 'EXPRESS',
    expressValue: game.EXPRESS_VALUE
```

- [ ] **Step 2: markup su `#game-screen`**

Dentro `#game-screen`, prima della barra alta: `<div class="speed-lines" aria-hidden="true"></div>`.
Dentro `.game-left`, dopo `.wheel-modules`:

```html
<div class="express-mod" id="express-mod" hidden>
  <div class="ex-head"><span class="lab">Modalit&agrave; express attiva</span><span class="who" id="ex-who"></span></div>
  <div class="ex-value"><b id="ex-value">500</b><span>per ogni occorrenza</span></div>
  <p class="ex-risk">Lettera assente o soluzione sbagliata: <b>bancarotta totale</b> &mdash; turno e banca a zero.</p>
</div>
```

Dentro `.game-right`, dopo il tabellone:

```html
<div class="express-boxes" id="express-boxes" hidden>
  <div class="ex-box"><span class="lab">Raffica</span><b class="is-letters" id="ex-raffica">&mdash;</b></div>
  <div class="ex-box"><span class="lab">Occorrenze totali</span><b id="ex-occ">0</b></div>
  <div class="ex-box is-express"><span class="lab">Punti express accumulati</span><b id="ex-points">0</b></div>
</div>
```

- [ ] **Step 3: CSS** (nuova sezione EXPRESS)

Righe di velocità: `position:absolute; left:0; right:0; top:calc(200*var(--u));
height:calc(520*var(--u)); background: repeating-linear-gradient(0deg, rgba(244,63,127,.5) 0 2px,
transparent 2px 26px); opacity:.5`, mascherate ai lati con
`mask-image: linear-gradient(90deg,#000,transparent 34%), linear-gradient(270deg,#000,transparent 34%)`
(più il prefisso `-webkit-`) così non passano dietro al tabellone. `display:none` di default,
`display:block` sotto `#game-screen.is-express`.

Modulo express: `padding:22 26`, `border-radius:16`,
`background:linear-gradient(180deg, rgba(244,63,127,.14), rgba(22,22,26,.92))`,
`border:1px solid rgba(244,63,127,.50)`; `500` Syne 800 52px `--express-soft`; il testo di
rischio oltre un hairline, `-apple-system` 14px/1.5 `--ink-soft` col `<b>` in `--ink`.

Tre riquadri: `display:flex; gap:14`, il terzo `flex:1.2` in tinta express
(`rgba(244,63,127,.10)` / bordo `rgba(244,63,127,.42)` / valore `--express-soft`). `Raffica` in
Space Mono 700 26px `letter-spacing:6px`, gli altri Syne 800 28px.

Scambio: `#game-screen.is-express .wheel-modules { display: none; }` e i tre blocchi nuovi
passano da `hidden` a visibili con `#game-screen.is-express #express-mod { display: block; }`
(l'attributo `hidden` perde contro una regola `display`, quindi lo stato lo decide la classe
sulla schermata: un solo punto di verità).

- [ ] **Step 4: `public/js/tv/express.js`**

Stesso taglio di `callout.js`: modulo piccolo, scrive solo con `textContent`.

```js
// Stato della raffica express: lettere chiamate, occorrenze uscite e punti del
// turno. Non è nello stato del server perché lì non esiste un "turno express"
// separato: sono i punti del turno di chi sta giocando. Qui si accumulano per
// mostrarli, e si azzerano quando l'express finisce.
let letters = [];
let occurrences = 0;

export function reset() { letters = []; occurrences = 0; paint(); }
export function letter(l) { letters.push(l); paint(); }
export function occurrence(n) { occurrences += n; paint(); }
export function player(name) { … #ex-who … }
export function points(v) { … #ex-points, separatore delle migliaia … }
export function value(v) { … #ex-value … }
function paint() { … #ex-raffica = letters.join(' ') || '—', #ex-occ = occurrences … }
```

Il separatore delle migliaia è già in `shell.js` (`num`): esportarlo da lì invece di riscriverlo.

- [ ] **Step 5: `main.js` — un solo interruttore**

```js
// Il magenta lo decide lo stato, non l'evento: così un refresh a metà express
// ricostruisce la schermata identica.
function setExpressSkin(on) {
  document.getElementById('game-screen').classList.toggle('is-express', on);
}
```

`main:gameState` chiama `setExpressSkin(g.expressActive)`, `express.value(g.expressValue)`,
e quando `expressActive` passa da false a true azzera (`express.reset()`) e scrive il nome del
giocatore di turno. `main:expressStart` resta lo stacco animato. `main:expressBankrupt` e
`main:expressRound` chiamano `express.reset()`.

`main:letterCalled` e `main:revealLetter` alimentano `express.letter()` / `express.occurrence()`
solo quando la pelle express è attiva. `renderScores` scrive `express.points(roundPoints)` del
giocatore di turno e usa `tone: 'express'` solo con `expressActive`, non con la fase.

Barra alta in express attivo: `renderTopBar(..., { pill: { name: 'EXPRESS',
note: \`${g.expressValue} a lettera\` }, board: { number, total, label: 'Fase 03', pips: false } })`.
Fuori dall'express la barra resta quella della `1c` con la chip `03` accesa.

Pillola di turno in tinta express: già fatta nella slice 2 (`.turn-pill.is-express`), cambia
solo il testo, che diventa `Consonanti a raffica`.

- [ ] **Step 6: fixture `1f` allineato al render**

Marco a `roundPoints: 3500, bank: 4200` (locale al fixture, non nei `PLAYERS` condivisi) e un
ramo `freeze === 'raffica'` che spara `main:letterCalled` + `main:revealLetter` per `T O N I`,
con le posizioni **lette dalla griglia** `GRIDS[VIAGGI].TONI` — non scritte a mano:

```js
const positionsOf = (grid, letter) => {
  const out = [];
  grid.forEach((row, r) => row.forEach((c, col) => {
    if (c.type === 'letter' && c.revealed && c.letter === letter) out.push({ row: r, col, letter });
  }));
  return out;
};
```

`tests/fixtures.test.js`: aggiungere `'raffica'` alla lista `FREEZE`.

- [ ] **Step 7: verifica `?mock=1f&freeze=raffica`** contro `screenshots/1f-express.png`, e
      `?mock=1c` per controllare che la `1c` non sia cambiata; test verdi; commit

---

## Task 4: `1g` · Giramoe

**Files:** `server.js`, `public/index.html`, `public/css/tv.css`, `public/js/main.js`,
`tests/giramoe.integration.test.js`

- [ ] **Step 1: evento `main:giramoeWindow`**

La finestra di prenotazione da 5s oggi la TV non la vede: `startGiramoeBuzzWindow()` fa partire
un `setTimeout` e basta. Serve l'anello del mockup.

```js
function startGiramoeBuzzWindow() {
  clearGiramoeTimer();
  state.giramoeWindowUntil = Date.now() + GIRAMOE_BUZZ_MS;
  io.to('main').emit('main:giramoeWindow', {
    ms: GIRAMOE_BUZZ_MS, total: GIRAMOE_BUZZ_MS,
    name: state.gi.players[state.gi.currentTurnIndex].name
  });
  giramoeTimer = setTimeout(() => { … }, GIRAMOE_BUZZ_MS);
}
```

`clearGiramoeTimer()` azzera `state.giramoeWindowUntil`. Nel ramo di riconnessione della TV
(dove già si rimandano `giramoeStart`/`giramoeBoard`/`giramoeScores`) si rimanda anche la
finestra col tempo che resta, se ne resta:

```js
const left = state.giramoeWindowUntil - Date.now();
if (left > 0) socket.emit('main:giramoeWindow', { ms: left, total: GIRAMOE_BUZZ_MS, name: … });
```

- [ ] **Step 2: markup su `#game-screen`**

In `.game-left`, dopo `#express-mod`:

```html
<div class="giramoe-mods" id="giramoe-mods" hidden>
  <div class="gm-mod gm-mult">
    <span class="lab">Moltiplicatore V</span>
    <div class="val"><b id="gi-mult">&mdash;</b><span>&times; occorrenze</span></div>
  </div>
  <div class="gm-mod gm-info">
    <span class="lab">Giro unico</span>
    <p>Girato dall&rsquo;host. Nessuno spicchio speciale.</p>
  </div>
</div>
```

In `.game-head`, accanto a `.turn-pill`:

```html
<div class="buzz-window" id="buzz-window" hidden>
  <div class="bw-text"><span class="lab">Finestra prenotazione</span><span class="who" id="bw-who"></span></div>
  <div class="bw-ring" id="bw-ring"><span class="bw-disc" id="bw-count">5</span></div>
</div>
```

- [ ] **Step 3: CSS** (nuova sezione GIRAMOE)

`#game-screen.is-giramoe .wheel-modules { display: none; }`, `#giramoe-mods { display: flex; }`.
Modulo moltiplicatore `flex:1.4`,
`background:linear-gradient(180deg, rgba(48,184,255,.16), rgba(22,22,26,.92))`,
`border:1px solid rgba(48,184,255,.60)`, `box-shadow:0 0 40px rgba(48,184,255,.14)`, valore Syne
800 60px `--accent`. Modulo `Giro unico` `flex:1`, `rgba(22,22,26,.92)`, bordo bianco 10%,
testo `-apple-system` 14px/1.4 `--ink-soft`, `justify-content:space-between`.

Anello: `86×86`, `background: conic-gradient(var(--accent) 0deg var(--deg), rgba(255,255,255,.1)
var(--deg) 360deg)`, disco interno `70px` `#0c0c0f`, cifra Syne 800 32px `--accent`. `--deg` la
scrive il JS. `@property --deg` non serve: non si anima in CSS, si aggiorna a passi.

- [ ] **Step 4: `main.js`**

`setGiramoeSkin(on)` come l'express. `main:giramoeBoard` imposta barra alta
(`left: 'Fase 04 · Tabellone finale', leftTone: 'accent',
right: 'Un solo tabellone · una consonante a testa'`) e accende la pelle.

`main:giramoeScores` scrive `#gi-mult` col moltiplicatore e la barra bassa:

```js
renderPlayersBar(host, scores.map((s, i) => ({
  name: s.name, values: [s.points, s.bank || 0],
  state: i === currentTurn ? 'Prenotabile' : 'Usata',
  tone: i === currentTurn ? 'active' : null
})), ['Giramoe', 'Banca']);
```

Anello: `main:giramoeWindow` lo apre e fa partire un `setInterval` da 50ms che scrive
`--deg` e la cifra (`Math.ceil(left / 1000)`); a zero si chiude da solo. Lo chiudono anche
`main:giramoeBuzzed`, `main:giramoeResume`, `main:giramoeSolved` e l'uscita dalla fase. Con la
finestra aperta la pillola di turno si nasconde: occupano lo stesso posto e direbbero la stessa
cosa due volte.

**Non** si aggiunge la riga "Giro in corso" con le lettere chiamate: il README la esclude
esplicitamente.

- [ ] **Step 5: test**

In `tests/giramoe.integration.test.js`, aggiungere alla socket `main` un ascolto di
`main:giramoeWindow` e verificare che dopo una consonante presente sia arrivato con
`ms === 5000` e il nome giusto, e che dopo una consonante assente **non** arrivi.

- [ ] **Step 6: verifica `?mock=1g`** contro `screenshots/1g-giramoe.png`; test verdi; commit

---

## Task 5: consegna

- [ ] **Step 1:** `node --test --test-concurrency=1` — tutti verdi
- [ ] **Step 2:** `?mock=1c`, `1e`, `1f&freeze=raffica`, `1g` riletti a 1920×1080
- [ ] **Step 3:** riferire al committente le forme invariabili scelte al posto di
      `Prenotato`/`Bloccata`/`si è prenotato` e aspettare l'ok prima della slice 5
