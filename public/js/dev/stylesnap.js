// Impronta dei valori calcolati di ogni elemento della pagina. Serve a dimostrare
// che uno split del CSS non ha cambiato niente: si esegue prima, si esegue dopo,
// e il diff deve essere vuoto. Guarda i valori CALCOLATI, non le regole, quindi
// non gli importa in quale file stia una dichiarazione.
//
// Uso dalla console: __styleSnap()  → stringa da confrontare

const PROPS = [
  'display', 'position', 'top', 'right', 'bottom', 'left', 'width', 'height',
  'margin', 'padding', 'border', 'border-radius', 'box-shadow', 'outline',
  'background-color', 'background-image', 'background-size', 'background-position',
  'color', 'opacity', 'font-family', 'font-size', 'font-weight', 'line-height',
  'letter-spacing', 'text-transform', 'text-align', 'white-space',
  'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'align-content', 'gap', 'flex',
  'grid-template-columns', 'grid-template-rows', 'aspect-ratio',
  'transform', 'transform-origin', 'transition', 'animation', 'z-index', 'overflow',
  'mask-image', '-webkit-mask-image', 'filter', 'visibility', 'pointer-events'
];

function path(el) {
  const bits = [];
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    let b = n.tagName.toLowerCase();
    if (n.id) { bits.unshift(b + '#' + n.id); break; }
    if (n.className && typeof n.className === 'string') {
      const cls = n.className.trim().split(/\s+/).filter(Boolean);
      if (cls.length) b += '.' + cls.join('.');
    }
    const sibs = n.parentElement ? [...n.parentElement.children].filter(c => c.tagName === n.tagName) : [];
    if (sibs.length > 1) b += `:nth(${sibs.indexOf(n)})`;
    bits.unshift(b);
  }
  return bits.join('>');
}

window.__styleSnap = () => {
  const out = [];
  // ogni .screen a turno visibile: altrimenti i valori calcolati dei nascosti
  // collassano e il confronto non copre niente
  const screens = [...document.querySelectorAll('.screen')];
  const was = screens.map(s => s.classList.contains('hidden'));
  for (let i = 0; i < screens.length; i++) {
    screens.forEach((s, j) => s.classList.toggle('hidden', j !== i));
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      out.push(`${screens[i].id}|${path(el)}|` + PROPS.map(p => cs.getPropertyValue(p)).join('§'));
    }
  }
  screens.forEach((s, j) => s.classList.toggle('hidden', was[j]));
  return out.sort().join('\n');
};

// L'impronta di una superficie è ~800KB: non si porta fuori dalla pagina a mano.
// La baseline resta in localStorage (stessa origine delle tre pagine) e il diff
// si calcola qui dentro, così esce solo l'elenco delle differenze.
//
// Uso:  await __snapSave('tv')   prima del refactor
//       await __snapDiff('tv')   dopo → { righe, diverse: 0 } se nulla è cambiato

// I valori di layout dipendono dai font: senza aspettarli, l'impronta di una
// pagina appena caricata e quella di una pagina calda non combaciano mai.
const ready = () => document.fonts.ready;

const cut = (line) => {
  const a = line.indexOf('|');
  const b = line.indexOf('|', a + 1);
  return [line.slice(0, b), line.slice(b + 1)];
};

window.__snapSave = async (key) => {
  await ready();
  const snap = window.__styleSnap();
  localStorage.setItem('snap:' + key, snap);
  return { key, righe: snap.split('\n').length, byte: snap.length };
};

window.__snapDiff = async (key, max = 8) => {
  await ready();
  const before = localStorage.getItem('snap:' + key);
  if (before == null) return { errore: `nessuna baseline per '${key}'` };

  // `<head>` fuori dal confronto: non è renderizzato, e il numero di <link> è
  // proprio la cosa che uno split del CSS cambia per definizione. Tenerlo dentro
  // segnalerebbe 32 righe di rumore ogni volta, coprendo le differenze vere.
  const mapOf = (s) => new Map(s.split('\n').map(cut).filter(([k]) => !k.includes('>head')));
  const a = mapOf(before);
  const b = mapOf(window.__styleSnap());

  const spariti = [...a.keys()].filter(k => !b.has(k));
  const nuovi = [...b.keys()].filter(k => !a.has(k));
  const cambiati = [];
  for (const [k, va] of a) {
    const vb = b.get(k);
    if (vb === undefined || vb === va) continue;
    // dice QUALE proprietà è cambiata, non solo che qualcosa è cambiato
    const pa = va.split('§'), pb = vb.split('§');
    cambiati.push({
      elemento: k,
      props: PROPS.map((p, i) => pa[i] === pb[i] ? null : `${p}: ${pa[i]} → ${pb[i]}`).filter(Boolean)
    });
  }

  const diverse = spariti.length + nuovi.length + cambiati.length;
  return {
    key, righe: a.size, diverse,
    esito: diverse === 0 ? 'identico' : 'DIVERSO',
    spariti: spariti.slice(0, max), nuovi: nuovi.slice(0, max),
    cambiati: cambiati.slice(0, max)
  };
};

console.info('[stylesnap] pronto: __styleSnap() · __snapSave(k) · __snapDiff(k)');
