import { ROOM_CODE_PATTERN } from './roomCode.js';
import { ErrorCodes, GameError } from './errors.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const MAX_NAME_LENGTH = 20;
const COLOR_PREFERENCES = new Set(['random', 'black', 'white']);

function invalid(message) {
  return new GameError(ErrorCodes.INVALID_PAYLOAD, message);
}

export function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Accepts `undefined` as "no payload" and normalises it to {}. */
export function requireObject(payload) {
  if (payload === undefined || payload === null) return {};
  if (!isPlainObject(payload)) throw invalid('Payload must be an object.');
  return payload;
}

export function sanitizeName(value, fallback = 'Player') {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string') throw invalid('Name must be a string.');
  // Strip control characters and collapse whitespace.
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return fallback;
  return cleaned.slice(0, MAX_NAME_LENGTH);
}

export function normalizeRoomCode(value) {
  if (typeof value !== 'string') throw invalid('Room code must be a string.');
  const code = value.trim().toUpperCase();
  if (!ROOM_CODE_PATTERN.test(code)) {
    throw new GameError(ErrorCodes.ROOM_NOT_FOUND, 'That room code is not valid.');
  }
  return code;
}

export function validateToken(value) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new GameError(ErrorCodes.INVALID_TOKEN, 'Your session token is invalid.');
  }
  return value;
}

export function optionalToken(value) {
  if (value === undefined || value === null || value === '') return null;
  return validateToken(value);
}

export function validateColorPreference(value) {
  if (value === undefined || value === null) return 'random';
  if (!COLOR_PREFERENCES.has(value)) throw invalid('Color must be "random", "black" or "white".');
  return value;
}

export function validateCoordinates(payload) {
  const { row, col } = requireObject(payload);
  const ok = (n) => Number.isInteger(n) && n >= 0 && n < 8;
  if (!ok(row) || !ok(col)) throw invalid('Move must have integer row and col between 0 and 7.');
  return { row, col };
}
