// public/js/fx/dotfield.js
// Sfondo a punti dietro il palco: respiro idle + onde radiali sugli eventi
// (spin, risposta giusta = ciano, sbagliata = i punti si spengono sull'onda).
import * as THREE from '../../vendor/three.module.js';

const FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec2 uResolution;   // px device
  uniform float uPulseT;      // istante ultimo evento (s); -1000 = nessuno
  uniform float uPulseKind;   // 0 spin, 1 correct, 2 wrong
  float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    float cellSize = 12.0;
    vec2 cellId = floor(gl_FragCoord.xy / cellSize);
    vec2 local = fract(gl_FragCoord.xy / cellSize) - 0.5;
    float h = hash21(cellId);
    float base = 0.05 + 0.04 * sin(uTime * 1.4 + h * 6.2831);

    float age = uTime - uPulseT;
    vec2 center = uResolution * 0.5;
    float d = distance((cellId + 0.5) * cellSize, center);
    float ring = exp(-abs(d - age * 900.0) * 0.012) * exp(-age * 1.4) * step(0.0, age);

    float radius = base + ring * 0.45;
    float mask = smoothstep(radius + 0.06, radius - 0.06, length(local));
    vec3 col = vec3(1.0);
    if (uPulseKind > 0.5 && uPulseKind < 1.5) col = mix(col, vec3(0.188, 0.722, 1.0), clamp(ring * 3.0, 0.0, 1.0));
    if (uPulseKind > 1.5) mask *= 1.0 - clamp(ring * 2.5, 0.0, 0.85);
    gl_FragColor = vec4(col * mask * 0.5, 1.0);
  }
`;

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
        uPulseKind: { value: 0 }
      }
    });
    // quad fullscreen in clip space: ignora camera
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.mesh.renderOrder = -1;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }
  resize(w, h, dpr) { this.material.uniforms.uResolution.value.set(w * dpr, h * dpr); }
  pulse(kind) {
    this.material.uniforms.uPulseT.value = this._t ?? 0;
    this.material.uniforms.uPulseKind.value = { spin: 0, correct: 1, wrong: 2 }[kind] ?? 0;
  }
  update(t) { this._t = t; this.material.uniforms.uTime.value = t; }
}
