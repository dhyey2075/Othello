import { randomUUID } from 'node:crypto';
import { MemoryRoomStore } from './MemoryRoomStore.js';
import { generateRoomCode } from '../utils/roomCode.js';
import { ErrorCodes, GameError } from '../utils/errors.js';
import {
  BLACK,
  WHITE,
  countDiscs,
  createGame,
  forfeitGame,
  getValidMoves,
  opponentOf,
  playMove,
} from '../game/othello.js';

const EXPIRED_MEMORY_MS = 6 * 60 * 60_000;

/**
 * Owns all room state. Rooms are plain, JSON-serialisable objects; timers and
 * sockets live in the socket layer. Every mutation ends with `save(room)` so a
 * remote store sees the change.
 *
 * Room shape:
 * {
 *   code, status: 'waiting' | 'playing' | 'finished',
 *   createdAt, updatedAt, round,
 *   players: [{ token, name, color, isHost, socketId, connected, left, disconnectedAt }],
 *   game: OthelloGame | null,
 *   endReason: 'normal' | 'opponent_left' | 'opponent_timeout' | null,
 *   rematchRequests: [token],
 *   claimableBy: token | null,    // set when the opponent's reconnect grace ran out
 *   lastConnectedAt: number,
 * }
 */
export class RoomManager {
  constructor({ store = new MemoryRoomStore(), config, now = () => Date.now() } = {}) {
    this.store = store;
    this.config = config;
    this.now = now;
    // Codes of rooms that were cleaned up, so joiners get "expired" instead of "invalid".
    this.expiredCodes = new Map();
  }

  /* ----------------------------- lookup ----------------------------- */

  getRoom(code) {
    return this.store.get(code);
  }

  requireRoom(code) {
    const room = this.store.get(code);
    if (room) return room;
    if (this.expiredCodes.has(code)) {
      throw new GameError(ErrorCodes.ROOM_EXPIRED, 'That game has expired or was closed.');
    }
    throw new GameError(ErrorCodes.ROOM_NOT_FOUND, 'No game found with that code.');
  }

  findPlayer(room, token) {
    return room.players.find((p) => p.token === token) ?? null;
  }

  requirePlayer(room, token) {
    const player = this.findPlayer(room, token);
    if (!player || player.left) {
      throw new GameError(ErrorCodes.INVALID_TOKEN, 'You are not a player in this game.');
    }
    return player;
  }

  getOpponent(room, token) {
    return room.players.find((p) => p.token !== token) ?? null;
  }

  save(room) {
    room.updatedAt = this.now();
    if (room.players.some((p) => p.connected)) room.lastConnectedAt = room.updatedAt;
    this.store.set(room.code, room);
    return room;
  }

  /* ---------------------------- lifecycle --------------------------- */

  createRoom({ name, colorPreference = 'random', socketId }) {
    let code;
    do {
      code = generateRoomCode();
    } while (this.store.has(code) || this.expiredCodes.has(code));

    const color =
      colorPreference === 'random' ? (Math.random() < 0.5 ? BLACK : WHITE) : colorPreference;
    const now = this.now();
    const host = this.#newPlayer({ name, color, isHost: true, socketId });
    const room = {
      code,
      status: 'waiting',
      createdAt: now,
      updatedAt: now,
      lastConnectedAt: now,
      round: 1,
      players: [host],
      game: null,
      endReason: null,
      rematchRequests: [],
      claimableBy: null,
    };
    this.save(room);
    return { room, player: host };
  }

  joinRoom(code, { name, socketId }) {
    const room = this.requireRoom(code);
    if (room.players.length >= 2 || room.status !== 'waiting') {
      throw new GameError(ErrorCodes.ROOM_FULL, 'That game already has two players.');
    }
    const host = room.players[0];
    const player = this.#newPlayer({ name, color: opponentOf(host.color), isHost: false, socketId });
    room.players.push(player);
    room.status = 'playing';
    room.game = createGame();
    this.save(room);
    return { room, player };
  }

  /** Binds a (new) socket to an existing player slot. */
  bindSocket(room, token, socketId) {
    const player = this.requirePlayer(room, token);
    const previousSocketId = player.socketId;
    const wasDisconnected = !player.connected;
    player.socketId = socketId;
    player.connected = true;
    player.disconnectedAt = null;
    if (room.claimableBy && wasDisconnected) room.claimableBy = null;
    this.save(room);
    return { player, previousSocketId, wasDisconnected };
  }

  markDisconnected(room, token) {
    const player = this.findPlayer(room, token);
    if (!player) return null;
    player.connected = false;
    player.socketId = null;
    player.disconnectedAt = this.now();
    // This player was connected until now; the abandon TTL must count from here.
    room.lastConnectedAt = player.disconnectedAt;
    this.save(room);
    return player;
  }

  /** Called when a player's reconnect grace period expires. */
  expireGrace(room, token) {
    const player = this.findPlayer(room, token);
    if (!player || player.connected) return { action: 'none' };

    if (room.status === 'waiting') {
      this.deleteRoom(room.code);
      return { action: 'deleted' };
    }
    if (room.status === 'playing') {
      const opponent = this.getOpponent(room, token);
      if (opponent && opponent.connected && !opponent.left) {
        room.claimableBy = opponent.token;
        this.save(room);
        return { action: 'claimable', opponent };
      }
    }
    return { action: 'none' };
  }

  /* ----------------------------- gameplay --------------------------- */

  isPaused(room) {
    return room.status === 'playing' && room.players.some((p) => !p.connected);
  }

  makeMove(room, token, row, col) {
    const player = this.requirePlayer(room, token);
    if (room.status !== 'playing' || !room.game) {
      throw new GameError(ErrorCodes.GAME_NOT_ACTIVE, 'The game is not in progress.');
    }
    if (this.isPaused(room)) {
      throw new GameError(ErrorCodes.GAME_PAUSED, 'The game is paused while your opponent reconnects.');
    }
    const result = playMove(room.game, player.color, row, col);
    if (!result.ok) throw new GameError(result.code, result.message);

    room.game = result.game;
    if (result.delta.gameOver) {
      room.status = 'finished';
      room.endReason = 'normal';
    }
    this.save(room);
    return result.delta;
  }

  claimWin(room, token) {
    const player = this.requirePlayer(room, token);
    if (room.status !== 'playing' || room.claimableBy !== token) {
      throw new GameError(ErrorCodes.CLAIM_UNAVAILABLE, 'You can only claim the win after the reconnect window ends.');
    }
    this.#finishEarly(room, player.color, 'opponent_timeout');
    return room;
  }

  /**
   * Removes a player intentionally. Returns what happened so the socket layer
   * can notify the opponent.
   */
  leaveRoom(room, token) {
    const player = this.requirePlayer(room, token);
    const opponent = this.getOpponent(room, token);
    player.left = true;
    player.connected = false;
    player.socketId = null;
    room.rematchRequests = [];

    let forfeited = false;
    if (room.status === 'waiting' || !opponent || opponent.left) {
      this.deleteRoom(room.code);
      return { deleted: true, forfeited, opponent: null };
    }
    if (room.status === 'playing') {
      this.#finishEarly(room, opponent.color, 'opponent_left');
      forfeited = true;
    } else {
      this.save(room);
    }
    return { deleted: false, forfeited, opponent };
  }

  requestRematch(room, token) {
    this.requirePlayer(room, token);
    const opponent = this.getOpponent(room, token);
    if (room.status !== 'finished' || !opponent || opponent.left) {
      throw new GameError(ErrorCodes.REMATCH_UNAVAILABLE, 'A rematch is not available.');
    }
    if (!room.rematchRequests.includes(token)) room.rematchRequests.push(token);

    const started = room.rematchRequests.length === 2;
    if (started) {
      for (const p of room.players) p.color = opponentOf(p.color);
      room.status = 'playing';
      room.game = createGame();
      room.endReason = null;
      room.rematchRequests = [];
      room.claimableBy = null;
      room.round += 1;
    }
    this.save(room);
    return { started, opponent };
  }

  /* ----------------------------- cleanup ---------------------------- */

  deleteRoom(code) {
    const existed = this.store.delete(code);
    if (existed) this.expiredCodes.set(code, this.now());
    return existed;
  }

  /** Deletes stale rooms and returns them (the socket layer notifies occupants). */
  sweep() {
    const now = this.now();
    const { waitingRoomTtlMs, finishedRoomTtlMs, reconnectGraceMs } = this.config;
    // Never sweep an empty room before its players' reconnect window has closed.
    const abandonedRoomTtlMs = Math.max(this.config.abandonedRoomTtlMs, reconnectGraceMs);
    const removed = [];

    for (const room of this.store.values()) {
      const anyoneConnected = room.players.some((p) => p.connected);
      let reason = null;
      if (!anyoneConnected && now - room.lastConnectedAt > abandonedRoomTtlMs) reason = 'abandoned';
      else if (room.status === 'finished' && now - room.updatedAt > finishedRoomTtlMs) reason = 'finished';
      else if (room.status === 'waiting' && now - room.createdAt > waitingRoomTtlMs) reason = 'expired';
      if (reason) {
        this.deleteRoom(room.code);
        removed.push({ room, reason });
      }
    }

    for (const [code, at] of this.expiredCodes) {
      if (now - at > EXPIRED_MEMORY_MS) this.expiredCodes.delete(code);
    }
    return removed;
  }

  /* ----------------------------- snapshot --------------------------- */

  /** Full, per-player view of a room (what the client needs to render everything). */
  buildSnapshot(room, token) {
    const you = this.findPlayer(room, token);
    const game = room.game;
    const grace = this.config.reconnectGraceMs;
    const scores = game ? countScores(game.board) : { black: 2, white: 2 };

    return {
      roomCode: room.code,
      status: room.status,
      round: room.round,
      paused: this.isPaused(room),
      board: game ? game.board : null,
      turn: game ? game.turn : null,
      scores,
      validMoves: game && room.status === 'playing' ? validMovesFor(game) : [],
      lastMove: game ? game.lastMove : null,
      moveHistory: game ? game.history : [],
      winner: game ? game.winner : null,
      endReason: room.endReason,
      canClaimWin: room.claimableBy === token,
      rematch: {
        youRequested: room.rematchRequests.includes(token),
        opponentRequested: room.rematchRequests.some((t) => t !== token),
      },
      reconnectGraceMs: grace,
      you: you ? { name: you.name, color: you.color, isHost: you.isHost } : null,
      players: room.players.map((p) => ({
        name: p.name,
        color: p.color,
        isHost: p.isHost,
        isYou: p.token === token,
        connected: p.connected,
        left: p.left,
        reconnectDeadline: !p.connected && !p.left && p.disconnectedAt ? p.disconnectedAt + grace : null,
      })),
      serverTime: this.now(),
    };
  }

  #newPlayer({ name, color, isHost, socketId }) {
    return {
      token: randomUUID(),
      name,
      color,
      isHost,
      socketId,
      connected: true,
      left: false,
      disconnectedAt: null,
    };
  }

  #finishEarly(room, winnerColor, reason) {
    room.game = forfeitGame(room.game, winnerColor);
    room.status = 'finished';
    room.endReason = reason;
    room.claimableBy = null;
    room.rematchRequests = [];
    this.save(room);
  }
}

function countScores(board) {
  const { black, white } = countDiscs(board);
  return { black, white };
}

function validMovesFor(game) {
  return getValidMoves(game.board, game.turn);
}
