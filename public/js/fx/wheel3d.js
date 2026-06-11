// Ruota 3D (three.js) — drop-in per la Wheel 2D di wheel.js: stessa interfaccia
// (constructor(canvas, opts), spinTo, setLabels, resize, onSpinEnd, spinning).
// Estetica tvOS Dark Pro: spicchi clearcoat sui colori di sistema Apple,
// ghiera in alluminio, hub a cupola, luci da studio fredde.

import * as THREE from '../../vendor/three.module.js';

const SEGMENT_COLORS = [
  '#e0352b', '#e8890c', '#ecbf08', '#2fb350',
  '#0cb3ab', '#2b9fb5', '#2e9cd4', '#0871e8',
  '#4f4dc4', '#9d4ac8', '#e8294e', '#c20013',
  '#b32f00', '#20803a', '#00679a', '#312f96'
];

// Stessa semantica degli "speciali" della ruota 2D.
const SPECIAL_STYLE = {
  bancarotta: { base: '#141416', text: '#ffffff', symbol: '✕',  word: 'BANCAROTTA' },
  next:       { base: '#6e6e74', text: '#ffffff', symbol: '→',  word: 'PASSA' },
  raddoppia:  { base: '#d7a64a', text: '#2b2104', symbol: '×2', word: 'RADDOPPIA' },
  express:    { base: '#0a84ff', text: '#ffffff', symbol: '»',  word: 'EXPRESS' }
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
    this._raf = null;

    this._initScene();
    this._buildWheel();
    this.resize();
    this._render();
  }

  _initScene() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    this.cameraBaseZ = 16.4; // metà altezza visibile ≈ 4.7 > raggio+ghiera (4.37)
    this.camera.position.set(0, 0, this.cameraBaseZ);

    // Luci da studio: key fredda alta, fill laterali tenui, ambient bassa
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(-3, 6, 8);
    const fillA = new THREE.DirectionalLight(0x9fb8ff, 0.7);
    fillA.position.set(7, -2, 6);
    const fillB = new THREE.DirectionalLight(0xc9b8ff, 0.45);
    fillB.position.set(-7, -4, 5);
    const amb = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(key, fillA, fillB, amb);
  }

  _buildWheel() {
    if (this.group) this.scene.remove(this.group);
    this.group = new THREE.Group();

    const R = 4;             // raggio faccia
    const DEPTH = 0.42;      // spessore disco
    const seg = (2 * Math.PI) / this.segments;

    // Spicchi estrusi con bevel
    for (let i = 0; i < this.segments; i++) {
      const start = -Math.PI / 2 + i * seg; // segmento 0 in alto, come la 2D
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      const STEPS = 10;
      for (let s = 0; s <= STEPS; s++) {
        const a = start + (seg * s) / STEPS;
        shape.lineTo(Math.cos(a) * R, -Math.sin(a) * R); // y invertita: la scena guarda -z
      }
      shape.lineTo(0, 0);
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: DEPTH, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.03, bevelSegments: 2
      });
      const label = this.labels[i];
      const special = SPECIAL_STYLE[label];
      const color = special ? special.base : SEGMENT_COLORS[i % SEGMENT_COLORS.length];
      const mat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(color),
        roughness: 0.32,
        metalness: 0.05,
        clearcoat: 1,
        clearcoatRoughness: 0.25
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.z = -DEPTH / 2;
      this.group.add(mesh);
    }

    // Ghiera alluminio
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(R + 0.16, 0.21, 24, 96),
      new THREE.MeshStandardMaterial({ color: 0xb9bcc4, metalness: 0.92, roughness: 0.24 })
    );
    this.group.add(rim);

    // Hub a cupola
    const hub = new THREE.Mesh(
      new THREE.SphereGeometry(0.62, 48, 32, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshPhysicalMaterial({ color: 0xdfe2e8, metalness: 0.85, roughness: 0.18, clearcoat: 1 })
    );
    hub.rotation.x = -Math.PI / 2; // cupola verso la camera
    hub.position.z = DEPTH / 2;
    hub.scale.z = 0.55;
    this.group.add(hub);

    // Etichette: anello CanvasTexture appoggiato sulla faccia
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
    const rr = (SIZE / 2) * 0.96; // raggio in px texture ~ faccia

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
        ctx.fillStyle = special.text;
        ctx.font = `900 ${rr * 0.135}px -apple-system, "Helvetica Neue", sans-serif`;
        ctx.shadowColor = 'rgba(0,0,0,0.45)';
        ctx.shadowBlur = 8;
        ctx.fillText(special.symbol, rr * 0.92, 0);
        ctx.font = `700 ${rr * 0.052}px -apple-system, "Helvetica Neue", sans-serif`;
        ctx.fillText(special.word, rr * 0.6, 0);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.font = `800 ${rr * 0.095}px -apple-system, "Helvetica Neue", sans-serif`;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 6;
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
    this.group.rotation.z = -this.rotation; // mantieni l'orientamento corrente
    this._render();
  }

  resize() {
    const container = this.canvas.parentElement;
    if (!container) return;
    const size = Math.min(container.clientWidth, container.clientHeight) * 0.96;
    this.renderer.setSize(size, size, true);
    this.camera.aspect = 1;
    this.camera.updateProjectionMatrix();
    this._render();
  }

  _render() {
    // rotation 2D è oraria col canvas; in three la z è verso l'osservatore → segno opposto
    this.group.rotation.z = -this.rotation;
    this.renderer.render(this.scene, this.camera);
  }

  // Identica alla 2D: porta il centro di `segmentIndex` sotto il puntatore in alto,
  // accumulando la rotazione tra gli spin. Ease-out cubico + dolly della camera.
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

    // rAF con paracadute: se la tab è nascosta/throttlata, avanza via setTimeout
    // (l'easing è basato sul tempo, quindi il risultato resta corretto).
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

      // dolly: avvicina a metà corsa, torna alla base sul finale
      const dolly = Math.sin(progress * Math.PI) * 2.2;
      this.camera.position.z = this.cameraBaseZ - dolly;

      this._render();

      if (progress < 1) {
        schedule(animate);
      } else {
        this.camera.position.z = this.cameraBaseZ;
        this._render();
        this.spinning = false;
        if (this.onSpinEnd) this.onSpinEnd();
      }
    };

    schedule(animate);
  }
}
