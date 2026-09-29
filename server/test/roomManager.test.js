import { describe, expect, it } from 'vitest';
import { RoomManager } from '../src/rooms/RoomManager.js';
import { ROOM_CODE_PATTERN, generateRoomCode } from '../src/utils/roomCode.js';

const config = {
  reconnectGraceMs: 60_000,
  waitingRoomTtlMs: 1_000,
  finishedRoomTtlMs: 1_000,
  abandonedRoomTtlMs: 1_000,
};

function setup() {
  let now = 1_000_000;
  const clock = { advance: (ms) => (now += ms) };
  const manager = new RoomManager({ config, now: () => now });
  return { manager, clock };
}

describe('room codes', () => {
  it('are 6 chars with no ambiguous characters', () => {
    for (let i = 0; i < 500; i++) {
      const code = generateRoomCode();
      expect(code).toMatch(ROOM_CODE_PATTERN);
      expect(code).not.toMatch(/[01OI]/);
    }
  });
});

describe('RoomManager', () => {
  it('creates, joins and assigns opposite colours', () => {
    const { manager } = setup();
    const { room, player: host } = manager.createRoom({ name: 'Ada', colorPreference: 'white', socketId: 's1' });
    expect(room.status).toBe('waiting');
    expect(host.color).toBe('white');

    const { player: guest } = manager.joinRoom(room.code, { name: 'Bo', socketId: 's2' });
    expect(guest.color).toBe('black');
    expect(room.status).toBe('playing');
    expect(room.game.turn).toBe('black');
  });

  it('rejects a third player', () => {
    const { manager } = setup();
    const { room } = manager.createRoom({ name: 'A', socketId: 's1' });
    manager.joinRoom(room.code, { name: 'B', socketId: 's2' });
    expect(() => manager.joinRoom(room.code, { name: 'C', socketId: 's3' })).toThrow(
      expect.objectContaining({ code: 'ROOM_FULL' }),
    );
  });

  it('distinguishes unknown from expired rooms', () => {
    const { manager } = setup();
    expect(() => manager.requireRoom('ABCDEF')).toThrow(expect.objectContaining({ code: 'ROOM_NOT_FOUND' }));
    const { room } = manager.createRoom({ name: 'A', socketId: 's1' });
    manager.deleteRoom(room.code);
    expect(() => manager.requireRoom(room.code)).toThrow(expect.objectContaining({ code: 'ROOM_EXPIRED' }));
  });

  it('pauses when a player disconnects and blocks moves', () => {
    const { manager } = setup();
    const { room, player: host } = manager.createRoom({ name: 'A', colorPreference: 'black', socketId: 's1' });
    const { player: guest } = manager.joinRoom(room.code, { name: 'B', socketId: 's2' });
    manager.markDisconnected(room, guest.token);
    expect(manager.isPaused(room)).toBe(true);
    expect(() => manager.makeMove(room, host.token, 2, 3)).toThrow(expect.objectContaining({ code: 'GAME_PAUSED' }));

    manager.bindSocket(room, guest.token, 's3');
    expect(manager.isPaused(room)).toBe(false);
    expect(manager.makeMove(room, host.token, 2, 3).flipped).toHaveLength(1);
  });

  it('lets the remaining player claim the win after grace expires', () => {
    const { manager } = setup();
    const { room, player: host } = manager.createRoom({ name: 'A', colorPreference: 'black', socketId: 's1' });
    const { player: guest } = manager.joinRoom(room.code, { name: 'B', socketId: 's2' });
    manager.markDisconnected(room, guest.token);
    expect(() => manager.claimWin(room, host.token)).toThrow();
    expect(manager.expireGrace(room, guest.token).action).toBe('claimable');
    manager.claimWin(room, host.token);
    expect(room.status).toBe('finished');
    expect(room.game.winner).toBe('black');
    expect(room.endReason).toBe('opponent_timeout');
  });

  it('deletes a lobby whose host never came back', () => {
    const { manager } = setup();
    const { room, player } = manager.createRoom({ name: 'A', socketId: 's1' });
    manager.markDisconnected(room, player.token);
    expect(manager.expireGrace(room, player.token).action).toBe('deleted');
    expect(manager.getRoom(room.code)).toBeNull();
  });

  it('swaps colours on rematch once both accept', () => {
    const { manager } = setup();
    const { room, player: host } = manager.createRoom({ name: 'A', colorPreference: 'black', socketId: 's1' });
    const { player: guest } = manager.joinRoom(room.code, { name: 'B', socketId: 's2' });
    room.status = 'finished';
    expect(manager.requestRematch(room, host.token).started).toBe(false);
    expect(manager.requestRematch(room, guest.token).started).toBe(true);
    expect(host.color).toBe('white');
    expect(guest.color).toBe('black');
    expect(room.round).toBe(2);
    expect(room.status).toBe('playing');
  });

  it('awards the win when a player leaves mid-game', () => {
    const { manager } = setup();
    const { room, player: host } = manager.createRoom({ name: 'A', colorPreference: 'black', socketId: 's1' });
    manager.joinRoom(room.code, { name: 'B', socketId: 's2' });
    const result = manager.leaveRoom(room, host.token);
    expect(result.forfeited).toBe(true);
    expect(room.game.winner).toBe('white');
    expect(room.endReason).toBe('opponent_left');
  });

  it('sweeps abandoned and stale rooms', () => {
    const { manager, clock } = setup();
    const { room: waiting } = manager.createRoom({ name: 'A', socketId: 's1' });
    const { room: gone, player } = manager.createRoom({ name: 'B', socketId: 's2' });
    const { player: guest } = manager.joinRoom(gone.code, { name: 'C', socketId: 's3' });
    manager.markDisconnected(gone, player.token);
    manager.markDisconnected(gone, guest.token);
    clock.advance(30_000);
    const first = manager.sweep();
    expect(first.map((r) => r.room.code)).not.toContain(gone.code); // still inside the reconnect grace
    clock.advance(31_000);
    const removed = [...first, ...manager.sweep()].map((r) => [r.room.code, r.reason]);
    expect(removed).toEqual(
      expect.arrayContaining([
        [waiting.code, 'expired'],
        [gone.code, 'abandoned'],
      ]),
    );
    expect(manager.store.size).toBe(0);
  });

  it('counts the abandon TTL from the last disconnect, not the last activity', () => {
    const { manager, clock } = setup();
    const { room, player } = manager.createRoom({ name: 'A', socketId: 's1' });
    clock.advance(10 * 60_000); // idle but connected in the lobby
    manager.markDisconnected(room, player.token); // e.g. a refresh
    clock.advance(1_000);
    manager.config.waitingRoomTtlMs = Infinity;
    expect(manager.sweep()).toEqual([]);
  });

  it('builds a per-player snapshot', () => {
    const { manager } = setup();
    const { room, player: host } = manager.createRoom({ name: 'A', colorPreference: 'black', socketId: 's1' });
    manager.joinRoom(room.code, { name: 'B', socketId: 's2' });
    const snap = manager.buildSnapshot(room, host.token);
    expect(snap.you).toEqual({ name: 'A', color: 'black', isHost: true });
    expect(snap.players.find((p) => p.isYou).name).toBe('A');
    expect(snap.validMoves).toHaveLength(4);
    expect(snap.scores).toEqual({ black: 2, white: 2 });
    expect(JSON.stringify(snap)).not.toContain(host.token);
  });
});
