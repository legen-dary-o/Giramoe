// Cursore custom del main display: punto istantaneo + anello che insegue (lerp),
// mix-blend-difference. Sugli elementi cliccabili l'anello si espande e mostra
// una label; il bottone dell'intro è magnetico. Attivo solo con puntatore fine.

const MAGNET_RADIUS = 130;
const MAGNET_PULL = 0.42;
const RING_LERP = 0.14;

export function initCursor() {
  if (!matchMedia('(pointer: fine)').matches) return null;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.body.classList.add('has-custom-cursor');

  const dot = document.createElement('div');
  dot.className = 'cursor-dot';
  const ring = document.createElement('div');
  ring.className = 'cursor-ring';
  const tip = document.createElement('span');
  tip.className = 'cursor-tip';
  ring.appendChild(tip);
  document.body.append(dot, ring);

  let mx = -100, my = -100, rx = -100, ry = -100;
  let visible = false;
  let hoverEl = null;

  const stage = document.getElementById('intro-stage');
  const magnetBtn = document.getElementById('tap-start-btn');

  document.addEventListener('mousemove', (e) => {
    mx = e.clientX;
    my = e.clientY;
    if (!visible) {
      visible = true;
      rx = mx; ry = my;
      dot.style.opacity = 1;
      ring.style.opacity = 1;
    }
    dot.style.transform = `translate(${mx - 3}px, ${my - 3}px)`;

    // parallax leggero del titolo intro
    if (stage && !reduced && !document.getElementById('start-tap-screen').classList.contains('hidden')) {
      const px = mx / innerWidth - 0.5;
      const py = my / innerHeight - 0.5;
      stage.style.transform = `translate(${px * -14}px, ${py * -10}px)`;
    }

    // bottone magnetico (solo se visibile)
    if (magnetBtn && magnetBtn.offsetParent !== null) {
      const r = magnetBtn.getBoundingClientRect();
      const dx = mx - (r.left + r.width / 2);
      const dy = my - (r.top + r.height / 2);
      const dist = Math.hypot(dx, dy);
      if (dist < MAGNET_RADIUS && !reduced) {
        const pull = (1 - dist / MAGNET_RADIUS) * MAGNET_PULL;
        magnetBtn.style.transform = `translate(${dx * pull}px, ${dy * pull}px)`;
      } else {
        magnetBtn.style.transform = '';
      }
    }
  });

  document.addEventListener('mouseleave', () => {
    visible = false;
    dot.style.opacity = 0;
    ring.style.opacity = 0;
    if (magnetBtn) magnetBtn.style.transform = '';
    if (stage) stage.style.transform = '';
  });

  // espansione su cliccabili: button, [data-cursor], .pickable
  const CLICKABLE = 'button, a, [data-cursor-label], .pickable, input, canvas#qr-canvas';
  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest(CLICKABLE);
    if (el === hoverEl) return;
    hoverEl = el;
    if (el && !el.disabled) {
      tip.textContent = el.dataset.cursorLabel || 'Tap';
      ring.classList.add('expanded');
    } else {
      ring.classList.remove('expanded');
    }
  });

  (function follow() {
    rx += (mx - rx) * RING_LERP;
    ry += (my - ry) * RING_LERP;
    const s = ring.classList.contains('expanded') ? 36 : 19;
    ring.style.transform = `translate(${rx - s}px, ${ry - s}px)`;
    requestAnimationFrame(follow);
  })();

  return { dot, ring };
}
