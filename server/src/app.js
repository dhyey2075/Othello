import { createServer as createHttpServer } from 'node:http';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { RoomManager } from './rooms/RoomManager.js';
import { registerSocketHandlers } from './sockets/registerHandlers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.resolve(__dirname, '../../client/dist');

export function createServer(config) {
  const corsOrigin = config.corsOrigin === '*' ? true : config.corsOrigin;
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: corsOrigin, methods: ['GET', 'POST'] }));

  const manager = new RoomManager({ config });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: Math.round(process.uptime()), rooms: manager.store.size });
  });

  // In production the server also hosts the built client (single origin, no CORS needed).
  if (config.serveClient && existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST, { index: false, maxAge: '1h' }));
    app.get(/^\/(?!socket\.io\/).*/, (_req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
  }

  const httpServer = createHttpServer(app);
  const io = new Server(httpServer, {
    cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
    // Detect dead connections (closed laptop, lost Wi-Fi) within ~20s.
    pingInterval: 10_000,
    pingTimeout: 10_000,
    maxHttpBufferSize: 10_000,
  });

  const dispose = registerSocketHandlers(io, manager, config);

  return {
    app,
    io,
    httpServer,
    manager,
    listen(port = config.port, host = config.host) {
      return new Promise((resolve) => httpServer.listen(port, host, () => resolve(httpServer.address())));
    },
    async close() {
      dispose();
      await new Promise((resolve) => io.close(() => resolve()));
    },
  };
}
