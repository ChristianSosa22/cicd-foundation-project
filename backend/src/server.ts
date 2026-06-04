import { buildApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { startReleaseExpiredWorker } from './workers/releaseExpired';

const app = buildApp();

const server = app.listen(env.PORT, () => {
  logger.info(`API listening on :${env.PORT} (${env.NODE_ENV})`);
  if (env.NODE_ENV !== 'test') startReleaseExpiredWorker();
});

function shutdown(signal: string): void {
  logger.info(`${signal} received — shutting down`);
  server.close(() => process.exit(0));
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
