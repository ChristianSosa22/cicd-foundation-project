import { and, desc, eq, inArray } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { reservations, vehicles } from '../../db/schema';
import { conflict, forbidden, notFound } from '../../lib/errors';
import { decrypt, encrypt, plateHash } from '../../lib/crypto';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { idParam, vehicleTypeEnum } from '../common/validators';

// Driver self-service — mounted at /me. All routes require auth.
export const meRouter: Router = Router();
meRouter.use(requireAuth);

// Vehicles / plates (Fn1, Pantalla 1)
meRouter.get('/vehicles', async (req, res, next) => {
  try {
    const rows = await db
      .select({ id: vehicles.id, plateEnc: vehicles.plateEnc, vehicleType: vehicles.vehicleType, isApproved: vehicles.isApproved })
      .from(vehicles)
      .where(eq(vehicles.userId, req.user!.id));

    res.json(rows.map((r) => ({ id: r.id, plate: decrypt(r.plateEnc), vehicle_type: r.vehicleType, is_approved: r.isApproved })));
  } catch (err) {
    next(err);
  }
});

meRouter.post(
  '/vehicles',
  validate({ body: z.object({ plate: z.string().min(1), vehicle_type: vehicleTypeEnum }) }),
  async (req, res, next) => {
    try {
      const body = req.body as { plate: string; vehicle_type: 'auto' | 'moto' | 'camioneta' };
      const norm = body.plate.trim().toUpperCase();
      const hash = plateHash(norm);

      const [existing] = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.plateHash, hash)).limit(1);
      if (existing) return next(conflict('Placa ya registrada'));

      const [row] = await db
        .insert(vehicles)
        .values({ userId: req.user!.id, plateEnc: encrypt(norm), plateHash: hash, vehicleType: body.vehicle_type, isApproved: false })
        .returning({ id: vehicles.id, vehicleType: vehicles.vehicleType, isApproved: vehicles.isApproved });

      res.status(201).json({ id: row.id, plate: norm, vehicle_type: row.vehicleType, is_approved: row.isApproved });
    } catch (err) {
      next(err);
    }
  },
);

meRouter.patch(
  '/vehicles/:id',
  validate({
    params: idParam,
    body: z
      .object({ plate: z.string().min(1).optional(), vehicle_type: vehicleTypeEnum.optional() })
      .refine((d) => d.plate || d.vehicle_type, 'Debe enviar al menos un campo'),
  }),
  async (req, res, next) => {
    try {
      const id = (req.params as { id: string }).id;
      const vehicleId = Number(id);
      const body = req.body as { plate?: string; vehicle_type?: 'auto' | 'moto' | 'camioneta' };

      const [vehicle] = await db
        .select()
        .from(vehicles)
        .where(and(eq(vehicles.id, vehicleId), eq(vehicles.userId, req.user!.id)))
        .limit(1);

      if (!vehicle) return next(notFound());
      if (vehicle.isApproved) return next(forbidden('No se puede editar un vehículo aprobado'));

      const updates: Partial<typeof vehicles.$inferInsert> = {};
      if (body.plate) {
        const norm = body.plate.trim().toUpperCase();
        updates.plateEnc = encrypt(norm);
        updates.plateHash = plateHash(norm);
      }
      if (body.vehicle_type) updates.vehicleType = body.vehicle_type;

      const [updated] = await db
        .update(vehicles)
        .set(updates)
        .where(eq(vehicles.id, vehicleId))
        .returning({ id: vehicles.id, plateEnc: vehicles.plateEnc, vehicleType: vehicles.vehicleType, isApproved: vehicles.isApproved });

      res.json({ id: updated.id, plate: decrypt(updated.plateEnc), vehicle_type: updated.vehicleType, is_approved: updated.isApproved });
    } catch (err) {
      next(err);
    }
  },
);

meRouter.delete('/vehicles/:id', validate({ params: idParam }), async (req, res, next) => {
  try {
    const vehicleId = Number((req.params as { id: string }).id);

    const [vehicle] = await db
      .select({ id: vehicles.id })
      .from(vehicles)
      .where(and(eq(vehicles.id, vehicleId), eq(vehicles.userId, req.user!.id)))
      .limit(1);

    if (!vehicle) return next(notFound());

    const [activeRes] = await db
      .select({ id: reservations.id })
      .from(reservations)
      .where(and(eq(reservations.vehicleId, vehicleId), inArray(reservations.status, ['reservada', 'ocupada'])))
      .limit(1);

    if (activeRes) return next(forbidden('Vehículo tiene reservas activas'));

    await db.delete(vehicles).where(eq(vehicles.id, vehicleId));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// Own reservations (active + history)
meRouter.get('/reservations', async (req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(reservations)
      .where(eq(reservations.userId, req.user!.id))
      .orderBy(desc(reservations.reservationDate));

    res.json(
      rows.map((r) => ({
        id: r.id,
        space_id: r.spaceId,
        vehicle_id: r.vehicleId,
        reservation_date: r.reservationDate,
        status: r.status,
        created_at: r.createdAt,
        confirm_deadline: r.confirmDeadline,
        confirmed_at: r.confirmedAt,
        released_at: r.releasedAt,
        cancelled_at: r.cancelledAt,
        is_late_cancellation: r.isLateCancellation,
      })),
    );
  } catch (err) {
    next(err);
  }
});
