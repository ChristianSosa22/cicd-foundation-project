import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSpace, createUser, createVehicle, deleteSpaces, deleteUsers, ensureAdmin, request } from './helpers';

describe('Reservations', () => {
  let driverId: number;
  let driverToken: string;
  let adminId: number;
  let adminToken: string;
  let approvedVehicleId: number;
  let unapprovedVehicleId: number;
  let spaceId: number;
  let motoSpaceId: number;

  const TOMORROW = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const DAY_AFTER = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);

  beforeAll(async () => {
    const driver = await createUser({ system_role: 'driver', category: 'ejecutivo' });
    driverId = driver.id;
    driverToken = driver.token;

    const admin = await ensureAdmin();
    adminId = admin.id;
    adminToken = admin.token;

    spaceId = await createSpace({ vehicle_type: 'auto', allowed_categories: ['ejecutivo'] });
    motoSpaceId = await createSpace({ vehicle_type: 'moto', allowed_categories: ['ejecutivo'] });

    approvedVehicleId = await createVehicle(driverId, { vehicle_type: 'auto', is_approved: true });
    unapprovedVehicleId = await createVehicle(driverId, { vehicle_type: 'auto', is_approved: false });
  });

  afterAll(async () => {
    await deleteSpaces(spaceId, motoSpaceId);
    await deleteUsers(driverId);
  });

  describe('POST /reservar', () => {
    it('creates reservation with status reservada', async () => {
      const res = await request
        .post('/reservar')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ space_id: spaceId, vehicle_id: approvedVehicleId, reservation_date: TOMORROW });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ status: 'reservada', space_id: spaceId, vehicle_id: approvedVehicleId });
      expect((res.body as { confirm_deadline: string }).confirm_deadline).toBeDefined();
    });

    it('returns 409 for double-booking same space+date', async () => {
      // Create second driver to attempt to book same space+date
      const driver2 = await createUser({ system_role: 'driver', category: 'ejecutivo' });
      const vehicle2 = await createVehicle(driver2.id, { vehicle_type: 'auto', is_approved: true });

      const res = await request
        .post('/reservar')
        .set('Authorization', `Bearer ${driver2.token}`)
        .send({ space_id: spaceId, vehicle_id: vehicle2, reservation_date: TOMORROW });

      expect(res.status).toBe(409);
      await deleteUsers(driver2.id);
    });

    it('returns 409 for one-active-reservation-per-day', async () => {
      // Driver tries to book a DIFFERENT space on TOMORROW (already has one active reservation)
      const space2 = await createSpace({ vehicle_type: 'auto', allowed_categories: ['ejecutivo'] });
      const vehicle2 = await createVehicle(driverId, { vehicle_type: 'auto', is_approved: true });

      const res = await request
        .post('/reservar')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ space_id: space2, vehicle_id: vehicle2, reservation_date: TOMORROW });

      expect(res.status).toBe(409);
      await deleteSpaces(space2);
    });

    it('returns 422 for unapproved vehicle', async () => {
      const res = await request
        .post('/reservar')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ space_id: spaceId, vehicle_id: unapprovedVehicleId, reservation_date: DAY_AFTER });
      expect(res.status).toBe(422);
    });

    it('returns 422 for vehicle type mismatch', async () => {
      const motoVehicle = await createVehicle(driverId, { vehicle_type: 'moto', is_approved: true });
      const res = await request
        .post('/reservar')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ space_id: spaceId, vehicle_id: motoVehicle, reservation_date: DAY_AFTER });
      expect(res.status).toBe(422);
    });

    it('returns 422 for category mismatch', async () => {
      const restrictedSpace = await createSpace({ vehicle_type: 'auto', allowed_categories: ['operativo'] });
      const res = await request
        .post('/reservar')
        .set('Authorization', `Bearer ${driverToken}`) // ejecutivo driver
        .send({ space_id: restrictedSpace, vehicle_id: approvedVehicleId, reservation_date: DAY_AFTER });
      expect(res.status).toBe(422);
      await deleteSpaces(restrictedSpace);
    });

    it('returns 403 for admin user (driver role required)', async () => {
      const res = await request
        .post('/reservar')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ space_id: spaceId, vehicle_id: approvedVehicleId, reservation_date: DAY_AFTER });
      expect(res.status).toBe(403);
    });
  });

  describe('Reservation lifecycle', () => {
    let reservationId: number;
    let anotherReservationId: number;

    beforeAll(async () => {
      // Create a fresh reservation for lifecycle tests
      const spaceForLife = await createSpace({ vehicle_type: 'auto', allowed_categories: ['ejecutivo'] });
      const driver2 = await createUser({ system_role: 'driver', category: 'ejecutivo' });
      const v2 = await createVehicle(driver2.id, { vehicle_type: 'auto', is_approved: true });

      const res = await request
        .post('/reservar')
        .set('Authorization', `Bearer ${driver2.token}`)
        .send({ space_id: spaceForLife, vehicle_id: v2, reservation_date: DAY_AFTER });

      reservationId = (res.body as { id: number }).id;

      // Store for cleanup
      (this as unknown as { _cleanups: Array<() => Promise<void>> })._cleanups = [
        async () => { await deleteSpaces(spaceForLife); await deleteUsers(driver2.id); },
      ];
    });

    it('POST /reservations/:id/confirm transitions reservada → ocupada', async () => {
      const driver2 = await createUser({ system_role: 'driver', category: 'ejecutivo' });
      const spaceC = await createSpace({ vehicle_type: 'auto', allowed_categories: ['ejecutivo'] });
      const vc = await createVehicle(driver2.id, { vehicle_type: 'auto', is_approved: true });

      const resCreate = await request
        .post('/reservar')
        .set('Authorization', `Bearer ${driver2.token}`)
        .send({ space_id: spaceC, vehicle_id: vc, reservation_date: DAY_AFTER });

      const rId = (resCreate.body as { id: number }).id;

      const confirm = await request
        .post(`/reservations/${rId}/confirm`)
        .set('Authorization', `Bearer ${driver2.token}`);
      expect(confirm.status).toBe(200);
      expect((confirm.body as { status: string }).status).toBe('ocupada');
      expect((confirm.body as { confirmed_at: string | null }).confirmed_at).toBeTruthy();

      await deleteSpaces(spaceC);
      await deleteUsers(driver2.id);
    });

    it('returns 422 when confirming non-reservada status', async () => {
      const driver2 = await createUser({ system_role: 'driver', category: 'ejecutivo' });
      const spaceC = await createSpace({ vehicle_type: 'auto', allowed_categories: ['ejecutivo'] });
      const vc = await createVehicle(driver2.id, { vehicle_type: 'auto', is_approved: true });

      const date3 = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
      const resCreate = await request.post('/reservar').set('Authorization', `Bearer ${driver2.token}`).send({ space_id: spaceC, vehicle_id: vc, reservation_date: date3 });
      const rId = (resCreate.body as { id: number }).id;

      await request.post(`/reservations/${rId}/confirm`).set('Authorization', `Bearer ${driver2.token}`);

      // Already ocupada, confirm again → 422
      const res2 = await request.post(`/reservations/${rId}/confirm`).set('Authorization', `Bearer ${driver2.token}`);
      expect(res2.status).toBe(422);

      await deleteSpaces(spaceC);
      await deleteUsers(driver2.id);
    });

    it('confirm + release: ocupada → liberada', async () => {
      const driver2 = await createUser({ system_role: 'driver', category: 'ejecutivo' });
      const spaceR = await createSpace({ vehicle_type: 'auto', allowed_categories: ['ejecutivo'] });
      const vr = await createVehicle(driver2.id, { vehicle_type: 'auto', is_approved: true });

      const date4 = new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10);
      const resCreate = await request.post('/reservar').set('Authorization', `Bearer ${driver2.token}`).send({ space_id: spaceR, vehicle_id: vr, reservation_date: date4 });
      const rId = (resCreate.body as { id: number }).id;

      await request.post(`/reservations/${rId}/confirm`).set('Authorization', `Bearer ${driver2.token}`);
      const releaseRes = await request.post(`/reservations/${rId}/release`).set('Authorization', `Bearer ${driver2.token}`);
      expect(releaseRes.status).toBe(200);
      expect((releaseRes.body as { status: string }).status).toBe('liberada');

      await deleteSpaces(spaceR);
      await deleteUsers(driver2.id);
    });

    it('cancel: reservada → cancelada, sets is_late_cancellation correctly', async () => {
      const driver2 = await createUser({ system_role: 'driver', category: 'ejecutivo' });
      const spaceCancel = await createSpace({ vehicle_type: 'auto', allowed_categories: ['ejecutivo'] });
      const vc = await createVehicle(driver2.id, { vehicle_type: 'auto', is_approved: true });

      // Use a date in the past to force late cancellation
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

      // Insert directly to bypass date validation (testing is_late_cancellation logic)
      const { db } = await import('../db');
      const { reservations } = await import('../db/schema');
      const [r] = await db.insert(reservations).values({
        userId: driver2.id,
        vehicleId: vc,
        spaceId: spaceCancel,
        reservationDate: yesterday,
        status: 'reservada',
        confirmDeadline: new Date(Date.now() + 20 * 60 * 1000),
      }).returning({ id: reservations.id });

      const cancelRes = await request.post(`/reservations/${r.id}/cancel`).set('Authorization', `Bearer ${driver2.token}`);
      expect(cancelRes.status).toBe(200);
      expect((cancelRes.body as { status: string }).status).toBe('cancelada');
      // Cancelling a past-date reservation is always late
      expect((cancelRes.body as { is_late_cancellation: boolean }).is_late_cancellation).toBe(true);

      await deleteSpaces(spaceCancel);
      await deleteUsers(driver2.id);
    });
  });

  describe('GET /me/reservations', () => {
    it('returns list of own reservations', async () => {
      const res = await request.get('/me/reservations').set('Authorization', `Bearer ${driverToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /reservations/:id', () => {
    it('returns 403 when accessing another user reservation', async () => {
      const driver2 = await createUser({ system_role: 'driver', category: 'ejecutivo' });
      const spaceX = await createSpace({ vehicle_type: 'auto', allowed_categories: ['ejecutivo'] });
      const vx = await createVehicle(driver2.id, { vehicle_type: 'auto', is_approved: true });

      const date5 = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
      const resCreate = await request.post('/reservar').set('Authorization', `Bearer ${driver2.token}`).send({ space_id: spaceX, vehicle_id: vx, reservation_date: date5 });
      const rId = (resCreate.body as { id: number }).id;

      const res = await request.get(`/reservations/${rId}`).set('Authorization', `Bearer ${driverToken}`);
      expect(res.status).toBe(403);

      // Admin can see it
      const adminRes = await request.get(`/reservations/${rId}`).set('Authorization', `Bearer ${adminToken}`);
      expect(adminRes.status).toBe(200);

      await deleteSpaces(spaceX);
      await deleteUsers(driver2.id);
    });
  });
});
