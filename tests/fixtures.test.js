// I fixture dell'harness ?mock= rigiocano payload agli handler veri delle tre
// superfici. Il modo di sbagliare più facile è un nome di evento storto: il
// fixture "funziona" ma non renderizza niente, e in console resta un warning che
// è facile non vedere. Qui il controllo è statico e copre tutti i fixture in una
// volta, invece di aprire trenta schermate a mano.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

// gli eventi che ogni superficie ascolta davvero, letti dal suo sorgente
const SURFACE_FILES = {
  tv:    ['public/js/main.js'],
  phone: ['public/js/player.js'],
  admin: ['public/js/admin.js']
};

function handledEvents(files) {
  const out = new Set();
  for (const f of files) {
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    for (const m of src.matchAll(/socket\.on\(\s*'([^']+)'/g)) out.add(m[1]);
  }
  return out;
}

const fixtures = () => import('../public/js/dev/fixtures.mjs');

test('ogni evento emesso dai fixture ha un handler nella sua superficie', async () => {
  const { BY_SURFACE } = await fixtures();
  const problems = [];
  for (const [surface, screens] of Object.entries(BY_SURFACE)) {
    const handled = handledEvents(SURFACE_FILES[surface]);
    for (const [id, build] of Object.entries(screens)) {
      for (const [event] of build(null)) {
        if (!handled.has(event)) problems.push(`${surface}/${id} → ${event}`);
      }
    }
  }
  assert.deepStrictEqual(problems, [], 'eventi senza handler:\n  ' + problems.join('\n  '));
});

test('ogni fixture emette payload di stato, non eventi che avviano animazioni', async () => {
  const { BY_SURFACE } = await fixtures();
  // main:spin fa girare la ruota per 6s, main:letterCalled apre l'overlay del
  // risultato: in una schermata da confrontare col render non ci vanno.
  const ANIMATI = new Set(['main:spin', 'main:letterCalled', 'main:revealLetter',
                           'main:solved', 'main:wrong', 'player:spinResult']);
  const problems = [];
  for (const [surface, screens] of Object.entries(BY_SURFACE)) {
    for (const [id, build] of Object.entries(screens)) {
      for (const [event] of build(null)) {
        if (ANIMATI.has(event)) problems.push(`${surface}/${id} → ${event}`);
      }
    }
  }
  assert.deepStrictEqual(problems, [], 'eventi di animazione nei fixture:\n  ' + problems.join('\n  '));
});

test('le griglie generate sono 4×16 e vengono da board.js', async () => {
  const { GRIDS } = await import('../public/js/dev/boards.generated.mjs');
  const board = require('../board');
  const phrases = Object.keys(GRIDS);
  assert.ok(phrases.length >= 5, 'servono almeno 5 frasi d\'esempio');
  for (const [phrase, variants] of Object.entries(GRIDS)) {
    for (const [rev, grid] of Object.entries(variants)) {
      assert.strictEqual(grid.length, 4, `${phrase}/${rev}: righe`);
      grid.forEach((row, r) => assert.strictEqual(row.length, 16, `${phrase}/${rev}: riga ${r}`));
      // il conto delle lettere deve combaciare con quello di board.js
      const fresh = board.createBoard('X', phrase);
      assert.strictEqual(fresh.ok, true, `${phrase}: board.js rifiuta la frase`);
      const expected = fresh.board.grid.flat().filter(c => c.type === 'letter').length;
      const actual = grid.flat().filter(c => c.type === 'letter').length;
      assert.strictEqual(actual, expected,
        `${phrase}/${rev}: la griglia generata non combacia con board.js — rilancia scripts/gen-fixtures.js`);
    }
  }
});
