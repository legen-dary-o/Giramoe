# Giramoe — Interactive Live Game Website

## Overview

Giramoe is a live party game played in person with friends. One screen (PC/TV) acts as the main display, while players and the game master interact via their phones. The core mechanic is a colorful spinning wheel with 16 segments.

## Architecture

- **Stack:** Node.js + Express + Socket.IO
- **No database** — game state lives in server memory
- **Single project** — one `npm start` runs everything
- **Local/LAN use** — all players are in the same room

## Views

### Main Screen — `/` (PC/TV, display only)

No direct interaction. Shows:

1. **Video intro:** `trailer.mp4` autoplays on white background, no controls, not seekable/rewindable
2. **Start button:** After video ends, a "Inizia" liquid glass button appears. This is decorative — the actual start is triggered by the admin on their phone. When admin presses start, the main screen transitions.
3. **QR Code lobby:** Shows a QR code for players to scan. Displays 3 player name slots, filling in as players connect (e.g., "Player1 ✓", "—", "—")
4. **Game screen:** The main wheel (large, 16 colored segments with text) centered. Above or below: 3 player names side by side. The current player's name glows/highlights; others are dimmed. When the wheel stops, the segment text appears center-screen with a scale-up + fade-in animation, stays a few seconds, then fades out and the turn advances.

### Admin — `/admin` (game master's phone)

The game master's control panel:

- **Pre-game:** "Inizia" button to trigger the transition from video to QR lobby on the main screen
- **Lobby:** Player list with connection status. "Avvia partita" button when 3 players are connected
- **During game:** Current turn indicator, player list with status, placeholder area for scores and future scene controls

### Player — `/play?room=XXXX` (player's phone)

Accessed by scanning the QR code:

- **Lobby:** Enter nickname, wait for game to start
- **During game:** Minimal wheel (16 colored segments, no text) centered. Player's nickname displayed at the bottom. When it's their turn: wheel activates with glow effect + "Tocca a te! Gira la ruota" message. When not their turn: wheel is dimmed/greyed out + "Attendi il tuo turno" message.
- **Disconnection:** If any player disconnects, all other players see an overlay: "In attesa di riconnessione..." — game pauses until all 3 are connected again (3 players are required)

## The Wheel

### Main Wheel (PC screen)

- 16 segments in a rainbow gradient (green → yellow → orange → red → pink → purple → blue → back to green), crystal/glass style matching the logo aesthetic
- Text label on each segment (content TBD — to be provided by the game master)
- Arrow/indicator at the top center (like in the logo)
- Smooth spin animation with natural deceleration (easing out)

### Minimal Wheel (player phone)

- 16 segments with the same color scheme but no text
- Sized for mobile, touch-friendly
- Player taps/swipes to spin when it's their turn
- Locked when it's not their turn

### Spin Synchronization

1. Player triggers spin on their phone
2. Server generates the winning segment randomly
3. Server sends the result to both the main screen and the spinning player's phone
4. Both wheels animate and land on the same segment
5. Main screen shows the segment text enlarged at center
6. After a few seconds, result fades, turn advances to the next player

## Turn Flow

```
Player 1 spins → result shown → auto-advance →
Player 2 spins → result shown → auto-advance →
Player 3 spins → result shown → auto-advance →
Player 1 spins → ...
```

Turns advance automatically after the result display timeout (a few seconds). No manual confirmation needed.

## Connection Flow

1. Admin opens `/admin` on phone
2. Admin presses "Inizia" → main screen transitions from video/button to QR code lobby
3. QR code encodes URL: `/play?room=XXXX` (room code auto-generated)
4. Players scan QR → enter nickname → join lobby
5. Main screen updates as players join (shows names filling in)
6. Admin sees player list on phone, presses "Avvia partita" when 3 players are in
7. Game begins — Player 1's turn

## Disconnection Handling

- 3 players are required at all times
- If a player disconnects, the game pauses
- All screens show a "waiting for reconnection" state
- Admin sees which player is disconnected
- When the player reconnects, the game resumes from where it left off

## Visual Style

- **Background:** White everywhere
- **UI Style:** Liquid glass — buttons, cards, and UI elements with crystal/glass transparency, reflections, glowing edges (matching the Giramoe logo aesthetic)
- **Font:** Modern, clean, sans-serif
- **Animations:** Smooth and fluid (easing, fades, scale transitions)
- **Color palette:** Rainbow spectrum from the wheel + white + crystal blue accents

## Project Structure

```
Documents/Giramoe/
├── server.js              # Express + Socket.IO server
├── package.json
├── public/
│   ├── index.html         # Main screen (PC/TV)
│   ├── admin.html         # Admin panel (phone)
│   ├── play.html          # Player view (phone)
│   ├── css/
│   │   └── style.css      # Shared styles + liquid glass
│   ├── js/
│   │   ├── main.js        # Main screen logic
│   │   ├── admin.js       # Admin logic
│   │   ├── player.js      # Player logic
│   │   └── wheel.js       # Shared wheel rendering (Canvas/SVG)
│   └── assets/
│       ├── trailer.mp4    # Intro video
│       └── logo.png       # Logo
└── docs/
```

## What's NOT in Scope (for now)

- Scoring system (placeholder only)
- Multiple game scenes/rounds
- Segment text content (TBD)
- Remote play (LAN only for now)
