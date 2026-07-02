// public/js/fx/envelopes3d.js
// Le 3 buste finali: corpi halftone che fluttuano al centro, la scelta corrente
// avanza verso la camera, l'apertura alza il lembo e mostra il contenuto.
// Mappa colori mono: green (vinta) → ciano, red → bianco spento.
import * as THREE from '../../vendor/three.module.js';
import { createHalftoneMaterial, addBarycentric, ACCENT_CSS } from './halftone.js';

const W = 1.7, H = 1.15, D = 0.07;
const X_SLOTS = [-2.4, 0, 2.4];
// scritta: parte dentro la busta, sale a fermarsi sopra il bordo alto (niente sovrapposizione)
const CONTENT_Y_IN = -H * 0.1;
const CONTENT_Y_OUT = H / 2 + (H * 0.6) / 2 + 0.43; // sopra anche il lembo aperto

export class Envelopes3D {
  constructor(scene, stage) {
    this.stage = stage;
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    this.items = [];
    for (let i = 0; i < 3; i++) this.items.push(this._buildEnvelope(i));
    this.view = null;
  }

  _buildEnvelope(i) {
    const root = new THREE.Group();
    root.position.set(X_SLOTS[i], 0, 0);

    const bodyMat = createHalftoneMaterial({ isTouch: true, dotScale: 0.85, cellSize: 7 });
    const body = new THREE.Mesh(addBarycentric(new THREE.BoxGeometry(W, H, D)), bodyMat);
    root.add(body);

    // bordo: comunica lo stato (corrente/rivelata) col colore
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(W, H, D)),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 })
    );
    root.add(edges);

    // lembo triangolare incernierato sul bordo alto
    const flapShape = new THREE.Shape();
    flapShape.moveTo(-W / 2, 0); flapShape.lineTo(W / 2, 0); flapShape.lineTo(0, -H * 0.52); flapShape.closePath();
    const flapMat = createHalftoneMaterial({ isTouch: true, dotScale: 0.55, cellSize: 7 });
    const flap = new THREE.Mesh(addBarycentric(new THREE.ExtrudeGeometry(flapShape, { depth: 0.02, bevelEnabled: false })), flapMat);
    const hinge = new THREE.Group();
    hinge.position.set(0, H / 2, D / 2 + 0.012);
    hinge.add(flap);
    root.add(hinge);

    const num = this._textPlane(String(i + 1), 0.5, 0.5, '700 150px "Space Mono", monospace', ACCENT_CSS);
    num.position.set(0, -H * 0.78, D / 2 + 0.02);
    root.add(num);

    const content = this._textPlane('', W * 0.92, H * 0.6, '700 56px "Space Mono", monospace', '#f5f5f7');
    content.position.set(0, CONTENT_Y_IN, D / 2 + 0.03);
    content.material.opacity = 0;
    content.visible = false;
    root.add(content);

    this.group.add(root);
    return { root, bodyMat, flapMat, edges, hinge, content, num, flapOpen: 0, targetZ: 0, targetScale: 1, contentRise: 0, contentRiseTarget: 0 };
  }

  _textPlane(text, w, h, font, color) {
    const cnv = document.createElement('canvas');
    cnv.width = 512; cnv.height = Math.round(512 * (h / w));
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ transparent: true })
    );
    mesh.userData = { cnv, font, color };
    this._drawText(mesh, text);
    return mesh;
  }

  _drawText(mesh, text) {
    const { cnv, font, color } = mesh.userData;
    const ctx = cnv.getContext('2d');
    ctx.clearRect(0, 0, cnv.width, cnv.height);
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // wrapping semplice per i contenuti lunghi
    const words = String(text).split(' ');
    const lines = [];
    let line = '';
    for (const wd of words) {
      const probe = line ? line + ' ' + wd : wd;
      if (ctx.measureText(probe).width > cnv.width * 0.9 && line) { lines.push(line); line = wd; }
      else line = probe;
    }
    if (line) lines.push(line);
    const lh = parseInt(font.match(/(\d+)px/)[1], 10) * 1.15;
    lines.forEach((l, i) => ctx.fillText(l, cnv.width / 2, cnv.height / 2 + (i - (lines.length - 1) / 2) * lh));
    if (mesh.material.map) mesh.material.map.dispose();
    mesh.material.map = new THREE.CanvasTexture(cnv);
    mesh.material.needsUpdate = true;
  }

  setVisible(on) { this.group.visible = on; }

  set(view) {
    this.view = view;
    const kept = view.state === 'KEPT';
    view.envelopes.forEach((e, i) => {
      const it = this.items[i];
      const isCurrent = i === view.current;
      // Keeping collapses the display to the chosen one: the others shrink and recede —
      // EXCEPT a revealed one (a red the admin opened), which stays on stage with its text.
      const goneAway = kept && !isCurrent && !e.revealed;
      it.targetZ = goneAway ? -4 : (isCurrent ? (kept ? 1.3 : 0.9) : 0);
      it.targetScale = goneAway ? 0.001 : (isCurrent ? (kept ? 1.3 : 1.12) : 1);
      it.flapTarget = e.revealed ? -2.4 : 0;
      it.bodyMat.uniforms.uDim.value = e.abandoned ? 0.3 : 1;
      it.flapMat.uniforms.uDim.value = e.abandoned ? 0.3 : 1;
      const showContent = !!e.revealed && !goneAway;
      it.contentRiseTarget = showContent ? 1 : 0;
      if (showContent) {
        it.content.visible = true;
        this._drawText(it.content, e.content || (e.color === 'red' ? '✕' : ''));
      }
      // bordo: rivelata green → ciano, red → bianco spento, corrente → bianco pieno
      const edgeColor = e.revealed ? (e.color === 'green' ? ACCENT_CSS : '#9a9aa0') : '#ffffff';
      it.edges.material.color.set(edgeColor);
      it.edges.material.opacity = i === view.current || e.revealed ? 0.95 : 0.35;
    });
  }

  update(t) {
    this.items.forEach((it, i) => {
      // fluttuazione: fase diversa per busta
      it.root.position.y = Math.sin(t * 0.7 + i * 2.1) * 0.12;
      it.root.rotation.y = Math.sin(t * 0.4 + i * 1.3) * 0.07;
      it.root.position.z += ((it.targetZ ?? 0) - it.root.position.z) * 0.08;
      const s = it.targetScale ?? 1;
      it.root.scale.x += (s - it.root.scale.x) * 0.08;
      it.root.scale.y = it.root.scale.z = it.root.scale.x;
      it.hinge.rotation.x += ((it.flapTarget ?? 0) - it.hinge.rotation.x) * 0.07;
      // scritta: sale fuori dalla busta e si ferma sopra, dissolvenza in entrata
      it.contentRise += ((it.contentRiseTarget ?? 0) - it.contentRise) * 0.08;
      it.content.position.y = CONTENT_Y_IN + (CONTENT_Y_OUT - CONTENT_Y_IN) * it.contentRise;
      it.content.material.opacity = it.contentRise;
      if (it.contentRise < 0.01 && (it.contentRiseTarget ?? 0) === 0) it.content.visible = false;
      it.bodyMat.uniforms.uTime.value = t;
      it.flapMat.uniforms.uTime.value = t;
    });
  }
}
