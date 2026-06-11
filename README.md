# Giramoe

Gioco di festa interattivo dal vivo con ruota che gira. Uno schermo principale (PC/TV) mostra le visual, tu gestisci la partita dal telefono (admin), e fino a 3 amici giocano dal proprio telefono.

## Avvio

```bash
npm install
npm start
```

Il server stampa gli indirizzi, ad esempio:

```
Main screen: http://192.168.1.72:3000
Admin:       http://192.168.1.72:3000/admin.html
```

Con `npm start` tutti i dispositivi devono essere sulla **stessa rete Wi‑Fi**.

## Giocare da reti diverse (online)

Per far entrare i giocatori da **qualsiasi rete** (anche dati cellulare), avvia in modalità
online — è un comando **diverso** da `npm start`:

```bash
npm run online
```

> ⚠️ Deve essere `npm run online`, non `npm start`. Con `npm start` il QR punta all'IP
> locale e serve la stessa rete Wi‑Fi.

All'avvio compare un banner con i link da usare:

```
• Schermo (sul PC):  http://localhost:3000          ← aprilo sul PC/TV
• Admin (telefono):  https://xxx.trycloudflare.com/admin.html   ← da QUALSIASI rete
• Giocatori:         inquadrano il QR (già puntato al tunnel)
```

Punti chiave:
- Lo **schermo principale** lo apri sul PC (`localhost:3000`): assets locali, nessuna latenza.
- L'**admin** (il tuo telefono) lo apri dall'URL del tunnel `https://…/admin.html`: così
  **anche tu** non devi stare sulla stessa rete del PC.
- I **giocatori** scansionano il QR: contiene già l'URL del tunnel.

Richiede `cloudflared` (installazione una tantum): `brew install cloudflared`.

Note: l'URL del tunnel è casuale e cambia a ogni avvio; chiunque lo abbia può aprirlo
finché il tunnel è attivo (lobby comunque limitata a 3 giocatori). Se la tua rete
blocca i tunnel Cloudflare, `npm run online` riparte automaticamente in modalità locale.

## Come si gioca

1. **Schermo principale (PC/TV):** apri `http://<IP>:3000/` — tocca per partire: title animation GIRAMOE e poi la lobby.
2. **Admin (tuo telefono):** apri `http://<IP>:3000/admin.html`, premi **Inizia** → compare il QR.
3. **Giocatori (max 3):** inquadrano il QR, inseriscono il nome, entrano.
4. Con 3 giocatori, premi **Avvia partita**, poi imposta **categoria** e **frase** del tabellone e premi **Avvia tabellone**.
5. A turno il giocatore **gira la ruota** e chiama una **consonante**:
   - presente → si rivela, guadagna `valore × occorrenze`, continua;
   - assente → passa il turno (punti del turno conservati).
6. Con almeno 500 punti del turno (e dopo aver indovinato una consonante) può **comprare una vocale** (costa 500).
7. Spicchi speciali: **next** passa il turno, **bancarotta** azzera punti turno + banca, **raddoppia** raddoppia i punti del turno se la consonante è presente.
8. Per risolvere, il giocatore dice la frase **a voce**: l'admin preme **Frase indovinata** (rivela tutto, i punti del turno vanno in banca) o **Passa turno** se sbagliata.
9. Si giocano **3 tabelloni**; poi parte il gioco finale **IL TRIPLETE**.

Tutti i dispositivi devono essere sulla **stessa rete Wi‑Fi** del PC.

## IL TRIPLETE (gioco finale)

Finiti i 3 tabelloni, in admin compare il tasto **IL TRIPLETE**. Premendolo parte
l'animazione del titolo (stessi colori degli spicchi della ruota) e l'admin inserisce
**un titolo** (l'argomento, uguale per tutti) e **3 frasi**. La ruota qui non serve.

- I tabelloni si giocano **uno alla volta**, ognuno vale **1000 punti**.
- **Tabelloni 1 e 2:** le caselle compaiono a caso, una ogni **1,5s**, finché il
  tabellone si riempie.
- **Tabellone 3:** le lettere **lampeggiano** (compaiono ~1s e spariscono, senza
  ripetersi) per i primi **15 reveal**, poi si **stabilizzano** e restano.
- Il giocatore si prenota col bottone **PRENOTATI** e dice la frase a voce. L'admin
  preme **Frase indovinata** (+1000) o **Frase sbagliata**. Il reveal si ferma alla
  prenotazione e riprende — **senza azzerarsi** — dopo una risposta errata.
- Chi sbaglia è **bloccato** finché non sbagliano tutti (poi i blocchi si azzerano).
  Alla prenotazione parte il suono `buzzer.mp3` e l'admin vede chi ha schiacciato.
- Chi indovina **tutti e 3** i tabelloni prende **5000** invece di 1000+1000+1000.
- Alla fine del Triplete i punti vanno **in banca**.

## EXPRESS (round)

Dopo il Triplete si torna alla **ruota**: altri **3 tabelloni**, ma uno spicchio
"PASSA" diventa **EXPRESS** (icona trenino). Chi ci capita entra **subito** in modalità
express (parte l'animazione "EXPRESS"):

- **Consonanti a raffica:** ogni occorrenza vale **500**, e si continua a sparare.
- **Vocali:** si comprano a **500** come al solito (rivelano, niente punti).
- **Indovina la frase** → vince il tabellone (punti in banca).
- **Lettera assente** oppure **soluzione sbagliata** → **BANCAROTTA totale**: azzera i
  punti del turno **e la banca**, e passa il turno. Il giocatore dopo gioca normale
  (niente bonus express) a meno che non ricada sullo spicchio EXPRESS.

Lato admin, in express i pulsanti diventano **Frase indovinata** / **Frase sbagliata**
(quest'ultimo = bancarotta).

## GIRAMOE (tabellone finale)

Dopo i 3 tabelloni express → animazione "GIRAMOE" e **un ultimo tabellone**. La ruota
qui **non ha spicchi speciali** (i 5 speciali sono sostituiti da valori a punti). **Giri
tu la ruota una sola volta** → moltiplicatore **V**.

- A giro, ogni giocatore di turno chiama **una sola consonante** (niente vocali). Se
  presente, viene rivelata e vale **V × occorrenze** per quel giocatore.
- Dopo la consonante ha **5 secondi** per premere **PRENOTATI** e dire la soluzione.
  Niente prenotazione / scaduto il tempo → passa al successivo (nessuna penalità).
- **Solo chi indovina** incassa **i propri** punti in banca; gli altri no. Frase
  sbagliata → passa, senza penalità.

## Finalista

Finito il Giramoe, **chi ha più banca diventa il finalista** e accede al gioco finale;
gli altri sono fuori. In caso di **parità**, i giocatori in testa fanno uno **spareggio**:
ognuno gira la ruota Giramoe una volta (dal telefono), vince il valore più alto (quei
punti **non** vengono aggiunti); se ancora pari si va a oltranza.

## Gioco finale (solo il finalista)

Niente ruota: **3 tabelloni** sullo stesso argomento con un **unico timer di 60s** che
si trasporta tra i tabelloni. L'admin inserisce argomento + 3 frasi.

- **Tabellone 1:** si rivelano **N R T E** (se presenti); il giocatore sceglie **3
  consonanti + 1 vocale** (gratis), poi **parte il timer**. Si prenota (ferma il timer)
  e risponde a voce → suono giusto/sbagliato; **in entrambi i casi** si va al tabellone
  successivo **mantenendo il tempo**.
- **Tabellone 2:** rivelate **prima e ultima lettera di ogni parola**; niente scelta
  lettere; il timer riparte da dov'era; si prenota e risponde.
- **Tabellone 3:** tutto vuoto; **consonanti illimitate + 1 vocale**, ma ogni **lettera
  errata −3s**; bottone per prenotarsi.
- **Timer a 0** nei primi due tabelloni → i restanti sono persi; al terzo (senza
  prenotazione in tempo) → errato.

Ogni tabellone risolto = **verde**, altrimenti **rosso**: questi 3 esiti colorano le buste.

L'admin inserisce **argomento + 3 frasi + i 3 testi delle buste** nello stesso form.

## Buste (finale)

Compaiono **3 buste** colorate **verde/rosso** in base ai 3 esiti del gioco finale.

- Il finalista apre una busta **verde** (se ce ne sono 2-3 sceglie quale; se 1 quella; se
  0 non apre nulla). Vede il contenuto e può **cambiarla alla cieca** con un tasto.
- Può cambiare **(verdi − 1)** volte (3 verdi → 2 cambi); una busta scartata **non** è più
  riscegliibile.
- Le buste **rosse** (se ci sono) le rivela **solo l'admin**, una alla volta, dalla console.

## Personalizzare la ruota

I 16 valori degli spicchi sono in `game.js`, nell'array `SEGMENTS`. Categoria e frase di ogni tabellone si impostano a runtime dalla console admin.

## Sviluppo e test

```bash
# test unitari (logica):
node --test tests/board.test.js tests/game.test.js tests/triplete.test.js tests/giramoe.test.js tests/finalist.test.js tests/finalgame.test.js tests/envelopes.test.js
# flussi via socket (server interno, ~55s):
node --test tests/triplete.integration.test.js tests/express.integration.test.js tests/giramoe.integration.test.js tests/final.integration.test.js
# test di integrazione del gioco base (richiede il server avviato):
node server.js & sleep 2 && node --test tests/integration.test.js
```

Seam utili a test/debug (variabili d'ambiente, opzionali): `PORT`/`HOST` (bind), `GIRAMOE_FORCE_SEGMENT` (forza lo spicchio del giro), `TRIPLETE_GAP_MS` (pausa tra i tabelloni del Triplete).

## Struttura

- `server.js` — layer Socket.IO: stato di gioco e broadcast (delega la logica ai moduli)
- `board.js` — layout della frase nel tabellone, rivelazione lettere (puro, testato)
- `game.js` — macchina a stati del turno, punteggi, ciclo dei 3 tabelloni (puro, testato)
- `triplete.js` — Triplete: 3 tabelloni, prenotazioni/blocchi, bonus 5000 (puro, testato)
- `giramoe.js` — tabellone finale: giro unico dell'admin, round-robin a consonanti, solo il vincitore incassa (puro, testato)
- `finalist.js` — selezione finalista (banca più alta) e confronto dello spareggio (puro, testato)
- `finalgame.js` — gioco finale: 3 tabelloni (NRTE / prima-ultima / vuoto), scelte lettere, risultati verde/rosso (puro, testato)
- `envelopes.js` — buste finali: apri/cambia le verdi, l'admin rivela le rosse (puro, testato)
- `game.js` include anche la modalità **EXPRESS** (raffica 500/occorrenza, bancarotta totale)
- `public/index.html` + `js/main.js` — schermo principale (PC/TV)
- `public/admin.html` + `js/admin.js` — console admin (telefono)
- `public/play.html` + `js/player.js` — vista giocatore (telefono)
- `public/js/wheel.js` — disegno e animazione della ruota (Canvas)
- `public/js/audio.js` — effetti sonori del main display
- `public/css/style.css` — stile liquid glass condiviso
- `public/assets/` — i 5 file audio (incl. `buzzer.mp3` del Triplete)
- `tests/` — test unitari (board, game) e di integrazione (socket)

## Note

- **Audio:** gli effetti partono **solo dal main display** e si attivano al primo tocco sulla schermata "Tocca per iniziare" (i browser bloccano l'audio senza un click). I 5 suoni sono in `public/assets/`.
- Quando un giocatore indovina una lettera presente, le sue occorrenze si scoprono **una alla volta** sul tabellone, con un suono per ognuna.
- L'animazione della ruota e l'audio girano solo con la scheda del main display **in primo piano** (limite del browser su `requestAnimationFrame`/autoplay).
- La libreria QR è inclusa localmente (`public/js/qrcode.min.js`), quindi funziona anche senza internet.
- Servono sempre 3 giocatori: se uno si disconnette la partita si mette in pausa e attende la riconnessione.
