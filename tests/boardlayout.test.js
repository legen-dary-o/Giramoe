const { test } = require('node:test');
const assert = require('node:assert');
const board = require('../board');

test('gridToTiles esclude le celle edge (angoli) e mappa letter/blocked', async () => {
  const { gridToTiles } = await import('../public/js/fx/boardlayout.mjs');
  const res = board.createBoard('TEST', 'CIAO MONDO');
  assert.strictEqual(res.ok, true);
  const tiles = gridToTiles(res.board.grid);

  // 4×16 = 64 celle, meno le 4 edge agli angoli = 60 tessere renderizzate
  assert.strictEqual(tiles.length, 60);
  // nessuna tessera negli angoli (righe 0/3, colonne 0/15)
  assert.ok(!tiles.some(t => (t.row === 0 || t.row === 3) && (t.col === 0 || t.col === 15)));
  // le lettere della frase, non rivelate
  const letters = tiles.filter(t => t.kind === 'letter');
  assert.strictEqual(letters.length, 'CIAOMONDO'.length);
  assert.ok(letters.every(t => t.revealed === false && /^[A-Z]$/.test(t.letter)));
  // tutto il resto è blocked senza lettera
  assert.ok(tiles.filter(t => t.kind === 'blocked').every(t => t.letter === null));
});
