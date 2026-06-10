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
- Lo **schermo principale** lo apri sul PC (`localhost:3000`): assets e video locali, nessuna latenza.
- L'**admin** (il tuo telefono) lo apri dall'URL del tunnel `https://…/admin.html`: così
  **anche tu** non devi stare sulla stessa rete del PC.
- I **giocatori** scansionano il QR: contiene già l'URL del tunnel.

Richiede `cloudflared` (installazione una tantum): `brew install cloudflared`.

Note: l'URL del tunnel è casuale e cambia a ogni avvio; chiunque lo abbia può aprirlo
finché il tunnel è attivo (lobby comunque limitata a 3 giocatori). Se la tua rete
blocca i tunnel Cloudflare, `npm run online` riparte automaticamente in modalità locale.

## Come si gioca

1. **Schermo principale (PC/TV):** apri `http://<IP>:3000/` — parte il video introduttivo a tutto schermo.
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
- Alla fine del Triplete i punti vanno **in banca** e si mostra la classifica finale.

## Personalizzare la ruota

I 16 valori degli spicchi sono in `game.js`, nell'array `SEGMENTS`. Categoria e frase di ogni tabellone si impostano a runtime dalla console admin.

## Sviluppo e test

```bash
node --test tests/board.test.js tests/game.test.js tests/triplete.test.js   # test unitari (logica)
node --test tests/triplete.integration.test.js   # flusso Triplete via socket (server interno, ~17s)
# test di integrazione del gioco base (richiede il server avviato):
node server.js & sleep 2 && node --test tests/integration.test.js
```

## Struttura

- `server.js` — layer Socket.IO: stato di gioco e broadcast (delega la logica ai moduli)
- `board.js` — layout della frase nel tabellone, rivelazione lettere (puro, testato)
- `game.js` — macchina a stati del turno, punteggi, ciclo dei 3 tabelloni (puro, testato)
- `triplete.js` — gioco finale: 3 tabelloni, prenotazioni/blocchi, bonus 5000 (puro, testato)
- `public/index.html` + `js/main.js` — schermo principale (PC/TV)
- `public/admin.html` + `js/admin.js` — console admin (telefono)
- `public/play.html` + `js/player.js` — vista giocatore (telefono)
- `public/js/wheel.js` — disegno e animazione della ruota (Canvas)
- `public/js/audio.js` — effetti sonori del main display
- `public/css/style.css` — stile liquid glass condiviso
- `public/assets/` — logo, video e i 5 file audio (incl. `buzzer.mp3` del Triplete)
- `tests/` — test unitari (board, game) e di integrazione (socket)

## Note

- **Audio:** l'audio (video iniziale + effetti) parte **solo dal main display** e si attiva al primo tocco sulla schermata "Tocca per iniziare" (i browser bloccano l'audio senza un click). I 5 suoni sono in `public/assets/`.
- Quando un giocatore indovina una lettera presente, le sue occorrenze si scoprono **una alla volta** sul tabellone, con un suono per ognuna.
- L'animazione della ruota e l'audio girano solo con la scheda del main display **in primo piano** (limite del browser su `requestAnimationFrame`/autoplay).
- La libreria QR è inclusa localmente (`public/js/qrcode.min.js`), quindi funziona anche senza internet.
- Servono sempre 3 giocatori: se uno si disconnette la partita si mette in pausa e attende la riconnessione.
