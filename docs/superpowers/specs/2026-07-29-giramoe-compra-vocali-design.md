# Compra vocali nel tabellone GIRAMOE

Data: 2026-07-29

## Contesto

Il tabellone GIRAMOE (fase 4, `giramoe.js`) oggi ammette una sola mossa per turno:
il giocatore di turno chiama **una consonante**. Se è presente la si rivela, il
giocatore incassa `moltiplicatore × occorrenze` e si apre una finestra di 5s per
prenotarsi e risolvere a voce; se è assente non prende niente, non può prenotarsi
e il turno passa. Le vocali non esistono in questa fase.

Questa spec introduce l'acquisto delle vocali **solo** in questo tabellone. La
ruota e l'Express restano invariati: lì la vocale comprata non consuma il turno e
si può continuare a chiamare consonanti.

## Regola

Nel turno GIRAMOE il giocatore compie **una sola azione**: chiama una consonante
**oppure** compra una vocale. Comprare la vocale esclude la consonante per quel
turno, e viceversa. Non è richiesto aver prima chiamato una consonante: si può
comprare direttamente.

### Costo

La vocale costa **500 punti**, scalati dai punti del turno GIRAMOE del giocatore
(`gi.players[i].points`, gli stessi che finiscono in banca solo se è lui a
risolvere). Serve `points >= 500`. A inizio round tutti sono a 0, quindi nessuno
può comprare finché non ha segnato con almeno una consonante presente.

### Esito

- **Vocale presente**: viene rivelata, **non dà punti** (come negli altri round),
  la lettera finisce in `usedLetters` e si apre la stessa finestra di 5s per
  prenotarsi e risolvere.
- **Vocale assente**: i 500 sono persi, niente rivelazione, niente finestra, il
  turno passa al giocatore successivo — identico alla consonante assente.

### Lettere assenti non bruciate

Una vocale comprata e assente **non** viene aggiunta a `usedLetters`: resta
comprabile da chiunque, anche dallo stesso giocatore in un turno successivo. È la
regola che il gioco già applica ovunque — sia in GIRAMOE per le consonanti
(`giramoe.js:58`), sia nella ruota e nell'Express, dove `usedLetters.push` sta
già dentro il ramo `count > 0` (`game.js:103`, `game.js:132`, `game.js:175`).
Ricordarsi quali lettere non ci sono fa parte della sfida.

Nessuna modifica a `finalgame.js`: nella finale in solitaria le lettere non si
comprano ma si pescano da un'allocazione fissa (3 consonanti + 1 vocale al
tabellone 1) e al tabellone 3 ogni lettera sbagliata costa −3s, quindi lì il
blocco della lettera già usata resta necessario.

### Consonanti finite

Quando tutte le consonanti della frase sono state rivelate, il giocatore di turno
può già prenotarsi senza chiamare nulla (comportamento attuale,
`giramoe.js:80`). Con questa modifica ha due strade:

- **prenotarsi subito**, gratis e senza cronometro — è la via di chi sa la
  soluzione;
- **comprare una vocale** (se ha ≥500 e ne restano di disponibili) per vedere
  altro. In questo caso accetta la finestra di 5s che parte dopo l'acquisto.

Chi ha meno di 500 punti non è mai bloccato: la prenotazione in questo stato è
comunque libera.

### Perché l'acquisto fa sempre partire la finestra

Dopo l'acquisto il giocatore ha speso la sua azione del turno. Se non partisse
nessun timer, un giocatore che compra e poi non si prenota lascerebbe il turno
appeso a tempo indeterminato. La finestra di 5s è ciò che fa scorrere il giro.

### Conseguenza voluta

Chi conosce la soluzione conosce anche le vocali contenute nella frase: con 500
punti può comprare una vocale sicuramente presente e garantirsi la finestra di
prenotazione, invece di scommettere su una consonante che potrebbe essere assente
e costargli il turno. In pratica i 500 punti comprano il diritto di rispondere.
Il costo è reale: quella vocale non produce punti.

### Banner "vocali finite"

Quando tutte le vocali della frase sono rivelate compare il badge già esistente
sul display principale. Non serve logica nuova: `broadcastGiramoe()` chiama già
`emitBoardStatus(state.gi.board.grid)` (`server.js:568`) e `boardStatus` calcola
`vowelsFinished` (`board.js:219`); finora non scattava solo perché in GIRAMOE le
vocali non venivano mai rivelate. Il pulsante di acquisto si disabilita nello
stesso momento.

## Implementazione

### `giramoe.js`

- `const VOWEL_COST = 500;`
- `vowelsFinished(gi)` — da `board.boardStatus`, gemella di `consonantsFinished`.
- `canBuyVowel(gi, playerIndex)` — vero se è il turno di quel giocatore, lo stato
  è `PLAYING`, `!calledThisTurn`, `points >= VOWEL_COST` e le vocali non sono
  finite.
- `buyVowel(gi, letter)` — stesse guardie di `canBuyVowel` più `board.isVowel` e
  lettera non in `usedLetters`; scala 500; se presente rivela, registra la
  lettera e imposta `calledThisTurn = true`; se assente chiama `passTurn(gi)`.
  Ritorna `{ ok, present, count, positions, passed }` come `callConsonant`.

`callConsonant` non cambia: rifiuta già quando `calledThisTurn` è vero, quindi
l'esclusività fra le due azioni è garantita dal flag esistente.

### `server.js`

- Nuovo handler `player:giramoeVowel` speculare a `player:giramoeLetter`:
  controlla fase, `state.gi` e che sia il turno del mittente; se presente emette
  `main:letterCalled` + `main:revealLetter` e chiama `startGiramoeBuzzWindow()`;
  se assente emette `main:wrong` e chiama `clearGiramoeTimer()`; in ogni caso
  `broadcastGiramoe()`.
- `playerGiramoeView(i)` espone `canBuyVowel` e aggiorna i messaggi:
  - turno proprio con consonanti disponibili → `Tocca a te: chiama una consonante`
    oppure `Tocca a te: chiama una consonante o compra una vocale` se può comprare;
  - consonanti finite → `Consonanti finite: prenotati e risolvi!` oppure
    `Consonanti finite: compra una vocale o prenotati` se può comprare.

### Client (`public/play.html`, `public/js/player.js`)

- In `#player-giramoe-screen`, sotto la tastiera: pulsante
  `Compra vocale (500)` (`#btn-gi-vowel`) e `<div class="vowel-picker hidden"
  id="gi-vowel-picker">`, stessa struttura e stessi stili della schermata ruota.
- `buildGiramoeKeyboard()` costruisce anche il picker; ogni vocale emette
  `player:giramoeVowel` e richiude il picker; il pulsante lo apre/chiude.
- `applyGiramoeState(st)` abilita il pulsante su `st.canBuyVowel`, disabilita le
  vocali già in `st.usedLetters` e nasconde il picker quando l'acquisto non è
  possibile.

### Regolamento

Aggiornare la fase 4 in `public/js/samiro-faq.js` e
`docs/samiro-regolamento.md`: cade la frase "Non si comprano vocali" e va
descritta la scelta consonante/vocale, il costo di 500 dai punti del turno, il
fatto che la vocale non dà punti e che apre comunque la prenotazione.

## Test

Sviluppo in TDD, esecuzione con `node --test --test-concurrency=1`.

Unit (`tests/giramoe.test.js`):

- acquisto di vocale presente: −500, rivelata, zero punti, `calledThisTurn` vero,
  turno invariato;
- acquisto di vocale assente: −500, turno passato, lettera **non** in
  `usedLetters` e ricomprabile;
- rifiuto con meno di 500 punti;
- rifiuto se nel turno si è già chiamata una consonante, e rifiuto della
  consonante dopo l'acquisto di una vocale (esclusività nei due sensi);
- rifiuto di una vocale già rivelata e quando le vocali sono finite;
- con consonanti finite e meno di 500 punti la prenotazione resta possibile.

Integration (`tests/giramoe.integration.test.js`):

- via socket, un giocatore che ha segnato compra una vocale presente, il display
  riceve `main:revealLetter` e la finestra di 5s si apre (la prenotazione
  successiva è accettata);
- acquisto di vocale assente: arriva `main:wrong` e il turno risulta passato.
