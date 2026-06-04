import { and, eq, lt } from 'drizzle-orm';
import cron from 'node-cron';
import { db } from '../db';
import { reservations } from '../db/schema';
import { logger } from '../lib/logger';

// P1 / UC6: auto-release reservations not confirmed within 20 minutes.
// Backed by the (status, confirm_deadline) index. MVP runs in-process; the
// cloud-native upgrade path is EventBridge/SQS (data-model.md open questions).
export function startReleaseExpiredWorker(): void {
  cron.schedule('* * * * *', async () => {
    try {
      const updated = await db
        .update(reservations)
        .set({ status: 'expirada', updatedAt: new Date() })
        .where(and(eq(reservations.status, 'reservada'), lt(reservations.confirmDeadline, new Date())))
        .returning({ id: reservations.id });

      if (updated.length > 0) {
        logger.info({ count: updated.length }, '[releaseExpired] reservas expiradas');
      }
    } catch (err) {
      logger.error({ err }, '[releaseExpired] error');
    }
  });

  logger.info('releaseExpired worker scheduled (every minute)');
}
