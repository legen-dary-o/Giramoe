// giramoe-scenes.jsx — Giramoe title/round animations, built on animations-v2.jsx.
// Persistent stage = Chrome (black field, top glow, 4 corner labels, film grain).
// Every scene starts and ends on bare Chrome, so all cuts are seamless.

const { SceneStage, useScene, Easing, interpolate, clamp,
        useTweaks, TweaksPanel, TweakSection, TweakToggle, TweakSelect } = window;

// ── Design tokens lifted from public/css/style.css ───────────────────────────
const INK = '#f5f5f7';
const INK_SOFT = 'rgba(245,245,247,0.55)';
const INK_FAINT = 'rgba(245,245,247,0.38)';
const ACCENT = '#30b8ff';
const HAIRLINE = 'rgba(255,255,255,0.14)';
const DISPLAY = "Syne, sans-serif";
const MONO = "'Space Mono', monospace";
const FIELD = 'radial-gradient(85% 65% at 50% -8%, rgba(48,56,74,0.32), transparent 62%), linear-gradient(180deg, #0a0a0c, #000000 64%)';
const GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.05 0'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)'/%3E%3C/svg%3E\")";

// public/js/wheel.js SEGMENT_COLORS
const SEG = ['#22c55e','#4ade80','#a3e635','#eab308','#f59e0b','#f97316','#ef4444','#f43f5e',
             '#ec4899','#d946ef','#a855f7','#8b5cf6','#6366f1','#3b82f6','#0ea5e9','#06b6d4'];

// ── Exactly three motion helpers; no easing outside them ────────────────────
const MOTION = {
  enter: (p) => Easing.easeOutExpo(clamp(p, 0, 1)),   // things arriving / settling
  drive: (p) => Easing.easeInOutSine(clamp(p, 0, 1)), // camera + continuous moves
  pop:   (p) => Easing.easeOutBack(clamp(p, 0, 1)),   // snaps, clacks, impacts
};
// windowed progress: 0 before a, 1 after b
const w = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const glint = (p) => 120 - 240 * p; // background-position % for the metallic sweep

// Tweak values, published by the root before the scene tree renders.
let TW = { chrome: true, grain: true, sound: true };

// ── Persistent stage ────────────────────────────────────────────────────────
const DOTS = {
  backgroundImage: 'radial-gradient(circle 1.6px at 50% 50%, rgba(255,255,255,0.55) 99%, transparent 100%)',
  backgroundSize: '7px 7px',
};

function Chrome({ label, children }) {
  // Every scene renders Chrome, so this is the single place the score is driven
  // from. Cues are progress-based, so retiming a scene retimes its sound too.
  const sc = useScene();
  if (sc && window.GiramoeAudio) {
    const nm = (sc.scene && sc.scene.name) || sc.name;
    window.GiramoeAudio.tick(nm, sc.progress);
  }
  const corner = (extra) => Object.assign({
    position: 'absolute', zIndex: 4, font: `600 17px ${MONO}`,
    letterSpacing: '4.5px', color: INK_FAINT, textTransform: 'uppercase',
  }, extra);
  return (
    <div data-screen-label={label} style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: FIELD, color: INK }}>
      {children}
      {TW.chrome && (<React.Fragment>
      <span style={corner({ top: '4.5%', left: '3.5%' })}>Giramoe&reg;</span>
      <span style={corner({ top: '4.5%', right: '3.5%' })}>Est. 2026</span>
      <span style={corner({ bottom: '4.5%', left: '3.5%' })}>
        <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: ACCENT, marginRight: 11, verticalAlign: 1 }} />
        Live
      </span>
      <span style={corner({ bottom: '4.5%', right: '3.5%' })}>Show dal vivo &mdash; IT</span>
      </React.Fragment>)}
      {TW.grain && <div style={{ position: 'absolute', inset: 0, zIndex: 50, pointerEvents: 'none', opacity: 0.55, backgroundImage: GRAIN }} />}
    </div>
  );
}

// Wordmark: Syne 800 with the metallic gradient, driven off the scene clock.
function Wordmark({ text, size, gp, style }) {
  return (
    <div style={Object.assign({
      fontFamily: DISPLAY, fontWeight: 800, fontSize: size, letterSpacing: '-0.03em',
      lineHeight: 1, whiteSpace: 'nowrap',
      background: 'linear-gradient(105deg,#f5f5f7 42%,#ffffff 49%,#8e94a3 52%,#f5f5f7 60%)',
      backgroundSize: '320% 100%', backgroundPosition: `${gp}% 0`,
      WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
    }, style)}>{text}</div>
  );
}

function Eyebrow({ text, style }) {
  return <div style={Object.assign({ font: `600 19px ${MONO}`, letterSpacing: '7px', color: INK_FAINT, textTransform: 'uppercase' }, style)}>{text}</div>;
}

// The monochrome halftone wheel of the home screen (public/js/fx/homewheel.js):
// 16 wedges, alternating dot density, no labels, no pointer.
function HaltoneWheel({ size, rot, style }) {
  const dot = 'radial-gradient(circle 2.1px at 50% 50%, #000 99%, transparent 100%)';
  return (
    <div style={Object.assign({
      width: size, height: size, borderRadius: '50%',
      background: 'repeating-conic-gradient(from -11.25deg, rgba(255,255,255,0.52) 0deg 22.5deg, rgba(255,255,255,0.26) 22.5deg 45deg)',
      maskImage: dot, WebkitMaskImage: dot, maskSize: '9px 9px', WebkitMaskSize: '9px 9px',
      transform: `rotate(${rot}deg)`,
    }, style)} />
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 · IL TRIPLETE — extreme close-up on a giant wheel that lands on it
// ═══════════════════════════════════════════════════════════════════════════
const CX = 960, CY = 2060, R = 1950, LABEL_R = 1950 * 0.74;
const TRIPLETE_LABELS = ['IL TRIPLETE', '900', '700', '500', '800', '600', '2500', '350',
                         '450', '900', '600', '700', '800', '500', '1000', '650'];

function GiantWheel({ rot }) {
  const stops = [];
  for (let i = 0; i < 16; i++) {
    const c = i === 0 ? '#111114' : SEG[i];
    stops.push(`${c} ${i * 22.5}deg ${(i + 1) * 22.5}deg`);
  }
  const face = { position: 'absolute', left: -R, top: -R, width: R * 2, height: R * 2, borderRadius: '50%' };
  return (
    <div style={{ position: 'absolute', left: CX, top: CY, width: 0, height: 0, transform: `rotate(${rot}deg)` }}>
      <div style={Object.assign({}, face, { background: `conic-gradient(from -11.25deg, ${stops.join(',')})` })} />
      <div style={Object.assign({}, face, { background: `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.26) 12%, rgba(255,255,255,0.04) 55%, rgba(0,0,0,0) 86%, rgba(0,0,0,0.18) 100%)` })} />
      <div style={Object.assign({}, face, { background: 'repeating-conic-gradient(from -11.25deg, rgba(255,255,255,0.9) 0deg 0.14deg, rgba(255,255,255,0) 0.14deg 22.5deg)' })} />
      <div style={Object.assign({}, face, { boxSizing: 'border-box', border: '22px solid rgba(255,255,255,0.82)' })} />
      {TRIPLETE_LABELS.map((lab, i) => (
        <div key={i} style={{
          position: 'absolute', left: 0, top: 0, whiteSpace: 'nowrap',
          transformOrigin: '0 0',
          transform: `rotate(${i * 22.5}deg) translateY(-${LABEL_R}px) translate(-50%,-50%)`,
          font: i === 0
            ? 'italic 900 74px "Arial Black", Arial, sans-serif'
            : `800 104px -apple-system, ${DISPLAY}`,
          color: '#fff', letterSpacing: i === 0 ? '1px' : 0,
          textShadow: i === 0 ? '0 0 26px rgba(125,225,255,0.95)' : '0 4px 10px rgba(0,0,0,0.55)',
        }}>{lab}</div>
      ))}
    </div>
  );
}

function Triplete() {
  const { localTime: t } = useScene();

  const SPIN_END = 3.5;
  const p = w(t, 0.05, SPIN_END);
  // six revolutions, decelerating; lands with segment 0 (IL TRIPLETE) at the pointer
  let rot = -2160 * (1 - Easing.easeOutQuart(p));
  // peg clack: damped overshoot after the stop
  const ring = w(t, SPIN_END, SPIN_END + 0.55);
  if (ring > 0 && ring < 1) rot += Math.sin(ring * Math.PI * 3.4) * 1.5 * (1 - ring) * (1 - ring);

  const speed = 1 - Easing.easeOutQuart(p);            // 1 → 0
  const blur = 22 * speed;
  const wheelIn = MOTION.enter(w(t, 0, 0.4));

  // impact shake
  const sh = Math.pow(1 - w(t, SPIN_END, SPIN_END + 0.42), 2.2) * (t > SPIN_END ? 1 : 0);
  const shx = Math.sin(t * 92) * 16 * sh, shy = Math.cos(t * 71) * 11 * sh;
  const rimFlash = MOTION.pop(w(t, SPIN_END, SPIN_END + 0.1)) * (1 - w(t, SPIN_END + 0.08, SPIN_END + 0.5));

  // camera pushes in a hair through the whole spin — never fully static
  const push = 1.0 + 0.05 * MOTION.drive(w(t, 0, 5.0));

  const veil = 0.93 * MOTION.enter(w(t, 3.95, 4.7));
  const titleBlur = 16 * MOTION.enter(w(t, 3.95, 4.8));
  const title = w(t, 4.0, 4.9);
  const outro = 1 - w(t, 5.25, 5.9);
  const wheelOut = 1 - w(t, 5.3, 5.9);

  return (
    <Chrome label={`Il Triplete +${t.toFixed(1)}s`}>
      <div style={{ position: 'absolute', inset: 0, opacity: wheelIn * wheelOut,
                    transform: `translate(${shx}px,${shy}px) scale(${push})` }}>
        <div style={{ position: 'absolute', inset: 0, filter: `blur(${blur + titleBlur}px)` }}>
          <GiantWheel rot={rot} />
        </div>
        {/* rim highlight flash on the clack */}
        <div style={{ position: 'absolute', left: CX - R, top: CY - R, width: R * 2, height: R * 2,
                      borderRadius: '50%', boxSizing: 'border-box',
                      border: '26px solid rgba(255,255,255,0.95)', opacity: rimFlash, filter: 'blur(3px)' }} />
        {/* pointer */}
        <div style={{ position: 'absolute', left: CX - 26, top: 46 - 6 * sh, width: 52, height: 74,
                      background: INK, clipPath: 'polygon(50% 100%, 0 0, 100% 0)',
                      filter: 'drop-shadow(0 6px 18px rgba(0,0,0,0.6))' }} />
      </div>

      <div style={{ position: 'absolute', inset: 0, background: '#000', opacity: veil }} />

      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', opacity: outro, paddingTop: 150 }}>
        <Eyebrow text="Bonus round" style={{ opacity: MOTION.enter(w(t, 4.15, 4.8)) }} />
        <Wordmark text="IL TRIPLETE" size={196} gp={glint(w(t, 4.3, 5.7))}
                  style={{ marginTop: 26,
                           opacity: MOTION.enter(w(t, 4.0, 4.75)),
                           filter: `blur(${(1 - MOTION.enter(title)) * 30}px)`,
                           transform: `scale(${1.1 - 0.1 * MOTION.enter(title) + 0.01 * MOTION.drive(w(t, 4.8, 6))})` }} />
        <div style={{ height: 1, background: HAIRLINE, marginTop: 40, width: 90 * MOTION.enter(w(t, 4.6, 5.3)) }} />
      </div>
    </Chrome>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · EXPRESS — headlights out of a tunnel, whiteout, wordmark
// ═══════════════════════════════════════════════════════════════════════════
const VPX = 960, VPY = 545;

function Express() {
  const { localTime: t } = useScene();

  const RUSH = 3.25;
  const tunnelIn = MOTION.enter(w(t, 0, 0.45));
  const accel = t + 1.35 * Math.pow(w(t, 0.6, RUSH), 2.6) * 2.4; // the train accelerates
  const rings = [];
  const RN = 11;
  for (let k = 0; k < RN; k++) {
    let u = ((k / RN) + accel * 0.30) % 1;
    const s = Math.pow(2, (u - 1) * 8.2);
    const op = Math.min(u / 0.12, 1) * (u > 0.9 ? (1 - u) / 0.1 : 1);
    rings.push({ s, op });
  }

  // headlights
  const uh = w(t, 0.1, RUSH);
  const hs = Math.pow(2, (Easing.easeInQuad(uh) - 1) * 10.5);
  const sep = 760 * hs, lr = 300 * hs;

  const amp = 16 * Math.pow(w(t, 1.1, RUSH), 2.4);
  const shx = Math.sin(t * 53) * amp, shy = Math.cos(t * 67) * amp * 0.6;

  const white = MOTION.pop(w(t, RUSH - 0.12, RUSH + 0.12)) * (1 - w(t, RUSH + 0.22, RUSH + 0.85));
  const tunnelOut = 1 - w(t, RUSH - 0.1, RUSH + 0.08);

  const title = w(t, RUSH + 0.05, RUSH + 1.0);
  const outro = 1 - w(t, 4.85, 5.4);
  const streak = w(t, 3.95, 4.75);

  return (
    <Chrome label={`Express +${t.toFixed(1)}s`}>
      <div style={{ position: 'absolute', inset: 0, opacity: tunnelIn * tunnelOut,
                    transform: `translate(${shx}px,${shy}px)` }}>
        {/* sleepers rushing at the camera */}
        {rings.map((r, k) => (
          <div key={'s' + k} style={{ position: 'absolute', left: VPX - 700 * r.s, top: VPY + 700 * r.s,
                                      width: 1400 * r.s, height: Math.max(1, 18 * r.s),
                                      background: 'rgba(255,255,255,0.16)', opacity: r.op }} />
        ))}
        {/* tunnel rings */}
        {rings.map((r, k) => (
          <div key={'r' + k} style={{ position: 'absolute', left: VPX - 1300 * r.s, top: VPY - 750 * r.s,
                                      width: 2600 * r.s, height: 1500 * r.s, boxSizing: 'border-box',
                                      border: `${Math.max(1, 3 * r.s)}px solid rgba(255,255,255,0.16)`,
                                      borderRadius: 220 * r.s, opacity: r.op }} />
        ))}
        {/* headlights */}
        {[-1, 1].map((d) => (
          <div key={d} style={{ position: 'absolute', left: VPX + d * sep / 2 - lr / 2, top: VPY - lr / 2,
                                width: lr, height: lr, borderRadius: '50%', background: '#ffffff',
                                filter: `blur(${Math.max(4, 60 * hs)}px)`,
                                boxShadow: `0 0 ${180 * hs}px ${70 * hs}px rgba(160,225,255,0.55)` }} />
        ))}
        {/* dark train mass behind the lights */}
        <div style={{ position: 'absolute', left: VPX - 900 * hs, top: VPY - 520 * hs,
                      width: 1800 * hs, height: 1100 * hs, borderRadius: `${340 * hs}px ${340 * hs}px 0 0`,
                      background: 'linear-gradient(180deg, #0b1420, #05080d)',
                      border: '2px solid rgba(120,190,255,0.28)', opacity: 0.9 * w(t, 1.4, 2.6), zIndex: -1 }} />
      </div>

      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', opacity: outro }}>
        <div style={{ position: 'absolute', zIndex: -1, left: -700, top: 430, width: 700, height: 6,
                      background: `linear-gradient(90deg, transparent, ${ACCENT}, transparent)`,
                      filter: 'blur(5px)',
                      opacity: streak > 0 && streak < 1 ? 1 : 0,
                      transform: `translateX(${MOTION.drive(streak) * 3100}px)` }} />
        <Eyebrow text="Bonus round" style={{ opacity: MOTION.enter(w(t, RUSH + 0.35, RUSH + 1.0)) }} />
        <Wordmark text="EXPRESS" size={230} gp={glint(w(t, RUSH + 0.2, RUSH + 1.6))}
                  style={{ marginTop: 26, opacity: MOTION.enter(w(t, RUSH - 0.05, RUSH + 0.4)),
                           transform: `scale(${1.08 - 0.08 * MOTION.enter(title) + 0.014 * MOTION.drive(w(t, RUSH + 0.6, 5.4))})`,
                           filter: `blur(${(1 - MOTION.enter(title)) * 18}px)` }} />
        <div style={{ height: 1, background: HAIRLINE, marginTop: 40, width: 90 * MOTION.enter(w(t, RUSH + 0.8, RUSH + 1.5)) }} />
        <div style={{ font: `400 28px ${MONO}`, letterSpacing: '3px', color: INK_SOFT, marginTop: 42,
                      opacity: MOTION.enter(w(t, RUSH + 1.0, RUSH + 1.7)) }}>500 a lettera. Sbagli, bancarotta.</div>
      </div>

      <div style={{ position: 'absolute', inset: 0, background: '#fff', opacity: white }} />
    </Chrome>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · GIRAMOE — the wheel drawn as a radar diagram, collapsing into the logo
// ═══════════════════════════════════════════════════════════════════════════
const GIRAMOE_VALUES = ['900','700','500','800','600','2500','350','450','900','600','700','800','500','1000','650','1500'];

function Giramoe() {
  const { localTime: t } = useScene();

  const SWEEP_A = 0.25, SWEEP_B = 2.45;
  const sweep = MOTION.drive(w(t, SWEEP_A, SWEEP_B));   // 0 → 1 around the dial
  const collapse = MOTION.enter(w(t, 2.95, 3.5));
  const diagOp = MOTION.enter(w(t, 0.12, 0.5)) * (1 - w(t, 3.05, 3.5));
  const scale = (1 - 0.8 * collapse) * (1 + 0.03 * MOTION.drive(w(t, 0.3, 3.0)));
  const rad = 322;

  const title = w(t, 3.25, 4.1);
  const outro = 1 - w(t, 4.35, 4.9);

  return (
    <Chrome label={`Giramoe +${t.toFixed(1)}s`}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: 0, height: 0, opacity: diagOp, transform: `scale(${scale})` }}>
          {/* rotating cyan cone: the sweep head */}
          <div style={{ position: 'absolute', left: -rad, top: -rad, width: rad * 2, height: rad * 2,
                        borderRadius: '50%', opacity: 0.55 * (1 - w(t, SWEEP_B - 0.2, SWEEP_B + 0.25)),
                        background: `conic-gradient(from ${-90 + sweep * 360}deg, rgba(48,184,255,0.55), rgba(48,184,255,0) 26deg)` }} />
          {/* spokes + values */}
          {GIRAMOE_VALUES.map((v, i) => {
            const on = clamp((sweep * 16 - i) / 0.7, 0, 1);
            const a = -90 + i * 22.5;
            return (
              <div key={i} style={{ position: 'absolute', left: 0, top: 0, opacity: on }}>
                <div style={{ position: 'absolute', left: 0, top: 0, width: rad * MOTION.enter(on), height: 1,
                              background: HAIRLINE, transformOrigin: '0 0', transform: `rotate(${a}deg)` }} />
                <div style={{ position: 'absolute', left: 0, top: 0,
                              transform: `rotate(${a + 11.25}deg) translateX(${(rad + 62) * MOTION.enter(on)}px) rotate(${-(a + 11.25)}deg) translate(-50%,-50%)`,
                              font: `700 24px ${MONO}`, letterSpacing: '1px',
                              color: i === 15 ? ACCENT : INK_SOFT, whiteSpace: 'nowrap' }}>{v}</div>
              </div>
            );
          })}
          {/* rim arc drawn by the sweep */}
          <svg width={rad * 2 + 40} height={rad * 2 + 40} viewBox={`0 0 ${rad * 2 + 40} ${rad * 2 + 40}`}
               style={{ position: 'absolute', left: -(rad + 20), top: -(rad + 20) }}>
            <circle cx={rad + 20} cy={rad + 20} r={rad} fill="none" stroke={ACCENT} strokeWidth="2"
                    strokeDasharray={2 * Math.PI * rad} strokeDashoffset={2 * Math.PI * rad * (1 - sweep)}
                    transform={`rotate(-90 ${rad + 20} ${rad + 20})`} opacity="0.85" />
          </svg>
          {/* hub */}
          <div style={{ position: 'absolute', left: -7, top: -7, width: 14, height: 14, borderRadius: '50%',
                        background: INK, boxShadow: `0 0 30px rgba(48,184,255,0.8)` }} />
        </div>
      </div>

      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', opacity: outro }}>
        <Eyebrow text="Tabellone finale" style={{ opacity: MOTION.enter(w(t, 3.45, 4.0)) }} />
        <Wordmark text="GIRAMOE" size={230} gp={glint(w(t, 3.4, 4.8))}
                  style={{ marginTop: 26, opacity: MOTION.enter(w(t, 3.25, 3.85)),
                           transform: `scale(${0.55 + 0.45 * MOTION.enter(title) + 0.012 * MOTION.drive(w(t, 3.9, 5))})`,
                           filter: `blur(${(1 - MOTION.enter(title)) * 24}px)` }} />
        <div style={{ height: 1, background: HAIRLINE, marginTop: 40, width: 90 * MOTION.enter(w(t, 3.8, 4.4)) }} />
      </div>
    </Chrome>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · FINALISTA — standings collapse into one name
// ═══════════════════════════════════════════════════════════════════════════
const STANDINGS = [
  { name: 'Giulia', bank: 12400 },
  { name: 'Marco',  bank: 9800 },
  { name: 'Luca',   bank: 7200 },
];

function Finalista() {
  const { localTime: t } = useScene();

  const rowsOp = MOTION.enter(w(t, 0.05, 0.6)) * (1 - w(t, 2.35, 2.75));
  const count = MOTION.drive(w(t, 0.3, 1.5));
  const losers = w(t, 1.65, 2.45);
  const winnerLift = MOTION.enter(w(t, 1.7, 2.5));

  const title = w(t, 2.5, 3.4);
  const outro = 1 - w(t, 4.3, 4.9);

  return (
    <Chrome label={`Finalista +${t.toFixed(1)}s`}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 18, opacity: rowsOp }}>
        <div style={{ font: `600 19px ${MONO}`, letterSpacing: '7px', color: INK_FAINT,
                      textTransform: 'uppercase', marginBottom: 22,
                      opacity: 1 - losers }}>Classifica</div>
        {STANDINGS.map((s, i) => {
          const win = i === 0;
          const away = win ? 0 : losers;
          const stag = MOTION.enter(clamp((t - 0.1 - i * 0.12) / 0.55, 0, 1));
          return (
            <div key={s.name} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              width: 820, padding: '30px 44px', boxSizing: 'border-box',
              font: `700 34px ${MONO}`, background: '#16161a', borderRadius: 16,
              border: `1px solid ${win ? `rgba(48,184,255,${0.10 + 0.55 * winnerLift})` : 'rgba(255,255,255,0.10)'}`,
              opacity: stag * (1 - away * 0.9),
              transform: `translateY(${(1 - stag) * 30 + away * 120}px) scale(${win ? 1 + 0.09 * winnerLift : 1 - 0.06 * away})`,
              boxShadow: win ? `0 24px 70px rgba(48,184,255,${0.22 * winnerLift})` : 'none',
            }}>
              <span style={{ display: 'flex', gap: 22, alignItems: 'baseline' }}>
                <span style={{ color: INK_FAINT, fontSize: 22 }}>{'0' + (i + 1)}</span>
                <span>{s.name}</span>
              </span>
              <span style={{ color: win ? ACCENT : INK_SOFT }}>{Math.round(s.bank * count).toLocaleString('it-IT')}</span>
            </div>
          );
        })}
      </div>

      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', opacity: outro }}>
        <div style={{ font: `800 40px ${DISPLAY}`, letterSpacing: '5px', textTransform: 'uppercase',
                      color: INK_SOFT, opacity: MOTION.enter(w(t, 2.5, 3.1)) }}>Finalista</div>
        <Wordmark text="Giulia" size={210} gp={glint(w(t, 2.7, 4.2))}
                  style={{ marginTop: 30, opacity: MOTION.enter(w(t, 2.55, 3.2)),
                           transform: `scale(${0.82 + 0.18 * MOTION.enter(title) + 0.012 * MOTION.drive(w(t, 3.3, 5))})`,
                           filter: `blur(${(1 - MOTION.enter(title)) * 22}px)` }} />
        <div style={{ font: `400 28px ${MONO}`, letterSpacing: '3px', color: INK_SOFT, marginTop: 40,
                      opacity: MOTION.enter(w(t, 3.1, 3.8)) }}>va al gioco finale!</div>
      </div>
    </Chrome>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 · BUSTE — the game's three envelopes: outcome is colour only (cyan = verde,
// dim white = rosso, per style.css), then one opens and the prize rises out.
// ═══════════════════════════════════════════════════════════════════════════
const BUSTE = [
  { n: '1', green: true,  prize: 'Viaggio a New York' },
  { n: '2', green: false, prize: 'Niente premio' },
  { n: '3', green: true,  prize: 'Weekend a Parigi' },
];
const EDGE_GREEN = 'rgba(48,184,255,0.85)';
const EDGE_RED = 'rgba(245,245,247,0.35)';
const EDGE_IDLE = 'rgba(255,255,255,0.35)';

// Geometry from public/js/fx/envelopes3d.js: W 1.7 × H 1.15, flap hinged on the
// top edge at 0.52H, number below the body, content rises from inside to above.
const EW = 408, EH = 276;

function Busta({ item, arrive, reveal, open, dim, push, t }) {
  const edge = reveal > 0.5 ? (item.green ? EDGE_GREEN : EDGE_RED) : EDGE_IDLE;
  const glow = item.green ? 'rgba(48,184,255,0.55)' : 'rgba(245,245,247,0.28)';
  const flap = MOTION.enter(open);
  const rise = MOTION.enter(clamp((open - 0.25) / 0.75, 0, 1));
  const bob = Math.sin(t * 1.15 + Number(item.n)) * 5;
  return (
    <div style={{
      position: 'relative', width: EW, height: EH + 92,
      opacity: arrive * (1 - dim * 0.72),
      transform: `translateY(${(1 - arrive) * 110 + bob - 40 * push}px) scale(${1 + 0.16 * push - 0.05 * dim})`,
    }}>
      {/* content rises out of the envelope and parks above the open flap */}
      <div style={{
        position: 'absolute', zIndex: 3, left: -50, right: -50, top: 34 - 176 * rise, textAlign: 'center',
        font: `700 34px ${MONO}`, letterSpacing: '0.5px', color: INK, textWrap: 'pretty',
        opacity: rise, textShadow: '0 6px 26px rgba(0,0,0,0.9)',
      }}>{item.prize}</div>

      {/* body */}
      <div style={{
        position: 'absolute', left: 0, top: 0, width: EW, height: EH, borderRadius: 6, boxSizing: 'border-box',
        border: `2px solid ${edge}`, background: '#0e0e12', ...DOTS,
        boxShadow: `0 18px 60px rgba(0,0,0,0.55), 0 0 ${46 * reveal + 54 * push}px ${glow}`,
      }} />
      {/* triangular flap, hinged on the top edge */}
      <div style={{
        position: 'absolute', left: 0, top: 0, width: EW, height: EH * 0.52,
        clipPath: 'polygon(0 0, 100% 0, 50% 100%)', background: '#22222b', ...DOTS,
        transformOrigin: '50% 0', transform: `rotateX(${-flap * 158}deg)`,
        filter: `drop-shadow(0 2px 0 ${edge}) brightness(${1 - 0.3 * flap})`,
      }} />
      {/* number, in the accent, below the body */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: EH + 22, textAlign: 'center',
                    font: `700 46px ${MONO}`, color: ACCENT, opacity: 0.9 }}>{item.n}</div>
    </div>
  );
}

function Buste() {
  const { localTime: t } = useScene();
  const outro = 1 - w(t, 5.3, 5.9);
  const openU = w(t, 3.25, 4.25);

  return (
    <Chrome label={`Buste +${t.toFixed(1)}s`}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 130, opacity: outro }}>
        <div style={{ font: `800 40px ${DISPLAY}`, letterSpacing: '5px', textTransform: 'uppercase',
                      color: INK_SOFT,
                      opacity: MOTION.enter(w(t, 0.1, 0.8)) * (1 - w(t, 2.5, 3.1)) }}>Le buste</div>

        <div style={{ display: 'flex', gap: 58, alignItems: 'flex-start', perspective: 2400 }}>
          {BUSTE.map((e, i) => (
            <Busta key={e.n} item={e} t={t}
                   arrive={MOTION.enter(clamp((t - 0.12 - i * 0.14) / 0.6, 0, 1))}
                   reveal={MOTION.drive(clamp((t - 0.9 - i * 0.42) / 0.5, 0, 1))}
                   open={i === 0 ? openU : 0}
                   push={i === 0 ? MOTION.enter(w(t, 2.5, 3.3)) : 0}
                   dim={i === 0 ? 0 : MOTION.enter(w(t, 2.5, 3.2))} />
          ))}
        </div>

        <div style={{ font: `400 26px ${MONO}`, letterSpacing: '3px', color: INK_SOFT,
                      opacity: MOTION.enter(w(t, 4.4, 5.0)) }}>Puoi cambiarla alla cieca.</div>
      </div>
    </Chrome>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
function GiramoeReel() {
  const [tw, setTweak] = useTweaks(window.TWEAK_DEFAULTS);
  TW = tw;
  const [armed, setArmed] = React.useState(false);
  React.useEffect(() => {
    if (window.GiramoeAudio) window.GiramoeAudio.setEnabled(tw.sound !== false);
  }, [tw.sound]);
  const arm = () => {
    if (window.GiramoeAudio) window.GiramoeAudio.unlock();
    setArmed(true);
  };
  React.useEffect(() => {
    window.addEventListener('pointerdown', arm, { once: true });
    window.addEventListener('keydown', arm, { once: true });
    return () => { window.removeEventListener('pointerdown', arm); window.removeEventListener('keydown', arm); };
  }, []);
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#000' }}>
      <SceneStage width={1920} height={1080} scenes={window.OM_SCENES}
                  playback={window.OM_PLAYBACK} bg="#000000">
        {{
          'Il Triplete': Triplete,
          'Express': Express,
          'Giramoe': Giramoe,
          'Finalista': Finalista,
          'Buste': Buste,
        }}
      </SceneStage>
      {!armed && (
        <div onClick={arm} style={{
          position: 'absolute', zIndex: 60, left: '50%', bottom: 26, transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
          padding: '11px 22px', borderRadius: 999, background: 'rgba(10,10,12,0.82)',
          border: '1px solid rgba(255,255,255,0.22)', backdropFilter: 'blur(8px)',
          font: `600 12px ${MONO}`, letterSpacing: '2.5px', textTransform: 'uppercase', color: INK,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: ACCENT }} />
          Tocca per l'audio
        </div>
      )}
      <TweaksPanel>
        <TweakSection label="Editing" />
        <TweakToggle label="Motion editor" value={tw.motionEditor}
                     onChange={(v) => setTweak('motionEditor', v)} />
        <TweakSection label="Broadcast chrome" />
        <TweakToggle label="Corner labels" value={tw.chrome}
                     onChange={(v) => setTweak('chrome', v)} />
        <TweakToggle label="Film grain" value={tw.grain}
                     onChange={(v) => setTweak('grain', v)} />
        <TweakSection label="Audio" />
        <TweakToggle label="Sound" value={tw.sound !== false}
                     onChange={(v) => setTweak('sound', v)} />
      </TweaksPanel>
    </div>
  );
}

window.GiramoeReel = GiramoeReel;
