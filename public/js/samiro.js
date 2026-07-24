// SAMIRO — assistente "finto AI" sul regolamento. Cerchio fisso su tutte le
// schermate del giocatore; al tocco apre una chat che risponde SOLO a domande
// sul regolamento (dati in samiro-faq.js) tramite keyword-matching, con
// fallback quando la domanda esce dal seminato. Nessuna chiamata di rete.
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

  // ---- Stile (iniettato: widget autonomo, rimovibile) ----------------------

  const css = `
  .samiro-fab {
    position: fixed; right: 16px; bottom: max(16px, env(safe-area-inset-bottom));
    width: 60px; height: 60px; border-radius: 50%; z-index: 9998;
    background: #fff; border: 2px solid var(--accent, #30b8ff);
    box-shadow: 0 8px 26px rgba(0,0,0,.5); cursor: pointer; overflow: hidden;
    display: grid; place-items: center; padding: 0;
    transition: transform .18s var(--ease-spring, ease);
  }
  .samiro-fab:active { transform: scale(.92); }
  .samiro-fab img {
    width: 100%; height: 100%; object-fit: cover; object-position: center center;
    /* immagine già ritagliata sull'unicorno (public/assets/samiro.png) */
  }
  .samiro-fab .samiro-fallback { font-size: 30px; line-height: 1; }
  .samiro-fab.hidden { display: none; }

  .samiro-panel {
    position: fixed; right: 16px; bottom: calc(84px + env(safe-area-inset-bottom));
    width: min(360px, calc(100vw - 24px));
    height: min(70vh, 540px); z-index: 9999;
    background: var(--panel, #16161a); color: var(--ink, #f5f5f7);
    border: var(--glass-border, 1px solid rgba(255,255,255,.1));
    border-radius: var(--r-lg, 22px); box-shadow: var(--shadow-lg, 0 24px 70px rgba(0,0,0,.6));
    display: flex; flex-direction: column; overflow: hidden;
    transform-origin: bottom right;
    animation: samiroIn .22s var(--ease-out, ease) both;
  }
  @keyframes samiroIn { from { opacity: 0; transform: translateY(12px) scale(.96); } to { opacity: 1; transform: none; } }
  .samiro-panel.hidden { display: none; }

  .samiro-head {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 14px; border-bottom: 1px solid var(--hairline, rgba(255,255,255,.14));
  }
  .samiro-head .samiro-ava {
    width: 34px; height: 34px; border-radius: 50%; overflow: hidden; background: #fff;
    display: grid; place-items: center; flex: none;
  }
  .samiro-head .samiro-ava img { width: 100%; height: 100%; object-fit: cover; object-position: center center; }
  .samiro-head .samiro-ava .samiro-fallback { font-size: 18px; }
  .samiro-head .samiro-name { font-family: var(--font-display, sans-serif); font-weight: 800; font-size: 17px; letter-spacing: .5px; }
  .samiro-head .samiro-sub { font-family: var(--font-mono, monospace); font-size: 10px; color: var(--ink-soft, #999); letter-spacing: 1px; text-transform: uppercase; }
  .samiro-head .samiro-close {
    margin-left: auto; background: none; border: none; color: var(--ink-soft, #999);
    font-size: 22px; line-height: 1; cursor: pointer; padding: 4px 6px;
  }

  .samiro-body { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; -webkit-overflow-scrolling: touch; }
  .samiro-msg { max-width: 82%; padding: 9px 12px; border-radius: 14px; font-family: var(--font-mono, monospace); font-size: 13px; line-height: 1.45; word-wrap: break-word; }
  .samiro-msg.bot { align-self: flex-start; background: rgba(255,255,255,.06); border: 1px solid var(--hairline, rgba(255,255,255,.14)); border-bottom-left-radius: 4px; }
  .samiro-msg.me { align-self: flex-end; background: var(--accent, #30b8ff); color: #001018; border-bottom-right-radius: 4px; }

  .samiro-chips { display: flex; flex-wrap: wrap; gap: 7px; padding: 4px 2px 2px; }
  .samiro-chip {
    background: rgba(255,255,255,.05); color: var(--ink, #f5f5f7);
    border: 1px solid var(--hairline, rgba(255,255,255,.2)); border-radius: 999px;
    padding: 7px 11px; font-family: var(--font-mono, monospace); font-size: 11.5px;
    cursor: pointer; transition: background .15s; text-align: left;
  }
  .samiro-chip:active { background: rgba(255,255,255,.14); }

  .samiro-input { display: flex; gap: 8px; padding: 10px 12px; border-top: 1px solid var(--hairline, rgba(255,255,255,.14)); }
  .samiro-input input {
    flex: 1; background: rgba(255,255,255,.05); border: 1px solid var(--hairline, rgba(255,255,255,.2));
    border-radius: 999px; padding: 9px 14px; color: var(--ink, #f5f5f7);
    font-family: var(--font-mono, monospace); font-size: 13px; outline: none;
  }
  .samiro-input input::placeholder { color: var(--ink-faint, rgba(245,245,247,.4)); }
  .samiro-input button {
    flex: none; width: 40px; border-radius: 50%; border: none; cursor: pointer;
    background: var(--accent, #30b8ff); color: #001018; font-size: 17px;
  }
  .samiro-input button:disabled { opacity: .4; }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // ---- DOM -----------------------------------------------------------------

  const IMG_SRC = '/assets/samiro.png';

  // <img> con fallback a emoji se l'immagine non è ancora stata caricata.
  function avatar(cls) {
    const wrap = document.createElement('span');
    if (cls) wrap.className = cls;
    const img = document.createElement('img');
    img.src = IMG_SRC; img.alt = 'Samiro';
    img.onerror = () => { img.remove(); const e = document.createElement('span'); e.className = 'samiro-fallback'; e.textContent = '🦄'; wrap.appendChild(e); };
    wrap.appendChild(img);
    return wrap;
  }

  const fab = document.createElement('button');
  fab.className = 'samiro-fab';
  fab.setAttribute('aria-label', 'Apri Samiro');
  fab.appendChild(avatar(null));

  const panel = document.createElement('div');
  panel.className = 'samiro-panel hidden';
  panel.innerHTML = `
    <div class="samiro-head">
      <span class="samiro-ava"></span>
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
  panel.querySelector('.samiro-ava').appendChild(avatar(null));

  document.body.appendChild(fab);
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
    fab.classList.add('hidden');
    if (!opened) {
      opened = true;
      addMsg(SAMIRO_INTRO, 'bot');
      addChips();
    }
    setTimeout(() => input.focus(), 50);
  }
  function close() {
    panel.classList.add('hidden');
    fab.classList.remove('hidden');
  }

  fab.addEventListener('click', open);
  panel.querySelector('.samiro-close').addEventListener('click', close);
  form.addEventListener('submit', e => {
    e.preventDefault();
    const t = input.value;
    input.value = '';
    ask(t);
  });
})();
