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
    this._wantVisible = false;
  }

  setVisible(on) {
    this._wantVisible = on;
    this.group.visible = on;
    // il rect del DOM è misurabile solo a schermo visibile: rilayout al frame dopo
    if (on) requestAnimationFrame(() => this.layout());
  }

  setTarget(el) { this.targetEl = el; }

  // Le tessere 3D vivono finché vive il loro host DOM. Cambiando fase senza
  // buttarle restavano disegnate sotto la schermata nuova: è così che all'inizio
  // dell'express la ruota finiva sopra il tabellone del Triplete ancora a video.
  clear() {
    for (const mesh of this.tiles.values()) this.group.remove(mesh);
    this.tiles.clear();
    this.grid = null;
    this.targetEl = null;
    this.group.visible = false;
  }

  // `.screen.hidden` è opacity:0 ma resta nel layout, quindi né il rect né
  // l'opacità della griglia bastano a capire se siamo ancora a video: va guardata
  // la schermata che la ospita.
  _targetShowing() {
    const el = this.targetEl;
    if (!el || !el.isConnected || !this.tiles.size) return false;
    const screen = el.closest('.screen');
    if (screen && screen.classList.contains('hidden')) return false;
    return parseFloat(getComputedStyle(el).opacity) >= 0.5;
  }

  setBoard(grid) {
    for (const mesh of this.tiles.values()) this.group.remove(mesh);
    this.tiles.clear();
    this.grid = grid;
    // nota: ogni cella lettera/non-rivelata crea un MeshBasicMaterial bianco
    // dedicato (non condiviso) perché in update() il flip anima il colore di
    // material[4] per-tessera (flash ciano→bianco); condividerlo tra tessere
    // farebbe sì che l'animazione di una tessera ne tinga anche altre.
    // Il churn è quindi limitato a una creazione per cella per ogni setBoard()
    // (push del tabellone), non per frame: accettabile.
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
    // durante lo spin .wheel-zoom sfuma il board (e fra una fase e l'altra la
    // schermata ospite sparisce del tutto): in entrambi i casi via le tessere
    if (this._wantVisible) this.group.visible = this._targetShowing();
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
