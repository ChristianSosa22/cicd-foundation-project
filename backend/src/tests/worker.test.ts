import { and, eq, lt } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '../db';
import { reservations } from '../db/schema';
import { createSpace, createUser, createVehicle, deleteSpaces, deleteUsers } from './helpers';

describe('releaseExpired worker logic', () => {
  let driverId: number;
  let vehicleId: number;
  let spaceId: number;
  let expiredReservationId: number;

  beforeAll(async () => {
    const driver = await createUser({ system_role: 'driver', category: 'ejecutivo' });
    driverId = driver.id;
    vehicleId = await createVehicle(driverId, { vehicle_type: 'auto', is_approved: true });
    spaceId = await createSpace({ vehicle_type: 'auto', allowed_categories: ['ejecutivo'] });

    // Insert a reservation with a past confirm_deadline (should be expired)
    const pastDeadline = new Date(Date.now() - 60 * 1000); // 1 minute ago
    const [r] = await db
      .insert(reservations)
      .values({
        userId: driverId,
        vehicleId,
        spaceId,
        reservationDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10), // yesterday
        status: 'reservada',
        confirmDeadline: pastDeadline,
      })
      .returning({ id: reservations.id });

    expiredReservationId = r.id;
  });

  afterAll(async () => {
    await db.delete(reservations).where(eq(reservations.id, expiredReservationId));
    await deleteSpaces(spaceId);
    await deleteUsers(driverId);
  });

  it('updates reservations with past confirm_deadline to expirada', async () => {
    // Run the worker logic directly (same query as the cron job)
    const updated = await db
      .update(reservations)
      .set({ status: 'expirada', updatedAt: new Date() })
      .where(and(eq(reservations.status, 'reservada'), lt(reservations.confirmDeadline, new Date())))
      .returning({ id: reservations.id });

    const updatedIds = updated.map((r) => r.id);
    expect(updatedIds).toContain(expiredReservationId);

    // Verify DB state
    const [row] = await db.select({ status: reservations.status }).from(reservations).where(eq(reservations.id, expiredReservationId)).limit(1);
    expect(row.status).toBe('expirada');
  });

  it('does not update reservations with future confirm_deadline', async () => {
    const futureDeadline = new Date(Date.now() + 60 * 1000); // 1 minute from now
    const [r] = await db
      .insert(reservations)
      .values({
        userId: driverId,
        vehicleId,
        spaceId,
        reservationDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
        status: 'reservada',
        confirmDeadline: futureDeadline,
      })
      .returning({ id: reservations.id });

    const updated = await db
      .update(reservations)
      .set({ status: 'expirada', updatedAt: new Date() })
      .where(and(eq(reservations.status, 'reservada'), lt(reservations.confirmDeadline, new Date())))
      .returning({ id: reservations.id });

    const updatedIds = updated.map((u) => u.id);
    expect(updatedIds).not.toContain(r.id);

    // Verify still reservada
    const [row] = await db.select({ status: reservations.status }).from(reservations).where(eq(reservations.id, r.id)).limit(1);
    expect(row.status).toBe('reservada');

    await db.delete(reservations).where(eq(reservations.id, r.id));
  });
});
