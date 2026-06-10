const SEGMENT_COLORS = [
  '#22c55e', '#4ade80', '#a3e635', '#eab308',
  '#f59e0b', '#f97316', '#ef4444', '#f43f5e',
  '#ec4899', '#d946ef', '#a855f7', '#8b5cf6',
  '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4'
];

// Special segments get a dedicated italic/black font, a big glyph and a small word,
// plus a distinct gradient + glow so they read as "special" at a glance.
const SPECIAL_STYLE = {
  bancarotta: { base: '#141414', edge: '#000000', text: '#ffffff', glow: 'rgba(239,68,68,0.95)', symbol: '✕',  word: 'BANCAROTTA' },
  next:       { base: '#aab2c0', edge: '#717a8a', text: '#ffffff', glow: 'rgba(255,255,255,0.55)', symbol: '→', word: 'PASSA' },
  raddoppia:  { base: '#ffd24a', edge: '#e0a200', text: '#5a3d00', glow: 'rgba(255,236,150,0.95)', symbol: '×2', word: 'RADDOPPIA' },
  express:    { base: '#0ea5e9', edge: '#0369a1', text: '#ffffff', glow: 'rgba(125,225,255,0.95)', symbol: '🚄', word: 'EXPRESS' }
};

// Lighten (pct > 0) or darken (pct < 0) a #rrggbb color.
function shade(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (pct >= 0) { r += (255 - r) * pct; g += (255 - g) * pct; b += (255 - b) * pct; }
  else { r *= 1 + pct; g *= 1 + pct; b *= 1 + pct; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
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

    this.resize();
    this.draw();
  }

  // Swap the segment labels (e.g. when the express round changes the wheel) and redraw.
  setLabels(labels) {
    this.labels = labels || [];
    this.draw();
  }

  resize() {
    const container = this.canvas.parentElement;
    const size = Math.min(container.clientWidth, container.clientHeight) * 0.96;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = size * dpr;
    this.canvas.height = size * dpr;
    this.canvas.style.width = size + 'px';
    this.canvas.style.height = size + 'px';
    this.ctx.scale(dpr, dpr);
    this.radius = size / 2 - 4;
    this.centerX = size / 2;
    this.centerY = size / 2;
    this.draw();
  }

  draw() {
    const ctx = this.ctx;
    const cx = this.centerX;
    const cy = this.centerY;
    const r = this.radius;
    const bezelW = Math.max(6, r * 0.06);
    const segR = r - bezelW;            // segments fill up to here; bezel sits outside
    const segAngle = (2 * Math.PI) / this.segments;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.translate(cx, cy);

    // ===== Rotating wheel: segments + labels =====
    ctx.save();
    ctx.rotate(this.rotation);

    for (let i = 0; i < this.segments; i++) {
      const startAngle = i * segAngle - Math.PI / 2;
      const endAngle = startAngle + segAngle;
      const label = this.labels[i];
      const special = SPECIAL_STYLE[label];

      // Base fill (radial gradient for specials, flat rainbow for numbers)
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, segR, startAngle, endAngle);
      ctx.closePath();
      if (special) {
        const g = ctx.createRadialGradient(0, 0, segR * 0.12, 0, 0, segR);
        g.addColorStop(0, special.base);
        g.addColorStop(1, special.edge);
        ctx.fillStyle = g;
      } else {
        const c = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
        const g = ctx.createRadialGradient(0, 0, segR * 0.12, 0, 0, segR);
        g.addColorStop(0, shade(c, 0.42));
        g.addColorStop(0.55, c);
        g.addColorStop(1, shade(c, -0.16));
        ctx.fillStyle = g;
      }
      ctx.fill();

      // Glossy sheen: bright center, faint mid, darker rim (glass dome)
      const sheen = ctx.createRadialGradient(0, 0, segR * 0.15, 0, 0, segR);
      sheen.addColorStop(0, 'rgba(255,255,255,0.28)');
      sheen.addColorStop(0.5, 'rgba(255,255,255,0.05)');
      sheen.addColorStop(0.86, 'rgba(0,0,0,0)');
      sheen.addColorStop(1, 'rgba(0,0,0,0.14)');
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, segR, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = sheen;
      ctx.fill();

      // Bright glass divider
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, segR, startAngle, endAngle);
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      if (this.showLabels && label != null) {
        const midAngle = startAngle + segAngle / 2;
        ctx.save();
        ctx.rotate(midAngle);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        if (special) {
          // Big glyph near the rim
          ctx.save();
          ctx.fillStyle = special.text;
          ctx.font = `italic 900 ${segR * 0.135}px "Arial Black", Arial, sans-serif`;
          if (special.glow) { ctx.shadowColor = special.glow; ctx.shadowBlur = 10; }
          ctx.fillText(special.symbol, segR * 0.93, 0);
          ctx.restore();
          // Small word further in
          ctx.fillStyle = special.text;
          ctx.font = `italic bold ${segR * 0.05}px "Arial Black", Arial, sans-serif`;
          ctx.shadowColor = 'rgba(0,0,0,0.4)';
          ctx.shadowBlur = 2;
          const w = this.truncateText(ctx, special.word, segR * 0.44);
          ctx.fillText(w, segR * 0.58, 0);
        } else {
          ctx.fillStyle = '#ffffff';
          ctx.font = `800 ${segR * 0.092}px -apple-system, "SF Pro Display", sans-serif`;
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 5;
          ctx.shadowOffsetY = 1.5;
          ctx.fillText(String(label).toUpperCase(), segR * 0.9, 0);
        }
        ctx.restore();
      }
    }

    ctx.restore(); // end rotation

    // ===== Fixed glass frame + overlays (do not rotate: stationary light) =====

    // Top specular sheen across the wheel face
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, segR, 0, 2 * Math.PI);
    ctx.clip();
    const topSheen = ctx.createLinearGradient(0, -segR, 0, segR * 0.1);
    topSheen.addColorStop(0, 'rgba(255,255,255,0.33)');
    topSheen.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = topSheen;
    ctx.fillRect(-segR, -segR, 2 * segR, segR * 1.1);
    ctx.restore();

    // Contact shadow where the face meets the bezel
    ctx.beginPath();
    ctx.arc(0, 0, segR - 2.5, 0, 2 * Math.PI);
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(30, 50, 90, 0.10)';
    ctx.stroke();

    // Glass bezel ring
    const rm = (segR + r) / 2;
    const bezelGrad = ctx.createLinearGradient(0, -r, 0, r);
    bezelGrad.addColorStop(0, 'rgba(255,255,255,0.97)');
    bezelGrad.addColorStop(0.5, 'rgba(196,212,240,0.6)');
    bezelGrad.addColorStop(1, 'rgba(255,255,255,0.88)');
    ctx.beginPath();
    ctx.arc(0, 0, rm, 0, 2 * Math.PI);
    ctx.lineWidth = bezelW;
    ctx.strokeStyle = bezelGrad;
    ctx.shadowColor = 'rgba(0,0,0,0.12)';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Inner + outer rim lines
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, 2 * Math.PI);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, segR, 0, 2 * Math.PI);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.stroke();

    // Rivets around the bezel (like the logo)
    const dots = 24;
    const dotR = Math.max(1.5, r * 0.011);
    for (let d = 0; d < dots; d++) {
      const a = (d / dots) * 2 * Math.PI;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * rm, Math.sin(a) * rm, dotR, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.shadowColor = 'rgba(100,140,200,0.4)';
      ctx.shadowBlur = 3;
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Center hub: glass dome with a specular highlight
    const hubR = segR * 0.12;
    const hubGrad = ctx.createRadialGradient(-hubR * 0.3, -hubR * 0.35, hubR * 0.1, 0, 0, hubR);
    hubGrad.addColorStop(0, '#ffffff');
    hubGrad.addColorStop(0.6, 'rgba(214,228,255,0.97)');
    hubGrad.addColorStop(1, 'rgba(150,182,240,0.92)');
    ctx.beginPath();
    ctx.arc(0, 0, hubR, 0, 2 * Math.PI);
    ctx.fillStyle = hubGrad;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-hubR * 0.3, -hubR * 0.38, hubR * 0.26, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fill();

    ctx.restore();
  }

  truncateText(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let truncated = text;
    while (truncated.length > 0 && ctx.measureText(truncated + '…').width > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + '…';
  }

  // Spin so that `segmentIndex` lands under the top pointer, computed from the
  // CURRENT rotation (the wheel accumulates rotation across spins). `spins` is the
  // number of extra full turns for the animation.
  spinTo(segmentIndex, spins = 6, duration = 6000) {
    if (this.spinning) return;
    this.spinning = true;

    const segDeg = 360 / this.segments;
    // rotation (deg, mod 360) at which segmentIndex's centre sits under the pointer
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

      // Cubic ease-out for natural deceleration
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
