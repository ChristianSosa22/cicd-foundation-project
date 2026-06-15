import { env } from './config/env';
import { logger } from './lib/logger';
import { startReceiptConsumerWorker, stopReceiptConsumerWorker } from './workers/receiptConsumer';

// Standalone entrypoint for the async consumer (Delivery 4, VPC track).
// Runs as its OWN ECS Fargate task — separate from the HTTP API task — so the
// producer (behind the ALB) and the consumer (polling SQS) are cleanly isolated.
// Container command: node dist/worker.js
logger.info(`receipt consumer worker booting (${env.NODE_ENV})`);

function shutdown(signal: string): void {
  logger.info(`${signal} received — stopping receipt consumer`);
  stopReceiptConsumerWorker();
  // Give the in-flight loop a moment to exit, then hard-exit.
  setTimeout(() => process.exit(0), 1_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

void startReceiptConsumerWorker().catch((err) => {
  logger.error({ err }, 'receipt consumer crashed');
  process.exit(1);
});
