// Stato della raffica express a schermo: lettere chiamate, occorrenze uscite e
// punti accumulati. Le prime due non stanno nello stato del server perché lì
// non esiste un "turno express" separato — sono il turno normale di chi sta
// giocando, con un moltiplicatore diverso. Qui si accumulano solo per
// mostrarle, e si azzerano quando la raffica finisce (bancarotta, soluzione,
// nuovo round). Un refresh a metà raffica le perde: sono cronaca, non punteggio.
//
// Come callout.js: scrive solo con textContent, i nomi arrivano dai giocatori.

const EMPTY = '—';

let letters = [];
let occurrences = 0;

const set = (id, value) => {
  const node = document.getElementById(id);
  if (node) node.textContent = value;
};

function paint() {
  set('ex-raffica', letters.length ? letters.join(' ') : EMPTY);
  set('ex-occ', String(occurrences));
}

export function reset() {
  letters = [];
  occurrences = 0;
  paint();
  set('ex-points', '0');
}

export function letter(l) {
  letters.push(String(l).toUpperCase());
  paint();
}

export function occurrence(n) {
  occurrences += n;
  paint();
}

export function player(name) {
  set('ex-who', name || '');
}

export function points(v) {
  set('ex-points', v);
}

export function value(v) {
  set('ex-value', v);
}
