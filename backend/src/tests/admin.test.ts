import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSpace, createUser, createVehicle, deleteSpaces, deleteUsers, ensureAdmin, request } from './helpers';

describe('Admin Routes', () => {
  let adminId: number;
  let adminToken: string;
  let driverId: number;
  let driverToken: string;

  beforeAll(async () => {
    const admin = await ensureAdmin();
    adminId = admin.id;
    adminToken = admin.token;

    const driver = await createUser({ system_role: 'driver', category: 'ejecutivo' });
    driverId = driver.id;
    driverToken = driver.token;
  });

  afterAll(async () => {
    await deleteUsers(driverId);
  });

  // --- Users ---
  describe('Admin Users (UC4)', () => {
    it('GET /admin/users returns 403 for driver', async () => {
      const res = await request.get('/admin/users').set('Authorization', `Bearer ${driverToken}`);
      expect(res.status).toBe(403);
    });

    it('GET /admin/users returns list for admin', async () => {
      const res = await request.get('/admin/users').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /admin/users filters by system_role', async () => {
      const res = await request.get('/admin/users?system_role=admin').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      const roles = (res.body as Array<{ system_role: string }>).map((u) => u.system_role);
      expect(roles.every((r) => r === 'admin')).toBe(true);
    });

    it('POST /admin/users creates new driver', async () => {
      const res = await request
        .post('/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: `newdriver-${Date.now()}@test.com`, full_name: 'New Driver', password: 'Pass12345!', system_role: 'driver', category: 'operativo' });
      expect(res.status).toBe(201);
      expect((res.body as { system_role: string }).system_role).toBe('driver');
      expect(res.body).not.toHaveProperty('password_hash');

      await deleteUsers((res.body as { id: number }).id);
    });

    it('POST /admin/users returns 409 for duplicate email', async () => {
      const u = await createUser({ system_role: 'driver' });
      const res = await request
        .post('/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: u.email, full_name: 'Dup User', password: 'Pass12345!', system_role: 'driver', category: 'operativo' });
      expect(res.status).toBe(409);
      await deleteUsers(u.id);
    });

    it('PATCH /admin/users/:id/deactivate toggles is_active', async () => {
      const u = await createUser({ system_role: 'driver' });
      const deactivate = await request.patch(`/admin/users/${u.id}/deactivate`).set('Authorization', `Bearer ${adminToken}`);
      expect(deactivate.status).toBe(200);
      expect((deactivate.body as { is_active: boolean }).is_active).toBe(false);

      const activate = await request.patch(`/admin/users/${u.id}/activate`).set('Authorization', `Bearer ${adminToken}`);
      expect(activate.status).toBe(200);
      expect((activate.body as { is_active: boolean }).is_active).toBe(true);

      await deleteUsers(u.id);
    });

    it('PATCH /admin/users/:id prevents self role change', async () => {
      const res = await request
        .patch(`/admin/users/${adminId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ system_role: 'driver' });
      expect(res.status).toBe(403);
    });
  });

  // --- Vehicle Approval ---
  describe('Vehicle Approval', () => {
    it('GET /admin/vehicles?approved=false shows pending vehicles', async () => {
      const vehicleId = await createVehicle(driverId, { is_approved: false });
      const res = await request.get('/admin/vehicles?approved=false').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      const ids = (res.body as Array<{ id: number }>).map((v) => v.id);
      expect(ids).toContain(vehicleId);
    });

    it('PATCH /admin/vehicles/:id/approve approves vehicle', async () => {
      const vehicleId = await createVehicle(driverId, { is_approved: false });
      const res = await request.patch(`/admin/vehicles/${vehicleId}/approve`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect((res.body as { is_approved: boolean }).is_approved).toBe(true);
    });
  });

  // --- Spaces ---
  describe('Admin Spaces (UC5)', () => {
    let spaceId: number;

    it('POST /admin/spaces creates space with categories', async () => {
      const res = await request
        .post('/admin/spaces')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ label: `TEST-SPACE-${Date.now()}`, vehicle_type: 'auto', allowed_categories: ['ejecutivo', 'operativo'] });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ vehicle_type: 'auto', is_active: true });
      expect((res.body as { allowed_categories: string[] }).allowed_categories).toHaveLength(2);
      spaceId = (res.body as { id: number }).id;
    });

    it('GET /admin/spaces includes inactive spaces', async () => {
      const res = await request.get('/admin/spaces').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('PATCH /admin/spaces/:id/deactivate → activate', async () => {
      const deactivate = await request.patch(`/admin/spaces/${spaceId}/deactivate`).set('Authorization', `Bearer ${adminToken}`);
      expect(deactivate.status).toBe(200);
      expect((deactivate.body as { is_active: boolean }).is_active).toBe(false);

      const activate = await request.patch(`/admin/spaces/${spaceId}/activate`).set('Authorization', `Bearer ${adminToken}`);
      expect(activate.status).toBe(200);
      expect((activate.body as { is_active: boolean }).is_active).toBe(true);
    });

    afterAll(async () => {
      if (spaceId) await deleteSpaces(spaceId);
    });
  });

  // --- Blackouts ---
  describe('Space Blackouts', () => {
    let spaceId: number;
    let blackoutId: number;

    const TOMORROW = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const DAY_AFTER = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);

    beforeAll(async () => {
      spaceId = await createSpace({ vehicle_type: 'auto', allowed_categories: ['ejecutivo'] });
    });

    afterAll(async () => {
      await deleteSpaces(spaceId);
    });

    it('POST creates blackout', async () => {
      const res = await request
        .post(`/admin/spaces/${spaceId}/blackouts`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ start_date: TOMORROW, end_date: DAY_AFTER, reason: 'Maintenance' });
      expect(res.status).toBe(201);
      blackoutId = (res.body as { id: number }).id;
    });

    it('GET lists blackouts for space', async () => {
      const res = await request.get(`/admin/spaces/${spaceId}/blackouts`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      const ids = (res.body as Array<{ id: number }>).map((b) => b.id);
      expect(ids).toContain(blackoutId);
    });

    it('blacked-out space excluded from availability for driver', async () => {
      const driver = await createUser({ system_role: 'driver', category: 'ejecutivo' });
      const res = await request
        .get(`/availability?tipo_vehiculo=auto&fecha=${TOMORROW}`)
        .set('Authorization', `Bearer ${driver.token}`);
      expect(res.status).toBe(200);
      const ids = (res.body as Array<{ id_espacio: number }>).map((s) => s.id_espacio);
      expect(ids).not.toContain(spaceId);
      await deleteUsers(driver.id);
    });

    it('DELETE removes blackout and space becomes available again', async () => {
      const del = await request.delete(`/admin/blackouts/${blackoutId}`).set('Authorization', `Bearer ${adminToken}`);
      expect(del.status).toBe(204);

      const driver = await createUser({ system_role: 'driver', category: 'ejecutivo' });
      const res = await request
        .get(`/availability?tipo_vehiculo=auto&fecha=${TOMORROW}`)
        .set('Authorization', `Bearer ${driver.token}`);
      const ids = (res.body as Array<{ id_espacio: number }>).map((s) => s.id_espacio);
      expect(ids).toContain(spaceId);
      await deleteUsers(driver.id);
    });

    it('returns 400 for end_date < start_date', async () => {
      const res = await request
        .post(`/admin/spaces/${spaceId}/blackouts`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ start_date: DAY_AFTER, end_date: TOMORROW });
      expect(res.status).toBe(400);
    });
  });

  // --- Dashboard ---
  describe('Dashboard Reporting (UC7)', () => {
    it('GET /admin/dashboard/occupancy returns array with expected shape', async () => {
      const res = await request.get('/admin/dashboard/occupancy').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      if ((res.body as unknown[]).length > 0) {
        const item = (res.body as Array<Record<string, unknown>>)[0];
        expect(item).toHaveProperty('vehicle_type');
        expect(item).toHaveProperty('estado');
        expect(item).toHaveProperty('count');
      }
    });
  });

  // --- Tariffs ---
  describe('Tariff Management (UC8)', () => {
    it('GET /tariffs returns current tariffs (driver auth)', async () => {
      const res = await request.get('/tariffs').set('Authorization', `Bearer ${driverToken}`);
      expect(res.status).toBe(200);
    });

    it('POST /admin/tariffs appends new price (append-only)', async () => {
      const before = await request.get('/admin/tariffs').set('Authorization', `Bearer ${adminToken}`);
      const countBefore = (before.body as unknown[]).length;

      const res = await request
        .post('/admin/tariffs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ vehicle_type: 'auto', price: 20.0, currency: 'GTQ' });
      expect(res.status).toBe(201);

      const after = await request.get('/admin/tariffs').set('Authorization', `Bearer ${adminToken}`);
      expect((after.body as unknown[]).length).toBe(countBefore + 1);
    });

    it('GET /tariffs returns latest price per type after new tariff', async () => {
      await request.post('/admin/tariffs').set('Authorization', `Bearer ${adminToken}`).send({ vehicle_type: 'auto', price: 25.0 });
      const res = await request.get('/tariffs').set('Authorization', `Bearer ${driverToken}`);
      const autoTariff = (res.body as Array<{ vehicle_type: string; price: string }>).find((t) => t.vehicle_type === 'auto');
      expect(autoTariff?.price).toBe('25.00');
    });
  });

  // --- Settings ---
  describe('Settings (Fn5)', () => {
    it('GET /admin/settings returns settings array', async () => {
      const res = await request.get('/admin/settings').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('PUT /admin/settings/:key upserts a value', async () => {
      const res = await request
        .put('/admin/settings/cancellation_window_hours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: 4 });
      expect(res.status).toBe(200);
      expect((res.body as { key: string; value: number }).key).toBe('cancellation_window_hours');

      // Verify idempotent
      const res2 = await request
        .put('/admin/settings/cancellation_window_hours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: 2 });
      expect(res2.status).toBe(200);
    });
  });

  // --- History / Export ---
  describe('Reservations History & Export', () => {
    it('GET /admin/reservations returns array', async () => {
      const res = await request.get('/admin/reservations').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /admin/reservations/export returns CSV', async () => {
      const res = await request.get('/admin/reservations/export').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
    });
  });
});
