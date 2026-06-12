# Rebranding Giramoe — stile "yutaabe" (halftone su nero)

Data: 2026-06-12 · Stato: approvato

## Obiettivo

Rebranding **solo grafico** dell'intero gioco nello stile di yutaabe.com: halftone
(punti) su nero, bianco + ciano elettrico, font Syne/Space Mono, scena three.js
come protagonista. La meccanica resta identica: stessi tabelloni (stesso numero di
caselle), stessa ruota (stessi 16 spicchi e stessi speciali), stesse fasi.

## Fuori scope

- Nessuna modifica a `server.js`, `game.js`, `board.js`, `triplete.js`,
  `giramoe.js`, `finalist.js`, `finalgame.js`, `envelopes.js`, `online.js`,
  protocollo socket, audio (`audio.js` e mp3 invariati).
- Nessun cambio alle regole, ai punteggi, al numero di celle/spicchi.
- Nessun three.js sui telefoni (player/admin): solo CSS.

## 1. Linguaggio visivo (tutte le superfici)

| Token | Valore | Uso |
|---|---|---|
| `--bg` | `#000000` | sfondo ovunque |
| `--ink` | `#f5f5f7` | testo, tessere lettera |
| `--accent` | `#30b8ff` | stati attivi, speciali ruota, hover, flash reveal |
| `--petrol` | `#0d2433` | celle del tabellone senza lettera |
| `--panel` | `#16161a` | pannelli HUD, banner, slot |

- Font: **Syne 800** (wordmark, titoli), **Space Mono 400/700** (etichette,
  numeri, corner label, lettere tabellone). File woff2 **self-hosted** in
  `public/fonts/` + `@font-face` in `style.css` — il gioco gira in LAN senza
  internet, vietati CDN.
- Stile pannelli "inchiostro su nero": riempimenti scuri pieni, raggi morbidi
  (riusare i `--r-*` esistenti), niente vetro/blur. Ciano solo per stato
  attivo/feedback. La `.grain` esistente resta, leggera.
- Feedback giusto/sbagliato (`fx-veil` e overlay): diventa mono —
  giusto = impulso ciano ai bordi, sbagliato = breve flash bianco invertito.
  Verde/rosso eliminati dalla palette. Criterio generale: mai più di un colore
  acceso a schermo oltre al ciano.

## 2. Pagina iniziale (`start-tap-screen`, PC)

- La scena three.js (`fx/homewheel.js`) sostituisce il fluido su questo schermo.
  Canvas fullscreen dietro la UI.
- Layout (HTML esistente riordinato): eyebrow "Giramoe Studio presenta" →
  **GIRAMOE** (Syne 800) centrato **sopra** la ruota → ruota grande al centro →
  tagline → bottone pill "Tocca per iniziare" in basso. Corner label invariati
  (Giramoe® / Est. 2026 / ● Live / Show dal vivo — IT) in Space Mono.
- Ruota home: 16 spicchi, **decorativa** — niente freccia, niente etichette.
  Disco con spessore reale (cilindro basso, smussi visibili), inclinata
  (~rotateX 12–16°), fluttuazione idle lenta.
- Effetti (stessa ricetta del gatto del sito, shader estratto dal riferimento):
  - **Halftone screen-space**: griglia celle da `gl_FragCoord` (~9 px), raggio
    del punto = illuminazione lambertiana shaped + pulsazione per-cella
    (hash della cella, due sinusoidi a frequenza diversa); colore punti bianco.
  - **Hover ciano**: influenza del cursore in raggio ~220 px — punti più grandi
    e tinti `vec3(0.188, 0.722, 1.0)`; hot tint blu sulla speculare.
  - **Wireframe baricentrico**: linee sottili sui triangoli con sweep verticale
    rumoroso (reveal/loop lento) e impulsi di luce che viaggiano sulle linee.
  - **Parallax**: la ruota ruota di qualche grado verso il cursore
    (lerp smorzato), come il gatto che segue il mouse.
- Spicchi distinguibili solo per densità/luminosità alternata dei punti e
  separatori wireframe (scelta "mono assoluto").
- Il cursore custom esistente (`fx/cursor.js`) resta, accento riallineato al
  ciano nuovo.

## 3. Main display in partita — palco three.js

Un modulo scena unico (`fx/stage3d.js` come orchestratore) renderizza sfondo,
tabellone e ruota nel canvas; l'HUD resta HTML sopra.

### 3.1 Tabellone 3D (`fx/board3d.js`)

- Griglia **identica** alla logica attuale (`board.js`, 4 righe, capienze
  14/16/16/14): le righe 0 e 3 renderizzano **solo 14 tessere** — le 4 celle
  d'angolo ("blocked") non esistono visivamente. Righe 0/3 centrate rispetto
  alle righe da 16.
- Tessere = box con spessore. Stati:
  - cella con lettera, nascosta → tessera **bianca** vuota
  - cella con lettera, rivelata → tessera bianca con lettera nera
    (texture canvas, Space Mono bold)
  - cella senza lettera (spazi e fuori frase) → tessera **blu petrolio** `#0d2433`
- Rivelazione: flip 3D della tessera (rotazione su asse X) con flash ciano
  sul bordo; suono esistente invariato. Ordine/timing pilotati dagli stessi
  eventi socket di oggi (`main.js` chiama il modulo invece di toccare il DOM
  di `#board-grid`).
- Vale per: `game-screen`, `triplete-screen`, `final-screen` (stesso modulo,
  board diverse).

### 3.2 Ruota di gioco (riscrittura `fx/wheel3d.js`)

- **Interfaccia invariata** (drop-in per `wheel.js`): `constructor(canvas, opts)`,
  `spinTo`, `setLabels`, `resize`, `onSpinEnd`, `spinning`. Fallback 2D esistente
  resta.
- Stessi 16 spicchi e stessa semantica speciali. Estetica: halftone mono come la
  home ma **con freccia** indicatore (bianca, punta ciano) e **etichette**
  (Space Mono, bianche; importi/parole come ora).
- Speciali in ciano: `bancarotta ✕`, `next →`, `raddoppia ×2`, `express »`
  (simbolo+parola ciano, fondo spicchio nero più fitto di punti).
- Spin: stesso comportamento/zoom attuale (wheel-zoom), camera del palco si
  avvicina alla ruota durante il giro.

### 3.3 Sfondo reattivo (`fx/dotfield.js`)

- Campo di punti halftone a tutto schermo dietro tabellone/ruota, sostituisce
  il fluido in partita. Reagisce agli eventi: giro ruota (onda dal centro),
  risposta giusta (impulso ciano), sbagliata (contrazione/buio breve).
- Camera del palco: micro-oscillazione idle (no cursore sulla TV).

### 3.4 HUD (HTML, restyle CSS)

- Banner categoria, barra giocatori (attivo = pannello ciano testo nero),
  overlay risultato, buzz banner, tag "IL TRIPLETE"/"Tabellone 1/3", timer
  finale: pannelli `#16161a`, Space Mono, niente glass/blur.

## 4. Altri schermi main display

- **Lobby**: layout a 3 colonne invariato; QR su pannello bianco pieno
  (scansionabilità), slot giocatori e fasi in Space Mono, sfondo dotfield calmo.
- **Title screen** (GIRAMOE / IL TRIPLETE / EXPRESS): Syne 800 gigante,
  reveal a punti: i punti del dotfield si addensano a formare il titolo,
  poi si dissolvono — stessa famiglia di effetti della home.
- **Finalista / Buste / fine partita**: stile ink; buste = pannelli scuri con
  bordo, apertura con flash ciano.

## 5. Telefoni (player.html / admin.html)

- Solo CSS su skin esistente (già dark): palette nuova (nero pieno, ciano
  `#30b8ff` al posto di `#0a84ff`), wordmark Syne, etichette Space Mono.
  Nessun canvas three.js.

## 6. Architettura file

```
public/fonts/                 ← syne-800.woff2, space-mono-400.woff2, space-mono-700.woff2
public/js/fx/homewheel.js     ← nuovo: scena home (ruota decorativa + parallax + hover)
public/js/fx/stage3d.js       ← nuovo: orchestratore palco partita (camera, sfondo, eventi)
public/js/fx/board3d.js       ← nuovo: tabellone 3D
public/js/fx/dotfield.js      ← nuovo: sfondo punti reattivo
public/js/fx/halftone.js      ← nuovo: materiale/shader condiviso (halftone + wireframe sweep)
public/js/fx/wheel3d.js       ← riscritto: ruota halftone, stessa interfaccia
public/js/fx/fluid.js         ← rimosso dall'uso (sostituito da homewheel/dotfield)
public/css/style.css          ← retheme completo (token, font, pannelli)
public/index.html             ← riordino intro, canvas palco
public/admin.html, play.html  ← retheme CSS
```

- `main.js`: cambia solo il livello presentazione (chiamate ai moduli fx invece
  del DOM per il tabellone; resto invariato).
- Shader condiviso in `halftone.js`: parametri uniformi `uTime`, `uMouse`,
  `uIsTouch`, `uSweepY`, `uResolution`, dimensione cella, intensità hover.

## 7. Performance e compatibilità

- `pixelRatio` cap a 2 (già così); halftone è un fragment shader economico,
  niente postprocessing (no bloom/composer).
- TV/PC senza WebGL: resta il fallback 2D della ruota; il tabellone 3D degrada
  a DOM attuale (il codice DOM di `main.js` resta come fallback dietro flag
  `webglOk`).
- Telefoni mai toccati da three.js.

## 8. Verifica

- I test esistenti in `tests/` devono passare invariati (logica intatta).
- Verifica manuale con `npm start`: intro → lobby → giro ruota → rivelazione
  lettere su tutte le fasi (tabelloni, triplete, express, giramoe, finale,
  buste), admin e player su telefono.
- Controllo leggibilità da distanza TV: etichette ruota e lettere tabellone.
