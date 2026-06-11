# Rebrand "tvOS Dark Pro" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand totale del front-end Giramoe in stile tvOS Dark Pro (spec `docs/superpowers/specs/2026-06-11-rebrand-tvos-dark-design.md`, mockup approvato `docs/mockups/index.html`) con ruota 3D Three.js, cursore custom, fluido al puntatore, title animation condivisa; logica server invariata.

**Architecture:** Main display (index.html) carica Three.js come ES module vendorizzato; i moduli FX (`wheel3d`, `fluid`, `title-fx`, `cursor`) vivono in `public/js/fx/` ed espongono classi importate da `main.js` (convertito a `type="module"`). Telefoni e admin restano CSS-only. `wheel.js` 2D resta per i telefoni e come fallback senza WebGL. Il CSS è riscritto da zero portando i token dal mockup approvato; le classi esistenti usate dai JS restano invariate.

**Tech Stack:** Three.js (vendored ESM), CSS vanilla, socket.io (invariato), node --test (invariato).

**Fonte di verità visiva:** `docs/mockups/index.html` — token, grana, hairline, micro-label, cursore, magnetismo: portare quei valori, non reinventarli.

---

### Task 1: Vendor Three.js

**Files:** Create `public/vendor/three.module.js`; Modify `package.json` (dep three)

- [ ] `npm install three`
- [ ] `cp node_modules/three/build/three.module.js public/vendor/`
- [ ] Verifica: `ls -la public/vendor/` (~1.2MB), `git add -f` se serve (no .gitignore match)
- [ ] Commit `chore: vendor three.js (ESM, offline)`

### Task 2: CSS rebrand core + intro senza video

**Files:** Rewrite `public/css/style.css`; Modify `public/index.html`, `public/js/main.js`

- [ ] Riscrivi `style.css` con i token del mockup: bg `#0c0c0e→#121214`, ink `#f5f5f7`, accent `#0a84ff`, glass scuro `rgba(24,24,27,.55)+blur(24px)`, hairline, grana SVG (classe `.grain`), micro-label (`.corner-label`, `.eyebrow`), wordmark `.wm` con glint (animare SOLO l'elemento col background-clip, mai i figli), `.btn-ghost`, celle board (blocked/hidden-letter/revealed bianche+flip), `.pcard` con active hairline+dot blu, fasi numerate, fx-correct/fx-wrong sobri (inset 1px + velo), shake 5px, `prefers-reduced-motion` che spegne glint/animazioni decorative. Coprire TUTTE le classi esistenti usate da main.js/player.js/admin.js (screen, mobile-container, glass-button/input/panel, keyboard/key/vowel, score-pill, turn-message, buzz-button/pill, player-nick, matchend-title, finalist-name, envelopes, disconnect-overlay, wheel-container/indicator, category-banner, board-grid/cell, players-bar/player-name/pn-*, triplete-*, final-*, standing/admin-*).
- [ ] `index.html`: rimuovi `#video-screen` e `#start-screen`; intro = `#start-tap-screen` ridisegnata (eyebrow + `.wm` GIRAMOE + hairline + tagline + btn-ghost + 4 corner-label + grain); lobby a 3 colonne editoriali (slot P1-P3 | wm+QR+hint | stat partita) + riga fasi `01…06`; aggiungi `<div class="grain">` e contenitore `#fluid-layer` (canvas fixed z-index 0); script: `main.js` diventa `type="module"`.
- [ ] `main.js`: elimina riferimenti video (`intro-video`, listener ended/error, fase 'video' → 'lobby' diretta); `startMainDisplay()` → `Sfx.unlock(); TitleFX disponibile? riproduci 'GIRAMOE' poi applyPhaseScreen() : applyPhaseScreen()` (TitleFX arriva in Task 5: per ora vai diretto a lobby).
- [ ] Verifica preview (launch config `giramoe`, `node server.js`, porta 3000): intro→tap→lobby, slot che si riempiono non verificabili senza player: screenshot statici ok; `npm test` passa.
- [ ] Commit `feat: rebrand tvOS dark — tokens, intro senza video, lobby editoriale`

### Task 3: Cursore custom su tutto il main display

**Files:** Create `public/js/fx/cursor.js`; Modify `public/index.html`, `public/css/style.css`

- [ ] `cursor.js` (ES module, export `initCursor()`): porta dot+ring dal mockup; attivo solo `matchMedia('(pointer:fine)')`; `document.body` cursor:none via classe `.has-custom-cursor`; ring lerp 0.14 in rAF; su elementi `[data-cursor]` o `button` → ring `.expanded` con label dal `data-cursor-label` (default TAP); magnetismo per `.btn-ghost` (raggio 130, pull 0.42); parallax `#intro-stage` come nel mockup; disattivo con `prefers-reduced-motion` (solo parallax off, cursore resta).
- [ ] Collega in `main.js`: `import { initCursor } from './fx/cursor.js'; initCursor();`
- [ ] Verifica preview con eval (dispatch mousemove, check transform/expanded) + screenshot.
- [ ] Commit `feat: cursore custom con anello magnetico su main display`

### Task 4: Ruota 3D Three.js

**Files:** Create `public/js/fx/wheel3d.js`; Modify `public/js/main.js`, `public/index.html` (il canvas resta)

Contratto (identico a `Wheel` 2D, drop-in per main.js):
```js
export class Wheel3D {
  constructor(canvas, { segments = 16, labels = [], showLabels = true, onSpinEnd = null })
  setLabels(labels)   // ridisegna texture etichette
  resize()
  spinTo(segmentIndex, spins = 6, duration = 6000)  // stessa matematica del 2D:
  // targetMod = (360 - i*segDeg - segDeg/2) mod 360, delta dal mod corrente, ease-out cubico
  get spinning()
  onSpinEnd  // callback assegnabile
}
```
- [ ] Implementa: scena con disco `CylinderGeometry(r, r, h≈r*0.07, 64)` ruotato a faccia in camera; segmenti = 16 mesh a spicchio (`Shape`+`ExtrudeGeometry` con bevel) materiale `MeshPhysicalMaterial` (clearcoat 1, roughness .35) colori Apple del mockup; ghiera = `TorusGeometry` materiale metallico (metalness .9, roughness .25); hub = `SphereGeometry` schiacciata clearcoat; etichette = `CanvasTexture` su anello piano sopra i segmenti (stesso stile 2D: numeri bianchi bold, speciali con simbolo+parola: bancarotta ✕, next →, raddoppia ×2, express ⚡/treno testo); luci: key direzionale + 2 fill colorati freddi + ambient; `renderer.toneMapping = ACESFilmicToneMapping`; rotazione applicata al gruppo; rAF solo durante spin/hover-idle leggero (idle: micro-oscillazione spenta con reduced-motion).
- [ ] Zoom spin: camera dolly-in durante `spinTo` (mantieni anche la classe CSS `wheel-zoom` esistente per il fade del resto).
- [ ] `main.js`: `initMainWheel` prova `new Wheel3D(...)` dentro try/catch + check `WebGLRenderingContext`; fallback `new Wheel(...)` 2D (wheel.js resta caricato come script classico o importato: lascia `<script src="/js/wheel.js">` in index.html).
- [ ] Verifica preview: lobby→(admin start? non serve) — testa la ruota in isolamento con eval: `window.__wheel.spinTo(3, 2, 1500)` esponendo `window.__wheel` in dev; screenshot prima/durante/dopo; console pulita.
- [ ] Commit `feat: ruota 3D three.js con fallback 2D`

### Task 5: Title animation condivisa (GIRAMOE / IL TRIPLETE / EXPRESS)

**Files:** Create `public/js/fx/title-fx.js`; Modify `public/js/main.js`, `public/index.html`, `public/css/style.css`

- [ ] `title-fx.js`: `export function playTitle(word, { duration = 2800 } = {})` → mostra `#title-screen` (nuovo, sostituisce `#triplete-title-screen`): wordmark `.wm` col glint + rise (riusa classi CSS), eyebrow contestuale ("BONUS ROUND" per triplete/express, "GIRAMOE STUDIO PRESENTA" per intro), hairline; backdrop: burst di ripple sul FluidFX se attivo (chiama `fluid.burst()` se presente — hook opzionale, nessuna dipendenza dura); risolve Promise a fine animazione.
- [ ] `index.html`: sostituisci il markup di `#triplete-title-screen` (fan/plate) con `#title-screen` minimale (eyebrow + wm + hairline). Rimuovi dal CSS `.triplete-fan*`, `.triplete-plate`, `.tl`, `tPop/tFanIn/tPlateIn`.
- [ ] `main.js`: `playTitleAnimation(word)` → `playTitle(word)`; intro tap: `await playTitle('GIRAMOE')` poi `applyPhaseScreen()`; gli handler triplete/express/giramoe usano la stessa funzione (timeout 2800 esistenti restano).
- [ ] Verifica preview: eval `playTitle('IL TRIPLETE')` e screenshot; tap intro completo.
- [ ] Commit `feat: title animation condivisa (intro/triplete/express/giramoe)`

### Task 6: Liquid glass — fluido al puntatore

**Files:** Create `public/js/fx/fluid.js`; Modify `public/js/main.js`, `public/index.html`

- [ ] `fluid.js`: `export class FluidFX { constructor(canvas); pointer(x, y); burst(); setEnabled(on); }` — render target ping-pong (half-res) con shader "trail": inject gaussian al puntatore con velocità, decay 0.96/frame + leggera diffusione (blur 4-tap); pass finale: distorce UV di un gradiente di base scuro (i toni del bg) + highlight speculare freddo proporzionale al campo → effetto liquido sotto la UI. Uniforms: `uTrail`, `uPointer`, `uVel`, `uTime`. Canvas `#fluid-canvas` fixed inset 0 z-index 0, `pointer-events:none`; UI sopra (z-index ≥1). Spento con `prefers-reduced-motion` o WebGL assente (canvas display:none). Pausa rAF quando tab nascosta e dopo 3s senza movimento (riparte al mousemove).
- [ ] `main.js`: init dopo cursor; condividi pointer handler col cursore (cursor.js emette callback `onMove(x,y)` oppure fluid ascolta mousemove suo — semplice: suo listener).
- [ ] Verifica: eval mousemove sintetici a serpentina + screenshot (scia visibile), poi fermo 4s → rAF in pausa (check `window.__fluid.running === false`).
- [ ] Commit `feat: liquid glass fluido al puntatore (three.js)`

### Task 7: Schermate di gioco main display

**Files:** Modify `public/css/style.css`, `public/index.html`, `public/js/main.js` (solo classi/markup, zero logica eventi)

- [ ] Game/express/giramoe/tiebreak: categoria micro-uppercase, board 4×16 con celle mockup, players-bar pcard (active = hairline + dot blu), result-overlay restyle (testo grande bianco, velo scuro blur), wheel-zoom invariato.
- [ ] Triplete board: `triplete-tag` micro-label, `buzz-banner` glass scuro con flash sobrio, celle `flash` (lampeggio board 3) con stile coerente (bianco al 70%).
- [ ] Finalist: `finalist-name` enorme bianco con glint; Final: timer monospaced tabulare con stato `.low` rosso pulsante; Envelopes: buste glass scuro, `current` hairline bianca, `open` rivela contenuto, `abandoned` opacità .35.
- [ ] Rimuovi emoji 🔔 da `showBuzz` (main.js): sostituisci con `<span class="buzz-ico">` SVG campana inline (no emoji come icone).
- [ ] Verifica preview di ogni schermata via eval (showScreen + dati finti) + screenshot; `npm test`.
- [ ] Commit `feat: restyle schermate gioco main display`

### Task 8: Telefono (play.html) — solo CSS

**Files:** Modify `public/play.html`, `public/css/style.css` (sezione phone)

- [ ] Sostituisci `<img logo>` con `.wm` testuale piccola; restyle: join-form (input hairline scuro, btn-ghost), keyboard scura (vocali bordo oro tenue `#d7a64a`? NO — accento unico: vocali bordo bianco .35 + peso 700), buzz-button/buzz-pill ridisegnati (cerchio scuro hairline che si riempie rosso `#ff453a` su attivo), score-pill scure, turn-message stati (your-turn verde), envelopes player. Niente cursore/fluid/three.
- [ ] Verifica preview con viewport mobile (375×812) su `/play.html` + screenshot.
- [ ] Commit `feat: restyle telefono giocatore`

### Task 9: Admin — token dark

**Files:** Modify `public/admin.html`, `public/css/style.css` (sezione admin)

- [ ] Solo skin: pannelli scuri, hairline, bottoni ghost, stessi token. Nessun cambio funzionale/markup oltre alle classi.
- [ ] Verifica preview `/admin.html` + screenshot; `npm test`.
- [ ] Commit `feat: restyle admin dark`

### Task 10: Pulizia + verifica finale

**Files:** Delete `public/assets/trailer.mp4`; Modify `README.md` (se cita il video)

- [ ] Rimuovi `trailer.mp4` (≈2.4MB) — non più referenziato; `grep -r trailer` deve dare zero hit.
- [ ] `npm test` completo verde.
- [ ] E2E visivo: flusso intro→title→lobby; game con spin 3D; triplete title+board; final; envelopes; phone; admin. Screenshot di prova per il riepilogo.
- [ ] Commit `chore: rimuovi video intro; verifica finale rebrand`

## Self-review

- Spec coverage: intro senza video (T2+T5), ruota 3D+fallback (T4), fluido (T6), cursore ovunque (T3), title condivisa (T5), board invariato (T7 solo stile), phone CSS-only (T8), admin (T9), token/grana/hairline (T2), reduced-motion (T2/T3/T6), vendor offline (T1), test verdi (ogni task). ✔
- Tipi/contratti coerenti: `Wheel3D` rispecchia `Wheel`; `playTitle` Promise; `FluidFX.pointer/burst`. ✔
- Niente placeholder: i valori visivi puntano al mockup committato (fonte concreta nel repo). ✔
