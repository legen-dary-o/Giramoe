// Cornice comune delle schermate TV: barra alta (wordmark, chip di fase, pip del
// tabellone, "Live") e barra bassa dei giocatori. La usano 1b, 1c, 1e, 1f, 1g,
// 1h e 1j: una funzione invece di sei copie dello stesso markup.
//
// I nomi dei giocatori arrivano da chi si collega: qui si scrivono con
// textContent, mai con innerHTML.

export const PHASES = [
  ['01', 'Tabelloni'], ['02', 'Triplete'], ['03', 'Express'],
  ['04', 'Giramoe'],   ['05', 'Finale'],   ['06', 'Buste']
];

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

const pad2 = (n) => String(n).padStart(2, '0');

// I punteggi si leggono da lontano: 1.400, non 1400. Il punto lo mettiamo noi
// invece di toLocaleString('it-IT'): un runtime con ICU ridotto ignora la locale
// e restituisce "1400" senza dirlo, e su una TV nessuno se ne accorgerebbe.
const num = (v) =>
  typeof v === 'number' ? String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : String(v);

// opts:
//   phase    1..6, quale chip è attiva
//   compact  true → una sola etichetta "Fase 0N · <nome>" al posto delle 6 chip
//   accent   'accent' (default) | 'express' — tinta della chip attiva
//   board    { number, total } → "Tabellone" + pip + contatore 01/03
//   right    stringa libera al posto di board
//   live     false per nascondere "● Live"
export function renderTopBar(host, opts = {}) {
  const { phase = 1, compact = false, accent = 'accent', board, right, live = true } = opts;
  host.innerHTML = '';
  host.classList.toggle('is-express', accent === 'express');

  const left = el('div', 'tb-side');
  left.append(el('span', 'tb-wm', 'GIRAMOE'), el('span', 'tb-div'));

  if (compact) {
    const [n, name] = PHASES[phase - 1];
    left.append(el('span', 'tb-one', `Fase ${n} · ${name}`));
  } else {
    const chips = el('div', 'tb-phases');
    PHASES.forEach(([n, name], i) => {
      const chip = el('span', 'tb-ph' + (i === phase - 1 ? ' is-now' : ''));
      chip.append(el('em', null, n), document.createTextNode(name));
      chips.append(chip);
    });
    left.append(chips);
  }

  const rightSide = el('div', 'tb-side');
  if (board) {
    rightSide.append(el('span', 'tb-lab', 'Tabellone'));
    const pips = el('div', 'tb-pips');
    for (let i = 1; i <= board.total; i++) {
      pips.append(el('span', i <= board.number ? 'is-on' : null));
    }
    const count = el('span', 'tb-count', pad2(board.number));
    count.append(el('span', null, '/' + pad2(board.total)));
    rightSide.append(pips, count);
  } else if (right) {
    rightSide.append(el('span', 'tb-lab', right));
  }
  if (live) {
    if (rightSide.childNodes.length) rightSide.append(el('span', 'tb-div'));
    const l = el('span', 'tb-live');
    l.append(el('span', 'live-dot'), document.createTextNode('Live'));
    rightSide.append(l);
  }

  host.append(left, rightSide);
}

// players: [{ name, values, state, tone }]
//   values  i numeri delle colonne, nello stesso ordine di `cols`
//   state   'In attesa' | 'Al turno' | 'Prenotato' | 'Bloccata' | 'Usata' | …
//   tone    null | 'active' | 'express' | 'locked' | 'buzzed'
// cols: etichette delle colonne, es. ['Turno', 'Banca'] o ['Punti', 'Banca'].
// La prima colonna prende la tinta della scheda: è il numero che sta cambiando.
export function renderPlayersBar(host, players, cols = ['Turno', 'Banca']) {
  host.innerHTML = '';
  players.forEach((p) => {
    const card = el('div', 'pcard' + (p.tone ? ' is-' + p.tone : ''));

    const avatar = el('div', 'pc-avatar', (p.name || '?').charAt(0).toUpperCase());
    if (p.tone === 'active' || p.tone === 'express') avatar.append(el('span', 'pc-dot'));

    const info = el('div', 'pc-info');
    info.append(el('span', 'pc-name', p.name), el('span', 'pc-state', p.state || ''));

    const nums = el('div', 'pc-nums');
    cols.forEach((label, i) => {
      const col = el('div', 'pc-col' + (i === 0 ? ' is-lead' : ''));
      col.append(el('div', 'pc-lab', label), el('div', 'pc-val', num(p.values[i])));
      nums.append(col);
    });

    card.append(avatar, info, nums);
    host.append(card);
  });
}
