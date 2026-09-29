# Othello — real-time multiplayer

A two-player online Othello (Reversi) game. One player creates a room and shares a 6-character code; the other joins and they play live. The server is authoritative, sessions survive refreshes and network drops, and the board is a real 3D scene rendered with **React Three Fiber**. All sound is synthesised with the Web Audio API.

- **Client:** React 18, Vite, Tailwind CSS, Framer Motion, React Three Fiber + drei (three.js), socket.io-client
- **Server:** Node.js (ES modules), Express, Socket.IO
- **Tests:** Vitest (game rules, room manager, and end-to-end socket flows)

## Quick start

Requires Node.js 18.18+ (20+ recommended).

```bash
npm run install:all   # installs root, server and client dependencies
npm run dev           # server on :4000, client on :5173 (runs both)
```

Open http://localhost:5173. To play against yourself on one machine, open a second window in a **private/incognito window** or add `?profile=2` to the URL (see [Testing locally](#testing-locally)).

### Production

```bash
npm run build         # builds client/dist
npm start             # server on :4000 serves the API, sockets and the built client
```

In production the server hosts `client/dist`, so the client and sockets share a single origin and need no CORS setup. To host the client somewhere else, build it with `VITE_SERVER_URL` pointing at the server and add the client's origin to `CLIENT_ORIGIN`.

### Tests

```bash
npm test              # or: cd server && npm test
```

## Environment variables

Copy the `.env.example` files to `.env` to override the defaults.

**server/.env**

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | HTTP + Socket.IO port |
| `HOST` | `0.0.0.0` | Bind address |
| `CLIENT_ORIGIN` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated CORS allow-list (`*` = any) |
| `RECONNECT_GRACE_MS` | `60000` | How long a dropped player's seat is held |
| `WAITING_ROOM_TTL_MS` | `1800000` | Lobby that never got an opponent |
| `FINISHED_ROOM_TTL_MS` | `600000` | Finished game kept around for rematch |
| `ABANDONED_ROOM_TTL_MS` | `120000` | Room with nobody connected |
| `SWEEP_INTERVAL_MS` | `30000` | Cleanup interval |
| `SERVE_CLIENT` | `true` | Serve `../client/dist` if it exists |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` or `silent` |

**client/.env**

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_SERVER_URL` | dev: `http://<page host>:4000`, prod: page origin | Socket.IO server URL |

## Project structure

```
Othello/
├── package.json              # install:all / dev / build / start / test
├── client/
│   ├── index.html
│   ├── vite.config.js, tailwind.config.js, postcss.config.js
│   └── src/
│       ├── App.jsx               # providers + animated screen switching
│       ├── context/
│       │   ├── GameContext.jsx   # useGame(): single source of socket/game state
│       │   └── ToastContext.jsx
│       ├── hooks/                # useSound, useCountdown, useMediaQuery (reduced motion, hover)
│       ├── lib/
│       │   ├── socket/socket.js  # the single socket instance + emitWithAck
│       │   ├── sound/SoundManager.js  # Web Audio synthesis, prefs in localStorage
│       │   ├── session.js        # persisted roomCode / playerToken / name
│       │   └── timing.js         # animation timings shared by 3D + sound
│       ├── components/
│       │   ├── board/            # Board3D (Canvas), BoardScene, Disc, geometry, felt texture, a11y grid
│       │   ├── ui/               # Button, Input, Segmented, DiscIcon, icons
│       │   └── PlayerCard, MoveHistory, GameOverModal, PauseBanner, ConnectionBanner, Toaster, ...
│       └── pages/                # HomePage, LobbyPage, GamePage, StatusScreens
└── server/
    ├── src/
    │   ├── index.js              # entry point
    │   ├── app.js                # Express + Socket.IO factory (/health, static client)
    │   ├── config.js
    │   ├── game/othello.js       # pure rules engine (no dependencies)
    │   ├── rooms/
    │   │   ├── RoomManager.js    # room lifecycle, moves, rematch, snapshots, TTL sweep
    │   │   └── MemoryRoomStore.js  # Map-backed store (swap for Redis)
    │   ├── sockets/registerHandlers.js  # event protocol, grace timers, tab takeover
    │   └── utils/                # validation, room codes, errors, logger
    └── test/                     # othello, roomManager, sockets (integration)
```

## Game rules (server-side)

Standard 8×8 Othello. The four centre discs start as D4/E5 white and E4/D5 black, and Black moves first. A move must flank at least one line of opponent discs in any of the 8 directions; every flanked line flips. If the next player has no legal move they pass automatically. The game ends when neither side can move (a full board is one case of this), and the player with more discs wins; equal counts are a draw.

The client only ever sends `{ row, col }`. The server checks turn order, pause state and legality, and rejects anything else with an error.

## Socket event protocol

All client → server events accept an optional **acknowledgement callback** that receives `{ ok: true, ...data }` or `{ ok: false, error: { code, message } }`. Every payload is validated on the server: types, room code format, UUID tokens, integer coordinates from 0 to 7, and sanitised names of up to 20 characters.

### Client → Server

| Event | Payload | Ack data |
| --- | --- | --- |
| `create_room` | `{ playerName?, color?: 'random' \| 'black' \| 'white' }` | `{ roomCode, playerToken, playerName, color, state }` |
| `join_room` | `{ roomCode, playerName?, playerToken? }` (a token already in the room turns this into a rejoin) | same as above |
| `rejoin_room` | `{ roomCode, playerToken }` | same as above |
| `make_move` | `{ row, col }` | `{}` (errors are also emitted as `error_message`) |
| `request_rematch` | — | `{ started }` |
| `claim_win` | — (only after the opponent's grace period expired) | `{}` |
| `leave_room` | `{ roomCode?, playerToken? }` (credentials are only needed if this socket isn't bound) | `{}` |

### Server → Client

| Event | Payload |
| --- | --- |
| `room_created` | `{ roomCode, color }` |
| `room_joined` | `{ roomCode, color, opponentName }` |
| `game_state` | Full per-player snapshot (see below) |
| `move_made` | `{ move: { row, col, color, flipped: [{row,col}], passed, gameOver, winner }, state }` |
| `opponent_status` | `{ status: 'joined' \| 'disconnected' \| 'reconnected' \| 'timeout' \| 'left', name, reconnectDeadline?, graceMs? }` |
| `game_over` | `{ winner: 'black' \| 'white' \| 'draw', scores, reason: 'normal' \| 'opponent_left' \| 'opponent_timeout' }` |
| `rematch_offered` | `{ name }` |
| `session_replaced` | `{ roomCode }`: another tab took over this seat |
| `room_closed` | `{ roomCode, reason }`: the room was cleaned up |
| `error_message` | `{ code, message, event }` |

**Snapshot (`game_state.state`)**

```js
{
  roomCode, status: 'waiting' | 'playing' | 'finished', round, paused,
  board: (null | 'black' | 'white')[8][8], turn, scores: { black, white },
  validMoves: [{ row, col }], lastMove, moveHistory: [{ type: 'move' | 'pass', color, row?, col?, flipped? }],
  winner, endReason, canClaimWin, rematch: { youRequested, opponentRequested },
  you: { name, color, isHost },
  players: [{ name, color, isHost, isYou, connected, left, reconnectDeadline }],
  reconnectGraceMs, serverTime
}
```

Player tokens never appear in snapshots; each player only learns their own token, from the ack.

**Error codes:** `INVALID_PAYLOAD`, `ROOM_NOT_FOUND`, `ROOM_EXPIRED`, `ROOM_FULL`, `INVALID_TOKEN`, `NOT_IN_ROOM`, `NOT_YOUR_TURN`, `ILLEGAL_MOVE`, `GAME_PAUSED`, `GAME_NOT_ACTIVE`, `REMATCH_UNAVAILABLE`, `CLAIM_UNAVAILABLE`, `INTERNAL`.

## How reconnection works

1. **Identity.** Creating or joining a room returns a random `playerToken` (UUID). The client stores `{ roomCode, playerToken, playerName }` in `localStorage`. The socket id is only a transport detail; the token *is* the seat.
2. **Automatic rejoin.** On every socket `connect` (first page load, refresh, or a Socket.IO auto-reconnect), the client emits `rejoin_room` if it has a stored session. The server rebinds the seat to the new socket id and replies with the full snapshot, so the board, turn, scores, history and players come back exactly as they were.
3. **Dropped connections.** When a socket disconnects, its player is marked `disconnected`, the opponent receives `opponent_status: disconnected` with a deadline, and the game is **paused** (moves are rejected with `GAME_PAUSED`). Server ping settings detect dead connections, such as a closed laptop or lost Wi-Fi, within about 20 seconds.
4. **Grace period.** A per-player timer (`RECONNECT_GRACE_MS`, default 60 s) starts. If the player rejoins in time, the timer is cleared, the opponent receives `reconnected`, and play resumes. If the timer expires:
   - **In the lobby** (no opponent yet), the room is closed.
   - **Mid-game**, the remaining player receives `timeout` and can **claim the win** or **keep waiting**. The absent player can still come back until the room is swept.
5. **Duplicate tabs.** The newest connection with a valid token wins. The previous socket receives `session_replaced` and is unbound. That tab then disconnects itself so it doesn't auto-reconnect and steal the seat back, and it offers "Play here instead".
6. **Leaving.** "Leave game" emits `leave_room` and clears local storage. Mid-game this forfeits (the opponent receives `left` and `game_over`); in the lobby it closes the room.
7. **Server restart / expired rooms.** A rejoin for a room that no longer exists fails with `ROOM_NOT_FOUND` or `ROOM_EXPIRED`. The client clears the session, shows "Room no longer exists" and returns home. The server remembers recently deleted codes so it can say *expired* instead of *invalid*.
8. **Transport.** Socket.IO reconnection is enabled with backoff (0.5 s growing to 5 s, with jitter). A "Reconnecting…" banner is shown meanwhile.

Room state lives in `RoomManager` behind a `get/set/delete/has/values` store interface (`MemoryRoomStore`). Rooms are plain JSON-serialisable objects; timers and sockets stay in the socket layer, so a Redis store can replace the Map without touching game logic. (Running several server instances would additionally need the Socket.IO Redis adapter.)

## 3D board

The board is a React Three Fiber scene:

- A rounded frame (`RoundedBox`), an inner lip, and a felt surface. The felt uses a procedurally painted canvas texture (gradient, fibre noise, grid, star points) on a `MeshPhysicalMaterial` with sheen.
- Discs are two beveled **lathe-geometry** halves (white top, black bottom) with clearcoat materials. They reflect a local environment built from `Lightformer` panels, so no HDR files are downloaded. They cast real shadows, and `ContactShadows` sit under the board.
- Placing a disc drops it in with a small bounce. Flipped discs rotate 180° with a lift, tipping away from the placed disc. The flip delay grows with distance from the placed disc, which produces a ripple. All of this is driven by the `flipped` list in `move_made`.
- Legal-move hint dots (toggleable), a hover ghost disc, and a last-move highlight.
- A gentle idle sway plus a pointer-following tilt. Both are disabled on touch devices and under `prefers-reduced-motion`, which also skips the drop and flip animations.
- **Accessibility:** a visually hidden grid of 64 buttons mirrors the board (ARIA labels such as "E6, empty, legal move"). Arrow keys move between cells, Enter or Space plays, and a focus square is drawn on the 3D board.

## Sound

`client/src/lib/sound/SoundManager.js` synthesises every sound: the placement thud, per-disc flip ticks timed to the animation, the your-turn ping, the invalid-move buzz, the opponent-joined chime, the win fanfare, lose and draw tones, and disconnect/reconnect cues. The `AudioContext` is resumed on the first user gesture to satisfy autoplay rules. Mute and volume live in the header's speaker menu and persist in `localStorage`.

## Testing locally

Two tabs in the same browser share `localStorage`, so the second tab would resume the first tab's seat, which is the duplicate-tab protection working as intended. To play both sides on one machine, use a private window for player two, or open `http://localhost:5173/?profile=2`. Any `?profile=` value namespaces the stored session.

To test from a phone on your LAN, open `http://<your-ip>:5173` and set `CLIENT_ORIGIN=*` (or add that origin) in `server/.env`.

### Manual test checklist

1. **Create room:** enter a name, pick a color, and click *Create game*. The lobby shows the code, *Copy code* / *Copy link*, and "Waiting for opponent…".
2. **Join:** in a private window (or `?profile=2`), enter the code and a name. Both sides get toasts and color assignments, and the host hears the chime.
3. **Errors:** join with `ZZZZZZ` to see "No game found". Join a full room with a third window to see "already has two players".
4. **Play a full game:** watch the hint dots, hover ghost, drop and flip ripple, scores, and move history. Clicking out of turn or on an illegal cell gives a buzz. A player with no moves gets a pass toast.
5. **Refresh mid-game:** reload either tab. It restores the exact board and turn, and the opponent sees "disconnected" then "is back".
6. **Kill the network:** in DevTools set *Network → Offline* (or disable Wi-Fi). The "Reconnecting…" banner appears, and the opponent sees the paused countdown. Go back online within 60 s and the game resumes. Stay offline past 60 s and the opponent can *Claim win* or *Keep waiting*.
7. **Duplicate tab:** open the same URL in a second tab of the same profile. The old tab shows "Game opened in another tab".
8. **Lobby resume:** refresh the host while in the lobby. The same code comes back.
9. **Rematch:** at game over, both players click *Rematch*. Colors swap and round 2 starts. *Back to home* leaves and notifies the opponent.
10. **Server restart:** stop and restart `npm run dev` mid-game. Clients show "Room no longer exists" and return home.
