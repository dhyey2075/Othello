/**
 * Persists the resumable session in localStorage.
 * `?profile=2` in the URL namespaces storage so two players can be tested
 * from the same browser without the tabs taking over each other's session.
 */
const profile = new URLSearchParams(window.location.search).get('profile');
const ns = profile ? `:${profile.replace(/[^a-z0-9_-]/gi, '').slice(0, 16)}` : '';

const SESSION_KEY = `othello.session${ns}`;
const NAME_KEY = `othello.name${ns}`;
const HINTS_KEY = 'othello.hints';

function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or disabled — the game still works, just without resume */
  }
}

export function loadSession() {
  const s = read(SESSION_KEY);
  if (s && typeof s.roomCode === 'string' && typeof s.playerToken === 'string') return s;
  return null;
}

export function saveSession({ roomCode, playerToken, playerName }) {
  write(SESSION_KEY, { roomCode, playerToken, playerName, savedAt: Date.now() });
  if (playerName) write(NAME_KEY, playerName);
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export const loadName = () => read(NAME_KEY) ?? '';
export const saveName = (name) => write(NAME_KEY, name);

export const loadHints = () => read(HINTS_KEY) ?? true;
export const saveHints = (on) => write(HINTS_KEY, on);
