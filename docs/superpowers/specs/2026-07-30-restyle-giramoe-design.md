# Restyle Giramoe — design

Data: 2026-07-30

## Obiettivo

Ricreare dentro Giramoe le 32 schermate dei due handoff di design, mantenendo invariate le
regole di gioco, lo stato sul server e tutte le animazioni esistenti. È un lavoro di **skin e
layout**: nessun evento socket nuovo dove basta arricchire un payload, nessuna libreria nuova,
nessun bundler.

I due bundle di riferimento stanno nella cartella del progetto (non versionati, come
`design_handoff_round_animations/`):

- `design_handoff_tv_screens/` — 8 schermate a 1920×1080 (`README.md`, `Giramoe TV Screens.dc.html`, `screenshots/`)
- `design_handoff_phone_screens/` — 24 schermate a 430×932 (13 giocatore + 11 admin)

I README dei bundle sono la **fonte di verità** per token, misure, colori e copy. Questo
documento non li ricopia: fissa le decisioni che i README non prendono, colma i buchi e definisce
come il lavoro viene spezzato e verificato.

## Copertura

| Superficie | Schermate |
|---|---|
| TV `public/index.html` | `1a` start · `1b` lobby · `1c` primo gioco · `1e` Triplete · `1f` Express · `1g` Giramoe · `1h` gioco finale · `1j` buste |
| Telefono giocatore `public/play.html` | `1a`–`1m` (13) |
| Telefono admin `public/admin.html` | `1n`–`1x` (11) |

### Buchi nei handoff, colmati qui

| Buco | Decisione |
|---|---|
| Tabelloni 2 e 3 del gioco finale TV (c'è solo il `3+1`) | progettati in § Gioco finale |
| Schermata Finalista TV (`#finalist-screen`) | riporta in tema riusando la scheda ciano della `1j` telefono: nome finalista, banca in Syne 800, riga su cosa succede adesso |
| Spareggio TV (oggi riusa `#game-screen` con `renderTiebreak`) | schermata dedicata sul modello della `1u` admin: eyebrow `Parità in banca`, titolo `Spareggio` Syne 800, ruota Giramoe, schede contendente con il valore uscito |
| Titolo di round (`#triplete-title-screen`) | **non si tocca**: è un'animazione |

## Decisioni

### 1. Ruota — solo il mozzo

Etichette e camera restano **esattamente come oggi**: il leggero scorcio 3D e l'orientamento
radiale delle etichette (compresi i numeri capovolti nella metà sinistra) sono voluti.

Cambia solo il mozzo. Oggi è una semisfera halftone bianca (`SphereGeometry` in
`_buildWheel`), che stacca troppo. Nuovo mozzo, **piatto**, disegnato dentro il canvas
dell'anello etichette (`_buildLabelRing`) — nessuna mesh nuova, nessun rischio sullo spin:

- disco pari al **20% del diametro**, `radial-gradient(circle at 50% 32%, #26343f 0%, #131b22 52%, #080d12 100%)`
- bordo `1px rgba(48,184,255,.45)`
- punti halftone al **45%**, sfumati verso il bordo
- nucleo pari al **2,2% del diametro**, `radial-gradient(circle at 50% 34%, #d8f3ff, #30b8ff 70%)`, alone `0 0 20px 5px rgba(48,184,255,.55)`

La **mini-ruota del telefono** (`public/js/wheel.js`, Canvas 2D — usata anche come fallback della
TV) è un problema diverso: non è la ruota halftone col mozzo bianco, è la **vecchia ruota "glass"**
— bezel bianco, rivetti, cupola di vetro, express col treno 🚄. Non va ritoccata col mozzo nuovo,
va **riscritta halftone** per somigliare alle `1c` e `1i` del handoff telefono: colori vividi
mascherati a punti, fascia scura radiale, separatori neri col filo ciano sui confini, perni,
cornice ciano con tacche, mozzo nuovo, etichette attive (oggi `showLabels:false`).
Per costo/beneficio la faccia va **bakeata in un canvas offscreen** a ogni `setLabels` e poi solo
ruotata: ridisegnare 16 spicchi più la maschera a punti a 60fps per 6 secondi di giro è troppo per
un telefono. Sta nella **slice 6**, dove si costruiscono le schermate telefono e la si può
giudicare a 196px nel suo contesto.

**Il bug del mockup non va copiato.** In `GiramoeWheel.dc.html` i colori partono da
`conic-gradient(from 0deg)` mentre i separatori da `repeating-conic-gradient(from -11.25deg)`:
mezzo spicchio di sfasamento, per cui la linea nera passa in mezzo alla banda di colore, sopra
l'etichetta. È visibile in tutti i render con ruota. `wheel3d.js` è già allineato
(separatori a `-π/2 + i·seg` = confini, etichette a `mid` = centri) e non va toccato.

### 2. Lettera e occorrenze — 3,5 secondi

Sulla TV i tre moduli sotto la ruota (`Spicchio` / `Lettera` / `Occorrenze`) si comportano così:

- alla chiamata, `Lettera` mostra la lettera; poi `Occorrenze` mostra `×N`, e **`×0` se la lettera
  è assente** — così il giocatore successivo sa che è già stata provata (sul tabellone una lettera
  assente non lascia traccia);
- dopo **3,5s** `Lettera` e `Occorrenze` tornano a `—`;
- `Spicchio` **non** ha timer: tiene il valore per tutto il turno, è il contesto del punteggio.
  Si azzera al giro successivo o al cambio di turno.

Dati già disponibili: `main:letterCalled` porta la lettera, `main:revealLetter` le posizioni
(occorrenze = `positions.length`), `main:wrong` significa `×0`, `main:spin` il valore dello spicchio.

In Express la riga `Raffica` resta **cumulativa** per tutto il turno express: è un riassunto,
non una notifica.

### 3. Express — il trattamento magenta è condizionale

I render Express (TV `1f`, telefono `1e`) mostrano lo stato **dopo** che un giocatore è entrato
in express. Fuori da quello stato la fase 03 è **identica** alla fase 01.

- `expressMode` attivo → fondo magenta, righe di velocità, pillola `EXPRESS | 500 A LETTERA` al
  posto delle chip, modulo express sotto la ruota, tre riquadri
  (`Raffica` / `Occorrenze totali` / `Punti express`), scheda giocatore in tinta magenta;
- `expressMode` spento → schermata `1c` intatta, con la chip `03 Express` attiva nella barra alta
  e lo spicchio `EXPRESS` al posto di uno `PASSA` sulla ruota.

Stessa regola sul telefono: `1e` solo in express, altrimenti `1c` / `1d`.

### 4. La ruota della schermata iniziale resta com'è

Il disco halftone decorativo della `1a` (`public/js/fx/homewheel.js`) **non si tocca**. Il handoff
chiedeva di alzare densità e luminosità dei punti fino all'aspetto del mockup e di aggiungere una
ghiera (`border:1px solid rgba(48,184,255,.32)` + `box-shadow:0 0 60px rgba(48,184,255,.10)`) e un
mozzo da 118px: **niente di tutto questo**. Resta la ruota di oggi.

Tutto il resto della `1a` si fa: eyebrow, wordmark Syne 800 184px col glint, la riga
`Il gioco della ruota` fra due filetti ciano, il bottone **pieno bianco** al posto del ghost, la
striscia delle 6 fasi in basso, le corner label. Resta anche lo **scrim** sopra il disco
(`radial-gradient(ellipse 42% 26% at 50% 25%, rgba(0,0,0,.88) 24%, transparent 72%)`): non è un
cambio di stile della ruota, è quello che tiene leggibile il wordmark sopra i punti.

### 5. Animazioni — invariate

`public/js/fx/roundscenes.js` (le 6 scene di round), `wheelFly`/`wheelBack`, `cellFlip`,
`liveBlink`, `waitPulse`, `glint`, `buzzPulse`, `.fx-veil`, `.result-overlay`,
`:active { transform: scale(...) }` e `@media (prefers-reduced-motion: reduce)`: tutto resta
com'è. Unico vincolo da verificare a ogni slice: le nuove barre alta/bassa non devono passare
sopra `#round-scene`.

### 6. Gioco finale — tabelloni 2 e 3

Scheletro della `1h` invariato: timer 230px a sinistra, tabellone 1040px al centro, colonna
`Tabelloni` a destra.

**Blocco `Lettere in gioco` (colonna sinistra, in basso):**

- **Tabellone 1** — come il render: 4 tessere bianche `N R T E` (`Regalate dal tabellone`) e 4
  tessere ciano, l'ultima a bordo tratteggiato (`Scelte dal finalista — 3 consonanti + 1 vocale`).
- **Tabellone 2** — nessuna scelta del giocatore. Al posto delle tessere bianche una riga
  `Prima e ultima lettera di ogni parola` (Space Mono 400 13px `--ink-soft`), sotto le tessere
  bianche delle lettere distinte uscite, a capo su massimo 2 righe. Nessuna tessera ciano.
- **Tabellone 3** — due file etichettate: `Chiamate` (tessere ciano che crescono: consonanti
  illimitate + 1 vocale) e `Errori · −3s` (tessere `rgba(255,255,255,.06)`, bordo
  `rgba(245,245,247,.28)`, testo `rgba(245,245,247,.45)`).

**Penalità del tabellone 3 — shake del timer.** Alla lettera errata:

- il numero del timer **e** la barra di avanzamento eseguono `timerPenalty .45s`:
  `translateX` `0 → -9px → +9px → -6px → +3px → 0` (a palco 1920, scalato con il resto);
- durante lo shake numero e barra passano a **`#f43f7f`** (il token ⊕ Express: è il solo colore
  d'allarme del sistema, e Express e gioco finale non coesistono mai, quindi nella schermata non
  può significare altro), barra con `box-shadow: 0 0 18px rgba(244,63,127,.7)`;
- il numero **salta subito** di 3: la penalità è già applicata quando parte l'animazione, lo shake
  spiega un numero già cambiato, non lo anticipa;
- `prefers-reduced-motion`: niente scossa, solo il lampo di colore per 450ms;
- la fila `Errori · −3s` resta: lo shake è la notifica, le tessere sono il registro;
- lo stesso shake va sulla scheda timer del **telefono** (`1k`): anche il finalista deve capire
  perché ha perso 3 secondi.

**Colonna destra, le tre schede** — si aggiunge lo stato di esito, assente nel render perché
fermo al primo tabellone: `RISOLTO` in `--accent` con pastiglia `8px` accesa, `SBAGLIATO` in
`rgba(245,245,247,.5)` con pastiglia spenta — gli stessi due colori delle buste (`--red` è bianco,
non rosso). La scheda attiva resta come nel render.

## Architettura

### CSS — split per superficie

`public/css/style.css` è a 1.301 righe e con 32 schermate raddoppierebbe. Si spezza in cinque
file, senza bundler, solo più `<link>`:

| File | Contenuto |
|---|---|
| `public/css/tokens.css` | variabili, `@font-face`, grana, halftone, reset |
| `public/css/shell.css` | barre alta/bassa, chip fase, pip, scheda giocatore, bottoni, campi, banner |
| `public/css/tv.css` | le 8 schermate TV + Finalista + Spareggio |
| `public/css/phone.css` | giocatore `1a`–`1m` |
| `public/css/admin.css` | admin `1n`–`1x` |

Caricamento: `index.html` → `tokens + shell + tv`; `play.html` → `tokens + shell + phone`;
`admin.html` → `tokens + shell + admin`. Ogni pagina scarica meno CSS di oggi e ogni file resta
sotto le ~600 righe.

### JS — due estrazioni

- `public/js/tv/shell.js` — `renderShell(phase, opts)`: barra alta (wordmark, 6 chip di fase, pip
  tabellone, `● Live`) e barra bassa giocatori. La usano `1b`, `1c`, `1e`, `1f`, `1g`, `1h`, `1j`:
  una funzione invece di sei copie.
- `public/js/phone/shell.js` — barra alta giocatore, coppia di stat card, banner di stato del
  turno: gli stessi tre pezzi su 8 schermate.

`public/js/admin.js` (368 righe) resta uno script classico, riorganizzato per sezioni: convertirlo
a modulo ES è rischio senza guadagno.

### Correzione dopo la slice 2: due pezzi del handoff non sono CSS

Il handoff descrive il campo halftone e le celle del tabellone in CSS, e la spec li aveva presi
alla lettera. In produzione sono due superfici WebGL, e scriverne la versione CSS avrebbe prodotto
regole che non si vedono.

- **Campo halftone.** Il tappeto di punti che copre il testo è `public/js/fx/dotfield.js`, un quad
  a schermo intero con shader proprio, e porta anche le onde radiali su spin / risposta giusta /
  risposta sbagliata. Il buco ellittico va **nello shader**, una maschera per schermata
  (`DotField.setScreen(id)`, chiamata da `showScreen`). Un `.hf-field` in DOM sopra raddoppierebbe
  i punti; spegnere lo shader porterebbe via le onde, che il committente ha chiesto di lasciare.
- **Celle del tabellone.** Le disegna `public/js/fx/board3d.js`; sotto `.webgl-stage` le celle DOM
  sono `visibility: hidden`. La distinzione fra cella chiusa (`#d8d8d9`, cioè
  `rgba(245,245,247,.88)` su nero) e cella rivelata (bianco pieno) sta nei **materiali**. Il CSS
  delle celle resta, ma vale solo come fallback quando WebGL non parte. Larghezza, gap e corpo
  restano CSS: `board3d.js` posa le tessere sul rettangolo della griglia DOM.

### Misure: palco logico 1920×1080

Il handoff esprime tutto su 1920×1080, come `roundscenes.js`. `tv.css` definisce
`--u: min(calc(100vw / 1920), calc(100vh / 1080))` — un pixel di quel palco — e le misure del
handoff si scrivono `calc(N * var(--u))`. Niente `transform: scale()` su un contenitore: la ruota
WebGL verrebbe scalata dopo il render e su una TV 4K uscirebbe sfocata.

### Server — solo campi di lettura

Lo stato vive sul server e non cambia. I mockup mostrano dati che il server **ha già** ma non
manda ai client. Si arricchiscono le view esistenti, con test; nessun evento nuovo dove basta un
campo in più.

| Campo | View | Serve a |
|---|---|---|
| `expressPoints`, `expressLetters` | `playerView`, `mainGameView` | `1f` TV, `1e` telefono |
| deadline della finestra di prenotazione 5s | `playerGiramoeView`, `main:giramoeScores` | anello 5s in `1g` TV e `1h` telefono |
| `picks` (consonanti + vocale), `wrongLetters` | `finalBoardView`, `playerFinalView` | `1h` TV tab. 1 e 3, `1k` telefono |
| `slotsTaken` / `slotsTotal` | `player:joined`, `main:showLobby` | contatore posti in `1a` / `1b` telefono |
| `lockedOut` degli altri giocatori | `playerTripleteView` | lista `BLOCCATO` / `IN GIOCO` in `1g` telefono |
| esito positivo della frase | `admin:boardError` → `admin:boardCheck` | riga di validazione live in `1p` admin |

Ogni slice aggiunge solo i campi che le servono, con i propri test: così ogni slice resta
rilasciabile da sola.

### Harness di sviluppo `?mock=`

Serve ad arrivare su una schermata senza rigiocare una partita, e soprattutto a **fermare gli
stati transitori** (shake della penalità, moduli `Lettera`/`Occorrenze` a 3,5s, banner di
prenotazione, pastiglia del turno) che in partita vera durano meno di quanto serva a
confrontarli col render.

- `public/js/dev/fixtures.js` — i contenuti d'esempio dei mockup (`PROVERBI`,
  `NON TUTTE LE CIAMBELLE RIESCONO CON IL BUCO`, Marco 1.400/3.200, Giulia 5.800, Elia 2.100,
  le buste, i timer), **nella forma esatta** dei payload veri (`mainGameView()`,
  `playerGiramoeView(i)`, `envelopesView()`, …).
- `public/js/dev/mock.js` — legge `?mock=<id>` e, se il parametro non c'è, esce subito. Se c'è,
  espone `window.__mockSocket`: un oggetto con la stessa API della socket (`on`, `emit`, `id`) che
  registra gli handler veri e poi li chiama con i fixture, nell'ordine giusto.
- Unica modifica alle tre superfici: `const socket = window.__mockSocket || io();`
- I due file dev si caricano con un `import()` dinamico dentro l'`if` del parametro: senza
  `?mock=` il browser non li scarica.
- `?mock=1w&freeze=<stato>` congela uno stato transitorio.

**Non duplica il rendering**: chiama le stesse funzioni della partita vera. Se una schermata viene
giusta col fixture, viene giusta col payload reale.

**Gate:** il server serve `/js/dev/` **solo** fuori produzione (middleware che risponde 404
quando `NODE_ENV === 'production'`), così durante una partita vera non è raggiungibile.

## Slice

Un branch `feat/restyle-2026`, un commit per slice. Dopo ogni slice: screenshot dell'app vera
accanto al render di riferimento, e correzioni prima di passare alla successiva.

| # | Slice | Contenuto |
|---|---|---|
| 1 | Ruota TV | mozzo nuovo in `wheel3d.js`, geometria angolare in un modulo puro con test, pagina di sviluppo `public/dev/wheel.html` col gate in produzione |
| 2 | Fondamenta TV + fase 01 | split CSS, `tv/shell.js`, harness `?mock=` + gate, campo halftone mascherato, celle tabellone, varianti categoria, `1c` con i tre moduli e il timer 3,5s |
| 3 | Start + lobby | `1a` (wordmark 184px, striscia 6 fasi, bottone bianco pieno, tagline `Il gioco della ruota`) e `1b` (QR 375px a correzione **H** con pastiglia `G`, colonna `Come si gioca`, riquadri statistica, striscia fasi bassa) |
| 4 | Triplete + Express + Giramoe | `1e`, `1f`, `1g` — più i campi server `expressPoints`/`expressLetters` e la deadline dei 5s |
| 5 | Gioco finale + buste + finalista + spareggio | `1h` nelle tre varianti (shake incluso), `1j`, `#finalist-screen`, spareggio TV — più `picks`/`wrongLetters` |
| 6 | Telefono giocatore | `1a`–`1m`, più la riscrittura halftone di `wheel.js`, più `slotsTaken`/`slotsTotal` e `lockedOut` |
| 7 | Telefono admin | `1n`–`1x` — più l'esito positivo della validazione frase |

## Verifica

A ogni slice:

1. screenshot dall'app vera (Browser pane a 1920×1080 e 430×932) confrontati con
   `screenshots/<id>-*.png` del bundle;
2. `node --test --test-concurrency=1 <moduli toccati>` — in parallelo i test si piantano;
3. controllo che `#round-scene` resti sopra le nuove barre e che le animazioni di round partano
   e chiudano come prima (`__scenes.play('triplete')` dalla console del main display);
4. `prefers-reduced-motion` attivo: nessuna scossa, nessun glint, nessuna rotazione.

## Fuori scope

- Regole di gioco, punteggi, macchina a stati: invariati.
- Le 6 animazioni di round e lo zoom della ruota.
- Etichette e camera della ruota.
- Nuove librerie, bundler, framework.
- `docs/mockups/index.html` e la galleria esistente.
