// Cornice comune della console del game master: barra alta, barra d'azione
// fissa in basso, righe giocatore. La usano nove schermate su undici — una
// funzione invece di nove copie dello stesso markup, come js/phone/shell.js per
// il telefono del giocatore e js/tv/shell.js per lo schermo grande.
//
// I nomi arrivano da chi si collega: qui si scrivono con textContent, mai con
// innerHTML.
//
// Non è un modulo importato da admin.js: quello è uno script classico. Viene
// caricato prima come modulo e appeso a window.AdminShell (vedi admin.html), lo
// stesso percorso in sviluppo e in produzione.

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

export const num = (v) =>
  typeof v === 'number' ? String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : String(v);

// { title, gm, phase, tone, pips }
//   title  testo a sinistra: 'GIRAMOE' in partita, 'IL TRIPLETE' nel bonus…
//   gm     true → chip GM accanto al titolo (solo lobby e partita)
//   phase  etichetta a destra
//   tone   null | 'accent' → la fase in ciano quando è quella calda
//   pips   { done, total } → tacche di avanzamento accanto alla fase
export function renderTopBar(host, { title, gm, phase, tone, pips } = {}) {
  host.innerHTML = '';
  const left = el('div', 'ad-title');
  left.append(el('span', 'ad-wm', title || 'GIRAMOE'));
  if (gm) left.append(el('span', 'ad-gm', 'GM'));

  const right = el('div', 'ad-phase-wrap');
  if (phase) right.append(el('span', 'ad-phase' + (tone ? ' is-' + tone : ''), phase));
  if (pips && pips.total) {
    const box = el('div', 'ad-pips');
    for (let i = 1; i <= pips.total; i++) {
      box.append(el('i', i <= pips.done ? 'is-done' : null));
    }
    right.append(box);
  }
  host.append(left, right);
}

// { hint, buttons: [{ id, label, tone, disabled }] }
//   tone: 'accent' (azione principale, ciano tenue) | 'plain' (contorno bianco)
// Il chiamante aggancia i click sugli id: qui si disegna e basta.
export function renderActions(host, { hint, buttons } = {}) {
  host.innerHTML = '';
  if (hint) host.append(el('span', 'ad-hint', hint));
  const row = el('div', 'ad-btns');
  (buttons || []).forEach((b) => {
    const btn = el('button', 'abtn is-' + (b.tone || 'accent'), b.label);
    btn.id = b.id;
    btn.disabled = !!b.disabled;
    row.append(btn);
  });
  host.append(row);
  host.hidden = !(buttons && buttons.length);
}

// Riga giocatore: nome a sinistra, un pezzo libero a destra.
//   right  stringa, oppure nodo già costruito da chi chiama
//   tone   'accent' → riga accesa (è il suo turno) | 'dim' → spenta
export function playerRow({ name, right, tone, extra } = {}) {
  const row = el('div', 'arow' + (tone ? ' is-' + tone : ''));
  row.append(el('span', 'ar-name', name || ''));
  if (right != null) {
    row.append(typeof right === 'string' ? el('span', 'ar-right', right) : right);
  }
  if (extra) row.append(extra);
  return row;
}

// Etichettina mono maiuscola: la usano tutte le schede.
export function label(text) { return el('span', 'alab', text); }

export { el };
