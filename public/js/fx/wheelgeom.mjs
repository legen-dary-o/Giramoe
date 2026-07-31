// Geometria angolare della ruota, unica fonte di verità per wheel3d.js e i test.
// Convenzione: lo spicchio 0 PARTE a ore 12 (-π/2) e cresce in senso orario;
// i separatori e i perni stanno sui CONFINI, le etichette sui CENTRI.
export const SEGMENTS = 16;

const TAU = Math.PI * 2;

// Confine iniziale dello spicchio i (dove va disegnato separatore e perno).
export function boundaryAngle(i, segments = SEGMENTS) {
  return -Math.PI / 2 + (i * TAU) / segments;
}

// Centro dello spicchio i (dove va disegnata l'etichetta).
export function midAngle(i, segments = SEGMENTS) {
  return boundaryAngle(i, segments) + TAU / segments / 2;
}
