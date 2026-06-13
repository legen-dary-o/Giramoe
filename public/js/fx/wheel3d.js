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
    if (this.group) {
      this.scene.remove(this.group);
      // libera geometrie/materiali/texture della ruota precedente (evita leak
      // sulla GPU ad ogni cambio etichette, es. round express)
      this.group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
        }
      });
    }
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
      // punti smorzati a grigio: fanno da texture, non competono con le
      // etichette bianche (la ruota di gioco deve restare leggibile da lontano)
      mat.uniforms.uDim.value = special ? 0.5 : 0.6;
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

    ctx.translate(cx, cx);

    // Separatori radiali tra gli spicchi: gap scuro con filo ciano al centro.
    // Disegnati sopra il tappeto di punti halftone, danno struttura ai 16 settori.
    for (let i = 0; i < this.segments; i++) {
      const a = -Math.PI / 2 + i * seg;
      ctx.save();
      ctx.rotate(a);
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(0,0,0,0.88)';
      ctx.lineWidth = SIZE * 0.013;
      ctx.beginPath(); ctx.moveTo(rr * 0.12, 0); ctx.lineTo(rr, 0); ctx.stroke();
      ctx.strokeStyle = ACCENT_CSS;
      ctx.lineWidth = SIZE * 0.0028;
      ctx.beginPath(); ctx.moveTo(rr * 0.12, 0); ctx.lineTo(rr, 0); ctx.stroke();
      ctx.restore();
    }

    // Cornice esterna ciano
    ctx.strokeStyle = 'rgba(48,184,255,0.5)';
    ctx.lineWidth = SIZE * 0.006;
    ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.stroke();

    // Etichette: testo grande con alone scuro → leggibile sopra i punti bianchi.
    for (let i = 0; i < this.segments; i++) {
      const label = this.labels[i];
      if (label == null) continue;
      const special = SPECIAL_STYLE[label];
      const mid = -Math.PI / 2 + i * seg + seg / 2;
      ctx.save();
      ctx.rotate(mid);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.95)';
      ctx.shadowBlur = SIZE * 0.014;
      if (special) {
        ctx.fillStyle = ACCENT_CSS;
        ctx.font = `700 ${rr * 0.15}px "Space Mono", monospace`;
        ctx.fillText(special.symbol, rr * 0.93, 0);
        ctx.font = `700 ${rr * 0.058}px "Space Mono", monospace`;
        ctx.fillText(special.word, rr * 0.62, 0);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.font = `700 ${rr * 0.11}px "Space Mono", monospace`;
        ctx.fillText(String(label).toUpperCase(), rr * 0.92, 0);
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
