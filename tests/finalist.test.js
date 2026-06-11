const { test } = require('node:test');
const assert = require('node:assert');
const finalist = require('../finalist');

test('topPlayers returns the single highest-bank player', () => {
  const players = [
    { id: 0, bank: 3000 }, { id: 1, bank: 5000 }, { id: 2, bank: 1000 }
  ];
  assert.deepStrictEqual(finalist.topPlayers(players), [1]);
});

test('topPlayers returns all tied leaders', () => {
  const players = [
    { id: 0, bank: 4000 }, { id: 1, bank: 4000 }, { id: 2, bank: 1000 }
  ];
  assert.deepStrictEqual(finalist.topPlayers(players), [0, 1]);
});

test('topPlayers handles a three-way tie', () => {
  const players = [
    { id: 0, bank: 2000 }, { id: 1, bank: 2000 }, { id: 2, bank: 2000 }
  ];
  assert.deepStrictEqual(finalist.topPlayers(players), [0, 1, 2]);
});

test('evaluateSpins picks the single highest spin', () => {
  assert.deepStrictEqual(finalist.evaluateSpins([0, 1], { 0: 400, 1: 700 }), { winner: 1 });
});

test('evaluateSpins reports the tied-top for sudden death', () => {
  assert.deepStrictEqual(finalist.evaluateSpins([0, 1, 2], { 0: 500, 1: 500, 2: 200 }), { tied: [0, 1] });
});

test('evaluateSpins with all equal keeps everyone tied', () => {
  assert.deepStrictEqual(finalist.evaluateSpins([0, 1], { 0: 300, 1: 300 }), { tied: [0, 1] });
});
