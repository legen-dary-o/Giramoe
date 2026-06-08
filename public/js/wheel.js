const SEGMENT_COLORS = [
  '#22c55e', '#4ade80', '#a3e635', '#eab308',
  '#f59e0b', '#f97316', '#ef4444', '#f43f5e',
  '#ec4899', '#d946ef', '#a855f7', '#8b5cf6',
  '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4'
];

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

  resize() {
    const container = this.canvas.parentElement;
    const size = Math.min(container.clientWidth, container.clientHeight) * 0.85;
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
    const segAngle = (2 * Math.PI) / this.segments;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.rotation);

    for (let i = 0; i < this.segments; i++) {
      const startAngle = i * segAngle - Math.PI / 2;
      const endAngle = startAngle + segAngle;

      // Segment fill
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
      ctx.fill();

      // Segment border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Glass highlight on each segment
      const grad = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
      grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0.15)');
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Label text
      if (this.showLabels && this.labels[i]) {
        ctx.save();
        const midAngle = startAngle + segAngle / 2;
        ctx.rotate(midAngle);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(11, r * 0.07)}px -apple-system, sans-serif`;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 3;

        const text = this.labels[i];
        const maxWidth = r * 0.55;
        const truncated = this.truncateText(ctx, text, maxWidth);
        ctx.fillText(truncated, r * 0.88, 0);
        ctx.restore();
      }
    }

    // Center circle (glass hub)
    const hubGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.12);
    hubGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    hubGrad.addColorStop(0.7, 'rgba(200, 220, 255, 0.7)');
    hubGrad.addColorStop(1, 'rgba(180, 200, 255, 0.5)');
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.12, 0, 2 * Math.PI);
    ctx.fillStyle = hubGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Outer ring (glass border)
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 4;
    ctx.stroke();

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

  spinTo(totalAngle, duration = 6000) {
    if (this.spinning) return;
    this.spinning = true;

    const startRotation = this.rotation;
    const targetRotation = startRotation + (totalAngle * Math.PI) / 180;
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
