// Contenuti d'esempio dei mockup, nella forma ESATTA dei payload del server
// (mainGameView, playerGiramoeView, envelopesView, …). Se una forma qui non
// combacia con quella di server.js, il fixture è sbagliato: la forma giusta è
// quella del server.
//
// Regola: il fixture emette solo payload di STATO. Gli eventi che innescano
// un'animazione (`main:spin` fa girare la ruota per 6s, `main:letterCalled` apre
// l'overlay del risultato) non vanno in una schermata ferma — o la schermata non
// si riesce a confrontare col render.

// Le griglie NON si scrivono a mano: le genera scripts/gen-fixtures.js usando
// board.js, cioè lo stesso codice del server.
import { GRIDS } from './boards.generated.js';

export const PLAYERS = [
  { id: 0, name: 'Marco',  roundPoints: 1400, bank: 3200, connected: true },
  { id: 1, name: 'Giulia', roundPoints: 0,    bank: 5800, connected: true },
  { id: 2, name: 'Elia',   roundPoints: 0,    bank: 2100, connected: true }
];

const PROVERBIO = 'NON TUTTE LE CIAMBELLE RIESCONO CON IL BUCO';

// Gli stessi 16 spicchi di game.js
const SEGMENTS = [1000, 'bancarotta', 'raddoppia', 200, 400, 500, 'next', 400,
                  300, 700, 500, 'next', 400, 300, 500, 'next'];

const TV = {
  // 1c · primo gioco, turno di Marco: ha appena chiamato T, uscite 3 occorrenze
  '1c': () => [
    ['main:state', { phase: 'playing' }],
    ['main:gameState', {
      board: { category: 'PROVERBI', grid: GRIDS[PROVERBIO].NTE },
      scores: PLAYERS,
      currentTurn: 0,
      boardNumber: 1,
      totalBoards: 3,
      segments: SEGMENTS
    }],
    ['main:boardStatus', { consonantsFinished: false, vowelsFinished: false }]
  ]
};

const PHONE = {};
const ADMIN = {};

const BY_SURFACE = { tv: TV, phone: PHONE, admin: ADMIN };

export function sequenceFor(surface, screen, freeze) {
  const build = (BY_SURFACE[surface] || {})[screen];
  return build ? build(freeze) : null;
}
