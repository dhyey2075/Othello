export const ErrorCodes = Object.freeze({
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  ROOM_EXPIRED: 'ROOM_EXPIRED',
  ROOM_FULL: 'ROOM_FULL',
  INVALID_TOKEN: 'INVALID_TOKEN',
  NOT_IN_ROOM: 'NOT_IN_ROOM',
  NOT_YOUR_TURN: 'NOT_YOUR_TURN',
  ILLEGAL_MOVE: 'ILLEGAL_MOVE',
  GAME_PAUSED: 'GAME_PAUSED',
  GAME_NOT_ACTIVE: 'GAME_NOT_ACTIVE',
  REMATCH_UNAVAILABLE: 'REMATCH_UNAVAILABLE',
  CLAIM_UNAVAILABLE: 'CLAIM_UNAVAILABLE',
  INTERNAL: 'INTERNAL',
});

export class GameError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export function toErrorPayload(err) {
  if (err instanceof GameError) return { code: err.code, message: err.message };
  return { code: ErrorCodes.INTERNAL, message: 'Something went wrong on the server.' };
}
