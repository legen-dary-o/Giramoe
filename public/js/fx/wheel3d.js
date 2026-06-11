// Ruota 3D (three.js) — drop-in per la Wheel 2D di wheel.js: stessa interfaccia
// (constructor(canvas, opts), spinTo, setLabels, resize, onSpinEnd, spinning).
// Estetica "candy glass": arcobaleno saturo lucido, ghiera cromata con led,
// cupola blu in vetro al centro, sheen di vetro fisso sulla faccia.

import * as THREE from '../../vendor/three.module.js';

// Arcobaleno candy: ordinato per tinta come la ruota del logo
const SEGMENT_COLORS = [
  '#ff2d2d', '#ff6a00', '#ffa600', '#ffd500',
  '#c8e600', '#6fd800', '#00c853', '#00c8a0',
  '#00c2d7', '#00a2ff', '#0066ff', '#4845ff',
  '#7d2dff', '#b620e0', '#e91e8c', '#ff3b5c'
];

// Stessa semantica degli "speciali" della ruota 2D.
const SPECIAL_STYLE = {
  bancarotta: { base: '#141416', text: '#ffffff', symbol: '✕',  word: 'BANCAROTTA' },
  next:       { base: '#8e8e96', text: '#ffffff', symbol: '→',  word: 'PASSA' },
  raddoppia:  { base: '#ffc400', text: '#3a2c00', symbol: '×2', word: 'RADDOPPIA' },
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
    // Neutral preserva la saturazione dei colori accesi (ACES li sbiadiva in pastello)
    this.renderer.toneMapping = THREE.NeutralToneMapping || THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    this.cameraBaseZ = 16.6; // metà altezza visibile ≈ 4.7 > raggio+ghiera (4.37)
    // leggera inclinazione dal basso: lo spessore del disco si legge
    this.camera.position.set(0, -1.5, this.cameraBaseZ);
    this.camera.lookAt(0, 0, 0);

    // Luci da studio: key fredda alta, fill laterali tenui, ambient bassa.
    // Niente point light speculare: creava un alone "glow" sugli spicchi.
    const key = new THREE.DirectionalLight(0xffffff, 2.3);
    key.position.set(-3, 6, 8);
    const fillA = new THREE.DirectionalLight(0x9fb8ff, 0.65);
    fillA.position.set(7, -2, 6);
    const fillB = new THREE.DirectionalLight(0xc9b8ff, 0.4);
    fillB.position.set(-7, -4, 5);
    const amb = new THREE.AmbientLight(0xffffff, 0.45);
    this.scene.add(key, fillA, fillB, amb);

    // Environment "studio" minimale: senza env i materiali metallici restano neri.
    // Cielo in gradiente + due softbox luminosi, precalcolati con PMREM.
    const envScene = new THREE.Scene();
    const skyCnv = document.createElement('canvas');
    skyCnv.width = 2; skyCnv.height = 128;
    const sg = skyCnv.getContext('2d').createLinearGradient(0, 0, 0, 128);
    sg.addColorStop(0, '#aab6cf');
    sg.addColorStop(0.55, '#3a4150');
    sg.addColorStop(1, '#15171d');
    const sctx = skyCnv.getContext('2d');
    sctx.fillStyle = sg;
    sctx.fillRect(0, 0, 2, 128);
    const skyTex = new THREE.CanvasTexture(skyCnv);
    skyTex.colorSpace = THREE.SRGBColorSpace;
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(20, 16, 12),
      new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide })
    );
    envScene.add(sky);
    // softbox larghi: sui materiali lucidi diventano i riflessi "finestra" del candy
    const boxMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const boxA = new THREE.Mesh(new THREE.PlaneGeometry(10, 3.5), boxMat);
    boxA.position.set(-5, 7, 6); boxA.lookAt(0, 0, 0);
    const boxB = new THREE.Mesh(new THREE.PlaneGeometry(6, 2.4), boxMat);
    boxB.position.set(7, -2, 7); boxB.lookAt(0, 0, 0);
    const boxC = new THREE.Mesh(new THREE.PlaneGeometry(12, 2), boxMat);
    boxC.position.set(0, 9, 4); boxC.lookAt(0, 0, 0);
    envScene.add(boxA, boxB, boxC);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(envScene, 0.04).texture;
    pmrem.dispose();
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
        roughness: 0.1,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
        envMapIntensity: 0.55 // tiene i colori saturi: l'env piena li sbiadiva
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.z = -DEPTH / 2;
      this.group.add(mesh);
    }

    // Ghiera cromata lucida con led bianchi, come la ruota del logo
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(R + 0.16, 0.26, 32, 128),
      new THREE.MeshPhysicalMaterial({ color: 0xeef3fa, metalness: 1, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.08 })
    );
    this.group.add(rim);

    const segAngle = (2 * Math.PI) / this.segments;
    const dotGeo = new THREE.SphereGeometry(0.075, 16, 12);
    const dotMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.4, roughness: 0.3 });
    for (let i = 0; i < this.segments; i++) {
      const theta = i * segAngle;
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.set(Math.sin(theta) * (R + 0.16), Math.cos(theta) * (R + 0.16), 0.24);
      this.group.add(dot);
    }

    // Separatori sottili cromati tra gli spicchi
    const dividerMat = new THREE.MeshStandardMaterial({ color: 0xdfe5ee, metalness: 1, roughness: 0.15 });
    for (let i = 0; i < this.segments; i++) {
      const theta = i * segAngle; // angolo orario dalle 12
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.022, R, 0.03), dividerMat);
      // sopra il bevel degli spicchi (che arriva a DEPTH/2 + bevelThickness)
      blade.position.set(Math.sin(theta) * R / 2, Math.cos(theta) * R / 2, DEPTH / 2 + 0.055);
      blade.rotation.z = -theta;
      this.group.add(blade);
    }

    // Hub: cupola blu in vetro lucido con anellino cromato alla base
    const hub = new THREE.Mesh(
      new THREE.SphereGeometry(1.0, 64, 48, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshPhysicalMaterial({ color: 0x1565ff, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05 })
    );
    hub.rotation.x = Math.PI / 2; // cupola verso la camera (+y → +z)
    hub.position.z = DEPTH / 2;
    hub.scale.y = 0.72; // appiattisce lungo il polo (asse y locale = profondita' dopo la rotazione)
    const hubRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.0, 0.035, 16, 64),
      new THREE.MeshPhysicalMaterial({ color: 0xeef3fa, metalness: 1, roughness: 0.12, clearcoat: 1 })
    );
    hubRing.position.z = DEPTH / 2 + 0.03;
    this.group.add(hub, hubRing);

    // Sheen di vetro fisso (non ruota con la ruota): velo bianco sull'arco alto
    if (!this._sheen) {
      const shCnv = document.createElement('canvas');
      shCnv.width = shCnv.height = 512;
      const sctx2 = shCnv.getContext('2d');
      const grad = sctx2.createLinearGradient(0, 0, 0, 512);
      grad.addColorStop(0, 'rgba(255,255,255,0.10)');
      grad.addColorStop(0.3, 'rgba(255,255,255,0.03)');
      grad.addColorStop(0.42, 'rgba(255,255,255,0)');
      sctx2.fillStyle = grad;
      sctx2.fillRect(0, 0, 512, 512);
      const shTex = new THREE.CanvasTexture(shCnv);
      this._sheen = new THREE.Mesh(
        new THREE.CircleGeometry(R * 0.99, 64),
        new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false })
      );
      this._sheen.position.z = DEPTH / 2 + 0.4;
      this._sheen.renderOrder = 10;
      this.scene.add(this._sheen);
    }

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
    this.camera.lookAt(0, 0, 0); // la camera è inclinata e il dolly cambia z
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

      // dolly leggero: avvicina a metà corsa senza mai tagliare il bordo
      // (mezza altezza visibile a z=15.7 ≈ 4.5 > raggio+ghiera 4.42)
      const dolly = Math.sin(progress * Math.PI) * 0.9;
      this.camera.position.z = this.cameraBaseZ - dolly;
      this.camera.lookAt(0, 0, 0);

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
