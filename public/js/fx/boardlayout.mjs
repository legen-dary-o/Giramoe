// Mapping puro dalla griglia logica di board.js (4x16, celle edge/blocked/letter)
// alle tessere renderizzate dal tabellone 3D. Le celle `edge` (gli angoli
// strutturali delle righe 0 e 3) non producono tessere.
export function gridToTiles(grid) {
  const tiles = [];
  grid.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (cell.type === 'edge') return;
      tiles.push({
        row: r,
        col: c,
        kind: cell.type === 'letter' ? 'letter' : 'blocked',
        letter: cell.type === 'letter' ? cell.letter : null,
        revealed: !!cell.revealed
      });
    });
  });
  return tiles;
}
