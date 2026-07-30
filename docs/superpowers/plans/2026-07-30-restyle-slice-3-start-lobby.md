# Restyle slice 3 — Start e lobby

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Rifare la `1a` (schermata iniziale) e la `1b` (lobby col QR) sulla cornice costruita
nella slice 2, **senza toccare la ruota** di `public/js/fx/homewheel.js`.

**Architecture:** Solo markup, CSS e due funzioni di rendering. Nessun evento nuovo, nessun campo
nuovo sul server: `main:showLobby` e `main:playerJoined` portano già `url` e `players`, e il
contatore `N di 3` è `players.length`.

**Spec:** `docs/superpowers/specs/2026-07-30-restyle-giramoe-design.md`
**Riferimento visivo:** `design_handoff_tv_screens/README.md` §1a §1b, sorgente del mockup
`Giramoe TV Screens.dc.html` righe 45–134 (i valori esatti stanno lì, il README dà forbici).

**Vincolo del committente:** la ruota della `1a` resta **esattamente com'è adesso**. Niente
aumento di densità o luminosità dei punti, niente ghiera ciano, niente mozzo da 118px. Il mockup
la mostra diversa: quella parte non si copia.

---

## Task 1: La `1a`

**Files:** `public/index.html`, `public/css/tv.css`

- [ ] **Step 1: Markup di `#start-tap-screen`**

Le quattro corner label restano dove sono (già giuste). Cambia il resto:

```html
    <div id="intro-scrim" aria-hidden="true"></div>
    <div id="intro-stage">
      <div class="eyebrow rise">Giramoe Studio presenta</div>
      <div class="wm rise">GIRAMOE</div>
      <div class="tagline rise"><span class="rule"></span>Il gioco della ruota<span class="rule"></span></div>
    </div>
    <div id="intro-bottom">
      <button class="glass-button rise" id="tap-start-btn" data-cursor-label="Tap">Tocca per iniziare</button>
      <div class="intro-wait-hint">In attesa dell'host&hellip;</div>
      <div class="intro-phases" id="intro-phases"></div>
    </div>
```

Via `.intro-wheel-gap`: serviva a spingere il testo sopra la ruota quando la colonna era
centrata. Ora il testo sta in alto e il blocco bottone/fasi in basso, la ruota passa in mezzo.

- [ ] **Step 2: CSS della `1a`** (in `tv.css`, sezione INTRO, misure `calc(N * var(--u))`)

Scrim: `position:absolute; inset:0; background: radial-gradient(ellipse 42% 26% at 50% 25%,
rgba(0,0,0,.88) 24%, transparent 72%)` — è una correzione di leggibilità sul wordmark, non uno
stile della ruota, quindi non viola il vincolo.

`#intro-stage`: `position:absolute; inset:0; flex column; align-items:center;
padding-top: calc(126 * var(--u)); justify-content:flex-start` (oggi è centrato).
Eyebrow Space Mono 600 12px `letter-spacing:7px` `rgba(245,245,247,.42)`.
Wordmark `font-size: calc(184 * var(--u))`, `letter-spacing:-.035em`, `line-height:.9`,
`margin-top: calc(26 * var(--u))`.
Tagline: flex, `gap:20px`, `margin-top:22px`, Space Mono 400 20px `letter-spacing:1px`
`rgba(245,245,247,.62)`; `.rule` `120×1px`, a sinistra
`linear-gradient(90deg, transparent, rgba(48,184,255,.7))`, a destra invertito.

`#intro-bottom`: `position:absolute; left:0; right:0; bottom: calc(66 * var(--u));`
flex column, `align-items:center`, `gap: calc(40 * var(--u))`.

Bottone pieno: `#tap-start-btn { color:#000; background:var(--ink); border-color:var(--ink);
padding: calc(19*var(--u)) calc(58*var(--u)); letter-spacing: calc(2.5*var(--u));
box-shadow: 0 calc(14*var(--u)) calc(44*var(--u)) rgba(0,0,0,.6) }`, hover `--accent`.
⚠ `#btn-join, #btn-inizia, …` in `shell.css` non contiene `#tap-start-btn`: nessun conflitto.

Striscia fasi: celle `padding: 0 calc(34*var(--u))`, `border-left:1px solid rgba(255,255,255,.10)`,
l'ultima anche `border-right`; numero Space Mono 700 11px `letter-spacing:2.5px`, nome Space Mono
600 12px `letter-spacing:3px` uppercase; fase attiva numero `--accent` e nome `--ink`, le altre
`rgba(235,235,245,.22)` e `rgba(235,235,245,.34)`.

- [ ] **Step 3: Riempire la striscia da `tv/shell.js`**

Nuova funzione, stesse `PHASES` già esportate:

```js
// Striscia delle sei fasi: colonna numero+nome nella 1a, riga numero·nome
// separata da filetti nella lobby. Stessa lista, due disposizioni.
export function renderPhaseStrip(host, phase = 1, { inline = false } = {}) { /* … */ }
```

`inline:false` → celle con `border-left` (1a). `inline:true` → celle separate da
`<span class="ps-sep">` da `38×1px` (lobby).

- [ ] **Step 4: Verificare**

`http://localhost:3000/` a 1920×1080, confronto con `screenshots/1a-start.png`. La ruota deve
essere **identica a prima**: confrontare con un `git stash` o con lo screenshot precedente.
Poi il tap: il bottone sparisce e resta `In attesa dell'host…`, la striscia fasi resta.

- [ ] **Step 5: Commit**

---

## Task 2: La `1b`

**Files:** `public/index.html`, `public/css/tv.css`, `public/js/main.js`, `public/js/tv/shell.js`

- [ ] **Step 1: `renderTopBar` accetta un'etichetta libera a sinistra**

Oggi a sinistra mette o le sei chip o `Fase 0N · nome`. La lobby vuole `Sala d'attesa`.
Aggiungere l'opzione `left: <stringa>`, che vince su `compact`.

- [ ] **Step 2: Markup di `#lobby-screen`**

```html
    <header class="tv-topbar" id="lobby-topbar"></header>
    <div class="lobby-grid">
      <div class="lobby-col">
        <div class="col-head"><span class="lab">Giocatori</span><span class="max">MAX 3</span></div>
        <div class="lobby-slots" id="lobby-slots"></div>
      </div>
      <div class="lobby-center">
        <div class="lab">Inquadra per entrare</div>
        <div class="qr-plate"><canvas id="qr-canvas"></canvas><div class="qr-badge">G</div></div>
        <div class="qr-url"><span>oppure apri</span><b id="lobby-url"></b></div>
      </div>
      <div class="lobby-col">
        <span class="lab">Come si gioca</span>
        … tre passi 01/02/03 + tre riquadri 6 Fasi · 7 Tabelloni · 3 Buste …
      </div>
    </div>
    <footer class="intro-phases is-inline" id="lobby-phases"></footer>
```

Le tre righe `Come si gioca` e i tre riquadri sono statici: nessun dato dal server.
Copy dal README §1b, da riportare alla lettera.

- [ ] **Step 3: CSS della lobby**

Griglia `1fr auto 1fr`, `gap:76px`, `padding:0 84px`, fra 88px e 96px (assoluta come la 1c).
Scheda giocatore: `padding:22px 26px`, `border-radius:16px`, `background:var(--panel)`,
`border:1px solid rgba(255,255,255,.10)`, avatar 52px, nome 24px, stato Space Mono 400 12px
`letter-spacing:2.5px` `--accent`, indice `P1` a destra.
Slot libero: `background:rgba(22,22,26,.5)`, `border:1px dashed rgba(255,255,255,.16)`,
avatar cerchio tratteggiato, `In attesa…` `rgba(245,245,247,.3)` + `SLOT LIBERO`.
Piastra QR: `background:var(--ink)`, `padding:20px`, `border-radius:20px`,
`box-shadow:0 26px 80px rgba(0,0,0,.65)`; badge `74px`, `border-radius:12px`, `G` Syne 800 32px.
Striscia bassa: `height:96px`, `border-top` hairline,
`background: linear-gradient(0deg, rgba(10,10,12,.9), transparent)`.

- [ ] **Step 4: `updatePlayerSlots` scrive le schede nuove**

Riscrive `#lobby-slots` con `document.createElement` (i nomi arrivano dai giocatori: niente
`innerHTML`). Stato: `COLLEGATO` normale, `RICONNESSIONE…` quando `connected === false`,
`SLOT LIBERO` quando lo slot è vuoto. Aggiorna anche il contatore in barra alta
(`N di 3 collegati`) e `#lobby-url`.

- [ ] **Step 5: QR a 375px con correzione alta**

In `main:showLobby`, `QRCode.toCanvas` passa da `{ width: 220, margin: 2 }` a
`{ width: 375, margin: 1, errorCorrectionLevel: 'H' }`.
⚠ Il badge `G` al centro copre dei moduli: **senza livello H il QR non si legge più**. Va
verificato inquadrandolo davvero, non a occhio.

- [ ] **Step 6: Verificare**

`?mock=1b` a 1920×1080 contro `screenshots/1b-lobby-qr.png`, e il QR letto col telefono.

- [ ] **Step 7: Commit**

---

## Task 3: Consegna

- [ ] **Step 1:** `node --test --test-concurrency=1 tests/*.test.js` — nessun test tocca queste
  schermate, devono restare 137 PASS.
- [ ] **Step 2:** Screenshot `1a` e `1b` accanto ai render.
- [ ] **Step 3:** Aspettare l'ok prima della slice 4.

## Fuori scope

- Ruota della `1a` (`fx/homewheel.js`): non si tocca, per decisione del committente.
- `1e` / `1f` / `1g`: slice 4.
- Le animazioni di round e `title-fx`: restano come sono.
