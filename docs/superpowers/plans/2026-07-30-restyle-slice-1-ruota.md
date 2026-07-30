# Restyle slice 1 — Ruota: mozzo nuovo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire il mozzo della ruota WebGL della TV — dalla semisfera halftone bianca al disco piatto scuro con nucleo ciano del handoff — senza toccare etichette, camera, spin, dolly e attrito della freccia.

**Architecture:** Il mozzo diventa **piatto** e viene disegnato dentro il canvas dell'anello etichette (`_buildLabelRing`), non come mesh: la semisfera attuale sporge in `z` e bucherebbe il piano delle scritte. Zero mesh nuove, zero rischio sull'animazione. Per verificare senza montare una partita si aggiunge una pagina di sviluppo `public/dev/wheel.html`, servita solo fuori produzione, che istanzia la ruota nelle tre varianti (base / express / giramoe).

**Tech Stack:** three.js (già vendorizzato in `public/vendor/three.module.js`), Canvas 2D per la texture dell'anello, Express per lo static, `node --test` per i test.

**Spec:** `docs/superpowers/specs/2026-07-30-restyle-giramoe-design.md`
**Riferimento visivo:** `design_handoff_tv_screens/GiramoeWheel.dc.html`, `design_handoff_tv_screens/screenshots/1c-primo-gioco.png`, `design_handoff_tv_screens/screenshots/1g-giramoe.png`

---

## Task 1: Pagina di sviluppo della ruota, con gate in produzione

Serve a vedere la ruota nelle tre varianti senza montare una partita. Va dietro a un gate perché
durante una festa vera non deve essere raggiungibile.

**Files:**
- Create: `public/dev/wheel.html`
- Modify: `server.js:17`

- [ ] **Step 1: Scrivere il gate in `server.js`**

Oggi la riga 17 è:

```js
app.use(express.static(require('path').join(__dirname, 'public')));
```

Va **preceduta** dal middleware che chiude `/dev/` e `/js/dev/` in produzione:

```js
// Le pagine e i fixture di sviluppo (public/dev, public/js/dev) servono solo a
// costruire e rivedere le schermate: fuori da sviluppo non sono raggiungibili.
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && /^\/(dev|js\/dev)\//.test(req.path)) {
    return res.status(404).end();
  }
  next();
});
app.use(express.static(require('path').join(__dirname, 'public')));
```

- [ ] **Step 2: Creare `public/dev/wheel.html`**

```html
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>Giramoe — dev: ruota</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: radial-gradient(85% 65% at 50% -8%, rgba(48,56,74,.32), transparent 62%),
                  linear-gradient(180deg, #0a0a0c, #000 64%);
      color: #f5f5f7; min-height: 100vh;
      font: 600 11px/1 ui-monospace, monospace; letter-spacing: 3px; text-transform: uppercase;
      display: flex; align-items: center; justify-content: center; gap: 64px; padding: 48px;
    }
    .cell { display: flex; flex-direction: column; align-items: center; gap: 22px; }
    .lab { color: rgba(245,245,247,.38); }
    .holder { position: relative; width: 556px; height: 556px; }
    .holder.sm { width: 196px; height: 196px; }
    canvas { display: block; }
  </style>
</head>
<body>
  <div class="cell">
    <div class="holder" id="h-base"><canvas id="c-base"></canvas></div>
    <span class="lab">base · 556px</span>
  </div>
  <div class="cell">
    <div class="holder" id="h-express"><canvas id="c-express"></canvas></div>
    <span class="lab">express · 556px</span>
  </div>
  <div class="cell">
    <div class="holder sm" id="h-giramoe"><canvas id="c-giramoe"></canvas></div>
    <span class="lab">giramoe · 196px</span>
  </div>

  <script type="module">
    import { Wheel3D } from '/js/fx/wheel3d.js';

    // Gli stessi 16 spicchi di game.js. Le varianti replicano quello che fa il
    // server: express sostituisce il "next" di indice 6, giramoe rimpiazza i 5
    // speciali con valori a punti.
    const BASE = [1000, 'bancarotta', 'raddoppia', 200, 400, 500, 'next', 400,
                  300, 700, 500, 'next', 400, 300, 500, 'next'];
    const GIRAMOE_VALUES = { 1: 900, 2: 600, 6: 250, 11: 800, 15: 350 };

    const express = BASE.map((s, i) => (s === 'next' && i === 6 ? 'express' : s));
    const giramoe = BASE.map((s, i) => (typeof s === 'number' ? s : GIRAMOE_VALUES[i]));

    for (const [id, labels] of [['base', BASE], ['express', express], ['giramoe', giramoe]]) {
      new Wheel3D(document.getElementById('c-' + id), {
        segments: 16, labels, showLabels: true
      });
    }
  </script>
</body>
</html>
```

- [ ] **Step 3: Avviare il server e aprire la pagina**

Avvia con la configurazione `giramoe` di `.claude/launch.json` (mai con Bash), poi apri
`http://localhost:3000/dev/wheel.html`.

Atteso: tre ruote visibili, ognuna coi suoi 16 spicchi colorati e le etichette. Il mozzo è ancora
la **semisfera bianca** di oggi — è il "prima" del confronto. Fai uno screenshot e tienilo.

- [ ] **Step 4: Verificare il gate**

```bash
NODE_ENV=production node -e "const {server}=require('./server');server.on('listening',async()=>{const p=server.address().port;const r=await fetch('http://127.0.0.1:'+p+'/dev/wheel.html');console.log('dev:',r.status);const q=await fetch('http://127.0.0.1:'+p+'/css/style.css');console.log('css:',q.status);process.exit(r.status===404&&q.status===200?0:1)})"
```

Atteso: `dev: 404`, `css: 200`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add server.js public/dev/wheel.html
git commit -m "chore(dev): pagina di sviluppo della ruota, chiusa in produzione"
```

---

## Task 2: Bloccare la convenzione degli angoli con un test

Il mockup `GiramoeWheel.dc.html` ha i colori a `from 0deg` e i separatori a `from -11.25deg`:
mezzo spicchio di sfasamento, la linea nera passa in mezzo alla banda di colore. `wheel3d.js` è
già corretto, ma la convenzione non è scritta da nessuna parte e non è protetta. Si estrae la
geometria in un modulo puro e si testa l'invariante.

**Files:**
- Create: `public/js/fx/wheelgeom.mjs`
- Create: `tests/wheelgeom.test.js`
- Modify: `public/js/fx/wheel3d.js`

- [ ] **Step 1: Scrivere il test che fallisce**

Crea `tests/wheelgeom.test.js`:

```js
// La ruota ha una sola convenzione angolare: lo spicchio 0 PARTE a ore 12 e i
// separatori stanno sui confini, non in mezzo alle bande. Nel mockup di design
// questa invariante era rotta (colori da 0deg, separatori da -11.25deg) e la
// linea nera cadeva sopra l'etichetta. Questo test la blocca.
const { test } = require('node:test');
const assert = require('node:assert');

const TAU = Math.PI * 2;
// distanza angolare minima fra due angoli, ignorando i giri interi
const near = (a, b) => Math.abs(((a - b + Math.PI) % TAU + TAU) % TAU - Math.PI);

// `await import` di un .mjs da un test CommonJS: stessa forma di
// tests/boardlayout.test.js
const geom = () => import('../public/js/fx/wheelgeom.mjs');

test('lo spicchio 0 parte a ore 12', async () => {
  const { boundaryAngle } = await geom();
  assert.ok(near(boundaryAngle(0), -Math.PI / 2) < 1e-9);
});

test('ogni etichetta sta esattamente in mezzo ai due confini del suo spicchio', async () => {
  const { boundaryAngle, midAngle, SEGMENTS } = await geom();
  for (let i = 0; i < SEGMENTS; i++) {
    const expected = boundaryAngle(i) + (TAU / SEGMENTS) / 2;
    assert.ok(near(midAngle(i), expected) < 1e-9, `spicchio ${i}`);
  }
});

test('nessun separatore cade su un centro di spicchio', async () => {
  const { boundaryAngle, midAngle, SEGMENTS } = await geom();
  for (let i = 0; i < SEGMENTS; i++) {
    for (let j = 0; j < SEGMENTS; j++) {
      assert.ok(near(boundaryAngle(i), midAngle(j)) > 1e-3,
        `separatore ${i} sopra l'etichetta ${j}`);
    }
  }
});

test('i confini sono 16, equispaziati di 22.5 gradi', async () => {
  const { boundaryAngle, SEGMENTS } = await geom();
  const step = TAU / SEGMENTS;
  assert.strictEqual(SEGMENTS, 16);
  for (let i = 0; i < SEGMENTS; i++) {
    assert.ok(near(boundaryAngle(i + 1) - boundaryAngle(i), step) < 1e-9);
  }
});
```

- [ ] **Step 2: Lanciare il test e verificare che fallisca**

```bash
node --test --test-concurrency=1 tests/wheelgeom.test.js
```

Atteso: FAIL, `Cannot find module '../public/js/fx/wheelgeom.mjs'`.

- [ ] **Step 3: Creare il modulo**

`public/js/fx/wheelgeom.mjs` — segue la convenzione di `boardlayout.mjs` (modulo puro,
condiviso fra client e test):

```js
// Geometria angolare della ruota, unica fonte di verità per wheel3d.js e i test.
// Convenzione: lo spicchio 0 PARTE a ore 12 (-π/2) e cresce in senso orario;
// i separatori e i perni stanno sui CONFINI, le etichette sui CENTRI.
export const SEGMENTS = 16;

const TAU = Math.PI * 2;

// Confine iniziale dello spicchio i (dove va disegnato separatore e perno).
export function boundaryAngle(i, segments = SEGMENTS) {
  return -Math.PI / 2 + (i * TAU) / segments;
}

// Centro dello spicchio i (dove va disegnata l'etichetta).
export function midAngle(i, segments = SEGMENTS) {
  return boundaryAngle(i, segments) + TAU / segments / 2;
}
```

- [ ] **Step 4: Lanciare il test e verificare che passi**

```bash
node --test --test-concurrency=1 tests/wheelgeom.test.js
```

Atteso: PASS, 4 test.

- [ ] **Step 5: Usare il modulo in `wheel3d.js`**

In testa al file, dopo l'import di `halftone.js` (riga 6), aggiungi:

```js
import { boundaryAngle, midAngle } from './wheelgeom.mjs';
```

Poi sostituisci i quattro punti dove l'angolo è calcolato a mano, **senza cambiarne il valore**:

- `_buildWheel`, riga 93: `const start = -Math.PI / 2 + i * seg;` → `const start = boundaryAngle(i, this.segments);`
- `_buildLabelRing`, separatori, riga 148: `const a = -Math.PI / 2 + i * seg;` → `const a = boundaryAngle(i, this.segments);`
- `_buildLabelRing`, etichette, riga 181: `const mid = -Math.PI / 2 + i * seg + seg / 2;` → `const mid = midAngle(i, this.segments);`
- `_buildLabelRing`, perni, riga 206: `const a = -Math.PI / 2 + i * seg;` → `const a = boundaryAngle(i, this.segments);`

- [ ] **Step 6: Verificare che la ruota non sia cambiata di un pixel**

Ricarica `http://localhost:3000/dev/wheel.html` e fai uno screenshot. Confrontalo con quello dello
Step 3 del Task 1: devono essere **identici** (il refactor non deve spostare nulla).

- [ ] **Step 7: Commit**

```bash
git add public/js/fx/wheelgeom.mjs tests/wheelgeom.test.js public/js/fx/wheel3d.js
git commit -m "refactor(ruota): geometria angolare in un modulo puro, con test dell'invariante"
```

---

## Task 3: Il mozzo nuovo

**Files:**
- Modify: `public/js/fx/wheel3d.js:120-127` (rimozione della semisfera)
- Modify: `public/js/fx/wheel3d.js:_buildLabelRing` (nuovo mozzo piatto)

- [ ] **Step 1: Rimuovere la semisfera halftone**

In `_buildWheel`, elimina queste righe (120-127):

```js
    // hub piccolo, stessi punti
    const hubGeo = addBarycentric(new THREE.SphereGeometry(0.5, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2));
    const hubMat = createHalftoneMaterial({ isTouch: true, dotScale: 0.8 });
    this._materials.push(hubMat);
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.x = Math.PI / 2;
    hub.position.z = DEPTH / 2;
    this.group.add(hub);
```

- [ ] **Step 2: Ricaricare e verificare che il centro sia vuoto**

Ricarica `http://localhost:3000/dev/wheel.html`.
Atteso: al centro delle ruote non c'è più la cupola bianca; si vedono convergere i 16 separatori.
È lo stato intermedio: non committare qui.

- [ ] **Step 3: Aggiungere il metodo `_drawHub`**

Nel corpo della classe `Wheel3D`, subito **dopo** `_buildLabelRing`, aggiungi:

```js
  // Mozzo piatto (handoff TV § Ruota), al posto della vecchia semisfera halftone
  // bianca che staccava troppo. Disegnato dentro il canvas dell'anello etichette
  // e non come mesh: la semisfera sporgeva in z e avrebbe bucato il piano delle
  // scritte. `ctx` è già traslato al centro del canvas.
  _drawHub(ctx, SIZE) {
    const hubR = SIZE * 0.10;    // disco: 20% del diametro della ruota
    const coreR = SIZE * 0.011;  // nucleo: 2.2% del diametro
    const oy = -hubR * 0.36;     // "circle at 50% 32%"

    // disco: radial-gradient(circle at 50% 32%, #26343f, #131b22 52%, #080d12)
    const disc = ctx.createRadialGradient(0, oy, hubR * 0.05, 0, oy, hubR * 1.3);
    disc.addColorStop(0, '#26343f');
    disc.addColorStop(0.52, '#131b22');
    disc.addColorStop(1, '#080d12');
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, hubR, 0, Math.PI * 2);
    ctx.fillStyle = disc; ctx.fill();
    ctx.clip();

    // punti halftone al 45%, sfumati verso il bordo
    const step = SIZE * 0.0126, dotR = SIZE * 0.0029;
    ctx.fillStyle = '#ffffff';
    for (let y = -hubR; y <= hubR; y += step) {
      for (let x = -hubR; x <= hubR; x += step) {
        const d = Math.hypot(x, y) / hubR;
        if (d > 1) continue;
        ctx.globalAlpha = 0.45 * Math.max(0, 1 - Math.pow(d / 0.96, 3));
        ctx.beginPath(); ctx.arc(x, y, dotR, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // ombre interne: inset 0 -8px 20px rgba(0,0,0,.9) + inset 0 4px 12px rgba(255,255,255,.07)
    const down = ctx.createLinearGradient(0, hubR * 0.1, 0, hubR);
    down.addColorStop(0, 'rgba(0,0,0,0)');
    down.addColorStop(1, 'rgba(0,0,0,0.9)');
    ctx.fillStyle = down; ctx.fillRect(-hubR, -hubR, hubR * 2, hubR * 2);
    const up = ctx.createLinearGradient(0, -hubR, 0, -hubR * 0.55);
    up.addColorStop(0, 'rgba(255,255,255,0.07)');
    up.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = up; ctx.fillRect(-hubR, -hubR, hubR * 2, hubR * 2);
    ctx.restore();

    // bordo ciano
    ctx.beginPath(); ctx.arc(0, 0, hubR, 0, Math.PI * 2);
    ctx.lineWidth = SIZE * 0.002;
    ctx.strokeStyle = 'rgba(48,184,255,0.45)';
    ctx.stroke();

    // nucleo ciano con alone
    const core = ctx.createRadialGradient(0, -coreR * 0.32, 0, 0, 0, coreR);
    core.addColorStop(0, '#d8f3ff');
    core.addColorStop(0.7, ACCENT_CSS);
    core.addColorStop(1, ACCENT_CSS);
    ctx.save();
    ctx.shadowColor = 'rgba(48,184,255,0.55)';
    ctx.shadowBlur = SIZE * 0.02;
    ctx.beginPath(); ctx.arc(0, 0, coreR, 0, Math.PI * 2);
    ctx.fillStyle = core; ctx.fill();
    ctx.fill(); // secondo passaggio: rinforza l'alone
    ctx.restore();
  }
```

- [ ] **Step 4: Chiamarlo in fondo a `_buildLabelRing`**

In `_buildLabelRing`, subito **dopo** il ciclo dei perni e **prima** di
`const tex = new THREE.CanvasTexture(cnv);`, aggiungi:

```js
    ctx.shadowBlur = 0;
    this._drawHub(ctx, SIZE);
```

Va per ultimo così il mozzo copre il punto dove convergono i 16 separatori.

- [ ] **Step 5: Ricaricare e confrontare col riferimento**

Ricarica `http://localhost:3000/dev/wheel.html`, fai uno screenshot e confrontalo con
`design_handoff_tv_screens/GiramoeWheel.dc.html` aperto a fianco (`?size=556`) e con il centro
della ruota in `design_handoff_tv_screens/screenshots/1g-giramoe.png`.

Atteso: disco scuro blu-grigio, più chiaro in alto, bordo ciano sottile, punti halftone appena
percepibili che si spengono verso il bordo, nucleo ciano piccolo con alone. Nessuna cupola bianca.

Se le proporzioni non tornano, i tre numeri da tarare sono `hubR` (0.10), `coreR` (0.011) e
l'`opacity` dei punti (0.45). Non toccare altro.

- [ ] **Step 6: Verificare che lo spin sia intatto**

La pagina di dev non espone le istanze, quindi per provare lo spin aggiungi **in coda** allo
script del modulo in `public/dev/wheel.html`:

```js
    // seam di sviluppo: fa girare tutte e tre le ruote dalla console
    window.__spin = (i = 6) => wheels.forEach(w => w.spinTo(i, 4, 3000));
```

e raccogli le istanze nel ciclo dello Step 2 del Task 1, cambiando

```js
    for (const [id, labels] of [['base', BASE], ['express', express], ['giramoe', giramoe]]) {
      new Wheel3D(document.getElementById('c-' + id), {
        segments: 16, labels, showLabels: true
      });
    }
```

in

```js
    const wheels = [];
    for (const [id, labels] of [['base', BASE], ['express', express], ['giramoe', giramoe]]) {
      wheels.push(new Wheel3D(document.getElementById('c-' + id), {
        segments: 16, labels, showLabels: true
      }));
    }
```

Poi dalla console: `__spin(6)`.

Atteso: le ruote girano, decelerano con l'ease-out e si fermano con lo spicchio 6 sotto la freccia;
la camera fa il dolly (avvicinamento) a metà giro. Il mozzo resta centrato e fermo.

- [ ] **Step 7: Verificare l'attrito della freccia e le animazioni di round nel gioco vero**

La pagina di dev non ha la freccia DOM né le scene. Sul main display vero
(`http://localhost:3000`, tocca per iniziare): la freccia in alto scatta sui perni mentre la ruota
gira, e dalla console `__scenes.play('triplete')` parte e `__scenes.skip()` la chiude.

- [ ] **Step 8: Lanciare tutti i test di logica**

```bash
node --test --test-concurrency=1 tests/board.test.js tests/boardlayout.test.js tests/game.test.js tests/triplete.test.js tests/giramoe.test.js tests/finalist.test.js tests/finalgame.test.js tests/envelopes.test.js tests/lobby.test.js tests/wheelgeom.test.js
```

Atteso: tutti PASS. La ruota non tocca la logica, quindi qualunque fallimento qui è un regresso da
indagare prima di committare.

- [ ] **Step 9: Commit**

```bash
git add public/js/fx/wheel3d.js
git commit -m "feat(ruota): mozzo piatto scuro col nucleo ciano al posto della semisfera bianca"
```

---

## Task 4: Consegna della slice

- [ ] **Step 1: Screenshot di confronto**

Produci due immagini affiancate: la ruota di dev a 556px (dopo) e
`design_handoff_tv_screens/screenshots/1g-giramoe.png` ritagliata sul centro (riferimento).
Inviale con `SendUserFile`.

- [ ] **Step 2: Riepilogo al committente**

Elenca: cosa è cambiato (solo il mozzo), cosa **non** è cambiato (etichette, camera, spin, dolly,
freccia, animazioni di round), e i tre numeri tarabili se vuole ritoccare le proporzioni.

- [ ] **Step 3: Aspettare l'ok prima della slice 2**

Non iniziare la slice 2 (fondamenta TV + fase 01) prima della conferma.

---

## Fuori scope in questa slice

- `public/js/wheel.js` — è la **vecchia ruota glass** (bezel bianco, rivetti, cupola di vetro,
  express col treno). La usa il telefono con `showLabels:false` e fa da fallback alla TV. Non va
  ritoccata col mozzo nuovo: va **riscritta halftone**. Va nella slice 6, dove si costruiscono le
  schermate telefono e si può giudicare a 196px nel contesto della `1c`.
- Etichette capovolte nella metà sinistra: **volute**, restano.
- Camera: resta a `(0, -1.5, 16.6)`, lo scorcio 3D è voluto.
- Harness `?mock=`: slice 2.
