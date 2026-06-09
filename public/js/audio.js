// Sound effects for the MAIN display only. A single user gesture (the tap-to-start
// click) unlocks playback for the whole page.
const SOUNDS = {
  spin: new Audio('/assets/spinning-wheel.mp3'),
  letter: new Audio('/assets/lettera_rivelata.mp3'),
  correct: new Audio('/assets/risposta_corretta.mp3'),
  wrong: new Audio('/assets/risposta_o_lettera_sbagliata.mp3')
};
SOUNDS.spin.loop = true;

const Sfx = {
  // Prime each sound inside a user gesture so later programmatic play() is allowed.
  unlock() {
    Object.values(SOUNDS).forEach(a => {
      a.muted = true;
      const p = a.play();
      if (p && p.then) {
        p.then(() => { a.pause(); a.currentTime = 0; a.muted = false; })
         .catch(() => { a.muted = false; });
      } else {
        a.muted = false;
      }
    });
  },
  play(name) {
    const a = SOUNDS[name];
    if (!a) return;
    try { a.currentTime = 0; } catch (e) {}
    a.play().catch(() => {});
  },
  startSpin() {
    try { SOUNDS.spin.currentTime = 0; } catch (e) {}
    SOUNDS.spin.play().catch(() => {});
  },
  stopSpin() {
    SOUNDS.spin.pause();
    try { SOUNDS.spin.currentTime = 0; } catch (e) {}
  }
};

window.Sfx = Sfx;
