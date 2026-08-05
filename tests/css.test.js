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

// Secondo modo di sbagliare invisibile: `@media (prefers-reduced-motion)` che
// spegne `.wm`, e da qualche altra parte un `.wm.rise` che rimette in piedi
// l'animazione. Il compound ha specificità più alta, quindi vince: chi ha
// chiesto di non far muovere niente vede muoversi tutto, e la regola che
// dovrebbe proteggerlo è lì scritta bene, quindi rileggendo il file sembra a
// posto. Va confrontata la specificità, non l'ordine.
function reducedMotionBlocks(css) {
  const out = [];
  const re = /@media[^{]*prefers-reduced-motion[^{]*\{/g;
  let m;
  while ((m = re.exec(css))) {
    // dalla graffa del @media, si conta fino a quella che lo chiude
    let depth = 1;
    let i = re.lastIndex;
    for (; i < css.length && depth > 0; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
    }
    out.push({ start: m.index, end: i, body: css.slice(re.lastIndex, i - 1) });
  }
  return out;
}

const norm = (sel) => sel.trim().replace(/\s+/g, ' ');

// Cosa spegne il blocco: le classi finali dei suoi selettori (`.wm` da `.wm`,
// `.dot` da `.pbanner .dot`) e i selettori interi, che servono a riconoscere i
// composti già messi a posto — `.wm.rise` nominato per esteso è la cura, non
// il problema.
function spente(body) {
  const classi = new Set();
  const selettori = new Set();
  for (const m of body.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/animation(?:-name)?\s*:\s*none/.test(m[2])) continue;
    for (const sel of m[1].split(',')) {
      selettori.add(norm(sel));
      const last = sel.trim().split(/\s+/).pop();
      const cls = last.match(/\.[\w-]+/g);
      if (cls) classi.add(cls[cls.length - 1]);
    }
  }
  return { classi, selettori };
}

test('a movimento ridotto nessun selettore composto riaccende un\'animazione spenta', () => {
  const dir = path.join(PUBLIC, 'css');
  const problems = [];
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.css'))) {
    const css = fs.readFileSync(path.join(dir, file), 'utf8');
    const blocks = reducedMotionBlocks(css);
    if (!blocks.length) continue;
    const dentro = (i) => blocks.some(b => i >= b.start && i < b.end);
    const off = new Set();
    const curate = new Set();
    blocks.forEach(b => {
      const s = spente(b.body);
      s.classi.forEach(c => off.add(c));
      s.selettori.forEach(x => curate.add(x));
    });

    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (dentro(m.index)) continue;                       // le regole del blocco stesso
      const decl = m[2];
      if (!/animation(?:-name)?\s*:/.test(decl) || /animation(?:-name)?\s*:\s*none/.test(decl)) continue;
      for (const parte of m[1].split(',')) {
        if (curate.has(norm(parte))) continue;             // il blocco lo nomina per esteso
        for (const cls of off) {
          // `.wm` seguito subito da un'altra classe/pseudo: stesso elemento,
          // specificità più alta. `.wm .rise` (spazio) è un altro elemento e va bene.
          const composto = new RegExp(cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[.:#\\[]');
          if (composto.test(parte)) {
            problems.push(`${file}: "${norm(parte)}" riaccende ${cls}, spenta a movimento ridotto`);
          }
        }
      }
    }
  }
  assert.deepStrictEqual(problems, [], 'animazioni che sopravvivono a movimento ridotto:\n  ' + problems.join('\n  '));
});

test('le pagine non caricano più style.css', () => {
  for (const page of PAGES) {
    assert.ok(!cssOf(page).files.includes('style.css'), `${page} carica ancora style.css`);
  }
  assert.ok(!fs.existsSync(path.join(PUBLIC, 'css', 'style.css')), 'style.css esiste ancora');
});

// Terzo modo di sbagliare invisibile, e il più cattivo perché si vede solo su un
// telefono: `background:` in forma abbreviata con dentro SOLO dei gradienti
// azzera `background-color` a `transparent`. Il fondo della pagina (la "canvas")
// prende il colore dell'elemento radice e lo stende su TUTTA la superficie, ma
// le immagini di sfondo no: quelle restano incollate al riquadro di html, alto
// `100%`. Fuori da quel riquadro non resta niente da dipingere e il browser usa
// il suo bianco. Su desktop e su Android non si nota; su iPhone quel "fuori"
// esiste sempre — le due strisce in cima e in fondo, dove Safari apre e chiude
// le sue barre — ed erano bianche.
// I commenti vanno via prima di leggere i selettori: `([^{}]+){` prende tutto
// quello che precede la graffa, commento compreso, e "/* … */ html, body" non è
// uguale a "html, body".
const senzaCommenti = (css) => css.replace(/\/\*[\s\S]*?\*\//g, ' ');

function blocchiDi(css, selettore) {
  const out = [];
  for (const m of senzaCommenti(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (norm(m[1]) === selettore) out.push(m[2]);
  }
  return out;
}

test('la radice ha un colore di fondo, non solo dei gradienti', () => {
  const css = fs.readFileSync(path.join(PUBLIC, 'css', 'tokens.css'), 'utf8');
  const blocchi = blocchiDi(css, 'html, body');
  assert.ok(blocchi.length, 'tokens.css non ha più un blocco `html, body`');
  for (const decl of blocchi) {
    const abbreviata = decl.match(/(?:^|[;{])\s*background\s*:([^;}]+)/);
    assert.ok(!abbreviata || /#|rgb|hsl|var\(--bg/.test(abbreviata[1]),
      '`background:` abbreviata senza colore: azzera background-color e la canvas resta bianca');
    assert.ok(/background-color\s*:/.test(decl),
      'html, body senza `background-color`: su iPhone la canvas fuori dal riquadro resta bianca');
  }
});

test('ogni pagina dice a Safari di che colore sono le sue barre', () => {
  for (const page of PAGES) {
    const html = fs.readFileSync(path.join(PUBLIC, page), 'utf8');
    assert.match(html, /<meta\s+name="theme-color"/,
      `${page} non ha <meta name="theme-color">: su iPhone le barre di Safari restano chiare`);
  }
});

// Quarto modo di sbagliare invisibile su uno schermo grande: in una colonna
// flex `flex-shrink` vale 1 di default. Quando il contenuto supera l'altezza del
// contenitore i figli si schiacciano INVECE di far comparire la barra di
// scorrimento, e il deficit non si spalma: la ruota (aspect-ratio) e la tastiera
// (griglia) hanno un'altezza minima pari alla loro, quindi non cedono niente, e
// tutto finisce sui due bottoni — gli unici la cui altezza minima automatica (una
// riga di testo) sta molto sotto quella dichiarata. Su un iPhone in Safari, dove
// le barre si mangiano ~150px, "Gira la ruota" passava da 58px a 17px.
// A 812px di finestra non succede: solo un test sul sorgente lo tiene fermo.
test('le schermate telefono che scorrono non schiacciano i propri figli', () => {
  const css = senzaCommenti(fs.readFileSync(path.join(PUBLIC, 'css', 'phone.css'), 'utf8'));
  const regole = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  // Solo le colonne delle schermate: `.samiro-body` scorre anche lei, ma è un
  // pannello di testo dove restringersi è quello che deve fare.
  const contenitori = new Set();
  for (const m of regole) {
    if (!/overflow-y\s*:\s*auto/.test(m[2])) continue;
    for (const s of m[1].split(',')) {
      if (/\.mobile-container|-col$/.test(norm(s))) contenitori.add(norm(s));
    }
  }
  assert.ok(contenitori.size, 'phone.css non ha più colonne che scorrono');
  for (const sel of contenitori) {
    const figli = new RegExp('^' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*>\\s*\\*$');
    const regola = regole.find(m =>
      m[1].split(',').some(s => figli.test(norm(s))) &&
      /flex-shrink\s*:\s*0|flex\s*:\s*none/.test(m[2]));
    assert.ok(regola,
      `"${sel}" scorre ma non blocca il restringimento dei figli: i bottoni si schiacciano`);
  }
});

// La pillola di Samiro è `position: fixed`: sta fuori dal flusso, quindi da sola
// non spinge via niente e copre l'ultima cosa della colonna — sul tabellone era
// "Compra vocale". Lo spazio se lo deve riservare il contenitore.
test('la colonna del telefono lascia posto alla pillola di Samiro', () => {
  const css = fs.readFileSync(path.join(PUBLIC, 'css', 'phone.css'), 'utf8');
  assert.match(css, /--dock-space\s*:/,
    'phone.css non definisce --dock-space: l\'ingombro della pillola fissa non è riservato da nessuno');
  const usa = [...css.matchAll(/padding[^;}]*var\(--dock-space\)/g)];
  assert.ok(usa.length >= 1,
    'nessun contenitore usa --dock-space nel proprio padding: la pillola copre l\'ultimo bottone');
});
