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

1. **Schermo principale (PC/TV):** apri `http://<IP>:3000/` — parte il video introduttivo.
2. **Admin (tuo telefono):** apri `http://<IP>:3000/admin.html` e premi **Inizia**. Sullo schermo principale compare un **QR code**.
3. **Giocatori (max 3):** inquadrano il QR col telefono, inseriscono il nome ed entrano.
4. Quando ci sono 3 giocatori, sull'admin premi **Avvia partita**.
5. A turno (Player 1 → 2 → 3), il giocatore di turno tocca la ruota sul telefono: la ruota gira sullo schermo principale **e** sul suo telefono, si ferma su uno spicchio, il testo appare grande al centro, poi passa il turno automaticamente.

Tutti i dispositivi devono essere sulla **stessa rete Wi‑Fi** del PC.

## Personalizzare gli spicchi

I 16 testi degli spicchi sono in `server.js`, nell'array `game.segments`. Modificali lì.

## Struttura

- `server.js` — server Express + Socket.IO, stato di gioco e logica turni
- `public/index.html` + `js/main.js` — schermo principale (PC/TV)
- `public/admin.html` + `js/admin.js` — console admin (telefono)
- `public/play.html` + `js/player.js` — vista giocatore (telefono)
- `public/js/wheel.js` — disegno e animazione della ruota (Canvas)
- `public/css/style.css` — stile liquid glass condiviso

## Note

- La libreria QR è inclusa localmente (`public/js/qrcode.min.js`), quindi funziona anche senza internet.
- Servono sempre 3 giocatori: se uno si disconnette la partita si mette in pausa e attende la riconnessione.
