# Giramoe v3 — Audio, Sequential Reveal & Board Shape

## Overview

Adds sound to the Giramoe Wheel-of-Fortune game, a Wheel-of-Fortune-style
one-letter-at-a-time board reveal, an audio-unlock start screen, and a board-shape
refinement (short top/bottom rows). All audio plays **only on the main display**
(PC/TV); the admin and player phones are unchanged and silent.

Builds on the v2 spec (`2026-06-09-giramoe-wheel-of-fortune-design.md`).

## Assets

Four audio files were added to the project root and must move into `public/assets/`
(the only directory Express serves):

- `spinning-wheel.mp3` — wheel spinning
- `lettera_rivelata.mp3` — a single letter flips on the board
- `risposta_corretta.mp3` — the phrase is solved
- `risposta_o_lettera_sbagliata.mp3` — a wrong letter or wrong verbal answer

All media is consolidated under `public/assets/`: `logo.png`, `teaser.png`,
`trailer.mp4`, and the four `.mp3` files. The duplicate copies left in the project
root (`logo.png`, `teaser.png`, `trailer.mp4`) are removed so there is a single
assets folder. (`board.js`, `game.js`, `server.js`, `public/` stay where they are.)

## Start Screen & Audio Unlock (main display)

Browsers block autoplay **with audio** unless a user gesture has occurred. So the
main display gains a first screen:

- On load, show a **start screen**: the Giramoe logo + the text "Tocca per iniziare".
- On click anywhere on that screen: hide it, show the video screen, and call
  `video.play()` with the video **unmuted**. The same click unlocks the four sound
  effects (a single user gesture unlocks audio for the whole page).
- The intro video (`trailer.mp4`) plays **with audio**, no controls, not seekable
  (as before).
- When the video ends, the existing flow continues (the decorative "Inizia" screen,
  then the admin-driven lobby).

The video's `muted` attribute is removed; autoplay is replaced by gesture-triggered
`play()`.

## Sounds & Triggers (main display only)

| Sound | Trigger |
|-------|---------|
| `spinning-wheel.mp3` | Starts when the wheel begins spinning (`main:spin`); stops when the wheel stops (`onSpinEnd`, with a `SPIN_MS` fallback timeout). Loops if shorter than the spin. |
| `lettera_rivelata.mp3` | Plays once per letter as each occurrence flips during the sequential reveal. |
| `risposta_corretta.mp3` | Plays when the admin presses "Frase indovinata" (`main:solved`). |
| `risposta_o_lettera_sbagliata.mp3` | Plays when a called letter is absent, or when the admin presses "Passa turno" (`main:wrong`). |

Implementation: a small `audio.js` module (or a section of `main.js`) holds the four
`Audio` objects, exposes `play(name)` / `stopSpin()` / `unlock()`, and is called from
`main.js` socket handlers. Audio lives only in the main screen's scripts.

## Sequential Letter Reveal (main display)

When a present letter is called, its occurrences are revealed **one at a time,
top-left → bottom-right**, each with the `lettera_rivelata` sound (~400 ms between
flips).

- **Server:** a new pure function `board.letterPositions(grid, letter)` returns the
  positions `[{row, col, letter}]` of the currently-unrevealed cells matching `letter`,
  in row-major (top-left → bottom-right) order. `game.applyConsonant` and
  `game.applyVowel` call it (before revealing) and include `positions` in their result.
- **Protocol:** the main display's board updates are split so the animation is not
  clobbered by a full re-render (see Protocol below). The server emits
  `main:revealLetter { positions }`; the main display reveals each position in order
  with a delay and the flip sound, mutating those cells in place.
- The board's source of truth remains the server grid; `main:gameState` is used to
  (re)draw the whole board only when a board is set or on reconnect.

## Board Shape (main display rendering)

The board is 4 rows. Rows 2 and 3 show **16** squares; rows 1 and 4 show **14**
squares, centered (the classic Wheel-of-Fortune trapezoid). The two corner positions
of rows 1 and 4 are not drawn at all (transparent), not red.

- **Data:** `board.buildGrid` marks the structural side cells of the short rows
  (columns outside the usable width) as a distinct cell type `edge` instead of
  `blocked`. Interior non-letter cells (word separators / empty playable cells) stay
  `blocked` (red). Letter cells stay `letter`.
- **Serialization:** `boardView` in `server.js` passes the `edge` type through.
- **Rendering:** the main display renders `edge` as an empty, transparent slot (no
  background, no border); `blocked` as red; `letter` as a white tile (hidden or
  revealed). The grid stays a 16-column CSS grid; `edge` cells simply occupy their
  slot invisibly, so rows 1 and 4 read as 14 centered squares.

## Protocol Changes (server → main only)

The admin and player event contracts are unchanged. For the main room:

- `main:gameState { board:{category, grid}, scores, currentTurn, boardNumber, totalBoards, segments }`
  — full redraw. Sent when a board is set (`admin:setBoard`) and on `main:init` while
  playing (reconnect/refresh). `grid` cells are `edge` | `blocked` | `letter` (letter
  hidden until revealed).
- `main:scores { scores, currentTurn }` — frequent score/turn updates; updates the
  score bar and active-player highlight only, never the board.
- `main:revealLetter { positions:[{row, col, letter}] }` — animate flips + flip sound.
- `main:solved` — play the correct sound. The fully-revealed board is delivered by a
  `main:gameState` emitted alongside it (the client's `gameState` handler does a full,
  non-animated redraw, so the whole phrase shows at once — hidden cells need their
  letters, which only `gameState` carries).
- `main:wrong` — wrong sound.
- `main:spin { winningSegment, totalAngle, value, result }` — wheel animation + spin
  sound (event exists; the spin sound is added on the client).
- `main:matchEnd { standings }` — unchanged.

Server handler wiring:

- `broadcastPlaying()` keeps emitting `admin:state` and `player:turnState`, but for the
  main room now emits `main:scores` (not a full `main:gameState`).
- `admin:setBoard` (success) emits `main:gameState` (full redraw), plus admin/player
  updates.
- `player:pickConsonant` / `player:buyVowel`:
  - present → emit `main:revealLetter { positions }`, then admin/player updates +
    `main:scores`.
  - absent → emit `main:wrong`, then updates + `main:scores`.
- `admin:solve` → emit `main:gameState` (board now fully revealed) + `main:solved`
  (correct sound). Then the existing logic: if it was the last board, also emit
  `main:matchEnd` — and the main display delays switching to the standings screen by
  ~3 s so the solved phrase and sound register; otherwise the next `admin:setBoard`
  redraws for the next board.
- `admin:passTurn` → emit `main:wrong`, then updates + `main:scores`.
- `next` / `bancarotta` (resolved inside `applySpin`) → after the spin delay, the
  routine `broadcastPlaying()` sends `main:scores`. No extra sound (the spin sound
  already played).

## Testing

- **Unit (`board.js`):** `letterPositions` returns matching unrevealed positions in
  row-major order; `buildGrid` marks short-row corners as `edge`, interior empties as
  `blocked`, letters as `letter`. Update the existing "blocked corners" test to expect
  `edge`.
- **Unit (`game.js`):** `applyConsonant` / `applyVowel` include ordered `positions`
  in their result for a present letter; empty for absent.
- **Integration (socket):** a present letter emits `main:revealLetter` with the right
  positions; an absent letter emits `main:wrong`; solve emits `main:solved`.
- **Browser smoke:** start screen → click → video unmuted; board renders with 14/16/16/14
  visible squares (corners of short rows transparent); a called letter reveals its cells
  one at a time; sounds are wired (verify the `Audio` elements exist and `play` is
  called — actual audio output is environment-dependent in the preview).

## Out of Scope

- Sounds for `next` / `bancarotta` segments (only the spin sound plays there).
- Volume controls / mute toggle.
- Audio on admin or player devices.
