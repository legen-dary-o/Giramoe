# Handoff: Giramoe — animazioni di round (Triplete / Express / Giramoe / Finalista / Buste)

## Overview
Cinque animazioni a schermo intero per il **main display** di Giramoe (`public/index.html`),
pensate per sostituire l'attuale `playTitleAnimation()` + `TitleDots`:

| # | Scena | Durata | Trigger nel gioco (socket) |
|---|-------|--------|----------------------------|
| 1 | IL TRIPLETE | 6.0s | `main:tripleteTitle` |
| 2 | EXPRESS | 5.5s | `main:expressStart` |
| 3 | GIRAMOE | 5.0s | `main:giramoeStart` |
| 4 | Finalista | 5.0s | schermata `#finalist-screen` |
| 5 | Buste | 6.0s | schermata `#envelopes-screen` |

Ognuna è **autonoma**: parte da schermo nero pulito e ci ritorna, quindi può essere
lanciata da sola senza sequenza.

## About the Design Files
I file di questo bundle sono **riferimenti di design realizzati in HTML/JS** — prototipi che
mostrano l'aspetto e il timing desiderati, **non codice di produzione da copiare**.
Il compito è **ricreare queste animazioni dentro l'ambiente esistente di Giramoe**:
moduli ES in `public/js/fx/`, three.js già presente in `public/vendor/`, CSS in
`public/css/style.css`, audio via `public/js/audio.js`. Il prototipo gira su un motore
timeline React (`animations-v2.jsx`) che **non va portato nel gioco** — serve solo a
riprodurre e scrubbare le animazioni per approvarle.

Nel gioco, ogni scena va implementata come una classe con `show()` / `update(t)`, esattamente
come `public/js/fx/titledots.js`, guidata dal loop di `stage3d.js`. Tutta la coreografia qui
sotto è espressa come funzione del **tempo locale della scena in secondi**, quindi è portabile
1:1 su un clock `requestAnimationFrame`.

## Fidelity
**High-fidelity.** Colori, tipografia, raggi, tempi ed easing sono definitivi e presi dal
repo. Ricrearle fedelmente. La resa può essere DOM/CSS (come il prototipo) oppure three.js
(coerente con `fx/`) — la scelta è del developer; il timing e i valori non cambiano.

---

## Design tokens (da `public/css/style.css`)
| Token | Valore |
|---|---|
| `--bg` | `#000000` |
| `--bg-2` | `#0a0a0c` |
| sfondo campo | `radial-gradient(85% 65% at 50% -8%, rgba(48,56,74,.32), transparent 62%), linear-gradient(180deg,#0a0a0c,#000 64%)` |
| `--ink` | `#f5f5f7` |
| `--ink-soft` | `rgba(245,245,247,.55)` |
| `--ink-faint` | `rgba(245,245,247,.38)` |
| `--accent` / `--green` | `#30b8ff` |
| `--red` | `#f5f5f7` |
| `--panel` / `--glass` | `#16161a` |
| `--hairline` | `rgba(255,255,255,.14)` |
| `--font-display` | Syne 800 |
| `--font-mono` | Space Mono 400/700 |
| `--r-md` | 16px |

Colori spicchi ruota: array `SEGMENT_COLORS` di `public/js/wheel.js` (16 valori, invariati).

**Wordmark** (usato in ogni scena): Syne 800, `letter-spacing:-.03em`, riempimento
`linear-gradient(105deg,#f5f5f7 42%,#fff 49%,#8e94a3 52%,#f5f5f7 60%)`, `background-size:320% 100%`,
`background-clip:text`. Il **glint** è `background-position` che va da `120%` a `-120%`
in ~1.4s. Non animare i figli: rompe `background-clip:text` (nota già presente nel CSS).

**Chrome persistente** su tutte le scene (identico a `#start-tap-screen`): 4 corner label
Space Mono 600 / `letter-spacing:4.5px` / `--ink-faint` a 4.5% dai bordi
(`Giramoe®`, `Est. 2026`, `● Live`, `Show dal vivo — IT`) + il `.grain` esistente.

## Easing — solo tre curve, nient'altro
```js
enter = easeOutExpo   // entrate, atterraggi
drive = easeInOutSine // camera, movimenti continui
pop   = easeOutBack   // impatti, scatti
```
Helper usato ovunque: `w(t,a,b) = clamp((t-a)/(b-a), 0, 1)`.

---

## 1 · IL TRIPLETE — 6.0s
Ruota gigante inquadrata da vicinissimo: si vede solo l'arco superiore.

**Geometria** (canvas logico 1920×1080): centro ruota `(960, 2060)`, raggio `R = 1950`.
Il bordo superiore cade a y=110 al centro e scende a y≈363 ai lati — un grande arco in cima.
Bezel: anello bianco `rgba(255,255,255,.82)` spesso 22px sul raggio.
Indicatore: triangolo `#f5f5f7` 52×74px, punta in basso, a `x=960, y=46`.

**Spicchi**: `conic-gradient(from -11.25deg, ...)`, 16 settori da 22.5°, colori
`SEGMENT_COLORS`, **tranne l'indice 0 che è `#111114`** (lo spicchio speciale IL TRIPLETE).
Sopra: sheen radiale + divisori bianchi `rgba(255,255,255,.9)` di 0.14°.

**Etichette** — questo è il punto delicato: raggio `0.74·R = 1443`, testo
`800 104px` (Syne/-apple-system) bianco con `text-shadow: 0 4px 10px rgba(0,0,0,.55)`;
lo spicchio 0 usa `italic 900 74px "Arial Black"` con `text-shadow: 0 0 26px rgba(125,225,255,.95)`.
Orientamento **tangenziale** (dritte quando lo spicchio arriva sotto l'indicatore) e — in DOM —
**`transform-origin: 0 0`** con `rotate(i*22.5deg) translateY(-1443px) translate(-50%,-50%)`.
Senza `transform-origin: 0 0` ogni numero ruota attorno al proprio centro e scivola fino a
mezza larghezza fuori dal suo spicchio. In canvas 2D l'equivalente è
`ctx.rotate(mid); ctx.translate(0,-1443); ctx.rotate(-mid)` prima di disegnare centrato.
Valori: `['IL TRIPLETE',900,700,500,800,600,2500,350,450,900,600,700,800,500,1000,650]`.

**Coreografia**
| t | evento |
|---|---|
| 0 → 0.4 | ruota in dissolvenza dentro, già a piena velocità |
| 0.05 → 3.5 | `rot = -2160° · (1 - easeOutQuart(p))` — 6 giri, decelera, si ferma con lo spicchio 0 sotto l'indicatore |
| — | motion blur `22px · (1 - easeOutQuart(p))` |
| 3.5 → 4.05 | **clack**: rimbalzo smorzato `sin(ring·π·3.4)·1.5°·(1-ring)²` |
| 3.5 → 3.92 | shake schermo `sin(t·92)·16px`, `cos(t·71)·11px`, smorzato `(1-p)^2.2` |
| 3.5 → 3.6 | flash sul bezel (anello bianco 26px, blur 3px), svanisce entro 4.0 |
| 3.95 → 4.7 | velo nero sopra la ruota fino a **0.93** + blur ruota +16px |
| 4.0 → 4.9 | wordmark **IL TRIPLETE** 196px: blur 30→0, scale 1.10→1.00, opacity 0→1 (padding-top 150px per non collidere con l'etichetta dello spicchio) |
| 4.15 → 4.8 | eyebrow `Bonus round` |
| 4.6 → 5.3 | hairline 0→90px |
| 5.25 → 5.9 | tutto in dissolvenza |
| 0 → 5.0 | camera: scale 1.00 → 1.05 (non è mai ferma) |

## 2 · EXPRESS — 5.5s
Treno frontale che esce dal tunnel.

Punto di fuga `(960, 545)`. 11 anelli di tunnel: per k, `u = frac(k/11 + accel·0.30)`,
`s = 2^((u-1)·8.2)`, box `2600s × 1500s` centrato sul VP, `border-radius: 220s`,
bordo `rgba(255,255,255,.16)`, opacity in dissolvenza a u<0.12 e u>0.9.
`accel = t + 1.35·w(t,0.6,3.25)^2.6·2.4` (il treno accelera).
Traversine: stessa legge, barra `1400s × 18s` a `y = 545 + 700s`, `rgba(255,255,255,.16)`.

Fari: `hs = 2^((easeInQuad(w(t,0.1,3.25)) - 1)·10.5)`, due cerchi bianchi
`Ø 300hs` distanti `760hs`, `blur(max(4, 60hs))`, `box-shadow 0 0 180hs 70hs rgba(160,225,255,.55)`.
Massa scura del treno dietro: `1800hs × 1100hs`, `linear-gradient(180deg,#0b1420,#05080d)`,
bordo `rgba(120,190,255,.28)`, entra tra 1.4 e 2.6s.

Shake camera: ampiezza `16px · w(t,1.1,3.25)^2.4`.

| t | evento |
|---|---|
| 3.13 → 3.37 | **whiteout** (`pop`), poi svanisce 3.47 → 4.10 |
| 3.15 → 3.33 | tunnel via |
| 3.20 → 3.65 | wordmark **EXPRESS** 230px già a posto sotto il bianco (blur 18→0, scale 1.08→1.00) |
| 3.60 → 4.25 | eyebrow `Bonus round` |
| 3.95 → 4.75 | striscia ciano `700×6px`, `blur(5px)`, attraversa dietro il wordmark |
| 4.05 → 4.75 | hairline 0→90px |
| 4.25 → 4.95 | sottotitolo `500 a lettera. Sbagli, bancarotta.` |
| 4.85 → 5.40 | dissolvenza |

## 3 · GIRAMOE — 5.0s
La ruota disegnata come quadrante radar, che collassa nel logo.

Raggio 322px al centro schermo. 16 raggi hairline che escono in sequenza
(`sweep = drive(w(t,0.25,2.45))`, il raggio i appare quando `sweep·16 > i`), ognuno con il
proprio valore in Space Mono 700 24px a `raggio+62` (l'ultimo, `1500`, in `--accent`).
Cono di scansione: `conic-gradient(from -90+sweep·360deg, rgba(48,184,255,.55), transparent 26deg)`.
Cerchio esterno: SVG `stroke #30b8ff 2px` con `stroke-dashoffset` che si chiude col sweep.
Mozzo: pallino bianco Ø14 con `box-shadow 0 0 30px rgba(48,184,255,.8)`.

2.95 → 3.50 il quadrante collassa (scale ×0.2) e svanisce; 3.25 → 4.10 il wordmark
**GIRAMOE** 230px esplode fuori dal punto di collasso (scale 0.55→1.00, blur 24→0);
eyebrow `Tabellone finale` 3.45→4.00; hairline 3.8→4.4; dissolvenza 4.35→4.90.

## 4 · Finalista — 5.0s
Classifica che si riduce a un nome.

Tre righe da 820×~100px, `background #16161a`, `border 1px rgba(255,255,255,.10)`,
`border-radius 16px`, padding 30/44, Space Mono 700 34px; indice `01/02/03` in
`--ink-faint` 22px; punteggio a destra.
0.05→0.60 entrano sfalsate di 0.12s; 0.30→1.50 i punteggi contano fino al valore
(formato `it-IT`: 12.400 / 9.800 / 7.200).
1.65→2.45 le due perdenti scendono di 120px, scalano a 0.94 e vanno a opacity 0.1;
1.70→2.50 la vincente sale a scale 1.09, bordo verso `rgba(48,184,255,.65)`,
`box-shadow 0 24px 70px rgba(48,184,255,.22)`.
2.35→2.75 le righe svaniscono; 2.50→3.40 compare il titolo `FINALISTA`
(Syne 800 40px, `letter-spacing 5px`, `--ink-soft`) e il nome come wordmark 210px
(scale 0.82→1.00, blur 22→0); 3.10→3.80 `va al gioco finale!`; dissolvenza 4.30→4.90.

## 5 · Buste — 6.0s
Le tre buste finali. **L'esito è comunicato solo dal colore, mai da una scritta.**

Geometria presa da `public/js/fx/envelopes3d.js` (W 1.7 : H 1.15): corpo **408×276px**,
`border-radius 6px`, `background #0e0e12` + texture halftone
(`radial-gradient(circle 1.6px at 50% 50%, rgba(255,255,255,.55) 99%, transparent 100%)`,
`background-size 7px 7px`), bordo 2px.
Lembo triangolare incernierato sul bordo alto: `408 × 143px`,
`clip-path: polygon(0 0, 100% 0, 50% 100%)`, `background #22222b`, stessa texture,
`transform-origin: 50% 0`, si apre con `rotateX(-158deg)`, `drop-shadow(0 2px 0 <bordo>)`.
Numero `1/2/3` sotto il corpo, Space Mono 700 46px in `--accent`.
Prospettiva contenitore: 2400px, gap 58px.

Colori bordo: neutro `rgba(255,255,255,.35)` → **verde `rgba(48,184,255,.85)`** /
**rosso `rgba(245,245,247,.35)`**, con glow `0 0 46px` del colore corrispondente.

| t | evento |
|---|---|
| 0.10 → 0.80 | titolo `LE BUSTE` (Syne 800 40px, ls 5px, `--ink-soft`) |
| 0.12 → 0.72 | le tre buste entrano dal basso, sfalsate di 0.14s; oscillazione lenta continua (`sin(t·1.15 + n)·5px`) |
| 0.90 / 1.32 / 1.74 | esito i-esimo: il bordo vira al colore, glow che pulsa. **Niente testo** |
| 2.50 → 3.20 | le due non scelte si smorzano (opacity ×0.28, scale 0.95); la busta 1 avanza verso camera (scale 1.16, −40px) e il titolo svanisce |
| 3.25 → 4.25 | il lembo si apre e il **premio** sale da dentro fino a 176px sopra il bordo alto: Space Mono 700 34px bianco, `z-index` sopra il lembo |
| 4.40 → 5.00 | `Puoi cambiarla alla cieca.` |
| 5.30 → 5.90 | dissolvenza |

Premi usati nel prototipo (segnaposto, da rendere configurabili dall'admin come già avviene):
`Viaggio a New York` (verde), `Niente premio` (rosso), `Weekend a Parigi` (verde).

---

## Audio
Il prototipo contiene una colonna sonora **procedurale** (`giramoe-audio.js`) che serve a far
sentire l'intenzione. In produzione si integra con `public/js/audio.js` (che già gestisce
l'unlock al primo tocco): registrare/procurare i suoni reali e chiamarli agli stessi istanti.

Le battute sono espresse come **frazione di avanzamento** della scena, così restano valide
se cambi la durata.

| Scena | p | Suono | Asset |
|---|---|---|---|
| Triplete | 0.005 | loop ruota che gira | `spinning-wheel.mp3` ✔ già nel repo |
| Triplete | 0.578 | stop loop + **clack metallico** | da procurare |
| Triplete | 0.586 | sub-drop d'impatto | da procurare |
| Triplete | 0.668 | accordo grave (131 Hz) | da procurare |
| Express | 0.005 | rumble in crescita (3.1s) | da procurare |
| Express | 0.11 / 0.30 | **trombe treno**, due note (233 → 311 Hz) | da procurare |
| Express | 0.55 | sibilo freni (1.1s) | da procurare |
| Express | 0.585 | whoosh + sub-drop sul whiteout | da procurare |
| Express | 0.63 | accordo (147 Hz) | da procurare |
| Giramoe | 0.05 + i·0.0275 (×16) | ping radar, 330 Hz che sale di 1/24 d'ottava a ping | da procurare |
| Giramoe | 0.66 | accordo (110 Hz) | da procurare |
| Finalista | 0.06 → 0.22 | 5 tick del conteggio | da procurare |
| Finalista | 0.30 | swell 1.15s che culmina sul nome | da procurare |
| Finalista | 0.51 | sub-drop + chime 659 Hz | da procurare |
| Finalista | 0.53 | accordo (165 Hz) | da procurare |
| Buste | 0.02 / 0.043 / 0.067 | fruscio di carta ×3 | da procurare |
| Buste | 0.192 / 0.262 / 0.332 | chime esito: brillante (verde) / spento (rosso) | da procurare |
| Buste | 0.433 | apertura busta | `lettera_rivelata.mp3` ✔ già nel repo |
| Buste | 0.558 | carta che scorre | da procurare |
| Buste | 0.650 | doppio chime sul premio (784 + 1047 Hz) | da procurare |

**Esplicitamente NON usare** `risposta_corretta.mp3` sul Finalista né sulle Buste.

## Integrazione nel gioco
- Sostituire `playTitleAnimation(word)` in `public/js/main.js` con un dispatcher che sceglie
  la scena giusta; i timeout attuali (`setTimeout(..., 2800)`) vanno allineati alla durata
  reale di ogni animazione (6000 / 5500 / 5000 ms).
- `TitleDots` (`public/js/fx/titledots.js`) diventa inutilizzato: rimuoverlo o tenerlo come
  fallback per `prefers-reduced-motion`.
- Rispettare `@media (prefers-reduced-motion: reduce)` come già fa `style.css`:
  in quel caso mostrare il solo wordmark statico.
- **Skip**: l'host deve poter saltare qualsiasi animazione con un tap dall'admin
  (evento socket → la scena salta all'ultimo frame e chiude).
- Le animazioni girano solo con la scheda del main display in primo piano (limite noto di
  `requestAnimationFrame`, già documentato nel README del gioco).

## Assets
Tutti già nel repo — nessun asset nuovo:
- Font: `public/fonts/syne-800.woff2`, `space-mono-400.woff2`, `space-mono-700.woff2`
- Audio: `public/assets/spinning-wheel.mp3`, `lettera_rivelata.mp3`
- Colori spicchi: `public/js/wheel.js`

## Files in questo bundle
| File | Cos'è |
|---|---|
| `Giramoe Animations.dc.html` | documento del prototipo: durate scene (`OM_SCENES`), font, tweaks |
| `giramoe-scenes.jsx` | **la coreografia** — una funzione per scena, tutto in funzione del tempo locale. È il riferimento normativo |
| `giramoe-audio.js` | motore audio procedurale + cue sheet completo |
| `animations-v2.jsx` | motore timeline del prototipo — **non portare nel gioco** |
| `tweaks-panel.jsx` | pannello di controllo del prototipo — **non portare nel gioco** |
| `Giramoe Screens.dc.html` | ricostruzione delle schermate attuali (intro / title / lobby) come riferimento di contesto |
| `fonts/`, `assets/` | copie dei font e degli mp3 usati dal prototipo |

Per far girare il prototipo in locale basta servire la cartella con un server statico e
aprire `Giramoe Animations.dc.html`.
