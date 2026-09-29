import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import { createServer } from '../src/app.js';
import { loadConfig } from '../src/config.js';

let server;
let url;
const clients = [];

function connect() {
  const socket = ioClient(url, { transports: ['websocket'], reconnection: false, forceNew: true });
  clients.push(socket);
  return new Promise((resolve) => socket.on('connect', () => resolve(socket)));
}

const emit = (socket, event, payload) =>
  new Promise((resolve) => socket.emit(event, payload, (res) => resolve(res)));

const next = (socket, event, predicate = () => true, timeout = 2000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeout);
    const handler = (data) => {
      if (!predicate(data)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(data);
    };
    socket.on(event, handler);
  });

async function startGame() {
  const host = await connect();
  const created = await emit(host, 'create_room', { playerName: 'Host', color: 'black' });
  const guest = await connect();
  const joined = await emit(guest, 'join_room', { roomCode: created.roomCode, playerName: 'Guest' });
  return { host, guest, created, joined };
}

beforeEach(async () => {
  const config = loadConfig({ reconnectGraceMs: 300, sweepIntervalMs: 60_000, serveClient: false });
  server = createServer(config);
  const address = await server.listen(0, '127.0.0.1');
  url = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  for (const c of clients.splice(0)) c.close();
  await server.close();
});

describe('socket protocol', () => {
  it('serves /health', async () => {
    const res = await fetch(`${url}/health`);
    expect(await res.json()).toMatchObject({ status: 'ok' });
  });

  it('creates and joins a room with acks', async () => {
    const { created, joined } = await startGame();
    expect(created.ok).toBe(true);
    expect(created.roomCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(created.color).toBe('black');
    expect(joined.ok).toBe(true);
    expect(joined.color).toBe('white');
    expect(joined.state.status).toBe('playing');
  });

  it('rejects bad codes, full rooms and invalid payloads', async () => {
    const { created } = await startGame();
    const third = await connect();
    expect((await emit(third, 'join_room', { roomCode: 'ZZZZZZ', playerName: 'x' })).error.code).toBe('ROOM_NOT_FOUND');
    expect((await emit(third, 'join_room', { roomCode: created.roomCode })).error.code).toBe('ROOM_FULL');
    expect((await emit(third, 'join_room', 'nope')).error.code).toBe('INVALID_PAYLOAD');
    expect((await emit(third, 'rejoin_room', { roomCode: created.roomCode, playerToken: 'bad' })).error.code).toBe(
      'INVALID_TOKEN',
    );
  });

  it('validates moves server-side and broadcasts deltas', async () => {
    const { host, guest } = await startGame();
    const err = next(guest, 'error_message');
    guest.emit('make_move', { row: 2, col: 4 }); // white moving out of turn
    expect((await err).code).toBe('NOT_YOUR_TURN');

    const illegal = await emit(host, 'make_move', { row: 0, col: 0 });
    expect(illegal.error.code).toBe('ILLEGAL_MOVE');

    const delta = next(guest, 'move_made');
    expect((await emit(host, 'make_move', { row: 2, col: 3 })).ok).toBe(true);
    const { move, state } = await delta;
    expect(move.flipped).toEqual([{ row: 3, col: 3 }]);
    expect(state.turn).toBe('white');
    expect(state.scores).toEqual({ black: 4, white: 1 });
  });

  it('pauses on disconnect and restores the full snapshot on rejoin', async () => {
    const { host, guest, joined } = await startGame();
    await emit(host, 'make_move', { row: 2, col: 3 });

    const dropped = next(host, 'opponent_status', (s) => s.status === 'disconnected');
    guest.close();
    expect((await dropped).name).toBe('Guest');

    const paused = await emit(host, 'make_move', { row: 5, col: 5 });
    expect(paused.error.code).toMatch(/GAME_PAUSED|NOT_YOUR_TURN/);

    const back = await connect();
    const reconnected = next(host, 'opponent_status', (s) => s.status === 'reconnected');
    const res = await emit(back, 'rejoin_room', { roomCode: joined.roomCode, playerToken: joined.playerToken });
    expect(res.ok).toBe(true);
    expect(res.state.paused).toBe(false);
    expect(res.state.board[2][3]).toBe('black');
    expect(res.state.moveHistory).toHaveLength(1);
    await reconnected;

    expect((await emit(back, 'make_move', { row: 2, col: 2 })).ok).toBe(true);
  });

  it('lets the remaining player claim the win once grace expires', async () => {
    const { host, guest } = await startGame();
    const timeout = next(host, 'opponent_status', (s) => s.status === 'timeout');
    guest.close();
    await timeout;
    const over = next(host, 'game_over');
    expect((await emit(host, 'claim_win')).ok).toBe(true);
    expect(await over).toMatchObject({ winner: 'black', reason: 'opponent_timeout' });
  });

  it('newest tab wins and the old one is told it was replaced', async () => {
    const { host, created } = await startGame();
    const replaced = next(host, 'session_replaced');
    const tab2 = await connect();
    const res = await emit(tab2, 'rejoin_room', { roomCode: created.roomCode, playerToken: created.playerToken });
    expect(res.ok).toBe(true);
    await replaced;
    const stale = await emit(host, 'make_move', { row: 2, col: 3 });
    expect(stale.ok).toBe(false);
    expect((await emit(tab2, 'make_move', { row: 2, col: 3 })).ok).toBe(true);
  });

  it('awards the win when a player leaves and supports rematch', async () => {
    const { host, guest } = await startGame();
    const left = next(guest, 'opponent_status', (s) => s.status === 'left');
    const over = next(guest, 'game_over');
    await emit(host, 'leave_room');
    await left;
    expect(await over).toMatchObject({ winner: 'white', reason: 'opponent_left' });
    expect((await emit(guest, 'request_rematch')).error.code).toBe('REMATCH_UNAVAILABLE');
  });

  it('plays a full game to the end, then rematches with swapped colours', async () => {
    const { host, guest, joined } = await startGame();
    const byColor = { black: host, white: guest };
    const gameOver = next(host, 'game_over', () => true, 10_000);
    expect((await emit(host, 'request_rematch')).error.code).toBe('REMATCH_UNAVAILABLE');

    let latest = joined.state;
    host.on('move_made', ({ state: s }) => (latest = s));

    let passes = 0;
    for (let i = 0; i < 70 && latest.status === 'playing'; i++) {
      const [move] = latest.validMoves;
      const turnBefore = latest.turn;
      const res = await emit(byColor[latest.turn], 'make_move', move);
      expect(res.ok).toBe(true);
      await new Promise((r) => setTimeout(r, 5));
      if (latest.status === 'playing' && latest.turn === turnBefore) passes++;
    }
    const over = await gameOver;
    expect(latest.status).toBe('finished');
    const { black, white } = latest.scores;
    expect(over.winner).toBe(black > white ? 'black' : white > black ? 'white' : 'draw');
    expect(latest.moveHistory.filter((h) => h.type === 'pass')).toHaveLength(passes);

    const offered = next(guest, 'rematch_offered');
    expect((await emit(host, 'request_rematch')).started).toBe(false);
    await offered;
    const restarted = next(host, 'game_state', (s) => s.status === 'playing');
    expect((await emit(guest, 'request_rematch')).started).toBe(true);
    const fresh = await restarted;
    expect(fresh.you.color).toBe('white');
    expect(fresh.round).toBe(2);
    expect(fresh.scores).toEqual({ black: 2, white: 2 });
  });

  it('closes the lobby if the host never returns', async () => {
    const host = await connect();
    const created = await emit(host, 'create_room', { playerName: 'Host' });
    host.close();
    await new Promise((r) => setTimeout(r, 450));
    const again = await connect();
    const res = await emit(again, 'rejoin_room', { roomCode: created.roomCode, playerToken: created.playerToken });
    expect(res.error.code).toBe('ROOM_EXPIRED');
  });
});
