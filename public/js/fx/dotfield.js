// public/js/fx/dotfield.js
// Sfondo a punti dietro il palco: respiro idle + onde radiali sugli eventi
// (spin, risposta giusta = ciano, sbagliata = i punti si spengono sull'onda).
//
// Il campo ha un BUCO ellittico al centro, diverso per schermata: era il difetto
// dichiarato dal committente — il tappeto di punti passava dietro al testo e lo
// rendeva illeggibile. Il buco sta qui e non in un livello DOM sopra, perché il
// tappeto è questo: sovrapporne un secondo raddoppierebbe i punti, e spegnere
// questo porterebbe via anche le onde.
import * as THREE from '../../vendor/three.module.js';

const FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec2 uResolution;   // px device
  uniform float uPulseT;      // istante ultimo evento (s); -1000 = nessuno
  uniform float uPulseKind;   // 0 spin, 1 correct, 2 wrong
  uniform vec2 uHole;         // semiassi dell'ellisse, in frazione di viewport
  uniform vec2 uHoleAt;       // centro dell'ellisse (coordinate CSS, y in giù)
  uniform vec2 uHoleStop;     // raggio trasparente → raggio opaco
  uniform float uAmp;         // opacità del campo per questa schermata
  float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    // passo 7px e punti da 1.6px: la stessa trama del resto del sistema
    float cellSize = 7.0;
    vec2 cellId = floor(gl_FragCoord.xy / cellSize);
    vec2 local = fract(gl_FragCoord.xy / cellSize) - 0.5;
    float h = hash21(cellId);
    float base = 0.114 + 0.03 * sin(uTime * 1.4 + h * 6.2831);

    float age = uTime - uPulseT;
    vec2 center = uResolution * 0.5;
    float d = distance((cellId + 0.5) * cellSize, center);
    float ring = exp(-abs(d - age * 900.0) * 0.012) * exp(-age * 1.4) * step(0.0, age);

    float radius = base + ring * 0.45;
    float mask = smoothstep(radius + 0.06, radius - 0.06, length(local));

    // buco ellittico: stessa convenzione di radial-gradient(ellipse X% Y% at ...)
    vec2 uv = vec2(gl_FragCoord.x / uResolution.x, 1.0 - gl_FragCoord.y / uResolution.y);
    float r = length((uv - uHoleAt) / uHole);
    mask *= smoothstep(uHoleStop.x, uHoleStop.y, r);

    vec3 col = vec3(1.0);
    if (uPulseKind > 0.5 && uPulseKind < 1.5) col = mix(col, vec3(0.188, 0.722, 1.0), clamp(ring * 3.0, 0.0, 1.0));
    if (uPulseKind > 1.5) mask *= 1.0 - clamp(ring * 2.5, 0.0, 0.85);
    gl_FragColor = vec4(col * mask * 0.55 * uAmp, 1.0);
  }
`;

// Maschere per schermata, dal handoff (§ "halftone che non copre più il testo").
// hole = semiassi, at = centro, stop = trasparente → opaco, amp = opacità.
const HOLES = {
  'lobby-screen':     { hole: [0.44, 0.40], at: [0.50, 0.52], stop: [0.52, 0.88], amp: 0.40 },
  'game-screen':      { hole: [0.56, 0.46], at: [0.50, 0.50], stop: [0.58, 0.92], amp: 0.34 },
  'triplete-screen':  { hole: [0.52, 0.44], at: [0.54, 0.48], stop: [0.56, 0.90], amp: 0.34 },
  'final-screen':     { hole: [0.54, 0.44], at: [0.50, 0.48], stop: [0.56, 0.90], amp: 0.32 },
  'envelopes-screen': { hole: [0.50, 0.42], at: [0.50, 0.52], stop: [0.54, 0.88], amp: 0.34 }
};
// Schermate senza contenuto al centro (titoli, finalista): campo pieno.
const FULL = { hole: [1, 1], at: [0.5, 0.5], stop: [0, 0.001], amp: 0.34 };

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
        uPulseKind: { value: 0 },
        uHole: { value: new THREE.Vector2(...FULL.hole) },
        uHoleAt: { value: new THREE.Vector2(...FULL.at) },
        uHoleStop: { value: new THREE.Vector2(...FULL.stop) },
        uAmp: { value: FULL.amp }
      }
    });
    // quad fullscreen in clip space: ignora camera
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.mesh.renderOrder = -1;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }
  resize(w, h, dpr) { this.material.uniforms.uResolution.value.set(w * dpr, h * dpr); }

  // Buco al centro dove vive il contenuto della schermata.
  setScreen(id) {
    const m = HOLES[id] || FULL;
    const u = this.material.uniforms;
    u.uHole.value.set(...m.hole);
    u.uHoleAt.value.set(...m.at);
    u.uHoleStop.value.set(...m.stop);
    u.uAmp.value = m.amp;
  }
  pulse(kind) {
    this.material.uniforms.uPulseT.value = this._t ?? 0;
    this.material.uniforms.uPulseKind.value = { spin: 0, correct: 1, wrong: 2 }[kind] ?? 0;
  }
  update(t) { this._t = t; this.material.uniforms.uTime.value = t; }
}
