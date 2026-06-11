// Liquido al puntatore (stile Noomo): trail in un render target ping-pong con
// decadimento e diffusione; il pass finale distorce un gradiente scuro di base e
// aggiunge un highlight speculare freddo dove il campo è intenso.
// Layer sotto la UI (#fluid-canvas, z-index 0, pointer-events none).
// Si spegne con prefers-reduced-motion o senza WebGL; rAF in pausa dopo 3s fermi.

import * as THREE from '../../vendor/three.module.js';

const IDLE_MS = 3000;
const SIM_SCALE = 0.5; // sim a mezza risoluzione

const TRAIL_FRAG = `
  uniform sampler2D uPrev;
  uniform vec2 uPointer;     // uv
  uniform vec2 uVel;         // uv/frame
  uniform vec2 uTexel;
  uniform float uInject;     // 0/1
  varying vec2 vUv;

  void main() {
    // diffusione: media 4 vicini + decadimento
    vec3 c = texture2D(uPrev, vUv).rgb * 4.0;
    c += texture2D(uPrev, vUv + vec2(uTexel.x, 0.0)).rgb;
    c += texture2D(uPrev, vUv - vec2(uTexel.x, 0.0)).rgb;
    c += texture2D(uPrev, vUv + vec2(0.0, uTexel.y)).rgb;
    c += texture2D(uPrev, vUv - vec2(0.0, uTexel.y)).rgb;
    c /= 8.0;
    c *= 0.962;

    // iniezione gaussiana al puntatore, intensita' dalla velocita'
    vec2 d = vUv - uPointer;
    d.x *= uTexel.y / uTexel.x; // correggi aspect
    float dist2 = dot(d, d);
    float speed = min(length(uVel) * 13.0, 0.8);
    float blob = exp(-dist2 * 2400.0) * speed * uInject;
    c.r += blob;
    c.gb += uVel * blob * 6.0; // memorizza direzione per la distorsione

    gl_FragColor = vec4(c, 1.0);
  }
`;

const DRAW_FRAG = `
  uniform sampler2D uTrail;
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vec3 t = texture2D(uTrail, vUv).rgb;
    float field = t.r;

    // distorsione del gradiente di base lungo la direzione memorizzata
    vec2 offset = t.gb * 0.22 + vec2(field * 0.008);
    vec2 uv = vUv + offset;

    // base: il fondale tvOS (radiale freddo in alto + verticale scuro)
    float topGlow = smoothstep(1.25, 0.0, distance(uv, vec2(0.5, 1.08)));
    vec3 base = mix(vec3(0.047, 0.047, 0.055), vec3(0.071, 0.071, 0.078), uv.y);
    base += vec3(0.10, 0.12, 0.17) * topGlow * 0.32;

    // riflesso discreto: solo un velo freddo, niente "verme" luminoso
    float hi = smoothstep(0.10, 0.9, field);
    vec3 sheen = vec3(0.36, 0.44, 0.62) * hi * 0.07;

    gl_FragColor = vec4(base + sheen, 1.0);
  }
`;

const VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

export class FluidFX {
  constructor(canvas) {
    this.enabled = false;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { canvas.style.display = 'none'; return; }

    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    } catch {
      canvas.style.display = 'none';
      return;
    }
    this.canvas = canvas;
    this.renderer.setPixelRatio(1);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.PlaneGeometry(2, 2);

    this.trailMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: TRAIL_FRAG,
      uniforms: {
        uPrev: { value: null },
        uPointer: { value: new THREE.Vector2(-1, -1) },
        uVel: { value: new THREE.Vector2(0, 0) },
        uTexel: { value: new THREE.Vector2(0, 0) },
        uInject: { value: 0 }
      }
    });
    this.drawMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: DRAW_FRAG,
      uniforms: {
        uTrail: { value: null },
        uTime: { value: 0 }
      }
    });
    this.trailMesh = new THREE.Mesh(quad, this.trailMat);
    this.drawMesh = new THREE.Mesh(quad, this.drawMat);

    this.pointerUv = new THREE.Vector2(-1, -1);
    this.lastUv = new THREE.Vector2(-1, -1);
    this.lastMove = 0;
    this.running = false;
    this.enabled = true;

    this._resize();
    addEventListener('resize', () => this._resize());

    addEventListener('mousemove', (e) => {
      this.pointerUv.set(e.clientX / innerWidth, 1 - e.clientY / innerHeight);
      this.lastMove = performance.now();
      this._wake();
    }, { passive: true });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.running = false;
      else this._wake();
    });

    this._wake(); // primo paint del fondale
  }

  _resize() {
    if (!this.enabled) return;
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    const sw = Math.max(2, Math.floor(w * SIM_SCALE));
    const sh = Math.max(2, Math.floor(h * SIM_SCALE));
    const opts = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    if (this.rtA) { this.rtA.dispose(); this.rtB.dispose(); }
    this.rtA = new THREE.WebGLRenderTarget(sw, sh, opts);
    this.rtB = new THREE.WebGLRenderTarget(sw, sh, opts);
    this.trailMat.uniforms.uTexel.value.set(1 / sw, 1 / sh);
    this._wake();
  }

  // burst centrale (usato dalla title animation)
  burst() {
    if (!this.enabled) return;
    this.pointerUv.set(0.5, 0.5);
    this.lastUv.set(0.48, 0.5);
    this.lastMove = performance.now();
    this._wake();
  }

  setEnabled(on) {
    if (!this.renderer) return; // reduced-motion / niente WebGL: resta spento
    this.enabled = on;
    if (this.canvas) this.canvas.style.display = on ? '' : 'none';
    if (on) this._wake(); else this.running = false;
  }

  _wake() {
    if (!this.enabled || this.running) return;
    this.running = true;
    const tick = () => {
      if (!this.running) return;
      this._step();
      // pausa quando il liquido si e' spento e il mouse e' fermo da un po'
      if (performance.now() - this.lastMove > IDLE_MS) {
        this.running = false;
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  _step() {
    const u = this.trailMat.uniforms;
    if (this.lastUv.x < 0) this.lastUv.copy(this.pointerUv);
    u.uPointer.value.copy(this.pointerUv);
    u.uVel.value.set(this.pointerUv.x - this.lastUv.x, this.pointerUv.y - this.lastUv.y);
    u.uInject.value = this.pointerUv.x >= 0 ? 1 : 0;
    this.lastUv.copy(this.pointerUv);

    // ping-pong trail
    u.uPrev.value = this.rtA.texture;
    this.renderer.setRenderTarget(this.rtB);
    this.scene.add(this.trailMesh);
    this.renderer.render(this.scene, this.camera);
    this.scene.remove(this.trailMesh);
    [this.rtA, this.rtB] = [this.rtB, this.rtA];

    // pass finale a schermo
    this.drawMat.uniforms.uTrail.value = this.rtA.texture;
    this.drawMat.uniforms.uTime.value = performance.now() / 1000;
    this.renderer.setRenderTarget(null);
    this.scene.add(this.drawMesh);
    this.renderer.render(this.scene, this.camera);
    this.scene.remove(this.drawMesh);
  }
}
