// Genera le griglie dei fixture usando board.js, così il markup dell'harness è
// identico a quello che produce il server. Una griglia scritta a mano che non
// combacia con board.js renderebbe bugiardo il confronto col render.
// Uso: node scripts/gen-fixtures.js
const fs = require('fs');
const path = require('path');
const board = require('../board');

// [frase, categoria, lettere già rivelate]
const CASES = [
  ['NON TUTTE LE CIAMBELLE RIESCONO CON IL BUCO', 'PROVERBI', 'NTE'],
  ['MEGLIO UN UOVO OGGI CHE UNA GALLINA DOMANI', 'SAGGEZZA POPOLARE', ''],
  ['IL GIRO DEL MONDO IN OTTANTA GIORNI', 'VIAGGI', 'TONI'],
  ['LE CINQUE TERRE DELLA LIGURIA', 'GEOGRAFIA', 'LRC'],
  ['MI RITORNI IN MENTE BELLA COME SEI', 'CANZONI ITALIANE', 'NRTELMCI']
];

const out = {};
for (const [phrase, category, revealed] of CASES) {
  const res = board.createBoard(category, phrase);
  if (!res.ok) throw new Error(`board.createBoard ha rifiutato "${phrase}": ${res.error}`);
  for (const ch of revealed) board.revealLetter(res.board.grid, ch);
  // stessa proiezione di boardView() in server.js
  const grid = res.board.grid.map(row => row.map(cell =>
    cell.type === 'letter'
      ? { type: 'letter', revealed: cell.revealed, letter: cell.revealed ? (cell.display || cell.letter) : null }
      : { type: cell.type }));
  out[phrase] = Object.assign(out[phrase] || {}, { [revealed || 'VUOTO']: grid });
}

// Tabellone 2 del gioco finale: prima e ultima lettera di ogni parola. Non è
// una combinazione di lettere, è una regola sua — la applica board.js, lo stesso
// modulo del server.
{
  const phrase = 'MI RITORNI IN MENTE BELLA COME SEI';
  const res = board.createBoard('CANZONI ITALIANE', phrase);
  if (!res.ok) throw new Error(`board.createBoard ha rifiutato "${phrase}": ${res.error}`);
  board.revealFirstLast(res.board.grid);
  out[phrase].PRIMULT = res.board.grid.map(row => row.map(cell =>
    cell.type === 'letter'
      ? { type: 'letter', revealed: cell.revealed, letter: cell.revealed ? (cell.display || cell.letter) : null }
      : { type: cell.type }));
}

// Il Triplete rivela CASELLE, non lettere: nessuna combinazione di lettere
// riproduce il suo riempimento sparso. Qui una casella su tre, con un passo
// fisso: serve un fixture riproducibile, non un tabellone diverso ogni volta.
{
  const phrase = 'MEGLIO UN UOVO OGGI CHE UNA GALLINA DOMANI';
  const res = board.createBoard('SAGGEZZA POPOLARE', phrase);
  if (!res.ok) throw new Error(`board.createBoard ha rifiutato "${phrase}": ${res.error}`);
  let n = 0;
  out[phrase].CELLE = res.board.grid.map(row => row.map(cell => {
    if (cell.type !== 'letter') return { type: cell.type };
    const on = (n++ % 3) === 0;
    return { type: 'letter', revealed: on, letter: on ? (cell.display || cell.letter) : null };
  }));
}

const dest = path.join(__dirname, '..', 'public', 'js', 'dev', 'boards.generated.mjs');
fs.writeFileSync(dest,
  '// GENERATO da scripts/gen-fixtures.js — non modificare a mano.\n' +
  '// Le griglie vengono da board.js, lo stesso modulo del server.\n' +
  'export const GRIDS = ' + JSON.stringify(out, null, 1) + ';\n');
console.log('scritto', dest, Object.keys(out).length, 'frasi');
