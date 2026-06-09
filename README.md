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
- `public/css/style.css` — stile liquid glass condiviso
- `tests/` — test unitari (board, game) e di integrazione (socket)

## Note

- La libreria QR è inclusa localmente (`public/js/qrcode.min.js`), quindi funziona anche senza internet.
- Servono sempre 3 giocatori: se uno si disconnette la partita si mette in pausa e attende la riconnessione.
