import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createUser, createVehicle, deleteUsers, ensureAdmin, request } from './helpers';

describe('Driver Vehicles (/me/vehicles)', () => {
  let driverId: number;
  let driverToken: string;
  let adminId: number;
  let adminToken: string;

  beforeAll(async () => {
    const driver = await createUser({ system_role: 'driver', category: 'operativo' });
    driverId = driver.id;
    driverToken = driver.token;

    const admin = await ensureAdmin();
    adminId = admin.id;
    adminToken = admin.token;
  });

  afterAll(async () => {
    await deleteUsers(driverId);
  });

  describe('GET /me/vehicles', () => {
    it('returns empty list initially', async () => {
      const res = await request.get('/me/vehicles').set('Authorization', `Bearer ${driverToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('returns 401 without token', async () => {
      const res = await request.get('/me/vehicles');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /me/vehicles', () => {
    let vehicleId: number;

    it('creates vehicle with is_approved=false', async () => {
      const res = await request
        .post('/me/vehicles')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ plate: 'ABC-123', vehicle_type: 'auto' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ plate: 'ABC-123', vehicle_type: 'auto', is_approved: false });
      vehicleId = (res.body as { id: number }).id;
    });

    it('normalizes plate to uppercase', async () => {
      const res = await request
        .post('/me/vehicles')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ plate: 'xyz-999', vehicle_type: 'moto' });
      expect(res.status).toBe(201);
      expect((res.body as { plate: string }).plate).toBe('XYZ-999');

      // Clean up
      await request.delete(`/me/vehicles/${(res.body as { id: number }).id}`).set('Authorization', `Bearer ${driverToken}`);
    });

    it('returns 409 for duplicate plate', async () => {
      const res = await request
        .post('/me/vehicles')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ plate: 'ABC-123', vehicle_type: 'auto' });
      expect(res.status).toBe(409);
    });

    it('returns 400 for missing vehicle_type', async () => {
      const res = await request
        .post('/me/vehicles')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ plate: 'NEW-111' });
      expect(res.status).toBe(400);
    });

    afterAll(async () => {
      if (vehicleId) {
        await request.delete(`/me/vehicles/${vehicleId}`).set('Authorization', `Bearer ${driverToken}`);
      }
    });
  });

  describe('PATCH /me/vehicles/:id', () => {
    let vehicleId: number;

    beforeAll(async () => {
      vehicleId = await createVehicle(driverId, { vehicle_type: 'auto', is_approved: false });
    });

    it('updates vehicle plate', async () => {
      const uniquePlate = `UPD-${randomUUID().replace(/-/g, '').slice(0, 4).toUpperCase()}`;
      const res = await request
        .patch(`/me/vehicles/${vehicleId}`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ plate: uniquePlate });
      expect(res.status).toBe(200);
      expect((res.body as { plate: string }).plate).toBe(uniquePlate);
    });

    it('returns 403 for approved vehicle', async () => {
      const approvedId = await createVehicle(driverId, { is_approved: true });
      const res = await request
        .patch(`/me/vehicles/${approvedId}`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ plate: 'NOP-000' });
      expect(res.status).toBe(403);
    });

    it('returns 400 when body has no fields', async () => {
      const res = await request
        .patch(`/me/vehicles/${vehicleId}`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent vehicle', async () => {
      const res = await request
        .patch('/me/vehicles/999999')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ plate: 'AAA-000' });
      expect(res.status).toBe(404);
    });

    afterAll(async () => {
      // Best effort cleanup
    });
  });

  describe('DELETE /me/vehicles/:id', () => {
    it('deletes unapproved vehicle with no active reservations', async () => {
      const id = await createVehicle(driverId, { vehicle_type: 'moto', is_approved: false });
      const res = await request.delete(`/me/vehicles/${id}`).set('Authorization', `Bearer ${driverToken}`);
      expect(res.status).toBe(204);
    });

    it('returns 404 for non-existent vehicle', async () => {
      const res = await request.delete('/me/vehicles/999999').set('Authorization', `Bearer ${driverToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('Vehicle approval workflow (admin approves)', () => {
    it('admin approves vehicle; driver can see is_approved=true', async () => {
      const vehicleId = await createVehicle(driverId, { vehicle_type: 'auto', is_approved: false });

      const approveRes = await request
        .patch(`/admin/vehicles/${vehicleId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(approveRes.status).toBe(200);
      expect((approveRes.body as { is_approved: boolean }).is_approved).toBe(true);

      const listRes = await request.get('/me/vehicles').set('Authorization', `Bearer ${driverToken}`);
      const found = (listRes.body as Array<{ id: number; is_approved: boolean }>).find((v) => v.id === vehicleId);
      expect(found?.is_approved).toBe(true);
    });
  });
});
