import cron from 'node-cron';
import { logger } from '../lib/logger';

// P1 / UC6: auto-release reservations not confirmed within 20 minutes.
// Backed by the (status, confirm_deadline) index. MVP runs in-process; the
// cloud-native upgrade path is EventBridge/SQS (data-model.md open questions).
export function startReleaseExpiredWorker(): void {
  cron.schedule('* * * * *', () => {
    logger.debug(
      '[releaseExpired] tick — TODO: UPDATE reservations SET status=\'expirada\' ' +
        "WHERE status='reservada' AND confirm_deadline < now()",
    );
  });
  logger.info('releaseExpired worker scheduled (every minute)');
}
