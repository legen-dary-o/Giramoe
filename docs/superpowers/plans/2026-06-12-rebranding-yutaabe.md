# Rebranding Giramoe stile yutaabe — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebranding solo grafico del gioco in stile yutaabe.com (halftone bianco/ciano su nero, Syne + Space Mono, scene three.js), logica di gioco intoccata.

**Architecture:** Tre superfici WebGL indipendenti sul main display — `HomeWheel` (ruota decorativa intro con parallax/hover), `Wheel3D` riscritta (ruota di gioco, stessa interfaccia drop-in), `Stage3D` (canvas fullscreen che renderizza sfondo a punti reattivo, tabellone 3D e buste 3D). Il DOM attuale di tabellone/buste resta come fallback (nascosto via CSS quando WebGL c'è, visibile altrimenti) e continua a essere aggiornato da `main.js`. Telefoni: solo CSS.

**Tech Stack:** three.js già vendorizzato (`public/vendor/three.module.js`), ShaderMaterial custom (halftone screen-space + wireframe baricentrico), CanvasTexture per lettere/etichette, font woff2 self-hosted. Test: `node --test` (CJS, già in `tests/`).

**Spec:** `docs/superpowers/specs/2026-06-12-rebranding-yutaabe-design.md`

---

## Mappa file

| File | Azione | Responsabilità |
|---|---|---|
| `public/fonts/*.woff2` | crea | Syne 800, Space Mono 400/700 self-hosted |
| `public/css/style.css` | modifica | token, font-face, retheme tutte le superfici |
| `public/js/fx/halftone.js` | crea | ShaderMaterial halftone+wireframe condiviso, helper baricentrico |
| `public/js/fx/boardlayout.mjs` | crea | mapping puro griglia logica → tessere (testabile in node) |
| `public/js/fx/homewheel.js` | crea | scena intro: ruota decorativa, parallax, hover |
| `public/js/fx/wheel3d.js` | riscrive | ruota di gioco halftone, stessa API |
| `public/js/fx/stage3d.js` | crea | orchestratore canvas fullscreen partita |
| `public/js/fx/dotfield.js` | crea | sfondo a punti reattivo |
| `public/js/fx/board3d.js` | crea | tabellone 3D (tessere, flip, flash) |
| `public/js/fx/envelopes3d.js` | crea | buste 3D fluttuanti |
| `public/js/fx/titledots.js` | crea | punti che si addensano a formare i titoli |
| `public/js/fx/fluid.js` | elimina | sostituito da homewheel + dotfield |
| `public/index.html` | modifica | canvas nuovi, riordino intro |
| `public/js/main.js` | modifica | wiring fx (solo livello presentazione) |
| `public/play.html`, `public/admin.html` | modifica | ritocchi markup minimi se servono |
| `tests/boardlayout.test.js` | crea | test del mapping tessere |

**Non toccare mai:** `server.js`, `game.js`, `board.js`, `triplete.js`, `giramoe.js`, `finalist.js`, `finalgame.js`, `envelopes.js`, `online.js`, `public/js/audio.js`, protocollo socket, file in `tests/` esistenti.

**Verifica visiva:** il gioco si avvia con `npm start` (stampa `Main screen: http://<ip>:3000`). Per pilotare le fasi serve l'admin (`/admin.html`). Hook console già esistenti: `window.__wheel`. Ne aggiungiamo altri (`window.__stage`, `window.__home`) per verifiche manuali.

---

### Task 1: Font self-hosted + token e retheme CSS base

**Files:**
- Create: `public/fonts/syne-800.woff2`, `public/fonts/space-mono-400.woff2`, `public/fonts/space-mono-700.woff2`
- Modify: `public/css/style.css` (sezioni TOKENS, RESET & BASE, PRIMITIVE)

- [ ] **Step 1: Scarica i font**

```bash
cd /Users/mario_dangelo/Documents/Giramoe
mkdir -p public/fonts
curl -fsSL -o public/fonts/syne-800.woff2 "https://cdn.jsdelivr.net/fontsource/fonts/syne@latest/latin-800-normal.woff2"
curl -fsSL -o public/fonts/space-mono-400.woff2 "https://cdn.jsdelivr.net/fontsource/fonts/space-mono@latest/latin-400-normal.woff2"
curl -fsSL -o public/fonts/space-mono-700.woff2 "https://cdn.jsdelivr.net/fontsource/fonts/space-mono@latest/latin-700-normal.woff2"
ls -la public/fonts
```

Expected: 3 file woff2, ognuno > 5 KB. Se jsDelivr non risponde, equivalenti su `https://cdn.jsdelivr.net/npm/@fontsource/syne@5/files/syne-latin-800-normal.woff2` (stesso pattern per space-mono).

- [ ] **Step 2: @font-face + nuovi token in style.css**

In `public/css/style.css`, PRIMA del blocco `/* === TOKENS === */` aggiungi:

```css
/* === FONT (self-hosted: il gioco gira in LAN senza internet) === */
@font-face {
  font-family: 'Syne';
  src: url('/fonts/syne-800.woff2') format('woff2');
  font-weight: 800;
  font-display: swap;
}
@font-face {
  font-family: 'Space Mono';
  src: url('/fonts/space-mono-400.woff2') format('woff2');
  font-weight: 400;
  font-display: swap;
}
@font-face {
  font-family: 'Space Mono';
  src: url('/fonts/space-mono-700.woff2') format('woff2');
  font-weight: 700;
  font-display: swap;
}
```

Poi sostituisci i valori dei token esistenti (stessi nomi, così il resto del CSS continua a funzionare) e aggiungine due nuovi:

```css
:root {
  --bg: #000000;
  --bg-2: #0a0a0c;
  --ink: #f5f5f7;
  --ink-soft: rgba(245, 245, 247, 0.55);
  --ink-faint: rgba(245, 245, 247, 0.38);
  --accent: #30b8ff;
  --green: #30b8ff;   /* feedback "giusto" ora è ciano (palette mono) */
  --red: #f5f5f7;     /* feedback "sbagliato" ora è flash bianco */
  --petrol: #0d2433;  /* celle tabellone senza lettera */
  --panel: #16161a;   /* pannelli HUD pieni, stile ink */
  --glass: #16161a;                          /* niente più vetro: pannello pieno */
  --glass-border: 1px solid rgba(255, 255, 255, 0.10);
  --glass-edge: none;
  --hairline: rgba(255, 255, 255, 0.14);
  --font-display: 'Syne', sans-serif;
  --font-mono: 'Space Mono', monospace;
  /* invariati: --r-sm, --r-md, --r-lg, --shadow-md, --shadow-lg, --ease-out, --ease-spring */
}
```

- [ ] **Step 3: Applica i font alle famiglie tipografiche**

Sempre in `style.css`:
- nel selettore `body` (sezione RESET & BASE) imposta `font-family: var(--font-mono);`
- ai selettori del wordmark e dei titoli (`.wm`, `.matchend-title`, `.finalist-name`, `#triplete-title`) imposta `font-family: var(--font-display); font-weight: 800;`
- a `.eyebrow`, `.corner-label`, `.tagline`, `.col-title`, `.slot-idx`, `.phases`, `.category-banner`, `.triplete-tag`, `.final-timer` imposta `font-family: var(--font-mono);` (se un selettore non dichiara già font-family, basta che erediti dal body — controlla e rimuovi eventuali `-apple-system` espliciti in queste regole).
- cerca OGNI occorrenza di `backdrop-filter` e `-webkit-backdrop-filter` nel file e rimuovila (il vetro sparisce, i pannelli sono pieni: `--glass` ora è un colore solido).

- [ ] **Step 4: Verifica visiva**

```bash
npm start
```

Apri `http://localhost:3000`: intro nera pura, GIRAMOE in Syne, etichette in Space Mono (lettere monospaziate ben visibili), bottone senza blur. Nessun errore in console. Il fluido c'è ancora (lo sostituiamo nel Task 4). Ctrl-C per fermare.

- [ ] **Step 5: Commit**

```bash
git add public/fonts public/css/style.css
git commit -m "feat: font Syne/Space Mono self-hosted e token palette mono"
```

---

### Task 2: boardlayout.mjs — mapping griglia → tessere (TDD)

La griglia logica di `board.js` è 4×16 con celle `edge` (le 4 strutturali agli angoli delle righe 0 e 3), `blocked` (interne senza lettera) e `letter`. Il 3D renderizza solo 14 tessere nelle righe 0/3: le `edge` spariscono.

**Files:**
- Create: `public/js/fx/boardlayout.mjs`
- Test: `tests/boardlayout.test.js`

- [ ] **Step 1: Scrivi il test che fallisce**

```js
// tests/boardlayout.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const board = require('../board');

test('gridToTiles esclude le celle edge (angoli) e mappa letter/blocked', async () => {
  const { gridToTiles } = await import('../public/js/fx/boardlayout.mjs');
  const res = board.createBoard('TEST', 'CIAO MONDO');
  assert.strictEqual(res.ok, true);
  const tiles = gridToTiles(res.board.grid);

  // 4×16 = 64 celle, meno le 4 edge agli angoli = 60 tessere renderizzate
  assert.strictEqual(tiles.length, 60);
  // nessuna tessera negli angoli (righe 0/3, colonne 0/15)
  assert.ok(!tiles.some(t => (t.row === 0 || t.row === 3) && (t.col === 0 || t.col === 15)));
  // le lettere della frase, non rivelate
  const letters = tiles.filter(t => t.kind === 'letter');
  assert.strictEqual(letters.length, 'CIAOMONDO'.length);
  assert.ok(letters.every(t => t.revealed === false && /^[A-Z]$/.test(t.letter)));
  // tutto il resto è blocked senza lettera
  assert.ok(tiles.filter(t => t.kind === 'blocked').every(t => t.letter === null));
});
```

- [ ] **Step 2: Verifica che fallisca**

Run: `node --test tests/boardlayout.test.js`
Expected: FAIL — `Cannot find module ... boardlayout.mjs`

- [ ] **Step 3: Implementazione minima**

```js
// public/js/fx/boardlayout.mjs
// Mapping puro dalla griglia logica di board.js (4x16, celle edge/blocked/letter)
// alle tessere renderizzate dal tabellone 3D. Le celle `edge` (gli angoli
// strutturali delle righe da 14) non producono tessere.
export function gridToTiles(grid) {
  const tiles = [];
  grid.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (cell.type === 'edge') return;
      tiles.push({
        row: r,
        col: c,
        kind: cell.type === 'letter' ? 'letter' : 'blocked',
        letter: cell.type === 'letter' ? cell.letter : null,
        revealed: !!cell.revealed
      });
    });
  });
  return tiles;
}
```

- [ ] **Step 4: Verifica che passi**

Run: `node --test tests/boardlayout.test.js`
Expected: PASS (1 test). Poi `npm test`: tutti i test esistenti ancora verdi.

Verifica anche che express serva i `.mjs` col MIME giusto (servirà al browser nel Task 7):

```bash
npm start & sleep 1; curl -sI http://localhost:3000/js/fx/boardlayout.mjs | grep -i content-type; kill %1
```

Expected: `Content-Type: application/javascript` (o `text/javascript`) — è ciò che express 4.21 fa di default per i `.mjs`. Se per qualche motivo uscisse `application/octet-stream`, fermati e segnala: la soluzione va decisa senza toccare `server.js`.

- [ ] **Step 5: Commit**

```bash
git add public/js/fx/boardlayout.mjs tests/boardlayout.test.js
git commit -m "feat: mapping griglia->tessere per il tabellone 3D (niente angoli)"
```

---

### Task 3: halftone.js — materiale shader condiviso

La ricetta visiva del riferimento (estratta dal sito): punti in screen-space la cui dimensione segue la luce, pulsazione per-cella, cursore che ingrandisce e tinge di ciano, wireframe baricentrico con fronte di sweep rumoroso e impulsi di luce. Nessuna luce three.js: l'illuminazione è nello shader.

**Files:**
- Create: `public/js/fx/halftone.js`

- [ ] **Step 1: Scrivi il modulo completo**

```js
// public/js/fx/halftone.js
// Materiale "halftone yutaabe": punti screen-space modulati dalla luce, hover
// ciano al cursore, wireframe baricentrico con sweep. Condiviso da ruote e buste.
import * as THREE from '../../vendor/three.module.js';

export const ACCENT_CSS = '#30b8ff';
export const ACCENT = new THREE.Color(0.188, 0.722, 1.0);

const VERT = /* glsl */ `
  attribute vec3 aBary;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vBary;
  varying float vWorldY;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mv.xyz;
    vBary = aBary;
    vWorldY = (modelMatrix * vec4(position, 1.0)).y;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec2 uCursor;       // px device, origine basso-sinistra (come gl_FragCoord)
  uniform float uIsTouch;     // 1 = niente cursore (TV): hover spento
  uniform float uCellSize;    // px device
  uniform float uDotScale;    // moltiplicatore raggio punti (alternanza spicchi)
  uniform float uHoverRadius; // px device
  uniform float uSweepY;      // quota world del fronte wireframe (-1000 = spento)
  uniform float uDim;         // 1 normale, <1 attenua (buste abbandonate)
  uniform vec3 uAccent;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vBary;
  varying float vWorldY;

  float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  void main() {
    vec3 n = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);
    vec3 lightDir = normalize(vec3(-0.4, 0.7, 0.6));
    vec3 halfVec = normalize(lightDir + viewDir);
    float diff = max(dot(n, lightDir), 0.0);
    float spec = pow(max(dot(n, halfVec), 0.0), 30.0);
    float lightShaped = pow(diff, 0.85) * 0.85 + 0.06;

    // --- halftone screen-space ---
    vec2 cellId = floor(gl_FragCoord.xy / uCellSize);
    vec2 cellLocal = fract(gl_FragCoord.xy / uCellSize) - 0.5;
    float dotDist = length(cellLocal);
    float h1 = hash21(cellId);
    float h2 = fract(sin(dot(cellId, vec2(91.34, 47.71))) * 28471.13);
    float pulseA = sin(uTime * 2.2 + h1 * 6.2831) * 0.5 + 0.5;
    float pulseB = sin(uTime * 1.3 + h2 * 6.2831) * 0.5 + 0.5;

    float cursorDist = distance((cellId + 0.5) * uCellSize, uCursor);
    float cursor = (1.0 - smoothstep(0.0, uHoverRadius, cursorDist)) * (1.0 - uIsTouch);

    float dotRadius = (lightShaped * 0.6
        + (pulseA - 0.5) * 0.10 * lightShaped
        + (pulseB - 0.5) * 0.06 * lightShaped) * uDotScale
        + cursor * 0.35;
    float dotMask = smoothstep(dotRadius + 0.08, dotRadius - 0.08, dotDist);
    vec3 dotColor = mix(vec3(1.0), uAccent, cursor);
    vec3 hot = vec3(0.4, 0.75, 1.0) * pow(spec, 1.2) * 2.0 * (1.0 - cursor);
    vec3 col = mix(vec3(0.0), dotColor + hot, dotMask);

    // --- wireframe baricentrico con sweep ---
    float minBary = min(min(vBary.x, vBary.y), vBary.z);
    float wire = 1.0 - smoothstep(0.0, 0.04, minBary);
    float edgeNoise = vnoise(vec2(vWorldY * 3.0, uTime * 0.8)) * 2.0 - 1.0;
    float frontDist = vWorldY - uSweepY + edgeNoise * 0.15;
    float inWire = smoothstep(0.07, -0.07, frontDist);
    float wireBrightness = 0.15 + diff * 0.5 + spec * 2.0;
    float travel = pow(1.0 - abs(fract(vViewPosition.y * 4.0 - uTime * 0.6) - 0.5) * 2.0, 12.0);
    col += (vec3(wireBrightness) + uAccent * travel * 0.6) * wire * inWire * 0.8;

    gl_FragColor = vec4(col * uDim, 1.0);
  }
`;

// Le geometrie devono essere non-indicizzate, con attributo aBary per il wireframe.
export function addBarycentric(geometry) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const count = g.attributes.position.count;
  const bary = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 3) {
    bary.set([1, 0, 0], i * 3);
    bary.set([0, 1, 0], (i + 1) * 3);
    bary.set([0, 0, 1], (i + 2) * 3);
  }
  g.setAttribute('aBary', new THREE.BufferAttribute(bary, 3));
  return g;
}

export function createHalftoneMaterial(opts = {}) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uTime: { value: 0 },
      uCursor: { value: new THREE.Vector2(-1e5, -1e5) },
      uIsTouch: { value: opts.isTouch ? 1 : 0 },
      uCellSize: { value: (opts.cellSize ?? 9) * dpr },
      uDotScale: { value: opts.dotScale ?? 1 },
      uHoverRadius: { value: (opts.hoverRadius ?? 220) * dpr },
      uSweepY: { value: -1000 },
      uDim: { value: 1 },
      uAccent: { value: ACCENT.clone() }
    }
  });
}
```

- [ ] **Step 2: Smoke check sintassi**

```bash
node --input-type=module -e "
import * as fs from 'fs';
const src = fs.readFileSync('public/js/fx/halftone.js','utf8');
if (!src.includes('gl_FragColor') || !src.includes('aBary')) throw new Error('shader incompleto');
console.log('ok');
"
```

Expected: `ok`. (La verifica visiva vera arriva col Task 4 — lo shader non è renderizzabile in node.)

- [ ] **Step 3: Commit**

```bash
git add public/js/fx/halftone.js
git commit -m "feat: materiale shader halftone condiviso (punti+wireframe stile yutaabe)"
```

---

### Task 4: HomeWheel — ruota decorativa dell'intro (parallax + hover)

**Files:**
- Create: `public/js/fx/homewheel.js`
- Modify: `public/index.html` (intro + canvas)
- Modify: `public/js/main.js:1-31` (wiring intro)
- Modify: `public/css/style.css` (sezione INTRO)

- [ ] **Step 1: Scrivi il modulo**

```js
// public/js/fx/homewheel.js
// Ruota decorativa della pagina iniziale: halftone mono, senza freccia né
// etichette. Parallax verso il cursore (come il gatto del riferimento),
// hover ciano gestito dallo shader, sweep wireframe in loop.
import * as THREE from '../../vendor/three.module.js';
import { createHalftoneMaterial, addBarycentric } from './halftone.js';

export class HomeWheel {
  constructor(canvas) {
    this.canvas = canvas;
    this.enabled = true;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    this.camera.position.set(0, 0, 15);
    this._materials = [];
    this._buildWheel();
    this._mouse = { px: -1e5, py: -1e5, nx: 0, ny: 0 };
    this._tilt = { x: 0.26, y: 0 };
    window.addEventListener('pointermove', (e) => this._onPointer(e));
    this.resize();
    this._t0 = performance.now();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  _buildWheel() {
    const R = 4, DEPTH = 0.5, SEGMENTS = 16;
    const group = new THREE.Group();
    const seg = (Math.PI * 2) / SEGMENTS;
    for (let i = 0; i < SEGMENTS; i++) {
      const start = -Math.PI / 2 + i * seg;
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      const STEPS = 6;
      for (let s = 0; s <= STEPS; s++) {
        const a = start + (seg * s) / STEPS;
        shape.lineTo(Math.cos(a) * R, -Math.sin(a) * R);
      }
      shape.lineTo(0, 0);
      const geo = addBarycentric(new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: false }));
      // alternanza di densità: è l'unica cosa che distingue gli spicchi (mono assoluto)
      const mat = createHalftoneMaterial({ dotScale: i % 2 ? 0.62 : 1.0 });
      this._materials.push(mat);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.z = -DEPTH / 2;
      group.add(mesh);
    }
    // hub: cupola bassa con gli stessi punti
    const hubGeo = addBarycentric(new THREE.SphereGeometry(0.55, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2));
    const hubMat = createHalftoneMaterial({ dotScale: 0.8 });
    this._materials.push(hubMat);
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.x = Math.PI / 2;
    hub.position.z = DEPTH / 2;
    group.add(hub);
    this.wheel = group;
    this.scene.add(group);
  }

  _onPointer(e) {
    const dpr = this.renderer.getPixelRatio();
    this._mouse.px = e.clientX * dpr;
    this._mouse.py = (window.innerHeight - e.clientY) * dpr;
    this._mouse.nx = (e.clientX / window.innerWidth) * 2 - 1;
    this._mouse.ny = (e.clientY / window.innerHeight) * 2 - 1;
  }

  setEnabled(on) {
    this.enabled = on;
    this.canvas.style.display = on ? '' : 'none';
  }

  resize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight, true);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  _loop(now) {
    requestAnimationFrame(this._loop);
    if (!this.enabled) return;
    const t = (now - this._t0) / 1000;
    const amp = this.reduced ? 0 : 1;
    // parallax: la ruota si inclina per seguire il cursore, lerp smorzato
    const targetX = 0.26 + this._mouse.ny * 0.10 * amp;
    const targetY = this._mouse.nx * 0.22 * amp;
    this._tilt.x += (targetX - this._tilt.x) * 0.05;
    this._tilt.y += (targetY - this._tilt.y) * 0.05;
    this.wheel.rotation.x = this._tilt.x;
    this.wheel.rotation.y = this._tilt.y;
    this.wheel.rotation.z = t * 0.05 * amp;                 // deriva lenta
    this.wheel.position.y = Math.sin(t * 0.5) * 0.15 * amp; // fluttuazione idle
    const sweep = ((t * 1.2) % 14) - 7;                     // fronte wireframe in loop
    for (const m of this._materials) {
      m.uniforms.uTime.value = t;
      m.uniforms.uCursor.value.set(this._mouse.px, this._mouse.py);
      m.uniforms.uSweepY.value = sweep;
    }
    this.renderer.render(this.scene, this.camera);
  }
}
```

- [ ] **Step 2: index.html — canvas e riordino intro**

In `public/index.html`:

1. Sostituisci `<canvas id="fluid-canvas" aria-hidden="true"></canvas>` con:

```html
<canvas id="stage-canvas" aria-hidden="true"></canvas>
```

2. Dentro `#start-tap-screen`, come PRIMO figlio (prima dei corner label), aggiungi:

```html
<canvas id="home-canvas" aria-hidden="true"></canvas>
```

3. Riordina `#intro-stage` (wordmark sopra, ruota visibile nel mezzo, azioni sotto):

```html
<div id="intro-stage">
  <div class="eyebrow rise">Giramoe Studio presenta</div>
  <div class="wm rise">GIRAMOE</div>
  <div class="intro-wheel-gap" aria-hidden="true"></div>
  <div class="tagline rise">Il gioco della ruota. Tre giocatori, un finalista.</div>
  <button class="glass-button rise" id="tap-start-btn" data-cursor-label="Tap">Tocca per iniziare</button>
  <div class="intro-wait-hint">In attesa dell'host&hellip;</div>
</div>
```

(via `<hr class="hairline intro-rule rise">`, arriva `.intro-wheel-gap`.)

- [ ] **Step 3: CSS intro**

Nella sezione `/* === INTRO === */` di `style.css` aggiungi/adatta:

```css
#home-canvas {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0;
}
#intro-stage { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; }
.intro-wheel-gap { height: 48vh; pointer-events: none; }
```

`#stage-canvas` eredita le regole che erano di `#fluid-canvas`: rinomina il selettore esistente (`#fluid-canvas { ... }` → `#stage-canvas { ... }`).

- [ ] **Step 4: main.js — wiring**

In `public/js/main.js`:

1. Le righe 1–7 diventano:

```js
import { initCursor } from './fx/cursor.js';
import { Wheel3D } from './fx/wheel3d.js';
import { HomeWheel } from './fx/homewheel.js';

initCursor();
let home = null;
try {
  home = new HomeWheel(document.getElementById('home-canvas'));
  window.__home = home; // hook di verifica manuale
} catch (err) {
  console.warn('HomeWheel non disponibile (WebGL?):', err);
}
window.addEventListener('resize', () => { if (home) home.resize(); });
```

2. In `showScreen` (riga ~19) sostituisci `fluid.setEnabled(id === 'start-tap-screen');` con:

```js
if (home) home.setEnabled(id === 'start-tap-screen');
```

(L'import e l'istanza di `FluidFX` spariscono. `fluid.js` si elimina nel Task 10.)

- [ ] **Step 5: Verifica visiva**

`npm start`, apri `http://localhost:3000`:
- ruota halftone al centro, GIRAMOE sopra, bottone sotto, niente freccia/etichette
- muovi il mouse: la ruota si inclina seguendolo; i punti vicino al cursore si ingrandiscono e diventano ciano
- ogni ~12 s un fronte wireframe attraversa la ruota dal basso verso l'alto
- clic su "Tocca per iniziare" → title animation → la ruota sparisce con l'intro
- console pulita.

- [ ] **Step 6: Commit**

```bash
git add public/js/fx/homewheel.js public/index.html public/js/main.js public/css/style.css
git commit -m "feat: ruota halftone decorativa nell'intro con parallax e hover ciano"
```

---

### Task 5: Wheel3D — riscrittura ruota di gioco (stessa API)

La matematica di `spinTo` (accumulo rotazione, ease-out cubico, paracadute rAF) e le firme pubbliche restano identiche alla versione attuale (`public/js/fx/wheel3d.js:284-333`): cambia solo la resa. La freccia resta il DOM `#main-wheel-indicator` già esistente.

**Files:**
- Rewrite: `public/js/fx/wheel3d.js`
- Modify: `public/css/style.css` (`.wheel-indicator`)

- [ ] **Step 1: Riscrivi il modulo**

```js
// public/js/fx/wheel3d.js
// Ruota di gioco halftone (stile yutaabe) — drop-in per la Wheel 2D di wheel.js:
// stessa interfaccia (constructor(canvas, opts), spinTo, setLabels, resize,
// onSpinEnd, spinning). Spicchi mono a densità alternata, speciali in ciano.
import * as THREE from '../../vendor/three.module.js';
import { createHalftoneMaterial, addBarycentric, ACCENT_CSS } from './halftone.js';

// Stessa semantica degli speciali della ruota 2D (wheel.js).
const SPECIAL_STYLE = {
  bancarotta: { symbol: '✕',  word: 'BANCAROTTA' },
  next:       { symbol: '→',  word: 'PASSA' },
  raddoppia:  { symbol: '×2', word: 'RADDOPPIA' },
  express:    { symbol: '»',  word: 'EXPRESS' }
};

export class Wheel3D {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.segments = options.segments || 16;
    this.labels = options.labels || [];
    this.showLabels = options.showLabels !== false;
    this.onSpinEnd = options.onSpinEnd || null;
    this.rotation = 0;       // radianti, stessa convenzione della 2D
    this.spinning = false;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    this.cameraBaseZ = 16.6;
    this.camera.position.set(0, -1.5, this.cameraBaseZ);
    this.camera.lookAt(0, 0, 0);

    this._materials = [];
    this._buildWheel();
    this.resize();
    this._t0 = performance.now();
    this._tick = this._tick.bind(this);
    requestAnimationFrame(this._tick);
  }

  _buildWheel() {
    if (this.group) this.scene.remove(this.group);
    this._materials = [];
    this.group = new THREE.Group();
    const R = 4, DEPTH = 0.42;
    const seg = (2 * Math.PI) / this.segments;

    for (let i = 0; i < this.segments; i++) {
      const start = -Math.PI / 2 + i * seg;
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      const STEPS = 6;
      for (let s = 0; s <= STEPS; s++) {
        const a = start + (seg * s) / STEPS;
        shape.lineTo(Math.cos(a) * R, -Math.sin(a) * R);
      }
      shape.lineTo(0, 0);
      const geo = addBarycentric(new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: false }));
      const special = SPECIAL_STYLE[this.labels[i]];
      // niente hover sulla TV (isTouch) — speciali quasi neri così il ciano dell'etichetta spicca
      const mat = createHalftoneMaterial({
        isTouch: true,
        dotScale: special ? 0.4 : (i % 2 ? 0.62 : 1.0)
      });
      this._materials.push(mat);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.z = -DEPTH / 2;
      this.group.add(mesh);
    }

    // hub piccolo, stessi punti
    const hubGeo = addBarycentric(new THREE.SphereGeometry(0.5, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2));
    const hubMat = createHalftoneMaterial({ isTouch: true, dotScale: 0.8 });
    this._materials.push(hubMat);
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.x = Math.PI / 2;
    hub.position.z = DEPTH / 2;
    this.group.add(hub);

    this._labelMesh = null;
    if (this.showLabels) this._buildLabelRing(R, DEPTH);
    this.scene.add(this.group);
  }

  _buildLabelRing(R, DEPTH) {
    const SIZE = 1024;
    const cnv = document.createElement('canvas');
    cnv.width = cnv.height = SIZE;
    const ctx = cnv.getContext('2d');
    const cx = SIZE / 2;
    const seg = (2 * Math.PI) / this.segments;
    const rr = (SIZE / 2) * 0.96;

    for (let i = 0; i < this.segments; i++) {
      const label = this.labels[i];
      if (label == null) continue;
      const special = SPECIAL_STYLE[label];
      const mid = -Math.PI / 2 + i * seg + seg / 2;
      ctx.save();
      ctx.translate(cx, cx);
      ctx.rotate(mid);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      if (special) {
        ctx.fillStyle = ACCENT_CSS;
        ctx.font = `700 ${rr * 0.13}px "Space Mono", monospace`;
        ctx.fillText(special.symbol, rr * 0.92, 0);
        ctx.font = `700 ${rr * 0.048}px "Space Mono", monospace`;
        ctx.fillText(special.word, rr * 0.6, 0);
      } else {
        ctx.fillStyle = '#f5f5f7';
        ctx.font = `700 ${rr * 0.085}px "Space Mono", monospace`;
        ctx.fillText(String(label).toUpperCase(), rr * 0.9, 0);
      }
      ctx.restore();
    }

    const tex = new THREE.CanvasTexture(cnv);
    tex.anisotropy = 4;
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(R, 64),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    );
    mesh.position.z = DEPTH / 2 + 0.055;
    this._labelMesh = mesh;
    this.group.add(mesh);
  }

  setLabels(labels) {
    this.labels = labels || [];
    this._buildWheel();
    this.group.rotation.z = -this.rotation;
  }

  resize() {
    const container = this.canvas.parentElement;
    if (!container) return;
    const size = Math.min(container.clientWidth, container.clientHeight) * 0.96;
    this.renderer.setSize(size, size, true);
    this.camera.aspect = 1;
    this.camera.updateProjectionMatrix();
  }

  // Loop continuo: i punti pulsano anche da ferma. Durante lo spin la rotazione
  // è guidata da spinTo (che ha il suo scheduler col paracadute anti-throttle).
  _tick(now) {
    requestAnimationFrame(this._tick);
    const t = (now - this._t0) / 1000;
    for (const m of this._materials) m.uniforms.uTime.value = t;
    this.group.rotation.z = -this.rotation;
    this.camera.lookAt(0, 0, 0);
    this.renderer.render(this.scene, this.camera);
  }

  // Identica alla versione precedente: porta il centro di `segmentIndex` sotto
  // il puntatore in alto accumulando la rotazione; ease-out cubico + dolly camera.
  spinTo(segmentIndex, spins = 6, duration = 6000) {
    if (this.spinning) return;
    this.spinning = true;

    const segDeg = 360 / this.segments;
    const targetMod = (((360 - segmentIndex * segDeg - segDeg / 2) % 360) + 360) % 360;
    const startRotation = this.rotation;
    const currentMod = ((((startRotation * 180) / Math.PI) % 360) + 360) % 360;
    const delta = (((targetMod - currentMod) % 360) + 360) % 360;
    const totalDeg = spins * 360 + delta;
    const targetRotation = startRotation + (totalDeg * Math.PI) / 180;
    const startTime = performance.now();

    // rAF con paracadute: se la tab è throttlata avanza via setTimeout
    const schedule = (fn) => {
      let fired = false;
      const id = requestAnimationFrame((t) => { fired = true; fn(t); });
      setTimeout(() => {
        if (!fired) { cancelAnimationFrame(id); fn(performance.now()); }
      }, 80);
    };

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      this.rotation = startRotation + (targetRotation - startRotation) * eased;

      const dolly = Math.sin(progress * Math.PI) * 0.9;
      this.camera.position.z = this.cameraBaseZ - dolly;

      if (progress < 1) {
        schedule(animate);
      } else {
        this.camera.position.z = this.cameraBaseZ;
        this.spinning = false;
        if (this.onSpinEnd) this.onSpinEnd();
      }
    };

    schedule(animate);
  }
}
```

- [ ] **Step 2: CSS freccia**

In `style.css`, nella regola `.wheel-indicator` (sezione GAME LAYOUT): triangolo bianco con punta ciano. Sostituisci i colori esistenti con:

```css
.wheel-indicator {
  /* posizione/dimensioni invariate */
  border-left-color: transparent;
  border-right-color: transparent;
  border-top-color: var(--ink);
  filter: drop-shadow(0 2px 0 var(--accent));
}
```

(Se la freccia attuale è costruita diversamente — es. background+clip-path — adatta mantenendo: corpo bianco, dettaglio ciano, nessun glow.)

- [ ] **Step 3: Verifica visiva**

`npm start`, apri main display e `http://localhost:3000/admin.html` sul telefono (o seconda tab):
- avvia lobby + partita dall'admin: la ruota di gioco appare halftone, etichette Space Mono leggibili, speciali in ciano
- gira la ruota dall'admin: spin fluido, zoom CSS come prima, atterra sullo spicchio giusto (confronta col risultato annunciato), `onSpinEnd` scatta (suono stop + risultato)
- round express: l'etichetta PASSA→EXPRESS cambia (setLabels funziona)
- in console: `window.__wheel.spinTo(0, 2, 2000)` come verifica rapida.

- [ ] **Step 4: Commit**

```bash
git add public/js/fx/wheel3d.js public/css/style.css
git commit -m "feat: ruota di gioco halftone mono, stessa interfaccia spinTo/setLabels"
```

---

### Task 6: Stage3D + DotField — palco fullscreen e sfondo reattivo

**Files:**
- Create: `public/js/fx/stage3d.js`, `public/js/fx/dotfield.js`
- Modify: `public/js/main.js` (wiring stage + pulse)

- [ ] **Step 1: dotfield.js**

```js
// public/js/fx/dotfield.js
// Sfondo a punti dietro il palco: respiro idle + onde radiali sugli eventi
// (spin, risposta giusta = ciano, sbagliata = i punti si spengono sull'onda).
import * as THREE from '../../vendor/three.module.js';

const FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec2 uResolution;   // px device
  uniform float uPulseT;      // istante ultimo evento (s); -1000 = nessuno
  uniform float uPulseKind;   // 0 spin, 1 correct, 2 wrong
  float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    float cellSize = 12.0;
    vec2 cellId = floor(gl_FragCoord.xy / cellSize);
    vec2 local = fract(gl_FragCoord.xy / cellSize) - 0.5;
    float h = hash21(cellId);
    float base = 0.05 + 0.04 * sin(uTime * 1.4 + h * 6.2831);

    float age = uTime - uPulseT;
    vec2 center = uResolution * 0.5;
    float d = distance((cellId + 0.5) * cellSize, center);
    float ring = exp(-abs(d - age * 900.0) * 0.012) * exp(-age * 1.4) * step(0.0, age);

    float radius = base + ring * 0.45;
    float mask = smoothstep(radius + 0.06, radius - 0.06, length(local));
    vec3 col = vec3(1.0);
    if (uPulseKind > 0.5 && uPulseKind < 1.5) col = mix(col, vec3(0.188, 0.722, 1.0), clamp(ring * 3.0, 0.0, 1.0));
    if (uPulseKind > 1.5) mask *= 1.0 - clamp(ring * 2.5, 0.0, 0.85);
    gl_FragColor = vec4(col * mask * 0.5, 1.0);
  }
`;

const VERT = /* glsl */ `
  void main() { gl_Position = vec4(position, 1.0); }
`;

export class DotField {
  constructor(scene) {
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uPulseT: { value: -1000 },
        uPulseKind: { value: 0 }
      }
    });
    // quad fullscreen in clip space: ignora camera
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.mesh.renderOrder = -1;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }
  resize(w, h, dpr) { this.material.uniforms.uResolution.value.set(w * dpr, h * dpr); }
  pulse(kind) {
    this.material.uniforms.uPulseT.value = this._t ?? 0;
    this.material.uniforms.uPulseKind.value = { spin: 0, correct: 1, wrong: 2 }[kind] ?? 0;
  }
  update(t) { this._t = t; this.material.uniforms.uTime.value = t; }
}
```

- [ ] **Step 2: stage3d.js**

```js
// public/js/fx/stage3d.js
// Palco fullscreen della partita: possiede il canvas, la camera (micro-idle),
// lo sfondo a punti e — dai task successivi — tabellone 3D e buste 3D.
import * as THREE from '../../vendor/three.module.js';
import { DotField } from './dotfield.js';

export class Stage3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 1);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    this.camera.position.set(0, 0, 10);
    // luci per le tessere/buste (lo sfondo ha il suo shader)
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-2, 3, 6);
    this.scene.add(key, new THREE.AmbientLight(0xffffff, 0.55));

    this.dots = new DotField(this.scene);
    this.board = null;     // Task 7
    this.envelopes = null; // Task 8
    this.title = null;     // Task 9
    this.mode = 'hidden';
    this.resize();
    this._t0 = performance.now();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  // px schermo → unità world sul piano z=0 (serve a posare le tessere sul rect DOM)
  worldPerPixel() {
    const h = 2 * this.camera.position.z * Math.tan((this.camera.fov * Math.PI) / 360);
    return h / window.innerHeight;
  }
  // rect DOM → centro+dimensioni world (origine centro schermo, y verso l'alto)
  rectToWorld(rect) {
    const wpp = this.worldPerPixel();
    return {
      x: (rect.left + rect.width / 2 - window.innerWidth / 2) * wpp,
      y: (window.innerHeight / 2 - rect.top - rect.height / 2) * wpp,
      w: rect.width * wpp,
      h: rect.height * wpp
    };
  }

  setMode(mode) { // 'hidden' | 'ambient' | 'board' | 'envelopes'
    this.mode = mode;
    this.canvas.style.display = mode === 'hidden' ? 'none' : '';
    if (this.board) this.board.setVisible(mode === 'board');
    if (this.envelopes) this.envelopes.setVisible(mode === 'envelopes');
  }

  pulse(kind) { this.dots.pulse(kind); }

  resize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight, true);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.dots.resize(window.innerWidth, window.innerHeight, this.renderer.getPixelRatio());
    if (this.board) this.board.layout();
  }

  _loop(now) {
    requestAnimationFrame(this._loop);
    if (this.mode === 'hidden') return;
    const t = (now - this._t0) / 1000;
    // micro-oscillazione idle della camera (niente cursore sulla TV)
    const amp = this.reduced ? 0 : 1;
    this.camera.position.x = Math.sin(t * 0.23) * 0.06 * amp;
    this.camera.position.y = Math.cos(t * 0.31) * 0.045 * amp;
    this.camera.lookAt(0, 0, 0);
    this.dots.update(t);
    if (this.board) this.board.update(t);
    if (this.envelopes) this.envelopes.update(t);
    if (this.title) this.title.update(t);
    this.renderer.render(this.scene, this.camera);
  }
}
```

- [ ] **Step 3: main.js — istanza e pulse**

In `public/js/main.js`:

1. Aggiungi all'init (dopo il blocco HomeWheel del Task 4):

```js
import { Stage3D } from './fx/stage3d.js';
// ...
let stage = null;
try {
  stage = new Stage3D(document.getElementById('stage-canvas'));
  document.body.classList.add('webgl-stage');
  window.__stage = stage; // hook di verifica manuale
} catch (err) {
  console.warn('Stage3D non disponibile, fallback DOM:', err);
}
```

e nel listener resize esistente aggiungi `if (stage) stage.resize();`.

2. In `showScreen`, dopo la riga di `home.setEnabled`, aggiungi:

```js
if (stage) {
  const modes = {
    'lobby-screen': 'ambient',
    'triplete-title-screen': 'ambient',
    'finalist-screen': 'ambient',
    'game-screen': 'board',
    'triplete-screen': 'board',
    'final-screen': 'board',
    'envelopes-screen': 'envelopes'
  };
  stage.setMode(modes[id] || 'hidden');
}
```

3. Aggiungi gli impulsi agli handler esistenti (una riga ciascuno, prima o dopo le chiamate Sfx):
- `main:spin` → `if (stage) stage.pulse('spin');`
- `main:solved` → `if (stage) stage.pulse('correct');`
- `main:wrong` → `if (stage) stage.pulse('wrong');`
- `main:expressBankrupt` → `if (stage) stage.pulse('wrong');`
- `main:tripleteSolved` → `if (stage) stage.pulse('correct');`
- `main:tripleteResume` → `if (stage) stage.pulse('wrong');`
- `main:giramoeSolved` → `if (stage) stage.pulse('correct');`

- [ ] **Step 4: Verifica visiva**

`npm start` + admin: in lobby e in partita lo sfondo mostra punti scuri che respirano; al giro ruota parte un'onda dal centro; risposta giusta = onda ciano, sbagliata = i punti si spengono sull'onda. In console: `__stage.pulse('correct')` per provare senza partita. Verifica che sull'intro lo stage sia spento (`display:none`) e ci sia solo la ruota home.

- [ ] **Step 5: Commit**

```bash
git add public/js/fx/stage3d.js public/js/fx/dotfield.js public/js/main.js
git commit -m "feat: palco three.js fullscreen con sfondo a punti reattivo agli eventi"
```

---

### Task 7: Board3D — tabellone 3D con flip

Il DOM del tabellone resta e continua a essere aggiornato (è il fallback no-WebGL e la fonte del layout): con WebGL attivo le sue celle sono `visibility:hidden` e le tessere 3D si posano esattamente sul suo rettangolo.

**Files:**
- Create: `public/js/fx/board3d.js`
- Modify: `public/js/fx/stage3d.js` (istanzia Board3D)
- Modify: `public/js/main.js` (delega render/reveal/flash)
- Modify: `public/css/style.css` (celle DOM: bianco/petrolio/angoli invisibili + hide sotto `.webgl-stage`)

- [ ] **Step 1: board3d.js**

```js
// public/js/fx/board3d.js
// Tabellone 3D: una tessera-box per ogni cella non-edge della griglia 4x16.
// Celle lettera = bianche (lettera nera al flip), celle senza lettera = blu
// petrolio. Si allinea al rettangolo del board DOM (nascosto), così il layout
// CSS esistente continua a comandare posizioni e responsive.
import * as THREE from '../../vendor/three.module.js';
import { gridToTiles } from './boardlayout.mjs';

const PETROL = 0x0d2433;
const WHITE = 0xf5f5f7;
const ACCENT = new THREE.Color('#30b8ff');
const FLIP_S = 0.38;       // durata flip (s)
const GRID_COLS = 16, GRID_ROWS = 4;

export class Board3D {
  constructor(scene, stage) {
    this.stage = stage;
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    this.targetEl = null;
    this.tiles = new Map();         // "r:c" -> mesh
    this._letterTex = new Map();    // "A" -> CanvasTexture (cache)
    this._geo = new THREE.BoxGeometry(1, 1, 1);
    this._petrolMat = new THREE.MeshStandardMaterial({ color: PETROL, roughness: 0.55 });
    this._whiteMat = new THREE.MeshStandardMaterial({ color: WHITE, roughness: 0.4 });
    this._frame = 0;
  }

  setVisible(on) {
    this.group.visible = on;
    // il rect del DOM è misurabile solo a schermo visibile: rilayout al frame dopo
    if (on) requestAnimationFrame(() => this.layout());
  }

  setTarget(el) { this.targetEl = el; }

  setBoard(grid) {
    for (const mesh of this.tiles.values()) this.group.remove(mesh);
    this.tiles.clear();
    this.grid = grid;
    for (const t of gridToTiles(grid)) {
      let mats;
      if (t.kind === 'blocked') {
        mats = this._petrolMat;
      } else {
        // [+x,-x,+y,-y,+z(front),-z]: fronte separato per il flip della lettera
        const front = t.revealed ? this._letterMat(t.letter) : new THREE.MeshBasicMaterial({ color: WHITE });
        mats = [this._whiteMat, this._whiteMat, this._whiteMat, this._whiteMat, front, this._whiteMat];
      }
      const mesh = new THREE.Mesh(this._geo, mats);
      mesh.userData = { row: t.row, col: t.col, kind: t.kind, letter: t.letter, revealed: t.revealed, anim: null };
      this.tiles.set(`${t.row}:${t.col}`, mesh);
      this.group.add(mesh);
    }
    this.layout();
  }

  _letterMat(letter) {
    if (!this._letterTex.has(letter)) {
      const cnv = document.createElement('canvas');
      cnv.width = cnv.height = 128;
      const ctx = cnv.getContext('2d');
      ctx.fillStyle = '#f5f5f7';
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = '#000';
      ctx.font = '700 88px "Space Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(letter, 64, 70);
      this._letterTex.set(letter, new THREE.CanvasTexture(cnv));
    }
    // materiale per-tessera: il colore anima il flash ciano post-flip
    return new THREE.MeshBasicMaterial({ map: this._letterTex.get(letter) });
  }

  layout() {
    if (!this.targetEl || !this.grid) return;
    const rect = this.targetEl.getBoundingClientRect();
    if (rect.width < 10) return; // schermo nascosto
    const w = this.stage.rectToWorld(rect);
    const cw = w.w / GRID_COLS, ch = w.h / GRID_ROWS;
    for (const mesh of this.tiles.values()) {
      const { row, col } = mesh.userData;
      mesh.position.x = w.x - w.w / 2 + (col + 0.5) * cw;
      mesh.position.y = w.y + w.h / 2 - (row + 0.5) * ch;
      mesh.scale.set(cw * 0.93, ch * 0.88, cw * 0.16);
    }
  }

  reveal({ row, col, letter }) {
    const mesh = this.tiles.get(`${row}:${col}`);
    if (!mesh || mesh.userData.kind !== 'letter' || mesh.userData.revealed) return;
    mesh.userData.revealed = true;
    mesh.userData.anim = { t0: this._t, letter };
  }

  // Triplete board 3: lettera visibile per `ms`, poi di nuovo bianca
  // (a meno che nel frattempo non sia stata rivelata per sempre).
  flash({ row, col, letter }, ms) {
    const mesh = this.tiles.get(`${row}:${col}`);
    if (!mesh || mesh.userData.kind !== 'letter' || mesh.userData.revealed) return;
    mesh.userData.anim = { t0: this._t, letter };
    setTimeout(() => {
      if (!mesh.userData.revealed) mesh.userData.anim = { t0: this._t, letter: null };
    }, ms);
  }

  update(t) {
    this._t = t;
    // il rect può muoversi (wheel-zoom, resize della TV): rimisura ~3 volte/s
    if (this.group.visible && ++this._frame % 20 === 0) this.layout();
    for (const mesh of this.tiles.values()) {
      const a = mesh.userData.anim;
      if (!a) continue;
      const p = Math.min((t - a.t0) / FLIP_S, 1);
      // flip "a porta": chiusa→bordo a metà→aperta; a metà si scambia la faccia
      mesh.rotation.x = (p < 0.5 ? p : 1 - p) * Math.PI;
      if (p >= 0.5 && !a.swapped) {
        a.swapped = true;
        mesh.material[4] = a.letter ? this._letterMat(a.letter) : new THREE.MeshBasicMaterial({ color: WHITE });
      }
      if (a.swapped && a.letter) {
        // flash ciano che sfuma verso bianco dopo il flip
        const fade = Math.min(Math.max((t - a.t0 - FLIP_S * 0.5) / 0.5, 0), 1);
        mesh.material[4].color.copy(ACCENT).lerp(new THREE.Color('#ffffff'), fade);
      }
      if (p >= 1) {
        mesh.rotation.x = 0;
        const fadeDone = !a.letter || (t - a.t0) > FLIP_S + 0.55;
        if (fadeDone) { if (a.letter) mesh.material[4].color.set('#ffffff'); mesh.userData.anim = null; }
      }
    }
  }
}
```

- [ ] **Step 2: stage3d.js — istanzia il board**

In `public/js/fx/stage3d.js`:

```js
import { Board3D } from './board3d.js';
// ... e nel constructor, al posto di `this.board = null; // Task 7`:
this.board = new Board3D(this.scene, this);
```

- [ ] **Step 3: main.js — delega**

In `public/js/main.js`, in coda a ciascuna di `renderBoard(grid)`, `renderTripleteBoard(grid)`, `renderFinalBoard(grid)` (dopo il loop DOM, `el` è già l'elemento griglia):

```js
if (stage) { stage.board.setTarget(el); stage.board.setBoard(grid); }
```

Nei punti di rivelazione:
- `revealSequence` (dentro il `setTimeout`, accanto a `Sfx.play('letter')`): `if (stage) stage.board.reveal(pos);`
- handler `main:finalReveal` (dentro il `setTimeout`): `if (stage) stage.board.reveal(pos);`
- `revealTripleteCell(cell)`: `if (stage) stage.board.reveal(cell);`
- `flashTripleteCell(cell, ms)`: `if (stage) stage.board.flash(cell, ms);`

- [ ] **Step 4: CSS celle**

In `style.css`, sezione `/* === BOARD 4×16 === */`, sostituisci i colori delle celle (layout/griglia invariati):

```css
.cell.letter { background: var(--ink); border-radius: 4px; color: transparent; }
.cell.letter.revealed { color: #000; }
.cell.blocked { background: var(--petrol); border-radius: 4px; }
.cell.edge { visibility: hidden; background: transparent; }
/* con WebGL attivo il DOM fa solo da layout: tessere disegnate dallo stage */
.webgl-stage .board-grid .cell { visibility: hidden; }
```

(Mantieni le altre proprietà esistenti — dimensioni, font, transizioni — e togli eventuali colori candy/glass residui nelle stesse regole. La classe `.flash` del triplete deve restare funzionante nel fallback DOM: lettera visibile su tessera bianca.)

- [ ] **Step 5: Verifica visiva**

`npm start` + admin, partita completa fino al primo tabellone:
- tessere 3D allineate al layout di prima (4 righe, le righe 1 e 4 con 14 celle SENZA angoli)
- celle lettera bianche, celle vuote blu petrolio
- rivelazione: flip 3D con lampo ciano che sfuma, una lettera alla volta col suono
- giro ruota con zoom: dopo il ritorno dal zoom le tessere sono ancora allineate
- triplete: reveal singoli e flash temporanei (board 3) funzionano
- gioco finale: tabellone renderizzato e reveal ok
- fallback: in `main.js` forza `stage = null` temporaneamente (o apri con WebGL disabilitato) → tabellone DOM visibile con tessere bianche/petrolio, angoli invisibili. Ripristina.

- [ ] **Step 6: Test**

Run: `npm test`
Expected: tutti PASS (la logica non è stata toccata).

- [ ] **Step 7: Commit**

```bash
git add public/js/fx/board3d.js public/js/fx/stage3d.js public/js/main.js public/css/style.css
git commit -m "feat: tabellone 3D con flip e flash ciano, DOM come fallback"
```

---

### Task 8: Envelopes3D — buste finali fluttuanti

**Files:**
- Create: `public/js/fx/envelopes3d.js`
- Modify: `public/js/fx/stage3d.js` (istanzia Envelopes3D)
- Modify: `public/js/main.js` (`renderEnvelopes` delega)
- Modify: `public/css/style.css` (envelope DOM mono + hide sotto `.webgl-stage`)

- [ ] **Step 1: envelopes3d.js**

```js
// public/js/fx/envelopes3d.js
// Le 3 buste finali: corpi halftone che fluttuano al centro, la scelta corrente
// avanza verso la camera, l'apertura alza il lembo e mostra il contenuto.
// Mappa colori mono: green (vinta) → ciano, red → bianco spento.
import * as THREE from '../../vendor/three.module.js';
import { createHalftoneMaterial, addBarycentric, ACCENT_CSS } from './halftone.js';

const W = 1.7, H = 1.15, D = 0.07;
const X_SLOTS = [-2.4, 0, 2.4];

export class Envelopes3D {
  constructor(scene, stage) {
    this.stage = stage;
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    this.items = [];
    for (let i = 0; i < 3; i++) this.items.push(this._buildEnvelope(i));
    this.view = null;
  }

  _buildEnvelope(i) {
    const root = new THREE.Group();
    root.position.set(X_SLOTS[i], 0, 0);

    const bodyMat = createHalftoneMaterial({ isTouch: true, dotScale: 0.85, cellSize: 7 });
    const body = new THREE.Mesh(addBarycentric(new THREE.BoxGeometry(W, H, D)), bodyMat);
    root.add(body);

    // bordo: comunica lo stato (corrente/rivelata) col colore
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(W, H, D)),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 })
    );
    root.add(edges);

    // lembo triangolare incernierato sul bordo alto
    const flapShape = new THREE.Shape();
    flapShape.moveTo(-W / 2, 0); flapShape.lineTo(W / 2, 0); flapShape.lineTo(0, -H * 0.52); flapShape.closePath();
    const flapMat = createHalftoneMaterial({ isTouch: true, dotScale: 0.55, cellSize: 7 });
    const flap = new THREE.Mesh(addBarycentric(new THREE.ExtrudeGeometry(flapShape, { depth: 0.02, bevelEnabled: false })), flapMat);
    const hinge = new THREE.Group();
    hinge.position.set(0, H / 2, D / 2 + 0.012);
    hinge.add(flap);
    root.add(hinge);

    const num = this._textPlane(String(i + 1), 0.5, 0.5, '700 150px "Space Mono", monospace', ACCENT_CSS);
    num.position.set(0, -H * 0.22, D / 2 + 0.02);
    root.add(num);

    const content = this._textPlane('', W * 0.92, H * 0.6, '700 56px "Space Mono", monospace', '#f5f5f7');
    content.position.set(0, H * 0.08, D / 2 + 0.03);
    content.visible = false;
    root.add(content);

    this.group.add(root);
    return { root, bodyMat, flapMat, edges, hinge, content, num, flapOpen: 0, targetZ: 0, targetScale: 1 };
  }

  _textPlane(text, w, h, font, color) {
    const cnv = document.createElement('canvas');
    cnv.width = 512; cnv.height = Math.round(512 * (h / w));
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ transparent: true })
    );
    mesh.userData = { cnv, font, color };
    this._drawText(mesh, text);
    return mesh;
  }

  _drawText(mesh, text) {
    const { cnv, font, color } = mesh.userData;
    const ctx = cnv.getContext('2d');
    ctx.clearRect(0, 0, cnv.width, cnv.height);
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // wrapping semplice per i contenuti lunghi
    const words = String(text).split(' ');
    const lines = [];
    let line = '';
    for (const wd of words) {
      const probe = line ? line + ' ' + wd : wd;
      if (ctx.measureText(probe).width > cnv.width * 0.9 && line) { lines.push(line); line = wd; }
      else line = probe;
    }
    if (line) lines.push(line);
    const lh = parseInt(font.match(/(\d+)px/)[1], 10) * 1.15;
    lines.forEach((l, i) => ctx.fillText(l, cnv.width / 2, cnv.height / 2 + (i - (lines.length - 1) / 2) * lh));
    if (mesh.material.map) mesh.material.map.dispose();
    mesh.material.map = new THREE.CanvasTexture(cnv);
    mesh.material.needsUpdate = true;
  }

  setVisible(on) { this.group.visible = on; }

  set(view) {
    this.view = view;
    view.envelopes.forEach((e, i) => {
      const it = this.items[i];
      it.targetZ = i === view.current ? 0.9 : 0;
      it.targetScale = i === view.current ? 1.12 : 1;
      it.flapTarget = e.revealed ? -2.4 : 0;
      it.bodyMat.uniforms.uDim.value = e.abandoned ? 0.3 : 1;
      it.flapMat.uniforms.uDim.value = e.abandoned ? 0.3 : 1;
      it.content.visible = !!e.revealed;
      if (e.revealed) this._drawText(it.content, e.content || (e.color === 'red' ? '✕' : ''));
      // bordo: rivelata green → ciano, red → bianco spento, corrente → bianco pieno
      const edgeColor = e.revealed ? (e.color === 'green' ? ACCENT_CSS : '#9a9aa0') : '#ffffff';
      it.edges.material.color.set(edgeColor);
      it.edges.material.opacity = i === view.current || e.revealed ? 0.95 : 0.35;
    });
  }

  update(t) {
    this.items.forEach((it, i) => {
      // fluttuazione: fase diversa per busta
      it.root.position.y = Math.sin(t * 0.7 + i * 2.1) * 0.12;
      it.root.rotation.y = Math.sin(t * 0.4 + i * 1.3) * 0.07;
      it.root.position.z += ((it.targetZ ?? 0) - it.root.position.z) * 0.08;
      const s = it.targetScale ?? 1;
      it.root.scale.x += (s - it.root.scale.x) * 0.08;
      it.root.scale.y = it.root.scale.z = it.root.scale.x;
      it.hinge.rotation.x += ((it.flapTarget ?? 0) - it.hinge.rotation.x) * 0.07;
      it.bodyMat.uniforms.uTime.value = t;
      it.flapMat.uniforms.uTime.value = t;
    });
  }
}
```

- [ ] **Step 2: stage3d.js — istanzia**

```js
import { Envelopes3D } from './envelopes3d.js';
// ... nel constructor, al posto di `this.envelopes = null; // Task 8`:
this.envelopes = new Envelopes3D(this.scene, this);
```

- [ ] **Step 3: main.js + CSS**

In `renderEnvelopes(row, view)` (main.js, dopo il loop DOM):

```js
if (stage) stage.envelopes.set(view);
```

In `style.css`, sezione ENVELOPES:

```css
.envelope.green { border-color: rgba(48, 184, 255, 0.6); }
.envelope.red { border-color: rgba(245, 245, 247, 0.35); }
.webgl-stage .envelope { visibility: hidden; }
```

- [ ] **Step 4: Verifica visiva**

`npm start` + admin fino alla fase buste (oppure, per fare prima, in console del main display: `__stage.setMode('envelopes'); __stage.envelopes.set({ current: 1, envelopes: [{color:'green',revealed:false},{color:'red',revealed:true,content:'BANCAROTTA'},{color:'green',revealed:false,abandoned:true}] })`):
- 3 buste halftone che fluttuano sfasate, numeri ciano
- la corrente avanza verso la camera e si illumina di bordo
- rivelata: lembo che si apre, contenuto leggibile, bordo ciano (green) o spento (red)
- abbandonata: attenuata.

- [ ] **Step 5: Commit**

```bash
git add public/js/fx/envelopes3d.js public/js/fx/stage3d.js public/js/main.js public/css/style.css
git commit -m "feat: buste finali 3D fluttuanti con apertura del lembo"
```

---

### Task 9: Title a punti + retheme schermi restanti + telefoni

**Files:**
- Create: `public/js/fx/titledots.js`
- Modify: `public/js/fx/stage3d.js` (istanzia TitleDots)
- Modify: `public/js/main.js` (title + colori QR)
- Modify: `public/css/style.css` (lobby, title, finalist, HUD, telefoni, admin)

- [ ] **Step 1: titledots.js**

```js
// public/js/fx/titledots.js
// Reveal dei titoli (GIRAMOE / IL TRIPLETE / EXPRESS): una nuvola di punti
// converge a formare la parola, tiene, poi si disperde.
import * as THREE from '../../vendor/three.module.js';

const COUNT_MAX = 1600;

export class TitleDots {
  constructor(scene) {
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(COUNT_MAX * 3);
    this.target = new Float32Array(COUNT_MAX * 3);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.points = new THREE.Points(
      this.geo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.045, transparent: true, opacity: 0 })
    );
    this.points.visible = false;
    scene.add(this.points);
    this.active = null;
  }

  async show(word) {
    await document.fonts.load('800 180px Syne').catch(() => {});
    const cnv = document.createElement('canvas');
    cnv.width = 1024; cnv.height = 256;
    const ctx = cnv.getContext('2d');
    ctx.font = '800 180px Syne, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(word, 512, 128);
    const img = ctx.getImageData(0, 0, 1024, 256).data;

    // campiona i pixel pieni a passo fisso → posizioni world (larghezza ~8 unità)
    let n = 0;
    for (let y = 0; y < 256 && n < COUNT_MAX; y += 4) {
      for (let x = 0; x < 1024 && n < COUNT_MAX; x += 4) {
        if (img[(y * 1024 + x) * 4 + 3] > 128) {
          this.target[n * 3] = ((x - 512) / 1024) * 8;
          this.target[n * 3 + 1] = ((128 - y) / 256) * 2 + 0.4;
          this.target[n * 3 + 2] = 0.5;
          // partenza: sparsi in una sfera larga
          this.pos[n * 3] = (Math.random() - 0.5) * 14;
          this.pos[n * 3 + 1] = (Math.random() - 0.5) * 8;
          this.pos[n * 3 + 2] = (Math.random() - 0.5) * 4;
          n++;
        }
      }
    }
    this.count = n;
    this.geo.setDrawRange(0, n);
    this.geo.attributes.position.needsUpdate = true;
    this.points.visible = true;
    this.active = { t0: this._t ?? 0 };
  }

  update(t) {
    this._t = t;
    if (!this.active) return;
    const age = t - this.active.t0;
    const mat = this.points.material;
    if (age < 1.0) mat.opacity = Math.min(age * 2, 0.9);          // converge
    else if (age < 2.4) mat.opacity = 0.9;                        // tiene
    else mat.opacity = Math.max(0.9 - (age - 2.4) * 1.5, 0);      // dissolve
    const k = age < 2.4 ? 0.06 : -0.015; // converge poi esplode piano
    for (let i = 0; i < this.count * 3; i++) this.pos[i] += (this.target[i] - this.pos[i]) * k;
    this.geo.attributes.position.needsUpdate = true;
    if (age > 3.2) { this.points.visible = false; this.active = null; }
  }
}
```

In `stage3d.js`: `import { TitleDots } from './titledots.js';` e al posto di `this.title = null; // Task 9` → `this.title = new TitleDots(this.scene);`.

In `main.js`, dentro `playTitleAnimation(word)` dopo `showScreen('triplete-title-screen')`:

```js
if (stage) stage.title.show(word);
```

- [ ] **Step 2: QR e ritocchi main.js**

In `main.js`, handler `main:showLobby`, i colori del QR diventano:

```js
color: { dark: '#000000', light: '#f5f5f7' }
```

- [ ] **Step 3: Retheme CSS schermi restanti**

In `style.css`, sezione per sezione (mantieni layout e dimensioni, cambia solo colori/font dove ancora "vecchi"):

- **LOBBY**: `.qr-container { background: var(--ink); padding: 14px; border-radius: var(--r-md); }` (il QR va scansionato: pannello bianco pieno). Slot giocatori e `.stat-row` su `var(--panel)`; `.ph.now em` in `var(--accent)`.
- **TITLE SCREEN**: il wordmark è già Syne dal Task 1; rimuovi eventuali gradienti/glint colorati residui (il reveal lo fanno i punti).
- **FINALIST / MATCH END**: `.finalist-name` in Syne, colore `var(--ink)`, eventuale sottolineatura `var(--accent)`.
- **CATEGORIA / PLAYERS BAR / RESULT / BUZZ / TIMER**: verifica che usino solo `var(--panel)`, `var(--ink)`, `var(--accent)`; il giocatore `.active` diventa `background: var(--accent); color: #000;`. `.final-timer.low { color: var(--accent); }` (niente rosso).
- **FEEDBACK**: `.fx-veil.correct` deve usare `var(--green)` (ora ciano) e `.fx-veil.wrong` `var(--red)` (ora bianco) — se i colori sono hardcoded nel CSS, sostituiscili coi token.
- **CURSORE CUSTOM** (sezione in fondo a style.css): l'accento del cursore (`fx/cursor.js` + relative regole) passa a `var(--accent)` se usa colori hardcoded.
- **PLAYER PHONE + ADMIN**: cerca nelle due sezioni ogni colore hardcoded (`#0a84ff`, verdi `#30d158`/`#22c55e`, rossi `#ff453a`/`#ef4444`) e sostituisci: blu→`var(--accent)`, verde-conferma→`var(--accent)`, rosso-errore→`var(--ink)` su sfondo scuro con bordo. Wordmark dei telefoni in `var(--font-display)`. Bottoni primari: `background: var(--accent); color: #000;`.

Comando utile per trovarli tutti:

```bash
grep -nE '#(0a84ff|30d158|ff453a|22c55e|ef4444|f59e0b|eab308)' public/css/style.css
```

- [ ] **Step 4: Verifica visiva**

- title animation all'avvio: GIRAMOE si forma coi punti e si dissolve
- lobby: QR scansionabile dal telefono (provalo!), slot e fasi mono
- telefono giocatore: join, buzz, tastiera — tutto in palette nuova, nessun blu Apple/verde/rosso residuo
- admin: leggibile, azioni chiare, accenti ciano
- spareggio e finalist screen coerenti.

- [ ] **Step 5: Commit**

```bash
git add public/js/fx/titledots.js public/js/fx/stage3d.js public/js/main.js public/css/style.css
git commit -m "feat: titoli a punti convergenti e retheme mono di lobby, HUD e telefoni"
```

---

### Task 10: Cleanup, reduced-motion e verifica finale

**Files:**
- Delete: `public/js/fx/fluid.js`
- Modify: `public/css/style.css` (REDUCED MOTION)

- [ ] **Step 1: Rimuovi il fluido**

```bash
grep -rn "fluid" public/ --include='*.js' --include='*.html' --include='*.css'
```

Expected: nessun riferimento residuo fuori da `public/js/fx/fluid.js` (se `cursor.js` o il CSS lo citano, rimuovi quelle righe). Poi:

```bash
git rm public/js/fx/fluid.js
```

- [ ] **Step 2: Reduced motion**

`HomeWheel` e `Stage3D` già azzerano parallax/idle con `prefers-reduced-motion` (`amp = 0`). Nella sezione `/* === REDUCED MOTION === */` di `style.css` verifica che le nuove animazioni CSS (flip fallback, rise, veil) siano già coperte dalle regole esistenti; se no aggiungi i nuovi selettori al blocco.

- [ ] **Step 3: Test completi**

Run: `npm test`
Expected: tutti PASS, incluso `tests/boardlayout.test.js`.

- [ ] **Step 4: Collaudo completo (checklist manuale)**

`npm start`, main display su PC + admin e un giocatore da telefono:

1. Intro: ruota halftone, parallax, hover ciano, GIRAMOE sopra, tap per iniziare
2. Lobby: QR scansionabile, join giocatore visibile
3. Partita: ruota di gioco halftone con freccia, spin+zoom, tabellone 3D, reveal flip, punteggi
4. Express: cambio etichetta ruota, bancarotta = onda "wrong"
5. Triplete: title a punti, board con buzz, flash board 3
6. Giramoe: board + buzz
7. Spareggio (se forzabile) e finalist
8. Finale: 3 tabelloni, timer, reveal
9. Buste: fluttuanti, selezione, apertura
10. Performance: su schermata partita, fps stabili (in console: nessun warning, animazioni fluide), CPU ragionevole
11. Audio invariato in ogni fase

- [ ] **Step 5: Commit finale**

```bash
git add -A
git commit -m "chore: rimosso fluid.js, rifiniture reduced-motion — rebranding yutaabe completo"
```

---

## Note per l'esecutore

- **Mai toccare** la logica di gioco (file in radice, socket, tests esistenti): se un task sembra richiederlo, fermati e segnala.
- `public/js/wheel.js` (2D) resta com'è: è solo il fallback no-WebGL della ruota; il suo aspetto candy non è in scope.
- Tutti i moduli fx importano three da `../../vendor/three.module.js` (versione vendorizzata, niente npm import).
- I font sono self-hosted apposta: non introdurre URL Google Fonts/CDN nel CSS.
- Se una verifica visiva fallisce, usa gli hook console: `__home`, `__stage`, `__wheel`.


