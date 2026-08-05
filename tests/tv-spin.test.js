// Il modulo "Spicchio" sotto la ruota grande non si scrive quando arriva
// `main:spin`, ma quando la ruota si ferma. Sono sei secondi di differenza, e in
// quei sei secondi il valore scritto in anticipo dice a tutti dove si fermerà la
// ruota: il giro diventa una formalità e il gioco perde il suo unico momento di
// sospensione.
//
// È un guasto che nessun altro test può vedere: main.js disegna nel browser, i
// test di integrazione parlano col server, e il server manda il payload giusto
// in entrambi i casi. Resta il sorgente. La regola che si controlla qui è
// strutturale, non testuale: dentro il gestore di `main:spin`, una chiamata a
// showWedge al livello esterno del gestore viene eseguita subito; una annidata
// dentro una funzione (l'atterraggio) viene eseguita quando quella funzione
// parte. Conta la profondità delle graffe, quindi riordinare il gestore non
// rompe il test — solo rimettere lo spoiler lo rompe.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const MAIN = path.join(__dirname, '..', 'public', 'js', 'main.js');

// Corpo del gestore, dalla graffa di apertura alla sua chiusura. La graffa da
// cercare è quella DOPO la freccia: `({ winningSegment, ... }) =>` ne ha già una
// nei parametri, e partire da quella darebbe come "corpo" la destrutturazione.
function corpoDelGestore(src, evento) {
  const apertura = new RegExp(`socket\\.on\\(\\s*['"\`]${evento}['"\`]`);
  const m = apertura.exec(src);
  assert.ok(m, `main.js non ha più un gestore per '${evento}'`);
  const freccia = src.indexOf('=>', m.index);
  assert.notStrictEqual(freccia, -1, `il gestore di '${evento}' non è una arrow function`);
  let i = src.indexOf('{', freccia);
  assert.notStrictEqual(i, -1, `il gestore di '${evento}' non ha un corpo fra graffe`);
  let depth = 1;
  i++;
  const start = i;
  for (; i < src.length && depth > 0; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') depth--;
  }
  return src.slice(start, i - 1);
}

// Le occorrenze di `ago` con la profondità di graffe a cui si trovano.
function occorrenze(corpo, ago) {
  const out = [];
  let depth = 0;
  for (let i = 0; i < corpo.length; i++) {
    if (corpo[i] === '{') depth++;
    else if (corpo[i] === '}') depth--;
    else if (corpo.startsWith(ago, i)) out.push({ i, depth });
  }
  return out;
}

test('lo spicchio non si scrive prima che la ruota si fermi', () => {
  const src = fs.readFileSync(MAIN, 'utf8');
  const corpo = corpoDelGestore(src, 'main:spin');

  const chiamate = occorrenze(corpo, 'showWedge');
  assert.ok(chiamate.length, "il gestore di 'main:spin' non scrive più lo spicchio");
  for (const { depth } of chiamate) {
    assert.notStrictEqual(depth, 0,
      "showWedge chiamata subito dentro 'main:spin': lo spicchio compare all'inizio " +
      'del giro e spoilera dove si fermerà la ruota. Va dentro la funzione di atterraggio.');
  }
});

// Stessa storia per l'overlay grande del risultato, e in più: se rAF viene
// throttlato (scheda in secondo piano) onSpinEnd non parte mai, quindi
// l'atterraggio deve avere anche una scadenza che lo faccia partire lo stesso —
// altrimenti al ritorno sulla scheda lo spicchio non compare più.
test("l'atterraggio ha una scadenza di scorta e non si esegue due volte", () => {
  const src = fs.readFileSync(MAIN, 'utf8');
  const corpo = corpoDelGestore(src, 'main:spin');
  assert.match(corpo, /onSpinEnd\s*=/, "il gestore non aggancia più onSpinEnd");
  assert.match(corpo, /setTimeout\(/, 'nessuna scadenza di scorta se rAF viene throttlato');
  const showResult = occorrenze(corpo, 'showResult');
  assert.ok(showResult.length && showResult.every(o => o.depth > 0),
    'showResult va chiamata all\'atterraggio, non all\'arrivo dell\'evento');
});
