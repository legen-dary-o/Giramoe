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

console.info('[stylesnap] pronto: __styleSnap()');
