// Lo split del CSS in cinque file ha aperto un modo di sbagliare che nessuna
// verifica visiva coglie: una @keyframes definita nel file di UNA superficie e
// usata da un'altra. L'impronta dei valori calcolati non se ne accorge, perché
// `animation: waitPulse 2s …` resta scritta identica anche quando i keyframes
// non esistono: semplicemente l'animazione non parte, in silenzio.
//
// Questo test lega ogni pagina ai suoi <link> e controlla che ogni animazione
// usata sia definita in almeno uno dei file che quella pagina carica davvero.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, '..', 'public');
const PAGES = ['index.html', 'play.html', 'admin.html'];

// parole che in una shorthand `animation` non sono un nome di keyframes
const KEYWORDS = new Set([
  'none', 'infinite', 'normal', 'reverse', 'alternate', 'alternate-reverse',
  'both', 'forwards', 'backwards', 'running', 'paused',
  'linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'step-start', 'step-end'
]);

const isValue = (tok) => /^-?[\d.]+m?s$/.test(tok) || /^-?[\d.]+%?$/.test(tok) || KEYWORDS.has(tok);

function cssOf(page) {
  const html = fs.readFileSync(path.join(PUBLIC, page), 'utf8');
  const files = [...html.matchAll(/<link[^>]+href="\/css\/([^"]+)"/g)].map(m => m[1]);
  assert.ok(files.length, `${page} non carica nessun CSS`);
  return { files, text: files.map(f => fs.readFileSync(path.join(PUBLIC, 'css', f), 'utf8')).join('\n') };
}

const defined = (css) => new Set([...css.matchAll(/@keyframes\s+([\w-]+)/g)].map(m => m[1]));

// i nomi usati, uno per pezzo separato da virgola in ogni dichiarazione
function used(css) {
  const out = [];
  for (const m of css.matchAll(/animation(?:-name)?\s*:\s*([^;}]+)/g)) {
    for (const part of m[1].split(',')) {
      // via le funzioni (var(--ease-out), cubic-bezier(…)): non contengono nomi
      const tokens = part.replace(/[\w-]+\([^)]*\)/g, ' ').trim().split(/\s+/).filter(Boolean);
      const names = tokens.filter(t => !isValue(t));
      if (names.length) out.push({ decl: part.trim(), names });
    }
  }
  return out;
}

test('ogni pagina definisce le keyframes che usa', () => {
  for (const page of PAGES) {
    const { files, text } = cssOf(page);
    const have = defined(text);
    for (const { decl, names } of used(text)) {
      for (const name of names) {
        assert.ok(have.has(name),
          `${page} (${files.join(' + ')}) usa "${name}" in "${decl}" ma non la definisce`);
      }
    }
  }
});

test('nessuna animazione con un nome che non esiste da nessuna parte', () => {
  const dir = path.join(PUBLIC, 'css');
  const all = fs.readdirSync(dir).filter(f => f.endsWith('.css'))
    .map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  const have = defined(all);
  for (const { decl, names } of used(all)) {
    for (const name of names) {
      assert.ok(have.has(name), `"${name}" usata in "${decl}" non è definita in nessun file`);
    }
  }
});

test('le pagine non caricano più style.css', () => {
  for (const page of PAGES) {
    assert.ok(!cssOf(page).files.includes('style.css'), `${page} carica ancora style.css`);
  }
  assert.ok(!fs.existsSync(path.join(PUBLIC, 'css', 'style.css')), 'style.css esiste ancora');
});
