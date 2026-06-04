import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSpace, createUser, createVehicle, deleteSpaces, deleteUsers, ensureAdmin, request } from './helpers';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { spaceBlackouts } from '../db/schema';

describe('Availability (/availability)', () => {
  let driverId: number;
  let driverToken: string;
  let adminId: number;
  let adminToken: string;
  let spaceAutoId: number;
  let spaceMotoId: number;

  const TODAY = new Date().toISOString().slice(0, 10);

  beforeAll(async () => {
    const driver = await createUser({ system_role: 'driver', category: 'ejecutivo' });
    driverId = driver.id;
    driverToken = driver.token;

    const admin = await ensureAdmin();
    adminId = admin.id;
    adminToken = admin.token;

    spaceAutoId = await createSpace({ vehicle_type: 'auto', allowed_categories: ['ejecutivo', 'operativo'] });
    spaceMotoId = await createSpace({ vehicle_type: 'moto', allowed_categories: ['operativo', 'visitante_frecuente'] });
  });

  afterAll(async () => {
    await deleteSpaces(spaceAutoId, spaceMotoId);
    await deleteUsers(driverId);
  });

  describe('GET /availability', () => {
    it('returns 401 without token', async () => {
      const res = await request.get('/availability');
      expect(res.status).toBe(401);
    });

    it('returns 400 for invalid tipo_vehiculo', async () => {
      const res = await request
        .get('/availability?tipo_vehiculo=barco')
        .set('Authorization', `Bearer ${driverToken}`);
      expect(res.status).toBe(400);
    });

    it('returns spaces filtered by vehicle type', async () => {
      const res = await request
        .get('/availability?tipo_vehiculo=auto')
        .set('Authorization', `Bearer ${driverToken}`);
      expect(res.status).toBe(200);
      const spaces = res.body as Array<{ tipo_vehiculo: string }>;
      expect(spaces.every((s) => s.tipo_vehiculo === 'auto')).toBe(true);
    });

    it('filters spaces by driver category — ejecutivo cannot see moto space for operativo only', async () => {
      const res = await request
        .get('/availability?tipo_vehiculo=moto')
        .set('Authorization', `Bearer ${driverToken}`);
      expect(res.status).toBe(200);
      const ids = (res.body as Array<{ id_espacio: number }>).map((s) => s.id_espacio);
      expect(ids).not.toContain(spaceMotoId); // ejecutivo not allowed in moto/operativo space
    });

    it('returns Disponible state for unreserved space', async () => {
      const res = await request
        .get(`/availability?tipo_vehiculo=auto&fecha=${TODAY}`)
        .set('Authorization', `Bearer ${driverToken}`);
      expect(res.status).toBe(200);
      const space = (res.body as Array<{ id_espacio: number; estado: string }>).find((s) => s.id_espacio === spaceAutoId);
      expect(space?.estado).toBe('Disponible');
    });

    it('response has required fields', async () => {
      const res = await request
        .get('/availability')
        .set('Authorization', `Bearer ${driverToken}`);
      expect(res.status).toBe(200);
      if ((res.body as unknown[]).length > 0) {
        const first = (res.body as Array<Record<string, unknown>>)[0];
        expect(first).toHaveProperty('id_espacio');
        expect(first).toHaveProperty('label');
        expect(first).toHaveProperty('tipo_vehiculo');
        expect(first).toHaveProperty('estado');
        expect(first).toHaveProperty('ultima_actualizacion');
      }
    });

    it('excludes blacked-out spaces', async () => {
      const [blackout] = await db
        .insert(spaceBlackouts)
        .values({ spaceId: spaceAutoId, startDate: TODAY, endDate: TODAY, createdBy: adminId })
        .returning({ id: spaceBlackouts.id });

      const res = await request
        .get(`/availability?tipo_vehiculo=auto&fecha=${TODAY}`)
        .set('Authorization', `Bearer ${driverToken}`);
      expect(res.status).toBe(200);
      const ids = (res.body as Array<{ id_espacio: number }>).map((s) => s.id_espacio);
      expect(ids).not.toContain(spaceAutoId);

      await db.delete(spaceBlackouts).where(eq(spaceBlackouts.id, blackout.id));
    });

    it('inactive spaces are not shown', async () => {
      const inactiveId = await createSpace({ vehicle_type: 'auto', is_active: false, allowed_categories: ['ejecutivo'] });

      const res = await request
        .get('/availability?tipo_vehiculo=auto')
        .set('Authorization', `Bearer ${driverToken}`);
      const ids = (res.body as Array<{ id_espacio: number }>).map((s) => s.id_espacio);
      expect(ids).not.toContain(inactiveId);

      await deleteSpaces(inactiveId);
    });
  });
});
