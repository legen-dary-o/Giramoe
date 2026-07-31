// Mini-ruota del telefono: canvas 2D, stesso halftone della ruota grande.
//
// Resta 2D e non diventa WebGL: il handoff dice che in produzione la mini-ruota
// e' questa, e portarla a three.js vorrebbe dire un contesto WebGL su ogni
// telefono in sala per un disco da 196px. Cambia il disegno, non la tecnologia:
// spinTo / setLabels / resize / onSpinEnd restano identici perche' li usa
// player.js e le animazioni non si toccano.
//
// La faccia della ruota si disegna UNA volta in un canvas fuori schermo e poi si
// ruota con drawImage: durante un giro da 6 secondi ridisegnare qualche migliaio
// di punti a ogni frame farebbe scattare il telefono.

// Palette e simboli sono gli stessi di public/js/fx/wheel3d.js, che e' l'originale.
// Duplicati e non importati: questo file e' uno script classico e wheel3d.js un
// modulo, quindi importarlo obbligherebbe play.html a caricare three.js.
const SEGMENT_COLORS = [
  '#22c55e', '#4ade80', '#a3e635', '#eab308',
  '#f59e0b', '#f97316', '#ef4444', '#f43f5e',
  '#ec4899', '#d946ef', '#a855f7', '#8b5cf6',
  '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4'
];

// Niente emoji: 🚄 ha peso e allineamento diversi fra Android e iOS, e su un
// disco da 196px la differenza si vede.
const SPECIAL_STYLE = {
  bancarotta: { symbol: '✕' },
  next:       { symbol: '→' },
  raddoppia:  { symbol: '×2' },
  express:    { symbol: '»' }
};

const ACCENT = '#30b8ff';
const SPECIAL_DOT = 'rgb(168,204,224)'; // azzurro acciaio spento, come nel 3D

// Punti piu' saturi e piu' chiari del colore dello spicchio: sul fondo nero del
// settore un colore pieno non reggerebbe il contrasto.
function vividColor(hex, sat = 1.3, light = 0.34) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const avg = (r + g + b) / 3;
  r = avg + (r - avg) * sat; g = avg + (g - avg) * sat; b = avg + (b - avg) * sat;
  r += (255 - r) * light; g += (255 - g) * light; b += (255 - b) * light;
  const c = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}

class Wheel {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.segments = options.segments || 16;
    this.labels = options.labels || [];
    this.showLabels = options.showLabels !== false;
    this.radius = 0;
    this.rotation = 0;
    this.spinning = false;
    this.onSpinEnd = options.onSpinEnd || null;
    this.dpr = 1;
    this._face = null;

    this.resize();
  }

  // Cambia le etichette (il round express trasforma un PASSA in EXPRESS).
  setLabels(labels) {
    this.labels = labels || [];
    this._buildFace();
    this.draw();
  }

  resize() {
    const container = this.canvas.parentElement;
    const size = Math.min(container.clientWidth, container.clientHeight) * 0.96;
    const dpr = window.devicePixelRatio || 1;
    this.dpr = dpr;
    this.canvas.width = size * dpr;
    this.canvas.height = size * dpr;
    this.canvas.style.width = size + 'px';
    this.canvas.style.height = size + 'px';
    // Impostare canvas.width azzera la trasformazione: questo scale non si somma
    // a quelli dei resize precedenti.
    this.ctx.scale(dpr, dpr);
    this.radius = size / 2 - 4;
    this.centerX = size / 2;
    this.centerY = size / 2;
    this._buildFace();
    this.draw();
  }

  // Disegna la faccia della ruota in un canvas fuori schermo, alla risoluzione
  // del dispositivo. Passo dei punti e raggio sono in px CSS e non in frazione
  // del raggio: su un disco da 196px la densita' della TV darebbe punti da mezzo
  // pixel, cioe' una superficie grigia uniforme.
  _buildFace() {
    if (!(this.radius > 0)) return;
    const dpr = this.dpr;
    const S = Math.max(64, Math.round(this.radius * 2 * dpr));
    const rr = S / 2;
    const cnv = this._face || (this._face = document.createElement('canvas'));
    cnv.width = cnv.height = S;
    const c = cnv.getContext('2d');
    const seg = (2 * Math.PI) / this.segments;
    const TAU = Math.PI * 2;

    c.translate(rr, rr);
    c.beginPath();
    c.arc(0, 0, rr, 0, TAU);
    c.fillStyle = '#000000';
    c.fill();

    // Aspetto dei punti per spicchio: i numeri pieni e vivi, gli speciali in
    // acciaio spento cosi' il simbolo bianco sopra resta leggibile.
    const look = [];
    for (let i = 0; i < this.segments; i++) {
      const special = SPECIAL_STYLE[this.labels[i]];
      look.push(special
        ? { fill: SPECIAL_DOT, scale: 0.42, alpha: 0.55 }
        : { fill: vividColor(SEGMENT_COLORS[i % SEGMENT_COLORS.length]), scale: i % 2 ? 0.66 : 1, alpha: 1 });
    }

    const step = 5 * dpr;
    const dotR = 1.1 * dpr;
    const edge = rr * 0.985;
    for (let y = -rr; y <= rr; y += step) {
      for (let x = -rr; x <= rr; x += step) {
        if (Math.hypot(x, y) > edge) continue;
        // atan2 misura nel verso del canvas (y in giu'): +PI/2 porta lo spicchio 0
        // a ore 12, come nella ruota grande.
        const a = ((Math.atan2(y, x) + Math.PI / 2) % TAU + TAU) % TAU;
        const l = look[Math.floor(a / seg) % this.segments];
        c.globalAlpha = l.alpha;
        c.fillStyle = l.fill;
        c.beginPath();
        c.arc(x, y, dotR * l.scale, 0, TAU);
        c.fill();
      }
    }
    c.globalAlpha = 1;

    // Separatori: solco scuro con un filo ciano al centro. Danno struttura ai
    // sedici settori sopra al tappeto di punti.
    for (let i = 0; i < this.segments; i++) {
      const a = i * seg - Math.PI / 2;
      c.save();
      c.rotate(a);
      c.lineCap = 'round';
      c.strokeStyle = 'rgba(0,0,0,0.88)';
      c.lineWidth = Math.max(1, rr * 0.027);
      c.beginPath(); c.moveTo(rr * 0.12, 0); c.lineTo(rr, 0); c.stroke();
      c.strokeStyle = ACCENT;
      c.lineWidth = Math.max(0.6, rr * 0.006);
      c.beginPath(); c.moveTo(rr * 0.12, 0); c.lineTo(rr, 0); c.stroke();
      c.restore();
    }

    // Letto scuro sfumato sotto alle scritte: alza il contrasto senza spegnere
    // gli spicchi (nessun taglio netto, il gradiente parte trasparente).
    const band = c.createRadialGradient(0, 0, rr * 0.46, 0, 0, rr);
    band.addColorStop(0, 'rgba(0,0,0,0)');
    band.addColorStop(0.3, 'rgba(0,0,0,0.5)');
    band.addColorStop(1, 'rgba(0,0,0,0.5)');
    c.beginPath(); c.arc(0, 0, rr, 0, TAU);
    c.fillStyle = band; c.fill();

    // Ghiera
    c.strokeStyle = 'rgba(48,184,255,0.5)';
    c.lineWidth = Math.max(1, rr * 0.0125);
    c.beginPath(); c.arc(0, 0, rr * 0.995, 0, TAU); c.stroke();

    // Etichette radiali. Sugli speciali resta solo il simbolo: la parola
    // ("BANCAROTTA") starebbe a 5px e non si leggerebbe.
    if (this.showLabels) {
      c.textAlign = 'right';
      c.textBaseline = 'middle';
      c.fillStyle = '#ffffff';
      c.shadowColor = 'rgba(0,0,0,0.95)';
      c.shadowBlur = rr * 0.03;
      for (let i = 0; i < this.segments; i++) {
        const label = this.labels[i];
        if (label == null) continue;
        const special = SPECIAL_STYLE[label];
        c.save();
        c.rotate(i * seg - Math.PI / 2 + seg / 2);
        c.font = `700 ${rr * (special ? 0.17 : 0.13)}px "Space Mono", monospace`;
        c.fillText(special ? special.symbol : String(label).toUpperCase(), rr * 0.92, 0);
        c.restore();
      }
      c.shadowBlur = 0;
    }

    // Perni al bordo, uno per separatore
    for (let i = 0; i < this.segments; i++) {
      const a = i * seg - Math.PI / 2;
      const px = Math.cos(a) * rr * 0.985, py = Math.sin(a) * rr * 0.985;
      c.beginPath(); c.arc(px, py, Math.max(1.2, rr * 0.022), 0, TAU);
      c.fillStyle = 'rgba(48,184,255,0.95)';
      c.fill();
    }

    // Per ultimo, cosi' copre il punto dove convergono i sedici separatori.
    this._drawHub(c, rr);
  }

  // Mozzo piatto, lo stesso deciso per la ruota grande: disco scuro con un velo
  // di punti e un nucleo ciano. Niente cupola di vetro.
  _drawHub(c, rr) {
    const TAU = Math.PI * 2;
    const hubR = rr * 0.20;
    const oy = -hubR * 0.36;

    const disc = c.createRadialGradient(0, oy, hubR * 0.05, 0, oy, hubR * 1.3);
    disc.addColorStop(0, '#26343f');
    disc.addColorStop(0.52, '#131b22');
    disc.addColorStop(1, '#080d12');
    c.save();
    c.beginPath(); c.arc(0, 0, hubR, 0, TAU);
    c.fillStyle = disc; c.fill();
    c.clip();

    const step = Math.max(2, hubR * 0.13), dotR = Math.max(0.5, hubR * 0.03);
    c.fillStyle = '#ffffff';
    for (let y = -hubR; y <= hubR; y += step) {
      for (let x = -hubR; x <= hubR; x += step) {
        const d = Math.hypot(x, y) / hubR;
        if (d > 0.96) continue;
        c.globalAlpha = 0.2475 * (d <= 0.46 ? 1 : 1 - (d - 0.46) / 0.5);
        c.beginPath(); c.arc(x, y, dotR, 0, TAU); c.fill();
      }
    }
    c.globalAlpha = 1;

    const down = c.createLinearGradient(0, hubR * 0.1, 0, hubR);
    down.addColorStop(0, 'rgba(0,0,0,0)');
    down.addColorStop(1, 'rgba(0,0,0,0.9)');
    c.fillStyle = down; c.fillRect(-hubR, -hubR, hubR * 2, hubR * 2);
    c.restore();

    c.beginPath(); c.arc(0, 0, hubR, 0, TAU);
    c.strokeStyle = 'rgba(255,255,255,0.14)';
    c.lineWidth = Math.max(1, rr * 0.006);
    c.stroke();

    c.beginPath(); c.arc(0, 0, Math.max(1.2, rr * 0.023), 0, TAU);
    c.fillStyle = ACCENT; c.fill();
  }

  draw() {
    const ctx = this.ctx;
    const r = this.radius;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this._face || !(r > 0)) return;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);
    ctx.rotate(this.rotation);
    ctx.drawImage(this._face, -r, -r, r * 2, r * 2);
    ctx.restore();
  }

  // Gira in modo che `segmentIndex` finisca sotto la freccia in alto, partendo
  // dalla rotazione CORRENTE (la ruota accumula giri). `spins` sono i giri
  // interi in piu' dell'animazione.
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

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      this.rotation = startRotation + (targetRotation - startRotation) * eased;
      this.draw();

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.spinning = false;
        if (this.onSpinEnd) this.onSpinEnd();
      }
    };

    requestAnimationFrame(animate);
  }
}
