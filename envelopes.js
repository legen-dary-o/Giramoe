// The final reveal: 3 envelopes coloured by the final game's three results (green =
// solved, red = not). The finalist may open a GREEN envelope (if there are 2-3 greens
// they choose which; 1 green = that one; 0 greens = none). After opening they may
// blindly change to another green via a button — up to (greens - 1) times — and a
// changed-away envelope can't be re-chosen. Red envelopes are revealed only by the
// admin, one at a time. Contents are admin-entered text. Pure state machine.

function createEnvelopes(results, contents) {
  const envelopes = results.map((r, i) => ({
    color: r ? 'green' : 'red',
    content: String(contents && contents[i] != null ? contents[i] : ''),
    revealed: false,
    abandoned: false
  }));
  const greens = envelopes.map((e, i) => (e.color === 'green' ? i : -1)).filter(i => i >= 0);
  return {
    envelopes,
    greens,                                   // greens still available to open/change into
    current: null,                            // index the finalist currently holds
    changesLeft: Math.max(0, greens.length - 1),
    state: greens.length === 0 ? 'NONE' : 'CHOOSING' // NONE | CHOOSING | OPENED
  };
}

// Finalist opens a green envelope (their first choice).
function openEnvelope(env, index) {
  if (env.state !== 'CHOOSING') return { ok: false };
  const e = env.envelopes[index];
  if (!e || e.color !== 'green' || e.revealed) return { ok: false };
  e.revealed = true;
  env.current = index;
  env.greens = env.greens.filter(i => i !== index);
  env.state = 'OPENED';
  return { ok: true, index, content: e.content };
}

// Finalist blindly swaps to the next available green; the held one is abandoned.
function changeEnvelope(env) {
  if (env.state !== 'OPENED' || env.changesLeft <= 0 || env.greens.length === 0) return { ok: false };
  env.envelopes[env.current].abandoned = true;
  const next = env.greens.shift();
  env.envelopes[next].revealed = true;
  env.current = next;
  env.changesLeft -= 1;
  return { ok: true, index: next, content: env.envelopes[next].content };
}

// Admin reveals a red envelope (one at a time, any time).
function revealRed(env, index) {
  const e = env.envelopes[index];
  if (!e || e.color !== 'red' || e.revealed) return { ok: false };
  e.revealed = true;
  return { ok: true, index, content: e.content };
}

module.exports = { createEnvelopes, openEnvelope, changeEnvelope, revealRed };
