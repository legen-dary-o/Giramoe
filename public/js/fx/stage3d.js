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
