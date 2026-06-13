// public/js/fx/halftone.js
// Materiale "halftone yutaabe": punti screen-space modulati dalla luce, hover
// ciano al cursore, wireframe baricentrico con sweep. Condiviso da ruote e buste.
import * as THREE from '../../vendor/three.module.js';

export const ACCENT_CSS = '#30b8ff';
export const ACCENT = new THREE.Color(0.188, 0.722, 1.0);

const VERT = /* glsl */ `
  attribute vec3 aBary;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vBary;
  varying float vWorldY;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mv.xyz;
    vBary = aBary;
    vWorldY = (modelMatrix * vec4(position, 1.0)).y;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec2 uCursor;       // px device, origine basso-sinistra (come gl_FragCoord)
  uniform float uIsTouch;     // 1 = niente cursore (TV): hover spento
  uniform float uCellSize;    // px device
  uniform float uDotScale;    // moltiplicatore raggio punti (alternanza spicchi)
  uniform float uHoverRadius; // px device
  uniform float uSweepY;      // quota world del fronte wireframe (-1000 = spento)
  uniform float uDim;         // 1 normale, <1 attenua (buste abbandonate)
  uniform vec3 uAccent;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vBary;
  varying float vWorldY;

  float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  void main() {
    vec3 n = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);
    vec3 lightDir = normalize(vec3(-0.4, 0.7, 0.6));
    vec3 halfVec = normalize(lightDir + viewDir);
    float diff = max(dot(n, lightDir), 0.0);
    float spec = pow(max(dot(n, halfVec), 0.0), 30.0);
    float lightShaped = pow(diff, 0.85) * 0.85 + 0.06;

    // --- halftone screen-space ---
    vec2 cellId = floor(gl_FragCoord.xy / uCellSize);
    vec2 cellLocal = fract(gl_FragCoord.xy / uCellSize) - 0.5;
    float dotDist = length(cellLocal);
    float h1 = hash21(cellId);
    float h2 = fract(sin(dot(cellId, vec2(91.34, 47.71))) * 28471.13);
    float pulseA = sin(uTime * 2.2 + h1 * 6.2831) * 0.5 + 0.5;
    float pulseB = sin(uTime * 1.3 + h2 * 6.2831) * 0.5 + 0.5;

    float cursorDist = distance((cellId + 0.5) * uCellSize, uCursor);
    float cursor = (1.0 - smoothstep(0.0, uHoverRadius, cursorDist)) * (1.0 - uIsTouch);

    float dotRadius = (lightShaped * 0.6
        + (pulseA - 0.5) * 0.10 * lightShaped
        + (pulseB - 0.5) * 0.06 * lightShaped) * uDotScale
        + cursor * 0.35;
    float dotMask = smoothstep(dotRadius + 0.08, dotRadius - 0.08, dotDist);
    vec3 dotColor = mix(vec3(1.0), uAccent, cursor);
    vec3 hot = vec3(0.4, 0.75, 1.0) * pow(spec, 1.2) * 2.0 * (1.0 - cursor);
    vec3 col = mix(vec3(0.0), dotColor + hot, dotMask);

    // --- wireframe baricentrico con sweep ---
    float minBary = min(min(vBary.x, vBary.y), vBary.z);
    float wire = 1.0 - smoothstep(0.0, 0.04, minBary);
    float edgeNoise = vnoise(vec2(vWorldY * 3.0, uTime * 0.8)) * 2.0 - 1.0;
    float frontDist = vWorldY - uSweepY + edgeNoise * 0.15;
    float inWire = smoothstep(0.07, -0.07, frontDist);
    float wireBrightness = 0.15 + diff * 0.5 + spec * 2.0;
    float travel = pow(1.0 - abs(fract(vViewPosition.y * 4.0 - uTime * 0.6) - 0.5) * 2.0, 12.0);
    col += (vec3(wireBrightness) + uAccent * travel * 0.6) * wire * inWire * 0.8;

    gl_FragColor = vec4(col * uDim, 1.0);
  }
`;

// Le geometrie devono essere non-indicizzate, con attributo aBary per il wireframe.
export function addBarycentric(geometry) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const count = g.attributes.position.count;
  const bary = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 3) {
    bary.set([1, 0, 0], i * 3);
    bary.set([0, 1, 0], (i + 1) * 3);
    bary.set([0, 0, 1], (i + 2) * 3);
  }
  g.setAttribute('aBary', new THREE.BufferAttribute(bary, 3));
  return g;
}

export function createHalftoneMaterial(opts = {}) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uTime: { value: 0 },
      uCursor: { value: new THREE.Vector2(-1e5, -1e5) },
      uIsTouch: { value: opts.isTouch ? 1 : 0 },
      uCellSize: { value: (opts.cellSize ?? 9) * dpr },
      uDotScale: { value: opts.dotScale ?? 1 },
      uHoverRadius: { value: (opts.hoverRadius ?? 220) * dpr },
      uSweepY: { value: -1000 },
      uDim: { value: 1 },
      uAccent: { value: ACCENT.clone() }
    }
  });
}
