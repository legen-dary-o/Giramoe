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
