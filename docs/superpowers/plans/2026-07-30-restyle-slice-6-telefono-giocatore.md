# Restyle slice 6 — Telefono del giocatore

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Rifare le tredici schermate del telefono giocatore (`1a`–`1m`) e portare la mini-ruota
allo stesso halftone della TV.

**Architecture:** `play.html` non ha una cornice comune: ogni schermata è un
`.mobile-container` che impila pillole. Il handoff ne introduce una — barra alta col nome e la
fase, schede statistiche a coppia, banner di stato, bottoni con tre stati — che si scrive una
volta in `public/js/phone/shell.js` e vale per otto schermate, come `tv/shell.js` per la TV.
La ruota resta un canvas 2D (`public/js/wheel.js`): cambia solo il disegno.

**Spec:** `docs/superpowers/specs/2026-07-30-restyle-giramoe-design.md`
**Riferimento visivo:** `design_handoff_phone_screens/README.md` §1a–§1m; sorgente del mockup
`Giramoe Phone Screens.dc.html`.

**Verifica:** `?mock=1a` … `?mock=1m` su `play.html` a **430×932** contro
`design_handoff_phone_screens/screenshots/`.

---

## Decisioni prese prima di scrivere codice

**1. La ruota del telefono resta un canvas 2D, non diventa WebGL.** Il handoff dice
esplicitamente che in produzione resta `wheel.js`. Portarla a `wheel3d.js` significherebbe
tre.js e un contesto WebGL su ogni telefono in sala per un disco da 196px: cambia solo il
disegno, non la tecnologia. Restano identici i meccanismi — `spinTo`, `setLabels`, `resize`,
`onSpinEnd` — perché li usa `player.js` e le animazioni non si toccano.

**2. La cornice del telefono si scrive una volta.** Otto schermate su tredici hanno la stessa
barra alta (avatar + nome a sinistra, fase a destra) e cinque hanno la stessa coppia di schede
statistiche. Vanno in `public/js/phone/shell.js`, non copiate in `player.js`.

**3. Il telefono oggi non sa cose che il handoff mostra.** Quanti posti mancano (`1a`), chi è
già dentro (`1b`), che fase e che tabellone si sta giocando (barra alta), quanto vale lo
spicchio uscito (`1d`), quanti secondi restano nella finestra Giramoe (`1h`). Sono tutte
proiezioni di stato che il server ha già: si aggiungono ai payload esistenti, non si inventa
stato nuovo.

**4. `1j` è due schermate, non una.** Il mockup le mette una sotto l'altra separate da
`Se invece perdi` solo per mostrarle insieme. In produzione se ne vede una sola.

---

## Task 1: La mini-ruota in halftone

**Files:** `public/js/wheel.js`, `public/dev/wheel.html`

- [ ] **Step 1: il disegno nuovo**

Restano invariati: 16 spicchi da 22.5°, lo spicchio 0 a ore 12, `spinTo`, `setLabels`,
`resize`, `onSpinEnd`. Cambia `draw()`:

- fondo dello spicchio: punti halftone del colore dello spicchio su nero, passo 5px, raggio
  del punto 1.1px — la stessa griglia della TV, scalata al disco piccolo;
- confini: 1px `rgba(255,255,255,.10)`, nessun bordo lucido;
- ghiera: anello `1px rgba(48,184,255,.55)` col tacchetto ogni spicchio;
- mozzo piatto da `0.19 * raggio`, `#0c0c0f`, bordo `1px rgba(255,255,255,.14)`, punto ciano
  centrale — lo stesso mozzo deciso nella slice 1 per la TV;
- etichette radiali Space Mono 700, colore `#f5f5f7`, con i simboli degli spicchi speciali
  (`✕`, `→`, `×2`, `»`) — niente emoji: `🚄` non ha lo stesso peso su Android e iOS.

Via `SPECIAL_STYLE` con gradienti e glow, via `shade()`: il tema non ha più superfici lucide.
`SEGMENT_COLORS` diventa la stessa lista di `public/js/fx/wheel3d.js`, importata no —
duplicata con un commento che dice dov'è l'originale (`wheel.js` è uno script classico,
`wheel3d.js` un modulo: importarlo qui obbligherebbe play.html a caricare tre.js).

- [ ] **Step 2: `public/dev/wheel.html` mostra anche la 2D**

La pagina di sviluppo della slice 1 confronta le varianti della ruota WebGL. Aggiungere un
riquadro con la ruota 2D alle tre dimensioni in cui esiste (196 · 250 · 240) così si vede
subito se il passo dei punti regge quando il disco è piccolo.

- [ ] **Step 3: verifica a 430×932 e commit**

---

## Task 2: Cornice del telefono, `1a`, `1b`, `1m`

**Files:** `public/js/phone/shell.js` (nuovo), `public/play.html`, `public/css/phone.css`,
`public/js/player.js`, `server.js`, `public/js/dev/fixtures.mjs`

- [ ] **Step 1: `public/js/phone/shell.js`**

```js
// La cornice del telefono giocatore: barra alta, schede statistiche, banner di
// stato. La usano otto schermate su tredici. I nomi arrivano dai giocatori:
// si scrivono con textContent, mai con innerHTML.
export function renderTopBar(host, { name, phase, tone })   // tone: null | 'accent' | 'express'
export function renderStats(host, cards)                    // [{ lab, value, tone }]
export function renderBanner(host, { text, tone })          // tone: null | 'accent' | 'express' | 'negative'
```

`wheel.js` e `player.js` sono script classici; `phone/shell.js` è un modulo. Va caricato come
modulo **prima** degli script classici e appeso a `window.PhoneShell`, come già fa `play.html`
con la socket finta: un solo percorso di caricamento, uguale in sviluppo e in produzione.

- [ ] **Step 2: i posti liberi e chi è già dentro (server)**

`1a` scrive `Posto 1 di 3 · servono 3 giocatori` e `1b` elenca i collegati: oggi il telefono
non ha nessuno dei due dati. Il server manda a **tutti** i socket (anche a chi non è ancora
entrato — è l'unico momento in cui serve) la composizione della lobby:

```js
// Chi sta per entrare deve sapere quanti posti restano, e chi è già dentro deve
// vedere gli altri arrivare: nessuno dei due è nella room 'main'.
function broadcastLobbyToPhones() {
  io.emit('player:lobby', { players: lobbyPlayers(), max: MAX_PLAYERS });
}
```

Va chiamata dove oggi si manda `main:playerJoined`, più una volta su `connection`.

- [ ] **Step 3: `1a` ingresso**

Colonna centrata `padding:0 28px 60px`, `gap:44px`; campo halftone col buco
(`ellipse 74% 30% at 50% 46%, transparent 60%`). Eyebrow `Giramoe Studio` Space Mono 600 10px
`letter-spacing:5px`; wordmark `.wm` a 42px `line-height:1.1`. Scheda form `padding:30px 24px`,
`border-radius:24px`, `background:#16161a`, `border:1px solid rgba(255,255,255,.10)`,
`box-shadow:0 18px 50px rgba(0,0,0,.5)`, `gap:16px`: etichetta `Come ti chiami` → campo →
primario `Entra` → contatore dei posti.

Il campo di testo **non scende sotto i 16px**: sotto quella soglia iOS zooma al focus e la
schermata salta.

- [ ] **Step 4: `1b` attesa e `1m` riconnessione**

`1b`: indicatore 74px (cerchio ciano con pallino `liveBlink 1.8s`), titolo `Ci siamo quasi`
Syne 800 30px, riga di spiegazione, lista dei collegati con dot, nome, badge `TU` e slot vuoti
`In attesa…`.
`1m`: stesso cerchio col pallino bianco, `Riconnessione…` Syne 800 28px, la riga
`La partita è in pausa e ti sta aspettando. Non chiudere la pagina.` e una scheda con avatar e
`Il tuo posto e i tuoi punti sono salvi`.

Fixture nuovo `1m` (oggi non c'è) e `1a`/`1b` aggiornati col payload `player:lobby`.

- [ ] **Step 5: verifica `?mock=1a`, `1b`, `1m` a 430×932; test verdi; commit**

---

## Task 3: `1c` turno, `1d` consonante, `1e` express

**Files:** `server.js`, `public/play.html`, `public/css/phone.css`, `public/js/player.js`,
`public/js/dev/fixtures.mjs`

- [ ] **Step 1: la barra alta ha bisogno della fase (server)**

`playerView()` guadagna tre campi, tutti già in `state`:

```js
    // La barra alta del telefono dice fase e tabellone: senza, il giocatore
    // vede solo il proprio punteggio e non sa a che punto è la partita.
    phase: state.phase,
    boardNumber: state.g.boardNumber,
    totalBoards: TOTAL_BOARDS,
    // "Spicchio 500" nella seconda scheda quando tocca chiamare la consonante
    wedge: state.g.lastSpinValue
```

- [ ] **Step 2: `1c` e `1d`**

`padding:18px 20px`, `gap:16px`: barra alta → due schede (`Punti turno` evidenziata / `Banca`;
in `1d` la seconda diventa `Spicchio 500`) → banner → mini-ruota 196px → primario
`Gira la ruota` 58px → tastiera → ghost `Compra vocale — 500`.
In `1c` la tastiera è a `opacity:.35` e il bottone vocale è ghost disattivato; in `1d` la
tastiera è attiva, il bottone vocale è secondario e sotto compare la scheda del picker vocali
con la nota `Le lettere spente sono già state chiamate`.

Tastiera: 21 consonanti, 7 colonne, `gap:9px`, tasto `aspect-ratio:1`, `border-radius:12px`,
Space Mono 600 20px; tre stati (disponibile / già chiamata / selezionata) e
`:active { transform: scale(.9) }` come oggi. Vocali: 5 colonne, Space Mono 700 22px.

- [ ] **Step 3: `1e` express**

Fondo magenta (`radial-gradient(85% 65% at 50% -8%, rgba(70,20,45,.35), transparent 62%),
linear-gradient(180deg,#0d090b,#000 64%)`), pillola `EXPRESS` in barra alta, righe di velocità
(`top:300px; height:300px`), schede `Punti turno` magenta / `A lettera 500`, blocco d'avviso
`Spara consonanti a raffica` + la riga del rischio, tastiera sempre attiva, `Compra vocale`
secondario, riga `Raffica  T O N I`.

La raffica la tiene il telefono: sono le lettere che ha sparato lui in questo turno, e nessun
payload del server le porta (lato server sono il turno normale con un moltiplicatore diverso).
Si azzera quando l'express finisce.

Via il messaggio con l'emoji `🚄 EXPRESS! Spara consonanti o compra vocali`.

- [ ] **Step 4: verifica `?mock=1c`, `1d`, `1e`; test verdi; commit**

---

## Task 4: `1f` `1g` Triplete, `1h` Giramoe, `1i` spareggio

**Files:** `server.js`, `public/play.html`, `public/css/phone.css`, `public/js/player.js`

- [ ] **Step 1: la finestra da 5s arriva anche al telefono (server)**

`playerGiramoeView(i)` guadagna il tempo che resta, dallo stesso `giramoeWindowUntil` che la
slice 4 ha aggiunto per la TV:

```js
    // L'anello del conto alla rovescia: senza, sul telefono i 5 secondi sono
    // una frase e basta.
    windowMs: Math.max(0, giramoeWindowUntil - Date.now()),
    windowTotal: GIRAMOE_BUZZ_MS,
```

- [ ] **Step 2: `1f` e `1g`**

`gap:26px`. Schede `Triplete` / `Banca`; istruzione centrata; **buzzer 300px** coi valori già
in `.buzz-button` (cambia la dimensione fissa) più il sottotesto `Tieni premuto per sicurezza`;
tre pip di avanzamento; nota `Tutti e tre → 5.000 punti`.
`1g`: pillola negativa `Frase sbagliata — sei bloccato` (`border-radius:999px`,
`white-space:nowrap`, dot `flex:none` — così non tocca i bordi), spiegazione, buzzer a
`opacity:.4` col sottotesto `Non disponibile`, lista dei tre giocatori coi badge
`BLOCCATO` / `IN GIOCO`.

La lista dei tre giocatori con lo stato non c'è nel payload: `player:tripleteState` porta solo
il proprio. Il server la aggiunge (`players: [{ name, locked }]`) — la stessa lista che
`tripleteScores()` produce già per la TV.

- [ ] **Step 3: `1h` Giramoe**

Schede `Moltiplicatore ×500` (evidenziata) / `Tuoi punti`; banner `Una sola consonante`;
tastiera attiva e **nessun bottone vocale** — nel Giramoe le vocali si comprano, quindi il
bottone resta ma solo quando `canBuyVowel` è vero (il mockup mostra il caso in cui non lo è);
scheda countdown con anello 58px `conic-gradient` + disco 46px e cifra Syne 800 22px; buzzer
pillola; nota `Solo chi indovina incassa i propri punti`.

- [ ] **Step 4: `1i` spareggio**

Colonna centrata: eyebrow `Parità in banca`, titolo `Spareggio` Syne 800 44px, spiegazione,
mini-ruota 250px in variante Giramoe, lista dei contendenti col valore uscito (`—` se non ha
ancora girato), primario `GIRA LA RUOTA` 62px.
La ruota nello spareggio oggi sul telefono non c'è: `#player-tiebreak-screen` ha solo il
bottone. Va aggiunta, con le stesse etichette che il server manda alla TV.

- [ ] **Step 5: verifica `?mock=1f`, `1g`, `1h`, `1i`; test verdi; commit**

---

## Task 5: `1j` finalista, `1k` gioco finale, `1l` buste

**Files:** `server.js`, `public/play.html`, `public/css/phone.css`, `public/js/player.js`

- [ ] **Step 1: gli esiti hanno bisogno dei numeri (server)**

`player:finalist` diventa `{ name, isMe, bank, myBank }`: la schermata dice `punti in banca`
se hai vinto e `Hai chiuso con 3.200 punti` se hai perso, e oggi nessuno dei due numeri arriva.
`player:finalState` guadagna `timeLeft`, `total` e `picks` (quante consonanti e se la vocale è
fatta) per la scheda timer e i quattro quadratini del progresso.

- [ ] **Step 2: `1j`**

Due stati alternativi nella stessa schermata.
Vinto: scheda ciano `padding:34px 24px`, `border-radius:24px`, `Sei il finalista` → banca Syne
800 46px `--accent` → `punti in banca` → `Tre tabelloni, 60 secondi in tutto. Guarda lo
schermo grande.`
Perso: scheda neutra a `opacity:.75`, `Fine partita` → `Va <nome> al gioco finale` Syne 800
30px → `Hai chiuso con N punti. Grazie per aver giocato!`

- [ ] **Step 3: `1k`**

Scheda timer (`60` Syne 800 44px `tabular-nums`, riga `Il timer parte quando hai scelto`,
barra piena); scheda istruzione ciano con i quattro quadratini 26px (pieni `--accent`, da fare
`1px dashed rgba(48,184,255,.6)`, 9px di stacco fra le tre consonanti e la vocale); tastiera
con le scelte evidenziate; riga vocali; buzzer `PRENOTATI` disattivato finché la scelta non è
completa — e disattivato **dicendo perché**, come tutti i primari del handoff.

- [ ] **Step 4: `1l` buste**

Titolo `Hai aperto la busta N` Syne 800 26px + riga dei cambi; busta aperta `padding:26px 22px`,
`border-radius:20px`, `border:2px solid rgba(48,184,255,.85)`, texture halftone a `opacity:.7`,
etichetta + premio Space Mono 700 26px; le altre due come riquadri `flex:1` a bordo
tratteggiato con stato `Chiusa` / `Scambiabile`; primario `TIENI QUESTA`, secondario `CAMBIA`,
nota `Una busta scartata non si può ripescare`.

- [ ] **Step 5: verifica `?mock=1j`, `1k`, `1l`; test verdi; commit**

---

## Task 6: consegna

- [ ] **Step 1:** `node --test --test-concurrency=1` — tutti verdi
- [ ] **Step 2:** tutte le tredici a 430×932, più un giro sulla TV (`?mock=1c`) per controllare
      che i campi nuovi del server non abbiano mosso niente
- [ ] **Step 3:** riferire al committente e aspettare l'ok prima della slice 7 (telefono admin)
