# Slice 7 — telefono admin (`1n`–`1x`)

> **Per chi esegue:** i passi hanno la casella `- [ ]`. Si spunta quando è fatto **e verificato**.

**Obiettivo:** rifare le undici schermate della console del game master seguendo il
handoff, con la stessa lingua visiva del telefono giocatore.

**Architettura:** `public/js/admin/shell.js` porta la cornice comune (barra alta, barra
d'azione in basso, schede, campi, righe giocatore) come `js/phone/shell.js` fa per il
giocatore. Lo stile va in `public/css/admin.css` (oggi 124 righe, quasi tutte da
buttare). Nessuna logica di gioco cambia: cambiano forma e quantità di informazione.

**Stack:** stessi token, Syne 800 + Space Mono, niente bundler. Verifica con `?mock=1n…1x`
a 430×932 e `node --test --test-concurrency=1`.

---

## Cosa c'è di diverso dal telefono giocatore

La console non è una schermata di gioco: è un pannello di controllo che si guarda di
sfuggita mentre si conduce. Tre elementi nuovi, tutti nel handoff:

1. **Barra alta con l'identità della fase.** A sinistra il titolo (`GIRAMOE` + chip `GM`
   in lobby e partita, poi `IL TRIPLETE`, `GIOCO FINALE`, `LE BUSTE`), a destra
   l'etichetta della fase con tre pip di avanzamento dove servono.
2. **Barra d'azione fissa in basso.** Riga di contesto in mono maiuscolo (`IL GIOCATORE HA
   DETTO LA FRASE A VOCE`) e sotto uno o due bottoni. Fissa in fondo, con hairline e
   sfumatura: le due azioni che si premono al volo non devono mai stare sotto la piega.
3. **Campi che sembrano schede.** Nel handoff i campi sono riquadri pieni dentro una
   scheda, non `<input>` nudi. Restano `<input>` veri — cambia il vestito.

**Attenzione al 16px:** il handoff scrive alcuni campi a 14,5px. Sotto i 16 iOS zooma la
pagina al fuoco, e su una console che si usa in piedi è peggio del disallineamento
tipografico. Tutti gli `input` vanno a 16px; è una deviazione voluta, va scritta nel
commento.

---

## Task 1: stato che manca sul server

Quattro cose che il handoff mostra e che oggi nessun payload porta. Tutte proiezioni di
stato già esistente, nessuno stato nuovo.

**Files:** `server.js`, `giramoe.js`, `tests/admin-payload.integration.test.js`

- [x] **Step 1: la frase sta nel tabellone? (`admin:checkPhrase`)**

Il handoff mostra `✓ Sta in 4 righe · 33 lettere` sotto il campo della frase, prima di
premere Avvia. Serve la stessa disposizione che usa il server, non una stima: si chiede a
lui con un giro di socket, invece di duplicare `board.js` nel browser.

```js
  // Anteprima della disposizione mentre si scrive: la calcola board.js, lo
  // stesso codice che poi costruisce il tabellone. Una copia dell'algoritmo nel
  // browser direbbe "ci sta" su frasi che poi il server rifiuta.
  socket.on('admin:checkPhrase', ({ phrase }) => {
    const r = board.layout(String(phrase || ''));   // nome vero da verificare in board.js
    socket.emit('admin:phraseCheck', r.ok
      ? { ok: true, rows: r.rows, letters: r.letters }
      : { ok: false, error: r.error });
  });
```

Prima di scrivere: leggere `board.js` e usare la funzione di disposizione che esiste già
(quella che `admin:setBoard` chiama per validare). Se restituisce solo `ok/error`, va
estesa per dire anche righe e lettere — **senza cambiare cosa considera valido**.

- [x] **Step 2: nel Giramoe, l'ultima lettera di ciascuno**

La `1t` mostra `L ×2 · 1.000` per ogni giocatore: la lettera chiamata, quante volte
compariva, i punti. Oggi `giramoeScores()` dà solo `points`.

In `giramoe.js`, dentro `callConsonant` sul ramo `count > 0`, e in `buyVowel` sul ramo
presente:

```js
    const p = currentPlayer(gi);
    p.points += gi.multiplier * count;
    p.lastLetter = letter;   // per la console: cosa ha chiamato e quanto ha reso
    p.lastCount = count;
```

e in `giramoeScores()`: `lastLetter: p.lastLetter || null, lastCount: p.lastCount || 0`.

- [x] **Step 3: nel gioco finale, lettere e tempo pieno**

`adminView().final` guadagna `total: FINAL_TIME_MS` (per la barra), `given` e `picks`
(le due righe di lettere della `1w`). `finalBoardView()` le calcola già: si estrae la
parte comune in una funzione invece di ricopiarla.

- [x] **Step 4: la banca del finalista**

`adminView().finalist` diventa `{ id, name, bank }` — la `1v` mostra `7.700` nella scheda
del finalista.

- [x] **Step 5: test del payload**

Un test end-to-end che arriva alla fase `final` e controlla i campi nuovi
(`total`, `given`, `picks`, `finalist.bank`) più `admin:checkPhrase` su una frase che ci
sta e una che non ci sta. Controprova: togliere un campo dal server deve far fallire il
test.

- [x] **Step 6: test verdi, commit**

---

## Task 2: cornice dell'admin + `1n` pre-partita, `1o` lobby

**Files:** `public/js/admin/shell.js` (nuovo), `public/admin.html`, `public/css/admin.css`,
`public/js/admin.js`, `public/js/dev/fixtures.mjs`

- [x] **Step 1: `public/js/admin/shell.js`**

Stesso schema di `js/phone/shell.js` — caricato come modulo da `admin.html` e appeso a
`window.AdminShell`, perché `admin.js` è uno script classico.

```js
export const num = (v) => …            // uguale a phone/shell.js: 1.400, non 1400
// { title, gm, phase, tone, pips: { done, total } }
export function renderTopBar(host, opts)
// { hint, buttons: [{ id, label, tone: 'accent'|'plain', disabled }] }
export function renderActions(host, opts)
// { label, value, tone } → riga giocatore con nome a sinistra e valore a destra
export function playerRow({ name, right, tone, dim })
```

- [x] **Step 2: lo scheletro CSS**

In `admin.css`: `.ad-topbar` (titolo Syne 17px + chip `GM`, fase mono 10px ls 2,5px, pip
18×4), `.ad-bar` (fissa in basso: `padding:16px 20px 26px`, hairline sopra, fondo
`linear-gradient(0deg, rgba(10,10,12,.96), rgba(10,10,12,.6))`), `.ad-hint`,
`.abtn` (58–60px, varianti piena / accento tenue / contorno), `.acard` (radius 18,
`--panel`, hairline, `padding:18px`, gap 10–12), `.alab` (mono 10px ls 2,5px maiuscolo
`--ink-faint`), `.afield` (radius 12, `rgba(255,255,255,.05)`, hairline, `padding:15px 16px`,
**16px** di testo), `.arow` (riga giocatore, radius 12, variante `.is-turn` accesa di ciano).

La colonna delle schermate con barra d'azione ha `padding-bottom` pari all'altezza della
barra, o l'ultima scheda ci finisce sotto.

- [x] **Step 3: `1n` pre-partita**

Colonna centrata: wordmark 46px col glint che c'è già, chip `GAME MASTER`, tre righe
numerate (Syne 800 24px + testo mono), primario `INIZIA`. La riga `Schermo principale collegato` del handoff non si fa: il
committente l'ha esclusa, e senza un campo che dica davvero se la TV è agganciata sarebbe
una rassicurazione finta.

- [x] **Step 4: `1o` lobby**

Scheda `Giocatori` con `2 / 3` in ciano, tre righe (pallino, nome, `×` per cacciare;
lo slot libero è tratteggiato e dice `Slot libero`), scheda `Link giocatori` con l'URL —
lo stesso del QR sulla TV, quindi arriva dallo stesso campo. Barra in basso: `AVVIA
PARTITA` spento finché non sono tre, con la nota `Serve il terzo giocatore`.

- [x] **Step 5: verifica `?mock=1n`, `1o`; test verdi; commit**

---

## Task 3: `1p` partita, `1q` tabelloni finiti

**Files:** `public/admin.html`, `public/css/admin.css`, `public/js/admin.js`, `fixtures.mjs`

- [x] **Step 1: `1p`**

Barra alta `GIRAMOE + GM` / `Fase 01` con tre pip. Scheda tabellone: intestazione
`Tabellone 1 di 3` + stato `IN CORSO` in ciano, campo categoria, campo frase (multilinea
visiva), riga di verifica `✓ Sta in 4 righe · 33 lettere` alimentata da
`admin:checkPhrase` **con debounce di 250ms** (una richiesta per tasto sarebbe traffico
inutile), primario `AVVIA TABELLONE`. Seconda scheda: `TURNO Marco` + pillola dello stato
(`CONSONANTE`, `GIRA`, `RADDOPPIA`…), tre righe `turno N · banca N` con la riga di chi
gioca accesa di ciano. Barra in basso: `INDOVINATA` (accento tenue) + `PASSA TURNO`
(contorno), sopra la riga `IL GIOCATORE HA DETTO LA FRASE A VOCE`.

- [x] **Step 2: `1q` tabelloni finiti**

Colonna centrata: tre pip pieni, titolo `Tre tabelloni fatti` Syne 34px, spiegazione,
classifica delle banche (nome + Syne 22px, ordinata dalla più alta), primario `IL TRIPLETE`
in Space Mono 700 16px ls 3px.

- [x] **Step 3: verifica `?mock=1p`, `1q`; test verdi; commit**

---

## Task 4: `1r` Triplete setup, `1s` Triplete live

**Files:** `public/admin.html`, `public/css/admin.css`, `public/js/admin.js`, `fixtures.mjs`

- [x] **Step 1: `1r`**

Barra alta `IL TRIPLETE` / `Fase 02 · setup`. Scheda argomento (`ARGOMENTO — UGUALE PER
TUTTI`), scheda con le tre frasi numerate (numero Syne 20px ciano + campo) e la nota
`Tutte e tre indovinate: 5.000 invece di 3.000`, scheda `COME SI RIVELA` con la
spiegazione dei tre tabelloni. Barra in basso: `AVVIA IL TRIPLETE` spento con la nota che
dice cosa manca (`Manca la terza frase`) — calcolata sui campi vuoti, non un testo fisso.

- [x] **Step 2: `1s`**

Scheda di notifica con la campanella: `Marco si è prenotato` + `rivelazione in pausa`
(quando nessuno è prenotato, la scheda dice a che punto è la rivelazione).
Scheda `PUNTI TRIPLETE` con le tre righe: chi è prenotato ha il bordo chiaro, chi è
bloccato è spento e ha la pillola `BLOCCATA`, il punteggio è Syne 800 22px.
Scheda `SE SBAGLIA` con la regola. Barra in basso: `INDOVINATA` + `SBAGLIATA`, sopra
`MARCO HA DETTO LA FRASE`; entrambi spenti finché nessuno è prenotato.

- [x] **Step 3: verifica `?mock=1r`, `1s`; test verdi; commit**

---

## Task 5: `1t` Giramoe, `1u` spareggio

**Files:** `public/admin.html`, `public/css/admin.css`, `public/js/admin.js`, `fixtures.mjs`

- [x] **Step 1: `1t`**

Barra alta `GIRAMOE` / `Fase 04 · tabellone finale` in ciano. Scheda del tabellone (due
campi + verifica come in `1p`). Scheda del moltiplicatore, accesa di ciano:
`MOLTIPLICATORE V` + valore Syne 26px, bottone `GIRA LA RUOTA`, nota `Un solo giro, poi
vale per tutti`; a giro fatto il bottone sparisce e resta il valore. Scheda del turno con
le tre righe `L ×2 · 1.000` (dai campi nuovi del task 1) e la pillola `5s PER PRENOTARSI`
sul giocatore di turno quando la finestra è aperta. Barra in basso: `INDOVINATA` +
`SBAGLIATA`, sopra `SOLO CHI INDOVINA INCASSA`.

- [x] **Step 2: `1u` spareggio**

Colonna centrata, niente barra d'azione: qui l'admin non fa nulla e la schermata deve
dirlo. Eyebrow `PARITÀ IN BANCA`, titolo `Spareggio` Syne 40px, spiegazione `I concorrenti
girano la ruota dal telefono. Non serve fare nulla.`, una scheda per contendente (avatar
44px, nome, stato `sta girando…` / `fatto`, valore Syne 26px), nota finale
`Questi punti non vengono aggiunti alla banca. Se resta parità si rigira.`

- [x] **Step 3: verifica `?mock=1t`, `1u`; test verdi; commit**

---

## Task 6: `1v` finalista, `1w` finale live, `1x` buste

**Files:** `public/admin.html`, `public/css/admin.css`, `public/js/admin.js`, `fixtures.mjs`

- [ ] **Step 1: `1v`**

È il form più lungo di tutta l'app: scheda del finalista (avatar, `FINALISTA` + nome,
banca Syne 24px in ciano), tre chip di passo (`1 ARGOMENTO`, `2 FRASI`, `3 BUSTE`) che si
accendono man mano che i gruppi sono completi, poi i tre gruppi di campi. Barra in basso
con `INIZIA IL FINALE` spento e la nota che dice cosa manca.

I chip non sono decorazione: il form ha sette campi e senza un indicatore non si capisce a
che punto si è. Si accendono da soli guardando i campi, non da un payload.

- [ ] **Step 2: `1w` finale live**

Scheda del timer: cifra Syne 800 **64px** `tabular-nums`, `TABELLONE 1 DI 3`, barra
ciano col bagliore, nota `il tempo si trasporta`. Tre riquadri quadrati dei tabelloni
(`IN CORSO` / `ATTESA` / esito). Scheda con le due file di lettere: `REGALATE DAL
TABELLONE` (tessere bianche su nero) e `CHIAMATE DAL GIOCATORE` (tessere ciano). Barra in
basso: `INDOVINATA` + `SBAGLIATA`, spenti se non è prenotato.

- [ ] **Step 3: `1x` buste**

Scheda `ESITI DEL GIOCO FINALE` coi tre pip colorati e la frase che ne consegue
(`Due verdi: il finalista sceglie e ha 1 cambio.`), scheda `STATO DELLE BUSTE` con le tre
righe (aperta dal finalista = ciano piena; rossa = bottone `RIVELA`; verde chiusa =
tratteggiata), scheda `CAMBI RIMASTI` col numero Syne 26px, nota finale.

- [ ] **Step 4: verifica `?mock=1v`, `1w`, `1x`; test verdi; commit**

---

## Task 7: consegna

- [ ] **Step 1:** `node --test --test-concurrency=1` — tutti verdi
- [ ] **Step 2:** tutte e undici a 430×932: niente scroll orizzontale, nessuna scheda
      sotto la barra d'azione, tutti gli `input` a 16px
- [ ] **Step 3:** giro di controllo su TV (`?mock=1c`) e telefono (`?mock=1c`): i campi
      nuovi del server non devono aver mosso niente
- [ ] **Step 4:** riferire al committente
