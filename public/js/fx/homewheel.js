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
    // z=33: la ruota ~45% dell'altezza viewport, resta nel gap tra wordmark e bottone
    this.camera.position.set(0, 0, 33);
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
