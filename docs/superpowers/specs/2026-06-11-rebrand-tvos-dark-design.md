# Giramoe — Rebrand "tvOS Dark Pro" (design approvato)

Data: 2026-06-11 · Mockup approvato: `docs/mockups/index.html`

## Obiettivo

Rebranding totale del front-end (main display, telefoni, admin) in stile Apple/tvOS scuro
professionale, con elementi 3D Three.js dosati. Logica di gioco server **invariata**.

## Brand tokens

- Sfondo: `#0c0c0e` → `#121214` (gradiente), highlight radiale freddo in alto
- Testo: `#f5f5f7`; soft `rgba(235,235,245,.55)`; faint `rgba(235,235,245,.38)`
- Accento: blu `#0a84ff` (unico); verde `#30d158` (ok/connesso); rosso `#ff453a` (errore)
- Font: stack di sistema SF Pro (`-apple-system`); pesi 300/500/600/700
- Glass scuro: `rgba(24,24,27,.55)` + blur 24px + border `rgba(255,255,255,.08)`
- Hairline: `rgba(255,255,255,.10-.14)`; micro-label uppercase tracking 2.5-5px
- Grana pellicola SVG su ogni schermo (opacity ~.5 del layer 5%)
- Wordmark: bianco, glint metallico animato (background-clip: text — MAI transform/filter sui figli)

## Flusso intro (main display)

1. Tap screen = intro editoriale (wordmark GIRAMOE + glint, eyebrow, hairline, tagline,
   bottone ghost magnetico, corner label, ● LIVE)
2. Al tap: **title animation "GIRAMOE"** (la stessa di Triplete/Express, migliorata) → lobby
3. Video `trailer.mp4` e start-screen **rimossi** (anche l'asset e gli screen dal DOM)

## Componenti Three.js (solo main display)

1. **Ruota 3D** (`wheel3d.js`): sostituisce il canvas 2D mantenendo la stessa interfaccia
   (`new Wheel(canvas, opts)`, `spinTo(segment, spins, duration)`, `setLabels`, `resize`,
   `onSpinEnd`). Disco con spessore + bevel, 16 segmenti colori Apple, ghiera alluminio,
   hub a cupola, luci da studio, riflessi; zoom camera durante lo spin.
   Fallback: WebGL assente → wheel 2D attuale (file conservato).
2. **Liquid glass / fluido** (`fluid.js`): layer fullscreen dietro la UI; trail fluido che
   segue il cursore con decadimento + distorsione/rifrazione (effetto Noomo). Attivo su
   tutte le schermate del main display; `pointer-events: none`; rispetta
   `prefers-reduced-motion` (disattivato).
3. **Title animation** (`title-fx.js`): condivisa per GIRAMOE (intro), IL TRIPLETE,
   EXPRESS, GIRAMOE (finale). Wordmark DOM con glint + entrata rise/blur; backdrop
   Three.js (onda fluida/particelle soft). Sostituisce la fan CSS arcobaleno.
- Three.js vendorizzato in `public/vendor/` (no CDN: deve funzionare offline/tunnel).

## Cursore custom (tutte le schermate main display)

- Punto 6px istantaneo + anello 38px con lerp, `mix-blend-difference`
- Sugli elementi cliccabili: anello espanso 72px + label ("TAP")
- Bottone intro magnetico (raggio ~130px, pull 0.42)
- Parallax leggero del titolo intro al mousemove
- Telefoni (play.html): nessun cursore (touch); admin: cursore standard

## Schermate (main display, da mockup)

- **Lobby**: colonne editoriali con hairline (GIOCATORI con stato/P1-P3 | wordmark+QR | PARTITA stats),
  fasi numerate `01 TABELLONI … 06 BUSTE` in basso, corrente bianca con numero blu
- **Game/Express/Giramoe/Tiebreak**: ruota 3D sin., categoria micro-uppercase glass,
  board **4×16 invariato** (solo restyle celle: blocked scuro, lettera nascosta più chiara,
  rivelata bianca con lettera nera + flip), card giocatori glass con turno attivo
  (hairline bianca + dot blu pulsante)
- **Triplete**: stessi pattern; tag "IL TRIPLETE · n/3" in micro-label
- **Finalist/Final/Envelopes**: stessi token; timer finale con stato `low` rosso;
  buste restyle glass scuro
- **Feedback**: giusta = inset border 1px verde + velo (fxFade); errata = rosso + shake 5px;
  lettera rivelata = flip 3D; buzz = banner glass + flash sobrio. Suoni invariati.

## Telefoni (play.html) — solo CSS

Stessi token (dark, hairline, glass scuro); tastiera scura con vocali evidenziate sobrie;
buzzer ridisegnato coerente; feedback verde/rosso. Niente Three.js né cursore.

## Admin (admin.html)

Solo aggiornamento token (dark), zero cambi funzionali.

## Vincoli

- Regole/board/eventi socket invariati; nessun cambio a server.js e moduli di gioco
- Test esistenti (`npm test`) devono passare
- `prefers-reduced-motion`: disattiva fluido, glint, parallax; mantiene leggibilità
- Performance: 60fps target sul main display; fluido e bloom degradabili

## Test/verifica

- `npm test` (logica server intatta)
- Verifica visiva con preview: intro→tap→title→lobby→game, spin ruota, reveal lettere,
  feedback giusta/errata, triplete title, telefono, admin
