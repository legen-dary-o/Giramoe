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

Se i giocatori non sono sulla tua stessa rete (es. rete dati), avvia in modalità online:

```bash
npm run online
```

Questo apre un tunnel Cloudflare verso il tuo Mac e usa l'URL pubblico
(`https://xxx.trycloudflare.com`) nel QR code: i giocatori entrano da qualsiasi rete.
Tu apri main screen e admin come al solito (in locale), il resto non cambia.

Richiede `cloudflared` (una sola volta): `brew install cloudflared`.

Note: l'URL è casuale e cambia a ogni avvio; chiunque lo abbia può aprirlo finché il
tunnel è attivo, ma la lobby resta comunque limitata a 3 giocatori.

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
9. Si giocano **3 tabelloni**; chi ha più banca alla fine vince.

Tutti i dispositivi devono essere sulla **stessa rete Wi‑Fi** del PC.

## Personalizzare la ruota

I 16 valori degli spicchi sono in `game.js`, nell'array `SEGMENTS`. Categoria e frase di ogni tabellone si impostano a runtime dalla console admin.

## Sviluppo e test

```bash
node --test tests/board.test.js tests/game.test.js   # test unitari (logica)
# test di integrazione (richiede il server avviato):
node server.js & sleep 2 && node --test tests/integration.test.js
```

## Struttura

- `server.js` — layer Socket.IO: stato di gioco e broadcast (delega la logica ai moduli)
- `board.js` — layout della frase nel tabellone, rivelazione lettere (puro, testato)
- `game.js` — macchina a stati del turno, punteggi, ciclo dei 3 tabelloni (puro, testato)
- `public/index.html` + `js/main.js` — schermo principale (PC/TV)
- `public/admin.html` + `js/admin.js` — console admin (telefono)
- `public/play.html` + `js/player.js` — vista giocatore (telefono)
- `public/js/wheel.js` — disegno e animazione della ruota (Canvas)
- `public/js/audio.js` — effetti sonori del main display
- `public/css/style.css` — stile liquid glass condiviso
- `public/assets/` — logo, video e i 4 file audio
- `tests/` — test unitari (board, game) e di integrazione (socket)

## Note

- **Audio:** l'audio (video iniziale + effetti) parte **solo dal main display** e si attiva al primo tocco sulla schermata "Tocca per iniziare" (i browser bloccano l'audio senza un click). I 4 suoni sono in `public/assets/`.
- Quando un giocatore indovina una lettera presente, le sue occorrenze si scoprono **una alla volta** sul tabellone, con un suono per ognuna.
- L'animazione della ruota e l'audio girano solo con la scheda del main display **in primo piano** (limite del browser su `requestAnimationFrame`/autoplay).
- La libreria QR è inclusa localmente (`public/js/qrcode.min.js`), quindi funziona anche senza internet.
- Servono sempre 3 giocatori: se uno si disconnette la partita si mette in pausa e attende la riconnessione.
