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

// Palette arcobaleno degli spicchi (stessa della mini ruota del player, wheel.js):
// colora i punti halftone così i 16 settori si distinguono da lontano (ibrido
// halftone × colore). Gli speciali restano in tinta neutra fredda.
const SEGMENT_COLORS = [
  '#22c55e', '#4ade80', '#a3e635', '#eab308',
  '#f59e0b', '#f97316', '#ef4444', '#f43f5e',
  '#ec4899', '#d946ef', '#a855f7', '#8b5cf6',
  '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4'
];
const SPECIAL_DOT = new THREE.Color(0.66, 0.80, 0.88); // azzurro acciaio spento

// Rende un colore #rrggbb più vivido (più saturo + schiarito) per i punti, così
// reggono il contrasto sul fondo nero del settore. Ritorna un THREE.Color.
function vividColor(hex, sat = 1.3, light = 0.34) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const avg = (r + g + b) / 3;
  r = avg + (r - avg) * sat; g = avg + (g - avg) * sat; b = avg + (b - avg) * sat;
  r += (255 - r) * light; g += (255 - g) * light; b += (255 - b) * light;
  const c = (v) => Math.max(0, Math.min(255, v)) / 255;
  return new THREE.Color(c(r), c(g), c(b));
}

export class Wheel3D {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.segments = options.segments || 16;
    this.labels = options.labels || [];
    this.showLabels = options.showLabels !== false;
    this.onSpinEnd = options.onSpinEnd || null;
    this.rotation = 0;       // radianti, stessa convenzione della 2D
    this.spinning = false;

    // Freccia/flapper opzionale (elemento DOM): fa l'attrito sui perni mentre
    // la ruota gira. Stato della molla-smorzatore aggiornato in _tick.
    this.indicator = options.indicator || null;
    this._flapA = 0;         // angolo flap (rad)
    this._flapV = 0;         // velocità angolare flap
    this._flapLast = performance.now();
    this._R = 4;             // raggio mondo della ruota (per proiettare gli overlay)

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
      // niente hover sulla TV (isTouch). Punti colorati col colore dello spicchio
      // (ibrido halftone × colore): i 16 settori si distinguono a colpo d'occhio.
      const mat = createHalftoneMaterial({
        isTouch: true,
        dotScale: special ? 0.42 : (i % 2 ? 0.66 : 1.0),
        tint: special ? SPECIAL_DOT : vividColor(SEGMENT_COLORS[i % SEGMENT_COLORS.length])
      });
      // numeri: punti pieni e vivi; speciali: tinta neutra spenta così le scritte
      // bianche restano leggibili (la ruota deve leggersi da lontano)
      mat.uniforms.uDim.value = special ? 0.55 : 1.0;
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

    // Fascia scura sfumata dietro alle scritte: gradiente radiale, trasparente
    // verso il centro → scuro verso il bordo (no taglio netto). Fa da letto al
    // testo sopra i punti colorati, alza il contrasto senza spegnere gli spicchi.
    const bandStart = rr * 0.46;
    const band = ctx.createRadialGradient(0, 0, bandStart, 0, 0, rr);
    band.addColorStop(0, 'rgba(0,0,0,0)');
    band.addColorStop(0.296, 'rgba(0,0,0,0.5)'); // pieno a ~rr*0.62
    band.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.fillStyle = band; ctx.fill();

    // Cornice esterna ciano
    ctx.strokeStyle = 'rgba(48,184,255,0.5)';
    ctx.lineWidth = SIZE * 0.006;
    ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.stroke();

    // Etichette: testo grande con alone scuro → leggibile sopra i punti colorati.
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
        // simbolo + parola in bianco (come i numeri): la fascia scura li regge
        ctx.fillStyle = '#ffffff';
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

    // Perni al bordo, uno per separatore: ruotano con la ruota e passano sotto
    // la freccia, che ci fa l'attrito (vedi animazione flap in _tick).
    for (let i = 0; i < this.segments; i++) {
      const a = -Math.PI / 2 + i * seg;
      const px = Math.cos(a) * rr * 0.985, py = Math.sin(a) * rr * 0.985;
      ctx.beginPath(); ctx.arc(px, py, SIZE * 0.013, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(48,184,255,0.95)';
      ctx.shadowColor = 'rgba(48,184,255,0.9)'; ctx.shadowBlur = SIZE * 0.012;
      ctx.fill();
      ctx.beginPath(); ctx.arc(px, py, SIZE * 0.006, 0, Math.PI * 2);
      ctx.shadowBlur = 0; ctx.fillStyle = '#eaffff'; ctx.fill();
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
    this._layoutOverlay();
  }

  // Proietta il disco 3D in pixel CSS ed espone centro+raggio come variabili sul
  // container (--disc-cx/--disc-cy/--disc-r). Ghiera e freccia (overlay CSS) si
  // allineano così al disco reale, dolly dello spin compreso.
  _layoutOverlay() {
    const cont = this.canvas.offsetParent || this.canvas.parentElement;
    if (!cont) return;
    const sizeCss = this.canvas.clientWidth;
    if (!sizeCss) return;
    const R = this._R;
    const pr = (x, y) => {
      const v = new THREE.Vector3(x, y, 0).project(this.camera);
      return { x: (v.x * 0.5 + 0.5) * sizeCss, y: (-v.y * 0.5 + 0.5) * sizeCss };
    };
    const l = pr(-R, 0), r = pr(R, 0), t = pr(0, R), b = pr(0, -R);
    const cx = (l.x + r.x) / 2, cy = (t.y + b.y) / 2;
    const rad = ((r.x - l.x) / 2 + (b.y - t.y) / 2) / 2;
    cont.style.setProperty('--disc-cx', (this.canvas.offsetLeft + cx) + 'px');
    cont.style.setProperty('--disc-cy', (this.canvas.offsetTop + cy) + 'px');
    cont.style.setProperty('--disc-r', rad + 'px');
  }

  // Freccia/flapper: molla-smorzatore spinta dai perni. La posizione nel
  // segmento (ph) cresce mentre un perno si avvicina al puntatore e scatta a 0
  // quando passa → spinta + rimbalzo proporzionali alla velocità. A ruota ferma
  // torna dritta (target 0).
  _updateFlap(now) {
    if (!this.indicator) return;
    const dt = Math.min((now - this._flapLast) / 1000, 0.05);
    this._flapLast = now;
    const seg = (2 * Math.PI) / this.segments;
    let ph = this.rotation / seg; ph -= Math.floor(ph);
    const target = this.spinning ? 0.34 * Math.pow(ph, 1.7) : 0;
    this._flapV += (target - this._flapA) * 170 * dt;
    this._flapV *= Math.pow(0.84, dt * 60);
    this._flapA += this._flapV * dt;
    this.indicator.style.transform = `translateX(-50%) rotate(${this._flapA}rad)`;
  }

  // Loop continuo: i punti pulsano anche da ferma. Durante lo spin la rotazione
  // è guidata da spinTo (che ha il suo scheduler col paracadute anti-throttle).
  _tick(now) {
    requestAnimationFrame(this._tick);
    const t = (now - this._t0) / 1000;
    for (const m of this._materials) m.uniforms.uTime.value = t;
    this.group.rotation.z = -this.rotation;
    this.camera.lookAt(0, 0, 0);
    this._updateFlap(now);
    this._layoutOverlay();
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
