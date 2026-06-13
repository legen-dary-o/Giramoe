// public/js/fx/titledots.js
// Reveal dei titoli (GIRAMOE / IL TRIPLETE / EXPRESS): una nuvola di punti
// converge a formare la parola, tiene, poi si disperde.
import * as THREE from '../../vendor/three.module.js';

const COUNT_MAX = 2200;

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
    const W = 1280, H = 320;
    const cnv = document.createElement('canvas');
    cnv.width = W; cnv.height = H;
    const ctx = cnv.getContext('2d');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    // adatta il corpo del font alla larghezza: parole lunghe (IL TRIPLETE)
    // altrimenti debordano dal canvas e perdono le lettere ai bordi
    let fontSize = 200;
    ctx.font = `800 ${fontSize}px Syne, sans-serif`;
    while (ctx.measureText(word).width > W * 0.92 && fontSize > 40) {
      fontSize -= 8;
      ctx.font = `800 ${fontSize}px Syne, sans-serif`;
    }
    ctx.fillText(word, W / 2, H / 2);
    const img = ctx.getImageData(0, 0, W, H).data;

    // raccoglie TUTTI i pixel pieni, poi ne campiona COUNT_MAX uniformemente:
    // così i punti coprono l'intera parola invece di esaurirsi sulle prime righe.
    const filled = [];
    for (let y = 0; y < H; y += 3) {
      for (let x = 0; x < W; x += 3) {
        if (img[(y * W + x) * 4 + 3] > 128) filled.push(x, y);
      }
    }
    const total = filled.length / 2;
    const n = Math.min(total, COUNT_MAX);
    const stride = total > 0 ? total / n : 1; // salta uniformemente se troppi pixel
    for (let k = 0; k < n; k++) {
      const idx = Math.floor(k * stride) * 2;
      const x = filled[idx], y = filled[idx + 1];
      this.target[k * 3] = ((x - W / 2) / W) * 9;          // larghezza ~9 unità
      this.target[k * 3 + 1] = ((H / 2 - y) / H) * 2.3 + 0.4;
      this.target[k * 3 + 2] = 0.5;
      // partenza: sparsi in una sfera larga
      this.pos[k * 3] = (Math.random() - 0.5) * 14;
      this.pos[k * 3 + 1] = (Math.random() - 0.5) * 8;
      this.pos[k * 3 + 2] = (Math.random() - 0.5) * 4;
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
