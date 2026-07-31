// La ruota ha una sola convenzione angolare: lo spicchio 0 PARTE a ore 12 e i
// separatori stanno sui confini, non in mezzo alle bande. Nel mockup di design
// questa invariante era rotta (colori da 0deg, separatori da -11.25deg) e la
// linea nera cadeva sopra l'etichetta. Questo test la blocca.
const { test } = require('node:test');
const assert = require('node:assert');

const TAU = Math.PI * 2;
// distanza angolare minima fra due angoli, ignorando i giri interi
const near = (a, b) => Math.abs(((a - b + Math.PI) % TAU + TAU) % TAU - Math.PI);

// `await import` di un .mjs da un test CommonJS: stessa forma di
// tests/boardlayout.test.js
const geom = () => import('../public/js/fx/wheelgeom.mjs');

test('lo spicchio 0 parte a ore 12', async () => {
  const { boundaryAngle } = await geom();
  assert.ok(near(boundaryAngle(0), -Math.PI / 2) < 1e-9);
});

test('ogni etichetta sta esattamente in mezzo ai due confini del suo spicchio', async () => {
  const { boundaryAngle, midAngle, SEGMENTS } = await geom();
  for (let i = 0; i < SEGMENTS; i++) {
    const expected = boundaryAngle(i) + (TAU / SEGMENTS) / 2;
    assert.ok(near(midAngle(i), expected) < 1e-9, `spicchio ${i}`);
  }
});

test('nessun separatore cade su un centro di spicchio', async () => {
  const { boundaryAngle, midAngle, SEGMENTS } = await geom();
  for (let i = 0; i < SEGMENTS; i++) {
    for (let j = 0; j < SEGMENTS; j++) {
      assert.ok(near(boundaryAngle(i), midAngle(j)) > 1e-3,
        `separatore ${i} sopra l'etichetta ${j}`);
    }
  }
});

test('i confini sono 16, equispaziati di 22.5 gradi', async () => {
  const { boundaryAngle, SEGMENTS } = await geom();
  const step = TAU / SEGMENTS;
  assert.strictEqual(SEGMENTS, 16);
  for (let i = 0; i < SEGMENTS; i++) {
    assert.ok(near(boundaryAngle(i + 1) - boundaryAngle(i), step) < 1e-9);
  }
});
