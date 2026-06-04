import { and, eq, inArray, sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { parkingSpaces, reservations, spaceAllowedCategory, spaceBlackouts } from '../../db/schema';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { dateString, vehicleTypeEnum } from '../common/validators';

export const availabilityRouter: Router = Router();

// UC2 / CU-02 — mounted at /availability.
// Invalid tipo_vehiculo (e.g. "barco") -> 400; missing token -> 401.
const querySchema = z.object({
  tipo_vehiculo: vehicleTypeEnum.optional(),
  fecha: dateString.optional(),
});

availabilityRouter.get('/', requireAuth, validate({ query: querySchema }), async (req, res, next) => {
  try {
    const query = req.query as { tipo_vehiculo?: 'auto' | 'moto' | 'camioneta'; fecha?: string };
    const fecha = query.fecha ?? new Date().toISOString().slice(0, 10);
    const tipoVehiculo = query.tipo_vehiculo;

    // Query A — spaces accessible to this user (filtered by category for drivers)
    const whereConditions = [eq(parkingSpaces.isActive, true)];
    if (tipoVehiculo) whereConditions.push(eq(parkingSpaces.vehicleType, tipoVehiculo));
    if (req.user!.system_role !== 'admin' && req.user!.category) {
      whereConditions.push(eq(spaceAllowedCategory.category, req.user!.category));
    }

    const spaces = await db
      .select({ id: parkingSpaces.id, label: parkingSpaces.label, vehicleType: parkingSpaces.vehicleType, updatedAt: parkingSpaces.updatedAt })
      .from(parkingSpaces)
      .innerJoin(spaceAllowedCategory, eq(spaceAllowedCategory.spaceId, parkingSpaces.id))
      .where(and(...whereConditions));

    if (spaces.length === 0) {
      res.json([]);
      return;
    }

    const spaceIds = spaces.map((s) => s.id);

    // Query B — active reservations for this date
    const activeRes = await db
      .select({ spaceId: reservations.spaceId, status: reservations.status, updatedAt: reservations.updatedAt })
      .from(reservations)
      .where(and(eq(reservations.reservationDate, fecha), inArray(reservations.status, ['reservada', 'ocupada']), inArray(reservations.spaceId, spaceIds)));

    // Query C — blackouts covering this date
    const blackouts = await db
      .select({ spaceId: spaceBlackouts.spaceId })
      .from(spaceBlackouts)
      .where(
        and(
          inArray(spaceBlackouts.spaceId, spaceIds),
          sql`${spaceBlackouts.startDate} <= ${fecha}`,
          sql`${spaceBlackouts.endDate} >= ${fecha}`,
        ),
      );

    const resMap = new Map(activeRes.map((r) => [r.spaceId, r]));
    const blackoutSet = new Set(blackouts.map((b) => b.spaceId));

    const result = spaces
      .filter((s) => !blackoutSet.has(s.id))
      .map((s) => {
        const active = resMap.get(s.id);
        const estado = active?.status === 'ocupada' ? 'Ocupado' : active?.status === 'reservada' ? 'Reservado' : 'Disponible';
        const ultima_actualizacion = (active?.updatedAt ?? s.updatedAt).toISOString();
        return { id_espacio: s.id, label: s.label, tipo_vehiculo: s.vehicleType, estado, ultima_actualizacion };
      });

    // Deduplicate: a space may appear multiple times due to multiple allowed categories
    const seen = new Set<number>();
    const unique = result.filter((r) => {
      if (seen.has(r.id_espacio)) return false;
      seen.add(r.id_espacio);
      return true;
    });

    res.json(unique);
  } catch (err) {
    next(err);
  }
});
