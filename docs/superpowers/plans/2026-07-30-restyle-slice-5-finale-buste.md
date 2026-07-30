# Restyle slice 5 — Gioco finale, buste, finalista, spareggio

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Rifare la `1h` (gioco finale) e la `1j` (buste) sulla cornice della slice 2, disegnare
i **tabelloni 2 e 3** del gioco finale — che nel handoff non ci sono — e dare la stessa cornice
alle due schermate di passaggio (finalista, spareggio).

**Architecture:** `#final-screen` diventa tre colonne fra la barra alta e il fondo: timer e
lettere a sinistra, categoria e tabellone al centro, esiti dei tre tabelloni a destra. Le buste
sono **WebGL** (`public/js/fx/envelopes3d.js`): lì il CSS non si vede, quindi la `1j` è titolo,
sottotitolo e barra bassa — le buste stesse restano quelle che sono, come da appunto n. 4.

**Spec:** `docs/superpowers/specs/2026-07-30-restyle-giramoe-design.md`
**Riferimento visivo:** `design_handoff_tv_screens/README.md` §1h §1j; sorgente del mockup
`Giramoe TV Screens.dc.html` righe 470–540 (1h), 545–600 (1j).

**Verifica:** `?mock=1h`, `?mock=1j` a 1920×1080 contro `screenshots/1h-gioco-finale.png` e
`1j-buste.png`; i tabelloni 2 e 3 e le due schermate di passaggio hanno fixture nuovi.

---

## Decisioni prese prima di scrivere codice

**1. I tabelloni 2 e 3 riusano il posto delle lettere, non ne aggiungono uno.** Nel tabellone 1
la colonna di sinistra mostra 4 tessere regalate + 4 scelte. Il 2 non ha scelte e il 3 ne ha
infinite: invece di inventare due layout, quel blocco cambia contenuto restando dov'è —
tabellone 2 una scheda-regola, tabellone 3 le tessere delle lettere chiamate, bianche se
presenti e magenta se assenti. Stessa colonna, stesso peso, tre stati.

**2. La penalità del tabellone 3 è uno scossone del timer, non una pillola.** Deciso col
committente: `shake` sul numero, che diventa **magenta `#f43f7f`** insieme alla barra per la
durata dell'animazione. Il magenta è l'unico colore d'allarme del tema (`--red` è bianco).
Serve un evento nuovo, `main:finalPenalty`: oggi il server toglie 3s e manda solo il nuovo
tempo, e uno scatto di 3 secondi sul display non si distingue dal normale scorrere.

**3. Le buste restano WebGL.** `envelopes3d.js` disegna corpi, lembi e premio; `.webgl-stage`
nasconde i `.envelope` del DOM. Rifare la busta in CSS scriverebbe regole invisibili — stesso
errore già preso nella slice 2 con il tabellone. Della `1j` si rifà quello che è davvero DOM:
titolo, sottotitolo e barra bassa (esiti, cambi rimasti, nota).

**4. Finalista e spareggio non hanno un render.** Non ne inventiamo uno: prendono la cornice
comune (barra alta con la fase giusta) e per il resto restano come sono — sopra ci gira
l'animazione di round, che per appunto n. 4 non si tocca.

---

## Task 1: Lo stato che manca sul server

**Files:** `server.js`, `tests/final.integration.test.js`

- [ ] **Step 1: `finalBoardView()` porta lettere, stato ed esiti**

Oggi manda categoria, indice, totale e griglia. La `1h` ha bisogno anche del nome del
finalista, delle lettere in gioco divise fra regalate e scelte, e degli esiti dei tre
tabelloni. Tutto derivabile da `state.fg`, quindi niente stato nuovo: solo proiezione.

```js
function finalBoardView() {
  const fg = state.fg;
  const b = fg.boards[fg.boardIndex];
  // Una lettera è "presente" se compare nella frase, rivelata o no: la griglia
  // porta la lettera base su ogni cella, anche chiusa.
  const inPhrase = (L) => b.grid.some(row => row.some(c => c.type === 'letter' && c.letter === L));
  const given = fg.boardIndex === 0 ? finalgame.BOARD1_REVEAL.slice() : [];
  const picks = fg.usedLetters
    .filter(L => !given.includes(L))
    .map(L => ({ letter: L, present: inPhrase(L) }));
  return {
    category: b.category,
    boardIndex: fg.boardIndex,
    totalBoards: 3,
    finalist: state.finalistId != null ? state.g.players[state.finalistId].name : '',
    state: fg.state,          // PICKING | RUNNING | BUZZED | DONE
    given, picks,
    results: fg.results.slice(),
    grid: b.grid.map(row => row.map(cell => (
      cell.type === 'letter'
        ? { type: 'letter', revealed: cell.revealed, letter: cell.revealed ? (cell.display || cell.letter) : null }
        : { type: cell.type }
    )))
  };
}
```

- [ ] **Step 2: il timer porta il totale, e la penalità si annuncia**

La barra sotto il numero è una percentuale: senza il totale la TV dovrebbe saperlo a memoria.
Ogni `main:finalTimer` diventa `{ ms, total: FINAL_TIME_MS }` — sono tre punti in `server.js`
(`broadcastFinal`, il tick di `startFinalCountdown`, il ramo `main:init`) più quello dentro
`player:finalPick`.

In `player:finalPick`, nel ramo `res.wrong`, dopo aver tolto i 3 secondi:

```js
      // Tre secondi in meno non si vedono: il display scorre già. Lo scossone
      // del timer è l'unica cosa che dice al finalista che ha appena pagato.
      io.to('main').emit('main:finalPenalty', { ms: FINAL_PENALTY_MS });
```

- [ ] **Step 3: test**

In `tests/final.integration.test.js` aggiungere alla socket `main` l'ascolto di
`main:finalPenalty` e, sul tabellone 3, verificare che una lettera assente lo faccia arrivare
con `ms === 3000` e che una presente **non** lo faccia arrivare. Verificare anche che
`main:finalBoard` porti `finalist`, `given` (4 lettere sul tabellone 1, vuoto sugli altri) e
`picks` con il campo `present`.

- [ ] **Step 4: `node --test --test-concurrency=1` verde, commit**

---

## Task 2: `1h` · Gioco finale, tabellone 1

**Files:** `public/index.html`, `public/css/tv.css`, `public/js/main.js`,
`public/js/dev/fixtures.mjs`, `scripts/gen-fixtures.js`

- [ ] **Step 1: markup di `#final-screen`**

```html
<div id="final-screen" class="screen hidden">
  <header class="tv-topbar" id="final-topbar"></header>
  <div class="fin-container">
    <aside class="fin-left">
      <div class="fin-clock">
        <span class="lab">Tempo rimasto</span>
        <div class="fin-time"><b id="final-timer">60</b><span>s</span></div>
        <div class="fin-bar"><i id="final-bar"></i></div>
        <span class="fin-note">Un solo timer per i tre tabelloni</span>
      </div>
      <div class="fin-letters">
        <span class="lab">Lettere in gioco</span>
        <div class="tile-row" id="fin-given"></div>
        <span class="cap" id="fin-given-cap">Regalate dal tabellone</span>
        <div class="tile-row" id="fin-picks"></div>
        <span class="cap" id="fin-picks-cap">Scelte dal finalista &mdash; 3 consonanti + 1 vocale</span>
      </div>
    </aside>
    <div class="fin-board">
      <div class="cat-spaced"><span class="hair"></span><span id="final-category"></span><span class="hair"></span></div>
      <div class="board-grid" id="final-board-grid"></div>
      <div class="fin-pill" id="fin-pill"><span class="dot"></span><span id="fin-pill-text"></span></div>
    </div>
    <aside class="fin-boards">
      <span class="lab">Tabelloni</span>
      <div class="fin-cards" id="fin-cards"></div>
      <p class="fin-foot">Ogni tabellone risolto colora una busta. Il tempo si trasporta.</p>
    </aside>
  </div>
</div>
```

Spariscono `.final-top`, `#final-board-tag` e `.category-banner` a pillola.

- [ ] **Step 2: CSS della `1h`** (nuova sezione, misure in `--u`)

Contenitore `top:88; bottom:0; display:flex; gap:56; padding:52 56 56`.
Colonna sinistra `width:400`, `justify-content:space-between`.
Numero Syne 800 **230px**, `line-height:.82`, `letter-spacing:-.04em`,
`font-variant-numeric:tabular-nums` (senza, il numero balla a ogni tick); `s` Space Mono 700
26px `--ink-faint`. Barra `height:6`, `border-radius:3`, fondo `rgba(255,255,255,.10)`,
riempimento `--accent` con `box-shadow:0 0 16px rgba(48,184,255,.7)` e
`transition: width .25s linear`. Nota Space Mono 400 14px `--ink-faint`.
Tessere `62×62`, `border-radius:12`, Space Mono 700 28px: regalate
`background:rgba(255,255,255,.9)` testo `#000`; scelte `rgba(48,184,255,.14)` /
`border:1px solid rgba(48,184,255,.6)` / testo `--accent`; la vocale `rgba(48,184,255,.06)` con
bordo tratteggiato. Il posto ancora da riempire: stessa misura, `border:1px dashed
rgba(255,255,255,.14)`, vuoto — così la fila non salta quando arriva la lettera.
Colonna centrale come la `1e` (categoria spaziata, ma filetti `110` e nome 30px
`letter-spacing:9px`), tabellone `width:1040; gap:8; font-size:42`, celle `border-radius:5`.
Pillola `padding:15 32`, dot 9px `liveBlink 1.4s`.
Colonna destra `width:252`, `justify-content:center`, `gap:20`; schede `padding:20 22`,
`border-radius:16`, numero Syne 800 36px; l'attiva `rgba(48,184,255,.10)` /
`border rgba(48,184,255,.65)`, le altre `rgba(255,255,255,.03)` / bordo bianco 10%.

- [ ] **Step 3: `main.js` — un solo punto che disegna la colonna sinistra e quella destra**

```js
// Le tre schede di destra: com'è andata finora, senza numeri da leggere.
const FINAL_DETAILS = ['N R T E + 4', 'prima e ultima', 'vuoto · −3s'];
function renderFinalCards(boardIndex, results) { … 'Risolto' | 'Perso' | 'In corso' | 'Da giocare' … }
```

Le tessere: `renderTiles(host, items)` dove ogni item è `{ letter, kind }` con
`kind` in `given | pick | vowel | wrong | empty`. La `1h` chiama:

```js
renderTiles(document.getElementById('fin-given'), b.given.map(l => ({ letter: l, kind: 'given' })));
renderTiles(document.getElementById('fin-picks'), padTo(b.picks.map(p => ({
  letter: p.letter, kind: p.present ? (isVowel(p.letter) ? 'vowel' : 'pick') : 'wrong'
})), 4));
```

`padTo` riempie di `{ kind: 'empty' }` fino a 4: il tabellone 1 ha quattro posti fissi.
`isVowel` sta già in `board.js`, ma quello è codice del server; sulla TV bastano cinque
lettere in una costante locale — importare `board.js` nel browser tirerebbe dentro tutto il
generatore di tabelloni per una domanda da una riga.

Barra alta: `renderTopBar(#final-topbar, { left: 'Fase 05 · Gioco finale', leftTone: 'dim',
right: 'Finalista' })` più il nome — serve un'opzione `rightStrong` per la coppia
etichetta + valore in Space Mono 700 16px, sulla falsariga di `board.label`.

Timer: `main:finalTimer` scrive numero, larghezza della barra (`ms / total`) e la classe `low`
sotto i 10s (invariata).

Pillola centrale: il testo segue `b.state` — `Scegli 3 consonanti e 1 vocale` in `PICKING`,
`Prenotati per rispondere` in `RUNNING`, `Risposta in corso` in `BUZZED`.

- [ ] **Step 4: fixture `1h`**

Il fixture c'è già ma con la vecchia forma: va allineato a `finalBoardView()` (nome del
finalista, `given`, `picks`, `results`, `state`) e `main:finalTimer` deve portare `total`.
Contenuto del render: `MI RITORNI IN MENTE BELLA COME SEI`, rivelate `N R T E L M C I`,
42 secondi su 60, `given: N R T E`, `picks: L M C` + vocale `I`.
La griglia `GRIDS[CANZONI].NRTELMCI` esiste già.

- [ ] **Step 5: verifica `?mock=1h`** contro `screenshots/1h-gioco-finale.png`; test verdi; commit

---

## Task 3: Tabelloni 2 e 3 (disegno nostro)

**Files:** `public/index.html`, `public/css/tv.css`, `public/js/main.js`,
`public/js/dev/fixtures.mjs`, `scripts/gen-fixtures.js`

- [ ] **Step 1: la colonna delle lettere cambia contenuto, non posto**

Nel blocco `.fin-letters` si aggiunge una scheda-regola, nascosta di default:

```html
<div class="fin-rule" id="fin-rule">
  <span class="lab" id="fin-rule-lab"></span>
  <p id="fin-rule-text"></p>
</div>
```

`applyFinalBoard(b)` decide cosa mostrare:

| tabellone | tessere regalate | tessere scelte | scheda-regola |
|---|---|---|---|
| 1 | `N R T E`, didascalia `Regalate dal tabellone` | 4 posti, didascalia `Scelte dal finalista — 3 consonanti + 1 vocale` | nascosta |
| 2 | nessuna | nessuna | `Prima e ultima` · `Prima e ultima lettera di ogni parola. Nessuna scelta: si va a colpo d'occhio.` |
| 3 | nessuna | tutte le chiamate, senza limite di posti, didascalia `Consonanti illimitate + 1 vocale` | `Ogni errore` · `Una lettera assente costa 3 secondi.` |

La fila del tabellone 3 va a capo (`flex-wrap: wrap`) e le tessere sbagliate sono
`background:rgba(244,63,127,.10)`, `border:1px solid rgba(244,63,127,.55)`, testo
`--express-soft`: è lo stesso magenta della penalità, così una tessera sbagliata e lo scossone
del timer si leggono come la stessa cosa.

- [ ] **Step 2: la penalità**

```css
/* Il timer del gioco finale scatta e diventa magenta quando una lettera assente
   costa 3 secondi. La barra lo segue: il tempo perso si vede in due posti. */
@keyframes finalShake {
  0%, 100% { transform: none; }
  20% { transform: translateX(calc(-10 * var(--u))); }
  40% { transform: translateX(calc(9 * var(--u))); }
  60% { transform: translateX(calc(-6 * var(--u))); }
  80% { transform: translateX(calc(3 * var(--u))); }
}
.fin-clock.is-penalty .fin-time { animation: finalShake 0.42s var(--ease-out); }
.fin-clock.is-penalty .fin-time b,
.fin-clock.is-penalty .fin-time span { color: var(--express); }
.fin-clock.is-penalty .fin-bar i { background: var(--express); box-shadow: 0 0 calc(16 * var(--u)) rgba(244, 63, 127, 0.7); }
```

`@keyframes finalShake` va in `tv.css` accanto alla regola che la usa: la usa solo la TV.
(Le keyframe condivise stanno in `shell.css` — vedi `tests/css.test.js`, che lega ogni pagina
alle keyframe che può vedere.)

In `main.js`:

```js
socket.on('main:finalPenalty', () => {
  const clock = document.querySelector('#final-screen .fin-clock');
  clock.classList.remove('is-penalty');
  void clock.offsetWidth;   // riavvia l'animazione se le penalità sono ravvicinate
  clock.classList.add('is-penalty');
  setTimeout(() => clock.classList.remove('is-penalty'), 420);
});
```

Sotto `prefers-reduced-motion` resta il magenta e sparisce lo scossone: l'informazione è il
colore, il movimento è l'enfasi.

- [ ] **Step 3: fixture `1h2` e `1h3`**

Due fixture nuovi accanto a `1h`: `boardIndex: 1` con la griglia prima-e-ultima e
`boardIndex: 2` con una manciata di chiamate fra cui due sbagliate. La griglia del tabellone 2
non si scrive a mano: `scripts/gen-fixtures.js` guadagna una variante `PRIMULT` costruita con
`board.revealFirstLast()`, cioè lo stesso codice del server.
`?mock=1h3&freeze=penalita` fa arrivare un `main:finalPenalty` per fotografare lo scossone
(aggiungere `'penalita'` alla lista `FREEZE` di `tests/fixtures.test.js`).

- [ ] **Step 4: verifica `?mock=1h2`, `?mock=1h3`, `?mock=1h3&freeze=penalita`; test verdi; commit**

---

## Task 4: `1j` buste, finalista e spareggio

**Files:** `public/index.html`, `public/css/tv.css`, `public/js/main.js`

- [ ] **Step 1: markup e CSS della `1j`**

Le buste restano WebGL. Si rifà la cornice:

```html
<div id="envelopes-screen" class="screen hidden">
  <header class="tv-topbar" id="envelopes-topbar"></header>
  <div class="env-head">
    <h1 class="env-title">LE BUSTE</h1>
    <p class="env-sub">Il colore dice tutto</p>
  </div>
  <div class="envelopes-row" id="envelopes-row"></div>
  <footer class="env-foot">
    <div class="env-results"><span class="lab">Esiti del gioco finale</span><div class="env-pips" id="env-pips"></div></div>
    <span class="env-div"></span>
    <div class="env-changes"><span class="lab">Cambi rimasti</span><b id="env-changes">1</b></div>
    <p class="env-note">Il finalista può cambiarla alla cieca dal telefono</p>
  </footer>
</div>
```

Titolo Syne 800 40px `letter-spacing:14px` `--ink-soft` a `top:150`; sottotitolo Space Mono 400
15px `--ink-faint`. Barra bassa `height:150`: pastiglie `36×8px` (`--accent` con
`box-shadow:0 0 20px rgba(48,184,255,.5)` per i tabelloni vinti, `rgba(245,245,247,.35)` per i
persi), divisore `1×66`, numero dei cambi Syne 800 34px `--accent`, nota a destra.
**Nessun bottone "Cambia busta"**: l'azione vive sul telefono.

Gli esiti dei tabelloni non sono in `envelopesView()`, ma il colore delle buste sì
(`green`/`red`, uno per tabellone): le pastiglie si disegnano da lì, senza campi nuovi.

- [ ] **Step 2: finalista e spareggio**

`#finalist-screen` prende la barra alta (`Fase 05 · Gioco finale`, `right: 'Finalista'`) e
tiene nome e sottotitolo come sono: sopra ci gira l'animazione di round, che non si tocca.
Lo spareggio usa già `#game-screen` e la cornice comune: gli manca solo la fase giusta in
barra alta (`Fase 04 · Spareggio`, `leftTone: 'accent'`) al posto delle sei chip.

- [ ] **Step 3: verifica `?mock=1j`** contro `screenshots/1j-buste.png`; test verdi; commit

---

## Task 5: consegna

- [ ] **Step 1:** `node --test --test-concurrency=1` — tutti verdi
- [ ] **Step 2:** riletti a 1920×1080: `1h`, `1h2`, `1h3`, `1h3&freeze=penalita`, `1j`, e la
      `1c` per controllare che il tabellone del gioco normale non sia cambiato
- [ ] **Step 3:** riferire al committente il disegno dei tabelloni 2 e 3 e aspettare l'ok
      prima della slice 6 (telefono giocatore)
