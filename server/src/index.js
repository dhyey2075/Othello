import { loadConfig } from './config.js';
import { createServer } from './app.js';
import { logger } from './utils/logger.js';

const config = loadConfig();
const server = createServer(config);

const address = await server.listen();
logger.info(`Othello server listening on http://${address.address}:${address.port}`);
logger.info(`CORS origins: ${JSON.stringify(config.corsOrigin)} | reconnect grace: ${config.reconnectGraceMs}ms`);

const shutdown = async (signal) => {
  logger.info(`${signal} received, shutting down`);
  await server.close();
  process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
