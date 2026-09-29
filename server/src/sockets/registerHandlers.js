import { ErrorCodes, GameError, toErrorPayload } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import {
  normalizeRoomCode,
  optionalToken,
  requireObject,
  sanitizeName,
  validateColorPreference,
  validateCoordinates,
  validateToken,
} from '../utils/validate.js';

/**
 * Wires every Socket.IO event to the RoomManager.
 *
 * Binding model: `socket.data = { roomCode, token }` links a socket to a player
 * slot. A slot is "owned" by whichever socket id is stored on the player; any
 * other socket carrying the same token is stale and gets ignored.
 *
 * Returns a `dispose()` function that stops timers (used by tests / shutdown).
 */
export function registerSocketHandlers(io, manager, config) {
  const graceTimers = new Map(); // playerToken -> Timeout

  /* ------------------------------ helpers ----------------------------- */

  const emitTo = (player, event, payload) => {
    if (player?.connected && player.socketId) io.to(player.socketId).emit(event, payload);
  };

  const sendState = (room) => {
    for (const p of room.players) emitTo(p, 'game_state', manager.buildSnapshot(room, p.token));
  };

  const gameOverPayload = (room) => ({
    winner: room.game?.winner ?? null,
    scores: manager.buildSnapshot(room, null).scores,
    reason: room.endReason,
  });

  const clearGrace = (token) => {
    const timer = graceTimers.get(token);
    if (timer) clearTimeout(timer);
    graceTimers.delete(token);
  };

  const bind = (socket, room, player) => {
    socket.join(room.code);
    socket.data.roomCode = room.code;
    socket.data.token = player.token;
  };

  const unbind = (socket) => {
    if (socket.data.roomCode) socket.leave(socket.data.roomCode);
    socket.data.roomCode = null;
    socket.data.token = null;
  };

  /** Resolves the room + player this socket currently owns. */
  const currentBinding = (socket) => {
    const { roomCode, token } = socket.data;
    if (!roomCode || !token) throw new GameError(ErrorCodes.NOT_IN_ROOM, 'You are not in a game.');
    const room = manager.requireRoom(roomCode);
    const player = manager.requirePlayer(room, token);
    if (player.socketId !== socket.id) {
      throw new GameError(ErrorCodes.NOT_IN_ROOM, 'This session is active in another tab.');
    }
    return { room, player };
  };

  /** Treats an existing binding on this socket as a dropped connection. */
  const releaseBinding = (socket) => {
    const { roomCode, token } = socket.data;
    if (!roomCode) return;
    unbind(socket);
    const room = manager.getRoom(roomCode);
    const player = room && manager.findPlayer(room, token);
    if (player && player.socketId === socket.id && !player.left) handleDrop(room, player);
  };

  const startGrace = (roomCode, token) => {
    clearGrace(token);
    const timer = setTimeout(() => {
      graceTimers.delete(token);
      const room = manager.getRoom(roomCode);
      if (!room) return;
      const player = manager.findPlayer(room, token);
      const result = manager.expireGrace(room, token);
      if (result.action === 'claimable') {
        emitTo(result.opponent, 'opponent_status', { status: 'timeout', name: player?.name });
        sendState(room);
      } else if (result.action === 'deleted') {
        logger.info(`Room ${roomCode} closed: host did not return to the lobby`);
      }
    }, config.reconnectGraceMs);
    timer.unref?.();
    graceTimers.set(token, timer);
  };

  function handleDrop(room, player) {
    manager.markDisconnected(room, player.token);
    const opponent = manager.getOpponent(room, player.token);
    if (opponent && !opponent.left) {
      emitTo(opponent, 'opponent_status', {
        status: 'disconnected',
        name: player.name,
        reconnectDeadline: player.disconnectedAt + config.reconnectGraceMs,
        graceMs: config.reconnectGraceMs,
      });
      sendState(room);
    }
    startGrace(room.code, player.token);
  }

  /**
   * Registers an event with uniform validation/error handling.
   * If the client passes an ack callback the result goes there; errors are
   * additionally broadcast as `error_message` when there is no ack or when
   * `alwaysEmitError` is set (moves), so toasts work without an ack.
   */
  const handle = (socket, event, fn, { alwaysEmitError = false } = {}) => {
    socket.on(event, (payload, ack) => {
      if (typeof payload === 'function') {
        ack = payload;
        payload = undefined;
      }
      const reply = typeof ack === 'function' ? ack : null;
      try {
        const result = fn(payload) ?? {};
        reply?.({ ok: true, ...result });
      } catch (err) {
        if (!(err instanceof GameError)) logger.error(`Error in ${event}:`, err);
        const error = toErrorPayload(err);
        if (!reply || alwaysEmitError) socket.emit('error_message', { ...error, event });
        reply?.({ ok: false, error });
      }
    });
  };

  /* ------------------------------ events ------------------------------ */

  io.on('connection', (socket) => {
    socket.data.roomCode = null;
    socket.data.token = null;
    logger.debug(`socket connected ${socket.id}`);

    handle(socket, 'create_room', (raw) => {
      const payload = requireObject(raw);
      const name = sanitizeName(payload.playerName, 'Host');
      const colorPreference = validateColorPreference(payload.color);
      releaseBinding(socket);

      const { room, player } = manager.createRoom({ name, colorPreference, socketId: socket.id });
      bind(socket, room, player);
      logger.info(`Room ${room.code} created by ${name} (${player.color})`);

      socket.emit('room_created', { roomCode: room.code, color: player.color });
      sendState(room);
      return {
        roomCode: room.code,
        playerToken: player.token,
        playerName: player.name,
        color: player.color,
        state: manager.buildSnapshot(room, player.token),
      };
    });

    handle(socket, 'join_room', (raw) => {
      const payload = requireObject(raw);
      const code = normalizeRoomCode(payload.roomCode);
      const token = optionalToken(payload.playerToken);
      const room = manager.requireRoom(code);

      // Joining a room you already belong to (e.g. re-entering your own code) is a rejoin.
      if (token && manager.findPlayer(room, token) && !manager.findPlayer(room, token).left) {
        return rejoin(socket, room, token);
      }

      const name = sanitizeName(payload.playerName, 'Guest');
      releaseBinding(socket);
      const { player } = manager.joinRoom(code, { name, socketId: socket.id });
      bind(socket, room, player);
      logger.info(`${name} joined room ${code} as ${player.color}`);

      const host = manager.getOpponent(room, player.token);
      emitTo(host, 'opponent_status', { status: 'joined', name: player.name });
      socket.emit('room_joined', { roomCode: code, color: player.color, opponentName: host?.name });
      sendState(room);
      return {
        roomCode: code,
        playerToken: player.token,
        playerName: player.name,
        color: player.color,
        state: manager.buildSnapshot(room, player.token),
      };
    });

    handle(socket, 'rejoin_room', (raw) => {
      const payload = requireObject(raw);
      const code = normalizeRoomCode(payload.roomCode);
      const token = validateToken(payload.playerToken);
      const room = manager.requireRoom(code);
      return rejoin(socket, room, token);
    });

    handle(
      socket,
      'make_move',
      (raw) => {
        const { row, col } = validateCoordinates(raw);
        const { room, player } = currentBinding(socket);
        const move = manager.makeMove(room, player.token, row, col);

        for (const p of room.players) {
          emitTo(p, 'move_made', { move, state: manager.buildSnapshot(room, p.token) });
        }
        if (move.gameOver) {
          const over = gameOverPayload(room);
          for (const p of room.players) emitTo(p, 'game_over', over);
        }
        return {};
      },
      { alwaysEmitError: true },
    );

    handle(socket, 'request_rematch', () => {
      const { room, player } = currentBinding(socket);
      const { started, opponent } = manager.requestRematch(room, player.token);
      if (!started) emitTo(opponent, 'rematch_offered', { name: player.name });
      sendState(room);
      return { started };
    });

    handle(socket, 'claim_win', () => {
      const { room, player } = currentBinding(socket);
      manager.claimWin(room, player.token);
      const opponent = manager.getOpponent(room, player.token);
      if (opponent) clearGrace(opponent.token);
      const over = gameOverPayload(room);
      for (const p of room.players) emitTo(p, 'game_over', over);
      sendState(room);
      return {};
    });

    handle(socket, 'leave_room', (raw) => {
      const payload = requireObject(raw);
      let room;
      let player;
      if (socket.data.roomCode) {
        ({ room, player } = currentBinding(socket));
      } else {
        // Allows a replaced/unbound tab to still leave with its stored credentials.
        room = manager.requireRoom(normalizeRoomCode(payload.roomCode));
        player = manager.requirePlayer(room, validateToken(payload.playerToken));
      }

      clearGrace(player.token);
      const previousSocketId = player.socketId;
      const result = manager.leaveRoom(room, player.token);
      unbind(socket);
      if (previousSocketId && previousSocketId !== socket.id) {
        const other = io.sockets.sockets.get(previousSocketId);
        if (other) {
          other.emit('room_closed', { roomCode: room.code, reason: 'left' });
          unbind(other);
        }
      }
      logger.info(`${player.name} left room ${room.code}`);

      if (result.opponent) {
        emitTo(result.opponent, 'opponent_status', { status: 'left', name: player.name });
        if (result.forfeited) emitTo(result.opponent, 'game_over', gameOverPayload(room));
        sendState(room);
      }
      return {};
    });

    socket.on('disconnect', (reason) => {
      logger.debug(`socket disconnected ${socket.id} (${reason})`);
      const { roomCode, token } = socket.data;
      if (!roomCode) return;
      const room = manager.getRoom(roomCode);
      const player = room && manager.findPlayer(room, token);
      // Ignore stale sockets that were already replaced by a newer connection.
      if (!player || player.left || player.socketId !== socket.id) return;
      handleDrop(room, player);
    });
  });

  function rejoin(socket, room, token) {
    const existing = manager.requirePlayer(room, token);
    if (socket.data.roomCode && (socket.data.roomCode !== room.code || socket.data.token !== token)) {
      releaseBinding(socket);
    }

    const { player, previousSocketId, wasDisconnected } = manager.bindSocket(room, existing.token, socket.id);
    clearGrace(token);

    // Newest connection wins: tell the old tab it lost the session.
    if (previousSocketId && previousSocketId !== socket.id) {
      const old = io.sockets.sockets.get(previousSocketId);
      if (old) {
        old.emit('session_replaced', { roomCode: room.code });
        unbind(old);
      }
    }
    bind(socket, room, player);

    const opponent = manager.getOpponent(room, token);
    if (wasDisconnected && opponent && !opponent.left) {
      emitTo(opponent, 'opponent_status', { status: 'reconnected', name: player.name });
    }
    logger.info(`${player.name} rejoined room ${room.code}`);
    sendState(room);
    return {
      roomCode: room.code,
      playerToken: player.token,
      playerName: player.name,
      color: player.color,
      state: manager.buildSnapshot(room, player.token),
    };
  }

  /* ------------------------------ sweeper ----------------------------- */

  const sweepTimer = setInterval(() => {
    for (const { room, reason } of manager.sweep()) {
      logger.info(`Room ${room.code} cleaned up (${reason})`);
      for (const p of room.players) {
        clearGrace(p.token);
        const s = p.socketId && io.sockets.sockets.get(p.socketId);
        if (s) {
          s.emit('room_closed', { roomCode: room.code, reason });
          unbind(s);
        }
      }
    }
  }, config.sweepIntervalMs);
  sweepTimer.unref?.();

  return function dispose() {
    clearInterval(sweepTimer);
    for (const t of graceTimers.values()) clearTimeout(t);
    graceTimers.clear();
  };
}
