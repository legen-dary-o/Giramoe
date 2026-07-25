// giramoe-audio.js — procedural score for the Giramoe reel.
// Cues are authored as PROGRESS fractions inside each scene, so they survive
// the host timeline's retiming (a stretched scene stretches its score too).
// Three cues use the game's real assets (public/assets); everything else is
// synthesised, so nothing extra has to be sourced to hear the design.
(function () {
  let ctx = null, master = null, noise = null;
  const buf = {};
  const FILES = {
    spin: 'assets/spinning-wheel.mp3',
    letter: 'assets/lettera_rivelata.mp3',
  };
  let spinNode = null;
  let enabled = true;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    const n = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noise = n;
    Object.keys(FILES).forEach((k) => {
      fetch(FILES[k]).then((r) => r.arrayBuffer())
        .then((a) => ctx.decodeAudioData(a)).then((b) => { buf[k] = b; })
        .catch(() => {});
    });
    return ctx;
  }

  const now = () => ctx.currentTime + 0.01;
  function gain(v, t) { const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.connect(master); return g; }
  function tone(type, f, t, dur, peak, detune) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (detune) o.detune.value = detune;
    const g = gain(0, t);
    g.gain.linearRampToValueAtTime(peak, t + Math.min(0.03, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  function noiseBurst(t, dur, peak, f0, f1, q) {
    const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q = q || 1;
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    const g = gain(0, t);
    g.gain.linearRampToValueAtTime(peak, t + dur * 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bp); bp.connect(g); s.start(t); s.stop(t + dur + 0.05);
  }
  function sample(name, vol, loop) {
    const b = buf[name]; if (!b) return null;
    const s = ctx.createBufferSource(); s.buffer = b; s.loop = !!loop;
    const g = gain(vol, now()); s.connect(g); s.start(now());
    return s;
  }

  // ── voices ────────────────────────────────────────────────────────────────
  const V = {
    drone(dur) {
      const t = now();
      [55, 82.5].forEach((f, i) => {
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(f, t);
        const g = gain(0, t);
        g.gain.linearRampToValueAtTime(0.11 / (i + 1), t + 1.2);
        g.gain.setValueAtTime(0.11 / (i + 1), t + dur * 0.8);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); o.start(t); o.stop(t + dur + 0.2);
      });
    },
    drop() {
      const t = now();
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(28, t + 1.1);
      const g = gain(0, t);
      g.gain.linearRampToValueAtTime(0.5, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
      o.connect(g); o.start(t); o.stop(t + 1.6);
      noiseBurst(t, 0.5, 0.13, 3000, 120, 0.6);
    },
    clack() {
      const t = now();
      tone('square', 1750, t, 0.05, 0.16);
      tone('triangle', 620, t, 0.13, 0.13);
      noiseBurst(t, 0.09, 0.2, 5500, 900, 2.5);
    },
    horn(low) {
      const t = now();
      const f = low ? 233 : 311;      // a minor-third pair, like a two-tone horn
      [f, f * 1.5, f * 0.5].forEach((ff, i) => tone('sawtooth', ff, t, 0.95, 0.075 / (i + 1), i * 6));
      noiseBurst(t, 0.95, 0.02, 900, 500, 1.2);
    },
    whoosh(dur) { noiseBurst(now(), dur || 0.55, 0.22, 250, 7000, 0.8); },
    hiss(dur) { noiseBurst(now(), dur || 0.9, 0.11, 6500, 2200, 1.4); },
    rumble(dur) {
      const t = now();
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(34, t); o.frequency.linearRampToValueAtTime(58, t + dur);
      const g = gain(0, t);
      g.gain.linearRampToValueAtTime(0.34, t + dur * 0.8);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.3);
      o.connect(g); o.start(t); o.stop(t + dur + 0.4);
      noiseBurst(t, dur, 0.07, 90, 320, 0.9);
    },
    ping(f) { const t = now(); tone('sine', f, t, 0.34, 0.09); tone('sine', f * 2, t, 0.16, 0.03); },
    tick() { noiseBurst(now(), 0.045, 0.1, 2600, 1400, 3); },
    paper() { noiseBurst(now(), 0.28, 0.13, 1800, 350, 0.9); },
    chime(f, bright) {
      const t = now();
      tone('sine', f, t, bright ? 1.5 : 0.7, 0.11);
      tone('sine', f * (bright ? 2 : 1.19), t, bright ? 1.1 : 0.5, 0.05);
    },
    chord(root, dur) {
      const t = now();
      [1, 1.5, 2, 3].forEach((m, i) => tone(i > 1 ? 'triangle' : 'sine', root * m, t, dur, 0.075 / (i * 0.6 + 1)));
    },
    swell(dur) {
      const t = now();
      const o = ctx.createOscillator(); o.type = 'triangle';
      o.frequency.setValueAtTime(110, t); o.frequency.linearRampToValueAtTime(220, t + dur);
      const g = gain(0, t);
      g.gain.linearRampToValueAtTime(0.13, t + dur * 0.85);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.2);
      o.connect(g); o.start(t); o.stop(t + dur + 0.3);
    },
    spinStart() { if (spinNode) return; spinNode = sample('spin', 0.5, true); },
    spinStop() { if (spinNode) { try { spinNode.stop(); } catch (e) {} spinNode = null; } },
    letter() { sample('letter', 0.7); },
  };

  // ── cue sheet: [progress, fn] per scene ───────────────────────────────────
  const CUES = {
    'Il Triplete': [
      [0.005, () => V.spinStart()],
      [0.578, () => { V.spinStop(); V.clack(); }],
      [0.586, () => V.drop()],
      [0.668, () => V.chord(131, 2.2)],
    ],
    'Express': [
      [0.005, () => V.rumble(3.1)],
      [0.11, () => V.horn(true)], [0.30, () => V.horn(false)],
      [0.55, () => V.hiss(1.1)],
      [0.585, () => { V.whoosh(0.5); V.drop(); }],
      [0.63, () => V.chord(147, 2.0)],
    ],
    'Giramoe': (function () {
      const c = [];
      for (let i = 0; i < 16; i++) c.push([0.05 + i * 0.0275, () => V.ping(330 * Math.pow(2, i / 24))]);
      c.push([0.66, () => V.chord(110, 2.2)]);
      return c;
    })(),
    'Finalista': [
      [0.06, () => V.tick()], [0.10, () => V.tick()], [0.14, () => V.tick()],
      [0.18, () => V.tick()], [0.22, () => V.tick()],
      [0.30, () => V.swell(1.15)],
      [0.51, () => { V.drop(); V.chime(659, true); }],
      [0.53, () => V.chord(165, 2.6)],
    ],
    'Buste': [
      [0.02, () => V.paper()], [0.043, () => V.paper()], [0.067, () => V.paper()],
      [0.192, () => V.chime(523, true)],
      [0.262, () => V.chime(196, false)],
      [0.332, () => V.chime(659, true)],
      [0.433, () => V.letter()],
      [0.558, () => V.paper()],
      [0.650, () => { V.chime(784, true); V.chime(1047, true); }],
    ],
  };

  let curScene = null, lastP = -1;

  window.GiramoeAudio = {
    unlock() { const c = ensure(); if (c && c.state === 'suspended') c.resume(); },
    ready() { return !!ctx && ctx.state === 'running'; },
    setEnabled(v) { enabled = !!v; if (!v) V.spinStop(); },
    // Called from every scene render. Fires the cues crossed since last frame;
    // a jump backwards or a big jump forwards (scrub, export seek) only re-syncs.
    tick(scene, p) {
      if (!enabled || !ctx || ctx.state !== 'running') return;
      if (scene !== curScene) { V.spinStop(); curScene = scene; lastP = -1; }
      const list = CUES[scene] || [];
      const dp = p - lastP;
      if (lastP < 0 || dp < 0 || dp > 0.12) { lastP = p; if (dp < 0) V.spinStop(); return; }
      for (let i = 0; i < list.length; i++) {
        if (list[i][0] > lastP && list[i][0] <= p) { try { list[i][1](); } catch (e) {} }
      }
      lastP = p;
    },
  };
})();
