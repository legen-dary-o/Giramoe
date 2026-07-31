// I tre moduli sotto la ruota. `Spicchio` tiene il valore per tutto il turno: e'
// il contesto del punteggio. `Lettera` e `Occorrenze` sono una notifica e si
// svuotano dopo 3,5s — quel tanto che basta al giocatore dopo per accorgersi che
// una lettera e' gia' stata provata, senza restare a schermo per sempre. `×0` e'
// previsto: una lettera assente non lascia traccia sul tabellone, e senza questo
// modulo nessuno saprebbe che e' stata chiamata.

const HOLD_MS = 3500;
const EMPTY = '—';

let timer = null;

const set = (id, value) => {
  const node = document.getElementById(id);
  if (!node) return;
  node.textContent = value == null ? EMPTY : String(value);
  node.parentElement.classList.toggle('is-empty', value == null);
};

// `?freeze=letter` tiene i moduli a schermo: serve a confrontarli col render
const frozen = () => new URLSearchParams(location.search).get('freeze') === 'letter';

export function showWedge(value) { set('mod-wedge', value); }

export function showLetter(letter) {
  clearTimeout(timer);
  set('mod-letter', letter);
  set('mod-count', null);
}

// occurrences: quante volte la lettera compare nel tabellone; 0 se assente
export function showOccurrences(occurrences) {
  clearTimeout(timer);
  set('mod-count', '×' + occurrences);
  if (frozen()) return;
  timer = setTimeout(() => {
    set('mod-letter', null);
    set('mod-count', null);
  }, HOLD_MS);
}

// Cambio di turno: via tutto, spicchio compreso.
export function reset() {
  clearTimeout(timer);
  set('mod-wedge', null);
  set('mod-letter', null);
  set('mod-count', null);
}
