import { and, eq, inArray, sql } from 'drizzle-orm';
import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { env } from '../../config/env';
import { db } from '../../db';
import { parkingSpaces, reservations, settings, spaceAllowedCategory, spaceBlackouts, users, vehicles } from '../../db/schema';
import { decrypt } from '../../lib/crypto';
import { conflict, forbidden, notFound, unprocessable } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { enqueueReceiptMessage } from '../../lib/sqs';
import { presignGetReceipt } from '../../lib/s3';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { dateString, idParam } from '../common/validators';

// POST /reservar (UC3, Fn1) — atomic create. 201; 409 double-book / one-active-per-day.
export const reservarRouter: Router = Router();
reservarRouter.post(
  '/',
  requireAuth,
  requireRole('driver'),
  validate({
    body: z.object({
      space_id: z.number().int().positive(),
      vehicle_id: z.number().int().positive(),
      reservation_date: dateString,
    }),
  }),
  async (req, res, next) => {
    try {
      const body = req.body as { space_id: number; vehicle_id: number; reservation_date: string };
      const userId = req.user!.id;
      const category = req.user!.category;

      if (!category) return next(unprocessable('Categoría de conductor no configurada'));

      // 1. Verify vehicle ownership + approval
      const [vehicle] = await db
        .select()
        .from(vehicles)
        .where(and(eq(vehicles.id, body.vehicle_id), eq(vehicles.userId, userId)))
        .limit(1);

      if (!vehicle) return next(notFound('Vehículo no encontrado'));
      if (!vehicle.isApproved) return next(unprocessable('El vehículo no está aprobado'));

      // 2. Verify space exists and is active
      const [space] = await db.select().from(parkingSpaces).where(eq(parkingSpaces.id, body.space_id)).limit(1);

      if (!space) return next(notFound('Espacio no encontrado'));
      if (!space.isActive) return next(unprocessable('El espacio no está disponible'));

      // 3. Vehicle type must match space type
      if (vehicle.vehicleType !== space.vehicleType) {
        return next(unprocessable('El tipo de vehículo no coincide con el espacio'));
      }

      // 4. Driver category must be allowed in this space
      const [allowed] = await db
        .select({ spaceId: spaceAllowedCategory.spaceId })
        .from(spaceAllowedCategory)
        .where(and(eq(spaceAllowedCategory.spaceId, body.space_id), eq(spaceAllowedCategory.category, category)))
        .limit(1);

      if (!allowed) return next(unprocessable('Tu categoría no tiene acceso a este espacio'));

      // 5. No blackout for this date
      const [blackout] = await db
        .select({ id: spaceBlackouts.id })
        .from(spaceBlackouts)
        .where(
          and(
            eq(spaceBlackouts.spaceId, body.space_id),
            sql`${spaceBlackouts.startDate} <= ${body.reservation_date}`,
            sql`${spaceBlackouts.endDate} >= ${body.reservation_date}`,
          ),
        )
        .limit(1);

      if (blackout) return next(conflict('El espacio no está disponible en esa fecha'));

      // 6. INSERT — partial unique indexes handle double-book + one-per-day → PG 23505 → 409
      // NOTE: confirm_deadline set to 1 minute for class demonstration (not 20 min).
      // This allows the EventBridge Scheduler (rate(1 minute)) to sweep expired
      // reservations in real-time during the test.
      const confirmDeadline = new Date(Date.now() + 1 * 60 * 1000);
      const [reservation] = await db
        .insert(reservations)
        .values({
          userId,
          vehicleId: body.vehicle_id,
          spaceId: body.space_id,
          reservationDate: body.reservation_date,
          status: 'reservada',
          confirmDeadline,
        })
        .returning();

      // 7. Enqueue GenerateReceiptCommand to SQS (async receipt pipeline).
      // The receipt-worker Lambda will generate the PDF, upload to S3, and
      // publish ReceiptReadyEvent to SNS. The receipt_s3_key will be NULL
      // until the worker completes (poll via GET /reservations/:id).
      if (env.RECEIPT_QUEUE_URL) {
        try {
          const messageId = await enqueueReceiptMessage({
            event_type: 'GenerateReceiptCommand',
            idempotency_key: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            data: {
              reservation_id: reservation.id,
              user_id: userId,
              space_id: body.space_id,
              vehicle_id: body.vehicle_id,
              reservation_date: body.reservation_date,
            },
          });
          logger.info({ messageId, reservation_id: reservation.id }, '[reservar] enqueued GenerateReceiptCommand');
        } catch (err) {
          logger.error({ err }, '[reservar] SQS enqueue failed — receipt will not be generated');
        }
      }

      res.status(201).json({
        id: reservation.id,
        space_id: reservation.spaceId,
        vehicle_id: reservation.vehicleId,
        reservation_date: reservation.reservationDate,
        status: reservation.status,
        confirm_deadline: reservation.confirmDeadline,
        receipt_s3_key: null,
      });
    } catch (err) {
      next(err);
    }
  },
);

function mapReservation(r: Record<string, unknown>) {
  return {
    id: r.id,
    user_id: r.userId,
    vehicle_id: r.vehicleId,
    space_id: r.spaceId,
    reservation_date: r.reservationDate,
    status: r.status,
    created_at: r.createdAt,
    confirm_deadline: r.confirmDeadline,
    confirmed_at: r.confirmedAt,
    released_at: r.releasedAt,
    cancelled_at: r.cancelledAt,
    is_late_cancellation: r.isLateCancellation,
    receipt_s3_key: r.receiptS3Key,
    updated_at: r.updatedAt,
  };
}

// /reservations/* — lifecycle transitions (UC3, Fn4, Fn5).
export const reservationsRouter: Router = Router();
reservationsRouter.use(requireAuth);

reservationsRouter.get('/:id', validate({ params: idParam }), async (req, res, next) => {
  try {
    const id = Number((req.params as { id: string }).id);
    const [reservation] = await db.select().from(reservations).where(eq(reservations.id, id)).limit(1);

    if (!reservation) return next(notFound());

    if (req.user!.system_role !== 'admin' && reservation.userId !== req.user!.id) return next(forbidden());

    // Enrich with space and vehicle info
    const [space] = await db.select({ label: parkingSpaces.label, vehicleType: parkingSpaces.vehicleType }).from(parkingSpaces).where(eq(parkingSpaces.id, reservation.spaceId)).limit(1);
    const [vehicle] = await db.select({ plateEnc: vehicles.plateEnc, vehicleType: vehicles.vehicleType }).from(vehicles).where(eq(vehicles.id, reservation.vehicleId)).limit(1);
    const [owner] = await db.select({ category: users.category }).from(users).where(eq(users.id, reservation.userId)).limit(1);

    res.json({
      ...mapReservation(reservation as unknown as Record<string, unknown>),
      space: space ? { label: space.label, vehicle_type: space.vehicleType } : null,
      vehicle: vehicle ? { plate: decrypt(vehicle.plateEnc), vehicle_type: vehicle.vehicleType } : null,
      user_category: owner?.category ?? null,
    });
  } catch (err) {
    next(err);
  }
});

reservationsRouter.post(
  '/:id/confirm',
  requireRole('driver'),
  validate({ params: idParam }),
  async (req, res, next) => {
    try {
      const id = Number((req.params as { id: string }).id);
      const [reservation] = await db.select().from(reservations).where(eq(reservations.id, id)).limit(1);

      if (!reservation) return next(notFound());
      if (reservation.userId !== req.user!.id) return next(forbidden());
      if (reservation.status !== 'reservada') return next(unprocessable('Estado inválido para confirmar: se requiere reservada'));

      const [updated] = await db
        .update(reservations)
        .set({ status: 'ocupada', confirmedAt: new Date(), updatedAt: new Date() })
        .where(eq(reservations.id, id))
        .returning();

      res.json(mapReservation(updated as unknown as Record<string, unknown>));
    } catch (err) {
      next(err);
    }
  },
);

reservationsRouter.post(
  '/:id/release',
  requireRole('driver'),
  validate({ params: idParam }),
  async (req, res, next) => {
    try {
      const id = Number((req.params as { id: string }).id);
      const [reservation] = await db.select().from(reservations).where(eq(reservations.id, id)).limit(1);

      if (!reservation) return next(notFound());
      if (reservation.userId !== req.user!.id) return next(forbidden());
      if (reservation.status !== 'ocupada') return next(unprocessable('Solo se pueden liberar reservas ocupadas'));

      const [updated] = await db
        .update(reservations)
        .set({ status: 'liberada', releasedAt: new Date(), updatedAt: new Date() })
        .where(eq(reservations.id, id))
        .returning();

      res.json(mapReservation(updated as unknown as Record<string, unknown>));
    } catch (err) {
      next(err);
    }
  },
);

reservationsRouter.post(
  '/:id/cancel',
  requireRole('driver'),
  validate({ params: idParam }),
  async (req, res, next) => {
    try {
      const id = Number((req.params as { id: string }).id);
      const [reservation] = await db.select().from(reservations).where(eq(reservations.id, id)).limit(1);

      if (!reservation) return next(notFound());
      if (reservation.userId !== req.user!.id) return next(forbidden());
      if (reservation.status !== 'reservada') return next(unprocessable('Solo se pueden cancelar reservas en estado reservada'));

      // Read cancellation window setting (default 2h)
      const [setting] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, 'cancellation_window_hours')).limit(1);
      const windowHours = typeof setting?.value === 'number' ? setting.value : 2;

      const reservationStart = new Date(reservation.reservationDate + 'T00:00:00');
      const isLate = reservationStart.getTime() - Date.now() < windowHours * 3_600_000;

      const [updated] = await db
        .update(reservations)
        .set({ status: 'cancelada', cancelledAt: new Date(), isLateCancellation: isLate, updatedAt: new Date() })
        .where(eq(reservations.id, id))
        .returning();

      res.json(mapReservation(updated as unknown as Record<string, unknown>));
    } catch (err) {
      next(err);
    }
  },
);

reservationsRouter.get(
  '/:id/receipt',
  validate({ params: idParam }),
  async (req, res, next) => {
    try {
      const id = Number((req.params as { id: string }).id);
      const [reservation] = await db.select().from(reservations).where(eq(reservations.id, id)).limit(1);

      if (!reservation) return next(notFound());
      if (req.user!.system_role !== 'admin' && reservation.userId !== req.user!.id) return next(forbidden());
      if (!reservation.receiptS3Key) return next(notFound('Comprobante no disponible'));

      const url = await presignGetReceipt(reservation.receiptS3Key, 300);
      res.json({ url });
    } catch (err) {
      next(err);
    }
  },
);

// ── Delivery 4: async producer ────────────────────────────────────────────────
// POST /reservas/enqueue — accepts a JSON reservation-intent payload, puts it on
// the receipt SQS queue, and returns 202 with the SQS-assigned MessageId.
// Access control is network-level: reachable only through the D3 ALB ingress,
// never via the task's private IP. The async worker (Deliverable B) consumes the
// message and writes the receipt object to S3.
export const reservasRouter: Router = Router();
reservasRouter.post(
  '/enqueue',
  validate({
    body: z.object({
      space_id: z.number().int().positive().optional(),
      vehicle_id: z.number().int().positive().optional(),
      reservation_date: dateString.optional(),
    }).passthrough(),
  }),
  async (req, res, next) => {
    try {
      const messageId = await enqueueReceiptMessage({
        type: 'ReservationEnqueued',
        payload: req.body,
        enqueued_at: new Date().toISOString(),
      });
      logger.info({ messageId }, '[enqueue] message accepted onto receipt queue');
      res.status(202).json({ message_id: messageId, status: 'accepted' });
    } catch (err) {
      next(err);
    }
  },
);
