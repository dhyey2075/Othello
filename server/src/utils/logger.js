const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };
const threshold = LEVELS[process.env.LOG_LEVEL] ?? (process.env.NODE_ENV === 'test' ? LEVELS.silent : LEVELS.info);

function log(level, ...args) {
  if (LEVELS[level] < threshold) return;
  const ts = new Date().toISOString();
  // eslint-disable-next-line no-console
  (level === 'error' ? console.error : console.log)(`[${ts}] ${level.toUpperCase()}`, ...args);
}

export const logger = {
  debug: (...a) => log('debug', ...a),
  info: (...a) => log('info', ...a),
  warn: (...a) => log('warn', ...a),
  error: (...a) => log('error', ...a),
};
