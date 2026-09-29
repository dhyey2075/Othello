import 'dotenv/config';

function int(name, fallback) {
  const raw = process.env[name];
  const value = raw === undefined || raw === '' ? NaN : Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function origins(raw) {
  if (!raw) return ['http://localhost:5173', 'http://127.0.0.1:5173'];
  if (raw.trim() === '*') return '*';
  return raw.split(',').map((o) => o.trim()).filter(Boolean);
}

export function loadConfig(overrides = {}) {
  return {
    port: int('PORT', 4000),
    host: process.env.HOST || '0.0.0.0',
    corsOrigin: origins(process.env.CLIENT_ORIGIN),
    reconnectGraceMs: int('RECONNECT_GRACE_MS', 60_000),
    waitingRoomTtlMs: int('WAITING_ROOM_TTL_MS', 30 * 60_000),
    finishedRoomTtlMs: int('FINISHED_ROOM_TTL_MS', 10 * 60_000),
    abandonedRoomTtlMs: int('ABANDONED_ROOM_TTL_MS', 2 * 60_000),
    sweepIntervalMs: int('SWEEP_INTERVAL_MS', 30_000),
    serveClient: process.env.SERVE_CLIENT !== 'false',
    ...overrides,
  };
}
