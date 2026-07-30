// public/js/fx/roundscenes.js
// Animazioni di round a schermo intero: IL TRIPLETE, EXPRESS, GIRAMOE, Finalista, Buste.
// Sostituiscono la vecchia title animation (wordmark + TitleDots) nei cinque momenti
// di stacco della partita.
//
// Riferimento normativo: design_handoff_round_animations/giramoe-scenes.jsx — tutta la
// coreografia è funzione del tempo locale della scena in secondi, quindi è portata 1:1.
// Il palco logico è 1920×1080 (come il prototipo) e viene scalato per entrare nello
// schermo; il rendering è DOM/CSS, il clock è un requestAnimationFrame locale.

const W = 1920, H = 1080;

// --- token (public/css/tokens.css) ---
const INK = '#f5f5f7';
const INK_SOFT = 'rgba(245,245,247,0.55)';
const INK_FAINT = 'rgba(245,245,247,0.38)';
const ACCENT = '#30b8ff';
const HAIRLINE = 'rgba(255,255,255,0.14)';
const DISPLAY = "'Syne', sans-serif";
const MONO = "'Space Mono', monospace";
// public/js/wheel.js SEGMENT_COLORS
const SEG = ['#22c55e', '#4ade80', '#a3e635', '#eab308', '#f59e0b', '#f97316', '#ef4444', '#f43f5e',
             '#ec4899', '#d946ef', '#a855f7', '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4'];
// texture halftone delle buste (public/js/fx/envelopes3d.js)
const DOTS = 'radial-gradient(circle 1.6px at 50% 50%, rgba(255,255,255,0.55) 99%, transparent 100%)';

// --- solo tre curve, come da handoff (+ le due usate dentro le formule) ---
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const w = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const easeOutExpo = (p) => (p === 1 ? 1 : 1 - Math.pow(2, -10 * p));
const easeInOutSine = (p) => -(Math.cos(Math.PI * p) - 1) / 2;
const easeOutBack = (p) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
const easeOutQuart = (p) => 1 - Math.pow(1 - p, 4);
const easeInQuad = (p) => p * p;
const enter = (p) => easeOutExpo(clamp(p, 0, 1));  // entrate, atterraggi
const drive = (p) => easeInOutSine(clamp(p, 0, 1)); // camera, movimenti continui
const pop = (p) => easeOutBack(clamp(p, 0, 1));     // impatti, scatti
const glint = (p) => 120 - 240 * p;                 // background-position % del wordmark

function el(tag, style, parent) {
  const e = document.createElement(tag);
  if (style) Object.assign(e.style, style);
  if (parent) parent.appendChild(e);
  return e;
}
const fill = { position: 'absolute', left: '0', top: '0', right: '0', bottom: '0' };

// blocco titolo condiviso: eyebrow + wordmark (glint) + hairline, centrati
function titleBlock(parent, { eyebrow, word, size, wmMargin = 26 }) {
  const box = el('div', Object.assign({}, fill, {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
  }), parent);
  const eb = el('div', { font: `600 19px ${MONO}`, letterSpacing: '7px', color: INK_FAINT, textTransform: 'uppercase' }, box);
  eb.textContent = eyebrow;
  const wm = el('div', {
    fontFamily: DISPLAY, fontWeight: '800', fontSize: size + 'px', letterSpacing: '-0.03em',
    lineHeight: '1', whiteSpace: 'nowrap', marginTop: wmMargin + 'px',
    background: 'linear-gradient(105deg,#f5f5f7 42%,#ffffff 49%,#8e94a3 52%,#f5f5f7 60%)',
    backgroundSize: '320% 100%', backgroundPosition: '120% 0',
    backgroundClip: 'text', color: 'transparent'
  }, box);
  wm.style.setProperty('-webkit-background-clip', 'text');
  wm.textContent = word;
  const hair = el('div', { height: '1px', background: HAIRLINE, marginTop: '40px', width: '0px' }, box);
  return { box, eyebrow: eb, wm, hair };
}

// ===========================================================================
// 1 · Atterraggio su uno spicchio — 6.0s. Ruota gigante ripresa da vicinissimo,
// sei giri che decelerano e si fermano sullo spicchio speciale (indice 0), poi
// velo nero e wordmark. La usano IL TRIPLETE e l'apertura del round EXPRESS:
// stessa coreografia, cambiano solo colore/etichetta dello spicchio e il titolo.
// ===========================================================================
const CX = 960, CY = 2060, R = 1950, LABEL_R = R * 0.74;
const WHEEL_VALUES = ['900', '700', '500', '800', '600', '2500', '350',
                      '450', '900', '600', '700', '800', '500', '1000', '650'];

const TRIPLETE_WHEEL = {
  wedge: '#111114',
  wedgeLabel: 'IL TRIPLETE',
  wedgeFont: 'italic 900 74px "Arial Black", Arial, sans-serif',
  wedgeShadow: '0 0 26px rgba(125,225,255,0.95)',
  eyebrow: 'Bonus round', word: 'IL TRIPLETE', size: 196
};

// Rosa scuro, non il #ec4899 della ruota: su quello la scritta bianca si perde.
// Qui il contrasto con il bianco è ~7.5:1, si legge anche di sfuocato.
const EXPRESS_WHEEL = {
  wedge: '#a11d5c',
  wedgeLabel: 'EXPRESS',
  wedgeFont: 'italic 900 92px "Arial Black", Arial, sans-serif',
  wedgeShadow: '0 0 30px rgba(255,160,205,0.9), 0 4px 12px rgba(0,0,0,0.75)',
  eyebrow: 'Bonus round', word: 'EXPRESS', size: 230
};

class WheelLandScene {
  constructor(root, cfg) {
    const labels = [cfg.wedgeLabel].concat(WHEEL_VALUES);
    this.wrap = el('div', Object.assign({}, fill), root);
    this.blur = el('div', Object.assign({}, fill), this.wrap);

    this.wheel = el('div', { position: 'absolute', left: CX + 'px', top: CY + 'px', width: '0', height: '0' }, this.blur);
    const face = () => ({ position: 'absolute', left: -R + 'px', top: -R + 'px', width: R * 2 + 'px', height: R * 2 + 'px', borderRadius: '50%' });
    const stops = [];
    for (let i = 0; i < 16; i++) {
      const c = i === 0 ? cfg.wedge : SEG[i]; // lo spicchio 0 è quello speciale
      stops.push(`${c} ${i * 22.5}deg ${(i + 1) * 22.5}deg`);
    }
    el('div', Object.assign(face(), { background: `conic-gradient(from -11.25deg, ${stops.join(',')})` }), this.wheel);
    el('div', Object.assign(face(), { background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.26) 12%, rgba(255,255,255,0.04) 55%, rgba(0,0,0,0) 86%, rgba(0,0,0,0.18) 100%)' }), this.wheel);
    el('div', Object.assign(face(), { background: 'repeating-conic-gradient(from -11.25deg, rgba(255,255,255,0.9) 0deg 0.14deg, rgba(255,255,255,0) 0.14deg 22.5deg)' }), this.wheel);
    el('div', Object.assign(face(), { boxSizing: 'border-box', border: '22px solid rgba(255,255,255,0.82)' }), this.wheel);
    labels.forEach((lab, i) => {
      // transform-origin 0 0: senza, ogni numero ruota sul proprio centro e scivola fuori dallo spicchio
      const d = el('div', {
        position: 'absolute', left: '0', top: '0', whiteSpace: 'nowrap', transformOrigin: '0 0',
        transform: `rotate(${i * 22.5}deg) translateY(${-LABEL_R}px) translate(-50%,-50%)`,
        font: i === 0 ? cfg.wedgeFont : `800 104px -apple-system, ${DISPLAY}`,
        color: '#fff', letterSpacing: i === 0 ? '1px' : '0',
        textShadow: i === 0 ? cfg.wedgeShadow : '0 4px 10px rgba(0,0,0,0.55)'
      }, this.wheel);
      d.textContent = lab;
    });

    this.rim = el('div', {
      position: 'absolute', left: CX - R + 'px', top: CY - R + 'px', width: R * 2 + 'px', height: R * 2 + 'px',
      borderRadius: '50%', boxSizing: 'border-box', border: '26px solid rgba(255,255,255,0.95)',
      opacity: '0', filter: 'blur(3px)'
    }, this.wrap);
    this.pointer = el('div', {
      position: 'absolute', left: CX - 26 + 'px', top: '46px', width: '52px', height: '74px',
      background: INK, clipPath: 'polygon(50% 100%, 0 0, 100% 0)', filter: 'drop-shadow(0 6px 18px rgba(0,0,0,0.6))'
    }, this.wrap);

    this.veil = el('div', Object.assign({}, fill, { background: '#000', opacity: '0' }), root);
    this.title = titleBlock(root, { eyebrow: cfg.eyebrow, word: cfg.word, size: cfg.size });
    this.title.box.style.paddingTop = '150px'; // non collide con l'etichetta dello spicchio
  }

  update(t) {
    const SPIN_END = 3.5;
    const p = w(t, 0.05, SPIN_END);
    // sei giri, decelera e si ferma con lo spicchio 0 sotto l'indicatore
    let rot = -2160 * (1 - easeOutQuart(p));
    const ring = w(t, SPIN_END, SPIN_END + 0.55);
    if (ring > 0 && ring < 1) rot += Math.sin(ring * Math.PI * 3.4) * 1.5 * (1 - ring) * (1 - ring); // clack

    const speed = 1 - easeOutQuart(p);
    const wheelIn = enter(w(t, 0, 0.4));
    const wheelOut = 1 - w(t, 5.3, 5.9);
    const sh = Math.pow(1 - w(t, SPIN_END, SPIN_END + 0.42), 2.2) * (t > SPIN_END ? 1 : 0);
    const push = 1.0 + 0.05 * drive(w(t, 0, 5.0)); // la camera non è mai ferma
    const titleBlurPx = 16 * enter(w(t, 3.95, 4.8));
    const title = w(t, 4.0, 4.9);
    const outro = 1 - w(t, 5.25, 5.9);

    this.wrap.style.opacity = wheelIn * wheelOut;
    this.wrap.style.transform = `translate(${Math.sin(t * 92) * 16 * sh}px,${Math.cos(t * 71) * 11 * sh}px) scale(${push})`;
    this.blur.style.filter = `blur(${22 * speed + titleBlurPx}px)`;
    this.wheel.style.transform = `rotate(${rot}deg)`;
    this.rim.style.opacity = pop(w(t, SPIN_END, SPIN_END + 0.1)) * (1 - w(t, SPIN_END + 0.08, SPIN_END + 0.5));
    this.pointer.style.top = (46 - 6 * sh) + 'px';
    this.veil.style.opacity = 0.93 * enter(w(t, 3.95, 4.7));

    this.title.box.style.opacity = outro;
    this.title.eyebrow.style.opacity = enter(w(t, 4.15, 4.8));
    this.title.wm.style.opacity = enter(w(t, 4.0, 4.75));
    this.title.wm.style.filter = `blur(${(1 - enter(title)) * 30}px)`;
    this.title.wm.style.transform = `scale(${1.1 - 0.1 * enter(title) + 0.01 * drive(w(t, 4.8, 6))})`;
    this.title.wm.style.backgroundPosition = `${glint(w(t, 4.3, 5.7))}% 0`;
    this.title.hair.style.width = 90 * enter(w(t, 4.6, 5.3)) + 'px';
  }
}

// Le due varianti concrete. Stessa durata e stesse battute audio: cambia solo la
// configurazione dello spicchio speciale e del wordmark finale.
const WHEEL_CUES = [
  [0.005, () => Sfx.startSpin()],
  [0.578, () => Sfx.stopSpin()] // + clack metallico e sub-drop d'impatto: suoni da procurare
];

class TripleteScene extends WheelLandScene {
  constructor(root) { super(root, TRIPLETE_WHEEL); }
}
TripleteScene.duration = 6.0;
TripleteScene.label = () => ({ eyebrow: TRIPLETE_WHEEL.eyebrow, word: TRIPLETE_WHEEL.word, size: TRIPLETE_WHEEL.size });
TripleteScene.cues = WHEEL_CUES;

// Apertura del round EXPRESS: la ruota si ferma sullo spicchio rosa "EXPRESS".
// (Diversa dalla scena `express` qui sotto, che parte quando un giocatore ci
// atterra davvero sopra durante il round.)
class ExpressWheelScene extends WheelLandScene {
  constructor(root) { super(root, EXPRESS_WHEEL); }
}
ExpressWheelScene.duration = 6.0;
ExpressWheelScene.label = () => ({ eyebrow: EXPRESS_WHEEL.eyebrow, word: EXPRESS_WHEEL.word, size: EXPRESS_WHEEL.size });
ExpressWheelScene.cues = WHEEL_CUES;

// ===========================================================================
// 2 · EXPRESS — 5.5s. Treno frontale che esce dal tunnel, whiteout, wordmark.
// ===========================================================================
const VPX = 960, VPY = 545, RUSH = 3.25, RN = 11;

class ExpressScene {
  constructor(root) {
    this.wrap = el('div', Object.assign({}, fill), root);
    this.sleepers = [];
    this.rings = [];
    for (let k = 0; k < RN; k++) {
      this.sleepers.push(el('div', { position: 'absolute', background: 'rgba(255,255,255,0.16)' }, this.wrap));
    }
    for (let k = 0; k < RN; k++) {
      this.rings.push(el('div', { position: 'absolute', boxSizing: 'border-box', border: '1px solid rgba(255,255,255,0.16)' }, this.wrap));
    }
    this.mass = el('div', {
      position: 'absolute', background: 'linear-gradient(180deg, #0b1420, #05080d)',
      border: '2px solid rgba(120,190,255,0.28)', zIndex: '-1'
    }, this.wrap);
    this.lights = [-1, 1].map(() => el('div', { position: 'absolute', borderRadius: '50%', background: '#ffffff' }, this.wrap));

    this.center = el('div', Object.assign({}, fill, {
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
    }), root);
    this.streak = el('div', {
      position: 'absolute', zIndex: '-1', left: '-700px', top: '430px', width: '700px', height: '6px',
      background: `linear-gradient(90deg, transparent, ${ACCENT}, transparent)`, filter: 'blur(5px)', opacity: '0'
    }, this.center);
    const t = titleBlock(this.center, { eyebrow: 'Bonus round', word: 'EXPRESS', size: 230 });
    this.title = t;
    // il blocco titolo di titleBlock è absolute: qui serve dentro il flow del center
    t.box.style.position = 'static';
    t.box.style.width = '100%';
    this.sub = el('div', { font: `400 28px ${MONO}`, letterSpacing: '3px', color: INK_SOFT, marginTop: '42px', opacity: '0' }, t.box);
    this.sub.textContent = '500 a lettera. Sbagli, bancarotta.';

    this.white = el('div', Object.assign({}, fill, { background: '#fff', opacity: '0' }), root);
  }

  update(t) {
    const accel = t + 1.35 * Math.pow(w(t, 0.6, RUSH), 2.6) * 2.4; // il treno accelera
    for (let k = 0; k < RN; k++) {
      const u = ((k / RN) + accel * 0.30) % 1;
      const s = Math.pow(2, (u - 1) * 8.2);
      const op = Math.min(u / 0.12, 1) * (u > 0.9 ? (1 - u) / 0.1 : 1);
      const sl = this.sleepers[k].style;
      sl.left = VPX - 700 * s + 'px'; sl.top = VPY + 700 * s + 'px';
      sl.width = 1400 * s + 'px'; sl.height = Math.max(1, 18 * s) + 'px'; sl.opacity = op;
      const rg = this.rings[k].style;
      rg.left = VPX - 1300 * s + 'px'; rg.top = VPY - 750 * s + 'px';
      rg.width = 2600 * s + 'px'; rg.height = 1500 * s + 'px';
      rg.borderWidth = Math.max(1, 3 * s) + 'px'; rg.borderRadius = 220 * s + 'px'; rg.opacity = op;
    }

    const hs = Math.pow(2, (easeInQuad(w(t, 0.1, RUSH)) - 1) * 10.5);
    const sep = 760 * hs, lr = 300 * hs;
    this.lights.forEach((L, i) => {
      const d = i === 0 ? -1 : 1;
      Object.assign(L.style, {
        left: VPX + d * sep / 2 - lr / 2 + 'px', top: VPY - lr / 2 + 'px',
        width: lr + 'px', height: lr + 'px',
        filter: `blur(${Math.max(4, 60 * hs)}px)`,
        boxShadow: `0 0 ${180 * hs}px ${70 * hs}px rgba(160,225,255,0.55)`
      });
    });
    Object.assign(this.mass.style, {
      left: VPX - 900 * hs + 'px', top: VPY - 520 * hs + 'px',
      width: 1800 * hs + 'px', height: 1100 * hs + 'px',
      borderRadius: `${340 * hs}px ${340 * hs}px 0 0`, opacity: 0.9 * w(t, 1.4, 2.6)
    });

    const amp = 16 * Math.pow(w(t, 1.1, RUSH), 2.4);
    this.wrap.style.opacity = enter(w(t, 0, 0.45)) * (1 - w(t, RUSH - 0.1, RUSH + 0.08));
    this.wrap.style.transform = `translate(${Math.sin(t * 53) * amp}px,${Math.cos(t * 67) * amp * 0.6}px)`;

    const title = w(t, RUSH + 0.05, RUSH + 1.0);
    const streak = w(t, 3.95, 4.75);
    this.center.style.opacity = 1 - w(t, 4.85, 5.4);
    this.streak.style.opacity = streak > 0 && streak < 1 ? 1 : 0;
    this.streak.style.transform = `translateX(${drive(streak) * 3100}px)`;
    this.title.eyebrow.style.opacity = enter(w(t, RUSH + 0.35, RUSH + 1.0));
    this.title.wm.style.opacity = enter(w(t, RUSH - 0.05, RUSH + 0.4));
    this.title.wm.style.filter = `blur(${(1 - enter(title)) * 18}px)`;
    this.title.wm.style.transform = `scale(${1.08 - 0.08 * enter(title) + 0.014 * drive(w(t, RUSH + 0.6, 5.4))})`;
    this.title.wm.style.backgroundPosition = `${glint(w(t, RUSH + 0.2, RUSH + 1.6))}% 0`;
    this.title.hair.style.width = 90 * enter(w(t, RUSH + 0.8, RUSH + 1.5)) + 'px';
    this.sub.style.opacity = enter(w(t, RUSH + 1.0, RUSH + 1.7));

    this.white.style.opacity = clamp(pop(w(t, RUSH - 0.12, RUSH + 0.12)), 0, 1) * (1 - w(t, RUSH + 0.22, RUSH + 0.85));
  }
}
ExpressScene.duration = 5.5;
ExpressScene.label = () => ({ eyebrow: 'Bonus round', word: 'EXPRESS', size: 230 });
// rumble, trombe treno, sibilo freni, whoosh sul whiteout: suoni da procurare
ExpressScene.cues = [];

// ===========================================================================
// 3 · GIRAMOE — 5.0s. La ruota come quadrante radar, che collassa nel logo.
// ===========================================================================
const GIRAMOE_VALUES = ['900', '700', '500', '800', '600', '2500', '350', '450',
                        '900', '600', '700', '800', '500', '1000', '650', '1500'];
const RAD = 322;

class GiramoeScene {
  constructor(root) {
    const holder = el('div', Object.assign({}, fill, { display: 'flex', alignItems: 'center', justifyContent: 'center' }), root);
    this.dial = el('div', { position: 'relative', width: '0', height: '0' }, holder);

    this.cone = el('div', {
      position: 'absolute', left: -RAD + 'px', top: -RAD + 'px', width: RAD * 2 + 'px', height: RAD * 2 + 'px',
      borderRadius: '50%'
    }, this.dial);

    this.spokes = GIRAMOE_VALUES.map((v, i) => {
      const g = el('div', { position: 'absolute', left: '0', top: '0' }, this.dial);
      const line = el('div', { position: 'absolute', left: '0', top: '0', height: '1px', background: HAIRLINE, transformOrigin: '0 0' }, g);
      const val = el('div', {
        position: 'absolute', left: '0', top: '0', font: `700 24px ${MONO}`, letterSpacing: '1px',
        color: i === 15 ? ACCENT : INK_SOFT, whiteSpace: 'nowrap'
      }, g);
      val.textContent = v;
      return { g, line, val, a: -90 + i * 22.5 };
    });

    const size = RAD * 2 + 40;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', size); svg.setAttribute('height', size);
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    Object.assign(svg.style, { position: 'absolute', left: -(RAD + 20) + 'px', top: -(RAD + 20) + 'px' });
    this.arc = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    this.arc.setAttribute('cx', RAD + 20); this.arc.setAttribute('cy', RAD + 20); this.arc.setAttribute('r', RAD);
    this.arc.setAttribute('fill', 'none'); this.arc.setAttribute('stroke', ACCENT); this.arc.setAttribute('stroke-width', '2');
    this.arc.setAttribute('stroke-dasharray', 2 * Math.PI * RAD);
    this.arc.setAttribute('transform', `rotate(-90 ${RAD + 20} ${RAD + 20})`);
    this.arc.setAttribute('opacity', '0.85');
    svg.appendChild(this.arc);
    this.dial.appendChild(svg);

    el('div', {
      position: 'absolute', left: '-7px', top: '-7px', width: '14px', height: '14px', borderRadius: '50%',
      background: INK, boxShadow: '0 0 30px rgba(48,184,255,0.8)'
    }, this.dial);

    this.title = titleBlock(root, { eyebrow: 'Tabellone finale', word: 'GIRAMOE', size: 230 });
  }

  update(t) {
    const SWEEP_A = 0.25, SWEEP_B = 2.45;
    const sweep = drive(w(t, SWEEP_A, SWEEP_B));
    const collapse = enter(w(t, 2.95, 3.5));
    this.dial.style.opacity = enter(w(t, 0.12, 0.5)) * (1 - w(t, 3.05, 3.5));
    this.dial.style.transform = `scale(${(1 - 0.8 * collapse) * (1 + 0.03 * drive(w(t, 0.3, 3.0)))})`;
    this.cone.style.background = `conic-gradient(from ${-90 + sweep * 360}deg, rgba(48,184,255,0.55), rgba(48,184,255,0) 26deg)`;
    this.cone.style.opacity = 0.55 * (1 - w(t, SWEEP_B - 0.2, SWEEP_B + 0.25));

    this.spokes.forEach((s, i) => {
      const on = clamp((sweep * 16 - i) / 0.7, 0, 1);
      s.g.style.opacity = on;
      s.line.style.width = RAD * enter(on) + 'px';
      s.line.style.transform = `rotate(${s.a}deg)`;
      const a = s.a + 11.25;
      s.val.style.transform = `rotate(${a}deg) translateX(${(RAD + 62) * enter(on)}px) rotate(${-a}deg) translate(-50%,-50%)`;
    });
    this.arc.setAttribute('stroke-dashoffset', 2 * Math.PI * RAD * (1 - sweep));

    const title = w(t, 3.25, 4.1);
    this.title.box.style.opacity = 1 - w(t, 4.35, 4.9);
    this.title.eyebrow.style.opacity = enter(w(t, 3.45, 4.0));
    this.title.wm.style.opacity = enter(w(t, 3.25, 3.85));
    this.title.wm.style.filter = `blur(${(1 - enter(title)) * 24}px)`;
    this.title.wm.style.transform = `scale(${0.55 + 0.45 * enter(title) + 0.012 * drive(w(t, 3.9, 5))})`;
    this.title.wm.style.backgroundPosition = `${glint(w(t, 3.4, 4.8))}% 0`;
    this.title.hair.style.width = 90 * enter(w(t, 3.8, 4.4)) + 'px';
  }
}
GiramoeScene.duration = 5.0;
GiramoeScene.label = () => ({ eyebrow: 'Tabellone finale', word: 'GIRAMOE', size: 230 });
// 16 ping radar + accordo finale: suoni da procurare
GiramoeScene.cues = [];

// ===========================================================================
// 4 · Finalista — 5.0s. La classifica si riduce a un nome.
// ===========================================================================
class FinalistaScene {
  constructor(root, opts) {
    const standings = (opts.standings && opts.standings.length ? opts.standings : [{ name: opts.name || '', bank: 0 }]);
    this.rows = [];
    this.box = el('div', Object.assign({}, fill, {
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '18px'
    }), root);
    this.kicker = el('div', {
      font: `600 19px ${MONO}`, letterSpacing: '7px', color: INK_FAINT, textTransform: 'uppercase', marginBottom: '22px'
    }, this.box);
    this.kicker.textContent = 'Classifica';

    standings.forEach((s, i) => {
      const win = !!s.winner;
      const row = el('div', {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        width: '820px', padding: '30px 44px', boxSizing: 'border-box',
        font: `700 34px ${MONO}`, background: '#16161a', borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.10)'
      }, this.box);
      const left = el('span', { display: 'flex', gap: '22px', alignItems: 'baseline' }, row);
      const idx = el('span', { color: INK_FAINT, fontSize: '22px' }, left);
      idx.textContent = '0' + (i + 1);
      const nm = el('span', null, left);
      nm.textContent = s.name;
      const val = el('span', { color: win ? ACCENT : INK_SOFT }, row);
      this.rows.push({ row, val, bank: s.bank || 0, win, i });
    });

    this.title = el('div', Object.assign({}, fill, {
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
    }), root);
    this.kicker2 = el('div', {
      font: `800 40px ${DISPLAY}`, letterSpacing: '5px', textTransform: 'uppercase', color: INK_SOFT
    }, this.title);
    this.kicker2.textContent = 'Finalista';
    const winner = standings.find(s => s.winner) || standings[0];
    const tb = titleBlock(this.title, { eyebrow: '', word: winner ? winner.name : (opts.name || ''), size: 210, wmMargin: 30 });
    tb.box.style.position = 'static';
    tb.eyebrow.style.display = 'none';
    tb.hair.style.display = 'none';
    this.wm = tb.wm;
    this.sub = el('div', { font: `400 28px ${MONO}`, letterSpacing: '3px', color: INK_SOFT, marginTop: '40px' }, this.title);
    this.sub.textContent = 'va al gioco finale!';
  }

  update(t) {
    const count = drive(w(t, 0.3, 1.5));
    const losers = w(t, 1.65, 2.45);
    const winnerLift = enter(w(t, 1.7, 2.5));
    this.box.style.opacity = enter(w(t, 0.05, 0.6)) * (1 - w(t, 2.35, 2.75));
    this.kicker.style.opacity = 1 - losers;

    this.rows.forEach((r) => {
      const away = r.win ? 0 : losers;
      const stag = enter(clamp((t - 0.1 - r.i * 0.12) / 0.55, 0, 1));
      r.val.textContent = Math.round(r.bank * count).toLocaleString('it-IT');
      Object.assign(r.row.style, {
        opacity: stag * (1 - away * 0.9),
        transform: `translateY(${(1 - stag) * 30 + away * 120}px) scale(${r.win ? 1 + 0.09 * winnerLift : 1 - 0.06 * away})`,
        borderColor: r.win ? `rgba(48,184,255,${0.10 + 0.55 * winnerLift})` : 'rgba(255,255,255,0.10)',
        boxShadow: r.win ? `0 24px 70px rgba(48,184,255,${0.22 * winnerLift})` : 'none'
      });
    });

    const title = w(t, 2.5, 3.4);
    this.title.style.opacity = 1 - w(t, 4.3, 4.9);
    this.kicker2.style.opacity = enter(w(t, 2.5, 3.1));
    this.wm.style.opacity = enter(w(t, 2.55, 3.2));
    this.wm.style.filter = `blur(${(1 - enter(title)) * 22}px)`;
    this.wm.style.transform = `scale(${0.82 + 0.18 * enter(title) + 0.012 * drive(w(t, 3.3, 5))})`;
    this.wm.style.backgroundPosition = `${glint(w(t, 2.7, 4.2))}% 0`;
    this.sub.style.opacity = enter(w(t, 3.1, 3.8));
  }
}
FinalistaScene.duration = 5.0;
FinalistaScene.label = (opts) => {
  const winner = (opts.standings || []).find(s => s.winner);
  return { eyebrow: 'Finalista', word: (winner && winner.name) || opts.name || '', size: 210 };
};
// tick del conteggio, swell, sub-drop + chime: suoni da procurare.
// NON usare risposta_corretta.mp3 qui (indicazione esplicita dell'handoff).
FinalistaScene.cues = [];

// ===========================================================================
// 5 · Buste — 6.0s. Le tre buste finali, spoiler-free: nessun esito reale mostrato,
// i tre beat di rivelazione sono pulsazioni ciano neutre e dalla busta che si apre
// sale un "?" al posto del premio. La rivelazione vera resta al gioco.
// ===========================================================================
const EW = 408, EH = 276; // geometria di public/js/fx/envelopes3d.js (W 1.7 : H 1.15)
const EDGE_IDLE = 'rgba(255,255,255,0.35)';
const EDGE_ON = 'rgba(48,184,255,0.85)';

class BusteScene {
  constructor(root) {
    this.box = el('div', Object.assign({}, fill, {
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '130px'
    }), root);
    this.title = el('div', {
      font: `800 40px ${DISPLAY}`, letterSpacing: '5px', textTransform: 'uppercase', color: INK_SOFT
    }, this.box);
    this.title.textContent = 'Le buste';

    const row = el('div', { display: 'flex', gap: '58px', alignItems: 'flex-start', perspective: '2400px' }, this.box);
    this.buste = [0, 1, 2].map((i) => {
      const g = el('div', { position: 'relative', width: EW + 'px', height: EH + 92 + 'px' }, row);
      const content = el('div', {
        position: 'absolute', zIndex: '3', left: '-50px', right: '-50px', textAlign: 'center',
        font: `700 68px ${MONO}`, color: ACCENT, opacity: '0', textShadow: '0 6px 26px rgba(0,0,0,0.9)'
      }, g);
      content.textContent = '?';
      const body = el('div', {
        position: 'absolute', left: '0', top: '0', width: EW + 'px', height: EH + 'px', borderRadius: '6px',
        boxSizing: 'border-box', border: `2px solid ${EDGE_IDLE}`, background: '#0e0e12',
        backgroundImage: DOTS, backgroundSize: '7px 7px'
      }, g);
      const flap = el('div', {
        position: 'absolute', left: '0', top: '0', width: EW + 'px', height: EH * 0.52 + 'px',
        clipPath: 'polygon(0 0, 100% 0, 50% 100%)', background: '#22222b',
        backgroundImage: DOTS, backgroundSize: '7px 7px', transformOrigin: '50% 0'
      }, g);
      const num = el('div', {
        position: 'absolute', left: '0', right: '0', top: EH + 22 + 'px', textAlign: 'center',
        font: `700 46px ${MONO}`, color: ACCENT, opacity: '0.9'
      }, g);
      num.textContent = String(i + 1);
      return { g, content, body, flap, i };
    });

    this.sub = el('div', { font: `400 26px ${MONO}`, letterSpacing: '3px', color: INK_SOFT }, this.box);
    this.sub.textContent = 'Puoi cambiarla alla cieca.';
  }

  update(t) {
    this.box.style.opacity = 1 - w(t, 5.3, 5.9);
    this.title.style.opacity = enter(w(t, 0.1, 0.8)) * (1 - w(t, 2.5, 3.1));
    this.sub.style.opacity = enter(w(t, 4.4, 5.0));

    const openU = w(t, 3.25, 4.25);
    this.buste.forEach((b) => {
      const arrive = enter(clamp((t - 0.12 - b.i * 0.14) / 0.6, 0, 1));
      const reveal = drive(clamp((t - 0.9 - b.i * 0.42) / 0.5, 0, 1));
      const open = b.i === 0 ? openU : 0;
      const push = b.i === 0 ? enter(w(t, 2.5, 3.3)) : 0;
      const dim = b.i === 0 ? 0 : enter(w(t, 2.5, 3.2));
      const flap = enter(open);
      const rise = enter(clamp((open - 0.25) / 0.75, 0, 1));
      const bob = Math.sin(t * 1.15 + (b.i + 1)) * 5;
      const edge = reveal > 0.5 ? EDGE_ON : EDGE_IDLE;

      b.g.style.opacity = arrive * (1 - dim * 0.72);
      b.g.style.transform = `translateY(${(1 - arrive) * 110 + bob - 40 * push}px) scale(${1 + 0.16 * push - 0.05 * dim})`;
      b.body.style.borderColor = edge;
      b.body.style.boxShadow = `0 18px 60px rgba(0,0,0,0.55), 0 0 ${46 * reveal + 54 * push}px rgba(48,184,255,0.55)`;
      b.flap.style.transform = `rotateX(${-flap * 158}deg)`;
      b.flap.style.filter = `drop-shadow(0 2px 0 ${edge}) brightness(${1 - 0.3 * flap})`;
      b.content.style.top = (34 - 176 * rise) + 'px';
      b.content.style.opacity = rise;
    });
  }
}
BusteScene.duration = 6.0;
BusteScene.label = () => ({ eyebrow: '', word: 'LE BUSTE', size: 150 });
BusteScene.cues = [
  [0.433, () => Sfx.play('letter')] // apertura della busta; fruscii e chime: suoni da procurare
];

const SCENES = {
  triplete: TripleteScene,
  expressWheel: ExpressWheelScene,
  express: ExpressScene,
  giramoe: GiramoeScene,
  finalista: FinalistaScene,
  buste: BusteScene
};

export const SCENE_DURATION_MS = Object.keys(SCENES)
  .reduce((acc, k) => (acc[k] = SCENES[k].duration * 1000, acc), {});

// ===========================================================================
// Motore: un palco 1920×1080 scalato, un rAF, una scena alla volta.
// ===========================================================================
export class RoundScenes {
  constructor(root) {
    this.root = root;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.stage = el('div', { position: 'absolute', left: '50%', top: '50%', width: W + 'px', height: H + 'px', transformOrigin: '50% 50%' }, root);
    this.content = el('div', Object.assign({}, fill, { overflow: 'hidden' }), this.stage);
    this._chrome();
    this.scene = null;
    this._raf = null;
    this._timer = null;
    this._resolve = null;
    this._layout();
    window.addEventListener('resize', () => this._layout());
    this._frame = this._frame.bind(this);
  }

  // chrome persistente: le 4 corner label del tap screen (la grana è già globale)
  _chrome() {
    const mk = (style, html) => {
      const s = el('span', Object.assign({
        position: 'absolute', zIndex: '4', font: `600 17px ${MONO}`, letterSpacing: '4.5px',
        color: INK_FAINT, textTransform: 'uppercase'
      }, style), this.stage);
      s.innerHTML = html;
      return s;
    };
    mk({ top: '4.5%', left: '3.5%' }, 'Giramoe&reg;');
    mk({ top: '4.5%', right: '3.5%' }, 'Est. 2026');
    mk({ bottom: '4.5%', left: '3.5%' }, '<span class="live-dot"></span>Live');
    mk({ bottom: '4.5%', right: '3.5%' }, 'Show dal vivo &mdash; IT');
  }

  _layout() {
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    this.stage.style.transform = `translate(-50%,-50%) scale(${s})`;
  }

  isPlaying() { return !!this.scene || !!this._resolve; }

  // Lancia una scena. La Promise si risolve a fine animazione (o su skip()).
  play(name, opts = {}) {
    const Scene = SCENES[name];
    if (!Scene) return Promise.resolve();
    this.skip(); // una scena alla volta: quella in corso chiude subito
    this.content.innerHTML = '';
    this.root.classList.add('visible');
    this._layout();

    this.duration = Scene.duration;
    this.cues = this.reduced ? [] : (Scene.cues || []);
    this._cueP = 0;

    if (this.reduced) {
      // prefers-reduced-motion: solo il wordmark statico
      const lab = Scene.label(opts);
      const tb = titleBlock(this.content, { eyebrow: lab.eyebrow, word: lab.word, size: lab.size });
      if (!lab.eyebrow) tb.eyebrow.style.display = 'none';
      tb.hair.style.width = '90px';
      this.scene = null;
      return this._finishIn(1800);
    }

    this.scene = new Scene(this.content, opts);
    this.scene.update(0);
    this._t0 = performance.now();
    this._raf = requestAnimationFrame(this._frame);
    // rete di sicurezza: se rAF viene throttlato (scheda in background) la scena
    // chiude comunque a tempo reale
    return this._finishIn(this.duration * 1000 + 150);
  }

  _finishIn(ms) {
    return new Promise((resolve) => {
      this._resolve = resolve;
      this._timer = setTimeout(() => this._end(), ms);
    });
  }

  _frame(now) {
    if (!this.scene) return;
    const t = (now - this._t0) / 1000;
    if (t >= this.duration) { this._end(); return; }
    this.scene.update(t);
    this._fireCues(t / this.duration);
    this._raf = requestAnimationFrame(this._frame);
  }

  _fireCues(p) {
    for (let i = 0; i < this.cues.length; i++) {
      const c = this.cues[i];
      if (c[0] > this._cueP && c[0] <= p) { try { c[1](); } catch (e) {} }
    }
    this._cueP = p;
  }

  // Salta all'ultimo frame e chiude (usata dall'host o quando arriva un'altra scena).
  skip() { if (this.isPlaying()) this._end(); }

  _end() {
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    if (this.scene) {
      this._fireCues(1); // le battute rimaste (es. stop del loop della ruota)
      try { this.scene.update(this.duration); } catch (e) {}
      this.scene = null;
    }
    try { Sfx.stopSpin(); } catch (e) {}
    this.root.classList.remove('visible');
    this.content.innerHTML = '';
    const r = this._resolve;
    this._resolve = null;
    if (r) r();
  }
}
