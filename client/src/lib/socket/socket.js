import { io } from 'socket.io-client';

function resolveServerUrl() {
  const fromEnv = import.meta.env.VITE_SERVER_URL;
  if (fromEnv) return fromEnv;
  if (import.meta.env.DEV) return `${window.location.protocol}//${window.location.hostname}:4000`;
  return window.location.origin;
}

export const SERVER_URL = resolveServerUrl();

/**
 * The single socket instance for the whole app. It connects once the
 * GameProvider has attached its listeners (autoConnect: false).
 */
export const socket = io(SERVER_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 5000,
  randomizationFactor: 0.5,
  timeout: 8000,
});

/** Emits with an acknowledgement, rejecting if the server doesn't answer in time. */
export function emitWithAck(event, payload, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    if (!socket.connected) {
      reject(Object.assign(new Error('Not connected to the game server.'), { code: 'OFFLINE' }));
      return;
    }
    socket.timeout(timeoutMs).emit(event, payload, (err, response) => {
      if (err) {
        reject(Object.assign(new Error('The server did not respond. Please try again.'), { code: 'TIMEOUT' }));
      } else if (!response?.ok) {
        const e = response?.error ?? { code: 'UNKNOWN', message: 'Something went wrong.' };
        reject(Object.assign(new Error(e.message), { code: e.code }));
      } else {
        resolve(response);
      }
    });
  });
}
