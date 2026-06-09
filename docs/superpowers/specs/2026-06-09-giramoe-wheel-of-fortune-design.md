# Giramoe v2 — Wheel of Fortune Game Mode

## Overview

Expands the existing Giramoe app (spinning wheel + real-time sync) into a full
Wheel-of-Fortune–style game ("La Ruota della Fortuna"). Three players take turns
spinning a points wheel, calling letters to reveal a hidden phrase on a board, and
banking points. A match consists of **3 boards (tabelloni)**, after which the game
ends (future games will be added later).

This builds on the v1 spec (`2026-06-09-giramoe-game-design.md`): same stack
(Node.js + Express + Socket.IO, in-memory state), same three views (main screen /
admin phone / player phone), same connection flow (QR lobby, 3 players required).

## Visual Changes (main screen)

- **Fullscreen video:** intro video fills the entire viewport (`object-fit: cover`),
  no white margins.
- **Wheel restyled to match the logo:**
  - Liquid-glass dividers between segments (translucent white borders + gloss).
  - Glass outer ring.
  - The pointer/indicator **touches** the wheel edge (currently floats above it).
  - Segment labels are the **point values** (see Wheel below), not "Spicchio N".
  - Special segment colors: `bancarotta` = black, `next` = grey, `raddoppia` = gold;
    numeric segments keep the rainbow palette.
- **Below the wheel:** a **category banner** (large glass label) and the **board**.

## The Wheel

16 segments, in clockwise order starting from the pointer (top):

```
1000, bancarotta, raddoppia, 200, 400, 500, next, 400, 300, 700, 500, next, 400, 300, 500, next
```

Segment types:
- **number** (1000/700/500/400/300/200): the spun value, used to score a consonant.
- **bancarotta**: bankrupt.
- **raddoppia**: double.
- **next**: lose a turn.

The server already computes a random `winningSegment` (0–15) and the `totalAngle`
to land on it; this is reused. `game.segments` becomes this value array (the index →
value mapping drives both the wheel labels and the scoring).

## The Board (Tabellone)

- Grid is **4 rows**, max **16 columns**. Usable cells per row: **14 / 16 / 16 / 14**
  (rows 1 and 4 have one permanently-blocked cell on each side; rows 2 and 3 use the
  full 16). Total usable cells: 60.
- The admin sets a **category** (string) and a **phrase** (string) at runtime, per board.
- The phrase is auto-laid-out into the grid (Wheel-of-Fortune style):
  - Phrase is uppercased and accent-normalized (À/È/É→A/E, etc.); only letters A–Z and
    spaces are kept (other characters stripped).
  - Words are placed left-to-right, **never split across rows**.
  - A word that doesn't fit in the remaining space of the current row moves to the next
    row. Rows are filled in order with capacities [14, 16, 16, 14].
  - Each row's content is **centered** within that row's usable width.
  - Spaces between words occupy a **blocked (red) cell**; a row never starts with a space.
  - If the phrase cannot fit (too long for 60 usable cells with the per-row capacities),
    the admin gets a validation error and must shorten it.
- **Cell states:**
  - **blocked (red):** unused cells and word-separator spaces — always shown red.
  - **letter (white):** holds a letter; **hidden** (blank white tile) until revealed,
    then shows the uppercase letter.
- The board is **shared**: revealed letters persist across turns within the same board.

## Letters

- **Vowels:** A E I O U.
- **Consonants:** all other A–Z letters (B C D F G H J K L M N P Q R S T V W X Y Z).
- **Used-letter rules:**
  - A called letter that **is present** in the board → revealed and **disabled for all
    players** (cannot be called again).
  - A called letter that is **absent** → **not disabled, not marked** anywhere. Players
    must remember which absent letters were already called ("astuzia").

## Scoring

Each player has two counters, both shown on the player phone and on the admin:
- **roundPoints** (punti turno): points earned on the current board.
- **bank** (banca): cumulative points carried across boards.

Rules:
- **Correct consonant:** `roundPoints += spunValue × occurrences`
  (e.g. spun 200, called "C", 3 C's → +600).
- **raddoppia + present consonant:** `roundPoints = roundPoints × 2` (and reveal). If
  `roundPoints` is 0, it stays 0 but letters still reveal.
- **Vowel purchase:** `roundPoints -= 500` (cost), reveal occurrences, **no points per
  occurrence**.
- **bancarotta:** the current player's `roundPoints = 0` **and** `bank = 0`. Turn passes.
- **Solve correct:** the solver's `roundPoints` is added to their `bank`; board ends.
- At the start of each new board, **all** players' `roundPoints` reset to 0. `bank` persists.

## Turn Flow (state machine)

State per turn for the current player:

1. `MUST_SPIN` — only action: **spin the wheel**.
2. Spin resolves by segment type:
   - **number** → `PICK_CONSONANT`.
   - **raddoppia** → `PICK_CONSONANT_DOUBLE`.
   - **next** → pass turn (auto).
   - **bancarotta** → wipe roundPoints + bank, pass turn (auto).
3. `PICK_CONSONANT` / `PICK_CONSONANT_DOUBLE` — player taps a consonant on their keyboard:
   - **present** → reveal occurrences; score (add value×count, or double); set
     `hasScoredConsonant = true`; go to `CONTINUE`.
   - **absent** → pass turn (auto). roundPoints kept.
4. `CONTINUE` — available actions:
   - **spin again** → back to step 2.
   - **buy vowel** — enabled only if `hasScoredConsonant` (player has spun and called a
     present consonant this turn) **and** `roundPoints >= 500` → `PICK_VOWEL`.
   - (The player may also attempt a verbal solve at any time; the admin adjudicates.)
5. `PICK_VOWEL` — player taps a vowel; `roundPoints -= 500`:
   - **present** → reveal occurrences; back to `CONTINUE`.
   - **absent** → pass turn (auto). roundPoints kept (already debited 500).

**Verbal solving:** the player says the phrase out loud. The admin presses:
- **"Frase indovinata"** → reveal the whole board; add solver's roundPoints to their bank;
  the board ends.
- **"Passa turno"** → wrong solve; turn passes (roundPoints kept). This button also lets the
  admin manually pass a turn if needed.

**Turn passing:** automatic for the rule-based cases (absent letter, next, bancarotta).
Manual (admin button) for a wrong verbal solve. Turn order is fixed: P1 → P2 → P3 → P1.

## Boards & Match End

- A match is **3 boards**. The admin sets category + phrase for each board, then starts it.
- Each new board starts with the next player in rotation (board 1 → P1, board 2 → P2,
  board 3 → P3), so the first move rotates fairly.
- After the 3rd board is solved, the game enters an **end screen** showing each player's
  final bank and the winner (highest bank). Future game modes will follow this.

## Admin Controls (additions)

Pre-board:
- **Category** input + **Phrase** input + **"Avvia tabellone"** (validates the phrase fits).

During board:
- **"Frase indovinata"** (reveal + bank + end board).
- **"Passa turno"** (wrong verbal solve / manual pass).
- Live view: each player's **roundPoints** and **bank**, current turn highlighted, board
  progress, current board number (1–3).

End:
- Final standings; (future) start next game.

## Architecture & Data Flow

All authoritative game logic lives on the **server** (`server.js` plus extracted modules);
clients render state and send intents. Key additions:

- **`board.js`** (new, server-side module): phrase normalization, word-wrap/auto-layout into
  the [14,16,16,14] grid, occurrence counting, reveal logic. Pure functions, unit-testable
  without sockets.
- **`game.js`** (new, server-side module): the turn state machine and scoring — given the
  current game state and a player intent (spin result, letter pick, vowel buy, admin solve),
  returns the next state and the events to emit. Pure/deterministic where possible (the RNG
  for the wheel stays in the socket layer and is passed in), so it is unit-testable.
- **`server.js`**: thin socket layer wiring intents to `game.js`/`board.js` and broadcasting
  state. Keeping logic out of the socket handlers keeps `server.js` focused and testable.

### Socket events (additions)

Player → server: `player:spin` (exists), `player:pickConsonant {letter}`,
`player:buyVowel {letter}`.

Admin → server: `admin:setBoard {category, phrase}` (validates, lays out, starts board),
`admin:solve` (Frase indovinata), `admin:passTurn`.

Server → main: `main:boardState {category, grid, currentPlayer, scores, boardNumber}`,
`main:reveal {cells, letter}`, `main:spin` (exists), `main:matchEnd {standings}`.

Server → players: `player:turnState {state, isMyTurn, roundPoints, bank, usedLetters,
vowelEnabled}`, `player:reveal {...}`, plus existing connection events.

Server → admin: `admin:state` extended with scores, board info, current board number,
phase.

### State shape (server, in memory)

```
game = {
  phase: 'video' | 'lobby' | 'playing' | 'matchEnd',
  roomCode, players: [{ id, name, socketId, connected, roundPoints, bank }],
  boardNumber: 1..3,
  board: { category, phrase, grid }   // grid: 2D array of cells {type:'blocked'|'letter', letter, revealed}
  currentTurnIndex,
  turnState: 'MUST_SPIN' | 'PICK_CONSONANT' | 'PICK_CONSONANT_DOUBLE' | 'CONTINUE' | 'PICK_VOWEL',
  lastSpinValue,            // numeric value or special tag for the current spin
  hasScoredConsonant,       // bool, resets each turn
  usedLetters: [],          // letters present-and-revealed (disabled for all)
  segments: [1000,'bancarotta',...]  // 16 values
}
```

## Testing

- **Unit tests** (`board.js`): normalization (accents/punctuation), word-wrap into
  [14,16,16,14] with centering, no word splitting, overflow rejection, occurrence counting,
  reveal correctness.
- **Unit tests** (`game.js`): each transition of the turn state machine — correct/absent
  consonant, raddoppia (present/absent, zero points), vowel buy (gating on hasScoredConsonant
  + ≥500, present/absent), bancarotta wipe, next, solve (bank + board end), board rotation,
  3-board match end.
- **Integration test** (Socket.IO client, like v1): full match — set board, spin, score,
  buy vowel, hit specials, solve, advance through 3 boards to match end; verify broadcasts
  to main/admin/players stay in sync.
- **Browser smoke test** (preview): main screen renders restyled wheel + category + board;
  player keyboard gates consonants/vowel correctly; reveals appear.

## Out of Scope (for now)

- Game modes after the 3 boards.
- Editing a board mid-play / undo.
- Persisting scores between server restarts.
- Accent/punctuation display in the phrase (normalized away).
