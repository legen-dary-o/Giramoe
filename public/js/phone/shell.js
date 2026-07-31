// Cornice comune del telefono giocatore: barra alta, schede statistiche e
// banner di stato. La usano otto schermate su tredici — una funzione invece di
// otto copie dello stesso markup, come tv/shell.js per lo schermo grande.
//
// I nomi arrivano da chi si collega: qui si scrivono con textContent, mai con
// innerHTML.
//
// Non è un modulo importato da player.js: quello è uno script classico. Viene
// caricato prima come modulo e appeso a window.PhoneShell (vedi play.html), lo
// stesso percorso in sviluppo e in produzione.

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

// I punteggi si leggono a colpo d'occhio: 1.400, non 1400. Il punto lo mettiamo
// noi invece di toLocaleString('it-IT'): un runtime con ICU ridotto ignora la
// locale e restituisce "1400" senza dirlo.
export const num = (v) =>
  typeof v === 'number' ? String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : String(v);

// { name, phase, tone } — tone: null | 'accent' | 'express'
// Con tone 'express' la fase diventa una pillola magenta.
export function renderTopBar(host, { name, phase, tone } = {}) {
  host.innerHTML = '';
  const left = el('div', 'pt-who');
  left.append(
    el('span', 'pt-avatar', (name || '?').charAt(0).toUpperCase()),
    el('span', 'pt-name', name || '')
  );
  const right = el('span', 'pt-phase' + (tone ? ' is-' + tone : ''), phase || '');
  host.append(left, right);
}

// cards: [{ lab, value, tone }] — tone: null | 'accent' | 'express'
export function renderStats(host, cards) {
  host.innerHTML = '';
  cards.forEach((c) => {
    const card = el('div', 'pstat' + (c.tone ? ' is-' + c.tone : ''));
    card.append(el('span', 'lab', c.lab), el('b', null, num(c.value)));
    host.append(card);
  });
}

// { text, tone } — tone: null (attesa) | 'accent' | 'express' | 'negative'
// Il negativo è una pillola: il testo è lungo e a bordo dritto toccherebbe i
// margini dello schermo.
export function renderBanner(host, { text, tone } = {}) {
  host.innerHTML = '';
  host.className = 'pbanner' + (tone ? ' is-' + tone : '');
  if (!text) { host.hidden = true; return; }
  host.hidden = false;
  host.append(el('span', 'dot'), el('span', 'txt', text));
}
