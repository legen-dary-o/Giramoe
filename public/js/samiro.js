// SAMIRO — assistente "finto AI" sul regolamento. Pillola fissa in basso su
// tutte le schermate del giocatore; al tocco apre una chat che risponde SOLO a
// domande sul regolamento (dati in samiro-faq.js) tramite keyword-matching, con
// fallback quando la domanda esce dal seminato. Nessuna chiamata di rete.
//
// Lo stile sta in public/css/phone.css (sezione SAMIRO), non più iniettato da
// qui: così il test delle keyframes lo vede come tutto il resto.
(function () {
  'use strict';
  if (typeof SAMIRO_FAQ === 'undefined') return; // samiro-faq.js non caricato

  // ---- Matching engine -----------------------------------------------------

  const STOPWORDS = new Set([
    'come', 'cosa', 'quando', 'quanto', 'quanti', 'quante', 'chi', 'perche',
    'perché', 'dove', 'quale', 'quali', 'il', 'lo', 'la', 'i', 'gli', 'le',
    'un', 'uno', 'una', 'di', 'del', 'della', 'dei', 'delle', 'che', 'e', 'ed',
    'a', 'ad', 'in', 'con', 'su', 'per', 'tra', 'fra', 'se', 'mi', 'ci', 'ti',
    'si', 'ma', 'o', 'posso', 'devo', 'fare', 'succede', 'sono', 'è', 'ho',
    'al', 'alla', 'nel', 'nella', 'da', 'dal', 'me', 'te', 'voglio', 'vorrei'
  ]);

  const strip = s => s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();

  // Confronto parola-per-parola: una parola della domanda "matcha" una parola del
  // pagliaio se condividono un prefisso di almeno 4 lettere (gestisce plurali/generi
  // tipo vocale/vocali) senza le collisioni dei substring generici (capito/capitale).
  function matchToken(tok, hayWords) {
    const cand = tok.length > 4 ? tok.slice(0, -1) : tok; // togli la desinenza plurale/genere
    for (const w of hayWords) {
      if (w === tok) return true;
      if (cand.length >= 4 && w.startsWith(cand)) return true; // domanda ⊂ pagliaio (vocali→vocale)
      if (w.length >= 4 && tok.startsWith(w)) return true;     // pagliaio ⊂ domanda (banca→bancarotta)
    }
    return false;
  }

  // Termini distintivi del gioco (nomi di fasi/meccaniche): pesano più delle
  // parole generiche, così "finale" batte il distrattore "passa", ecc.
  const STRONG = ['tabel', 'tripl', 'expres', 'giramo', 'moe', 'bancar', 'banca',
    'vocal', 'conso', 'busta', 'bust', 'final', 'raddop', 'sparegg', 'moltipl',
    'cappot', 'nrte', 'spicch', 'prenot', 'buzz', 'memor'];

  function weight(t) {
    if (/^\d+$/.test(t)) return 3;            // punteggi: 500, 1000, 5000…
    if (/^punt/.test(t)) return 2;            // punti/punteggio: semi-distintivo
    for (const st of STRONG) if (t.startsWith(st)) return 3;
    return 1;                                 // parola generica
  }

  // Easter egg: riconosce una richiesta di soluzione/indizio/consiglio su un
  // tabellone (→ risposta "Shabban"), distinguendola da domande di regolamento
  // come "quando dico la soluzione". `q` è già normalizzato (accenti/punteggiatura via).
  const CHEAT_WORDS = /\b(indizio|indizi|suggeriment\w*|trucco|trucchi|spoiler|aiutino|imbrogl\w*|barare|sbircia\w*)\b/;
  const REQUEST_VERB = /\b(dammi|dimmi|svela|svelami|rivela|rivelami|passami|fammi|mostrami|voglio|dicci|dici|dai|suggerisci|aiutami|qual\w*)\b/;
  function isCheatRequest(q) {
    if (CHEAT_WORDS.test(q)) return true;                                  // indizio, trucco, spoiler…
    if (/\b(soluzione|soluzioni|consiglio|consigli)\b/.test(q) && REQUEST_VERB.test(q)) return true;
    if (/\b(frase|risposta|parola)\b/.test(q) && REQUEST_VERB.test(q)) return true; // "dimmi la frase"
    return false;
  }

  // Pre-normalizza i "pagliai" (keyword + domanda) di ogni voce una sola volta.
  const HAYSTACKS = SAMIRO_FAQ.map(item => strip(item.k.join(' ') + ' ' + item.q));
  const HAY_WORDS = HAYSTACKS.map(h => Array.from(new Set(h.split(' ').filter(w => w.length >= 3))));

  function tokens(text) {
    return strip(text).split(' ').filter(t => t.length >= 3 && !STOPWORDS.has(t));
  }

  // Ritorna la risposta migliore, o il fallback se nessuna voce raggiunge la soglia.
  function answer(query) {
    const q = strip(query);
    if (!q) return SAMIRO_FALLBACK;

    // Easter egg: la parola "opalescente".
    if (/opalescent/.test(q)) return SAMIRO_OPAL;
    // Easter egg: "chi è Moe?" (\bmoe\b evita il match dentro "giramoe").
    if (/\bmoe\b/.test(q) && /\b(chi|cosa|cos)\b/.test(q)) return SAMIRO_MOE;
    // Easter egg: richiesta di soluzioni/indizi/consigli.
    if (isCheatRequest(q)) return SAMIRO_NO_HINT;

    // Convenevoli: gestiti a parte, senza sporcare le FAQ.
    if (/\b(ciao|ehi|hey|salve|buongiorno|buonasera)\b/.test(q) && tokens(query).length <= 1) {
      return 'Ciao! Chiedimi pure qualsiasi cosa sul regolamento. 🦄';
    }
    if (/\b(grazie|grazi|thanks|top|perfetto|ok)\b/.test(q) && tokens(query).length <= 1) {
      return 'Figurati! Sono qui per il regolamento. 🦄';
    }

    const qTokens = tokens(query);
    if (qTokens.length === 0) return SAMIRO_FALLBACK;

    let best = -1, bestScore = 0;
    for (let i = 0; i < SAMIRO_FAQ.length; i++) {
      const hayWords = HAY_WORDS[i];
      let score = 0;
      for (const t of qTokens) if (matchToken(t, hayWords)) score += weight(t);
      // Bonus se un'intera keyword multi-parola compare nella domanda.
      for (const kw of SAMIRO_FAQ[i].k) {
        const nkw = strip(kw);
        if (nkw.includes(' ') && q.includes(nkw)) score += 2;
      }
      if (score > bestScore) { bestScore = score; best = i; }
    }

    return bestScore >= 1 ? SAMIRO_FAQ[best].a : SAMIRO_FALLBACK;
  }

  // ---- DOM -----------------------------------------------------------------

  const IMG_SRC = '/assets/samiro.png';

  // <img> con fallback a emoji se l'immagine non c'è o non si carica.
  function avatar() {
    const wrap = document.createElement('span');
    wrap.className = 'samiro-ava';
    const img = document.createElement('img');
    img.src = IMG_SRC; img.alt = 'Samiro';
    img.onerror = () => { img.remove(); const e = document.createElement('span'); e.className = 'samiro-fallback'; e.textContent = '🦄'; wrap.appendChild(e); };
    wrap.appendChild(img);
    return wrap;
  }

  // Pillola ancorata in basso al centro (vedi la sezione SAMIRO di phone.css).
  const dock = document.createElement('button');
  dock.className = 'samiro-dock';
  dock.setAttribute('aria-label', 'Apri Samiro, l’assistente sul regolamento');
  const lab = document.createElement('span');
  lab.className = 'samiro-lab';
  lab.innerHTML = 'Samiro <i>· Regolamento</i>';
  dock.append(avatar(), lab);

  const panel = document.createElement('div');
  panel.className = 'samiro-panel hidden';
  panel.innerHTML = `
    <div class="samiro-head">
      <div>
        <div class="samiro-name">Samiro</div>
        <div class="samiro-sub">Assistente regolamento</div>
      </div>
      <button class="samiro-close" aria-label="Chiudi">×</button>
    </div>
    <div class="samiro-body"></div>
    <form class="samiro-input" autocomplete="off">
      <input type="text" placeholder="Scrivi una domanda…" maxlength="140">
      <button type="submit" aria-label="Invia">➤</button>
    </form>`;
  const head = panel.querySelector('.samiro-head');
  head.insertBefore(avatar(), head.firstChild);

  document.body.appendChild(dock);
  document.body.appendChild(panel);

  const body = panel.querySelector('.samiro-body');
  const form = panel.querySelector('.samiro-input');
  const input = form.querySelector('input');
  let opened = false;

  function scrollDown() { body.scrollTop = body.scrollHeight; }

  function addMsg(text, who) {
    const el = document.createElement('div');
    el.className = 'samiro-msg ' + who;
    el.textContent = text;
    body.appendChild(el);
    scrollDown();
    return el;
  }

  function addChips() {
    const wrap = document.createElement('div');
    wrap.className = 'samiro-chips';
    SAMIRO_QUICK.forEach(q => {
      const c = document.createElement('button');
      c.type = 'button';
      c.className = 'samiro-chip';
      c.textContent = q;
      c.addEventListener('click', () => ask(q));
      wrap.appendChild(c);
    });
    body.appendChild(wrap);
    scrollDown();
  }

  function ask(text) {
    text = text.trim();
    if (!text) return;
    addMsg(text, 'me');
    // Piccola pausa per dare un tocco "conversazionale".
    setTimeout(() => addMsg(answer(text), 'bot'), 260);
  }

  function open() {
    panel.classList.remove('hidden');
    dock.classList.add('hidden');
    if (!opened) {
      opened = true;
      addMsg(SAMIRO_INTRO, 'bot');
      addChips();
    }
    setTimeout(() => input.focus(), 50);
  }
  function close() {
    panel.classList.add('hidden');
    dock.classList.remove('hidden');
  }

  dock.addEventListener('click', open);
  panel.querySelector('.samiro-close').addEventListener('click', close);
  form.addEventListener('submit', e => {
    e.preventDefault();
    const t = input.value;
    input.value = '';
    ask(t);
  });
})();
