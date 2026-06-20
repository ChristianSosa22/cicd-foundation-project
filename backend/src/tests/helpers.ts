import bcrypt from 'bcryptjs';
import { eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import supertest from 'supertest';
import { buildApp } from '../app';
import { db } from '../db';
import { encrypt, plateHash } from '../lib/crypto';
import { parkingSpaces, reservations, settings, spaceAllowedCategory, tariffs, users, vehicles } from '../db/schema';

export const app = buildApp();
const agent = supertest(app);
// Business routes are mounted under /api (see app.ts). Tests use logical paths
// without the prefix so call sites stay readable; this wrapper adds it.
export const request = {
  get:    (path: string) => agent.get(`/api${path}`),
  post:   (path: string) => agent.post(`/api${path}`),
  put:    (path: string) => agent.put(`/api${path}`),
  patch:  (path: string) => agent.patch(`/api${path}`),
  delete: (path: string) => agent.delete(`/api${path}`),
};

export async function createUser(overrides: {
  email?: string;
  password?: string;
  system_role?: 'admin' | 'driver';
  category?: 'ejecutivo' | 'operativo' | 'visitante_frecuente' | null;
  is_active?: boolean;
} = {}): Promise<{ id: number; email: string; password: string; token: string }> {
  const email = overrides.email ?? `test-${randomUUID()}@test.com`;
  const password = overrides.password ?? 'TestPass123!';
  const passwordHash = bcrypt.hashSync(password, 4);

  const [user] = await db
    .insert(users)
    .values({
      email,
      fullName: 'Test User',
      passwordHash,
      systemRole: overrides.system_role ?? 'driver',
      category: overrides.category !== undefined ? overrides.category : 'ejecutivo',
      isActive: overrides.is_active !== false,
    })
    .returning({ id: users.id });

  const res = await request.post('/auth/login').send({ email, password });
  const token = (res.body as { token: string }).token;

  return { id: user.id, email, password, token };
}

export async function deleteUsers(...ids: number[]): Promise<void> {
  for (const id of ids) {
    // Clean up FK dependencies before deleting user
    await db.delete(reservations).where(eq(reservations.userId, id));
    const userVehicles = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.userId, id));
    if (userVehicles.length > 0) {
      const vehicleIds = userVehicles.map((v) => v.id);
      await db.delete(reservations).where(inArray(reservations.vehicleId, vehicleIds));
      await db.delete(vehicles).where(eq(vehicles.userId, id));
    }
    await db.delete(users).where(eq(users.id, id));
  }
}

export async function createSpace(overrides: {
  label?: string;
  vehicle_type?: 'auto' | 'moto' | 'camioneta';
  allowed_categories?: Array<'ejecutivo' | 'operativo' | 'visitante_frecuente'>;
  is_active?: boolean;
} = {}): Promise<number> {
  const label = overrides.label ?? `TEST-${randomUUID().slice(0, 6)}`;
  const vehicleType = overrides.vehicle_type ?? 'auto';
  const allowedCats = overrides.allowed_categories ?? ['ejecutivo', 'operativo', 'visitante_frecuente'];

  const [space] = await db
    .insert(parkingSpaces)
    .values({ label, vehicleType, isActive: overrides.is_active !== false })
    .returning({ id: parkingSpaces.id });

  if (allowedCats.length > 0) {
    await db.insert(spaceAllowedCategory).values(allowedCats.map((c) => ({ spaceId: space.id, category: c })));
  }

  return space.id;
}

export async function deleteSpaces(...ids: number[]): Promise<void> {
  for (const id of ids) {
    // Delete reservations referencing this space before removing the space (FK constraint)
    await db.delete(reservations).where(eq(reservations.spaceId, id));
    await db.delete(spaceAllowedCategory).where(eq(spaceAllowedCategory.spaceId, id));
    await db.delete(parkingSpaces).where(eq(parkingSpaces.id, id));
  }
}

export async function createVehicle(
  userId: number,
  overrides: {
    vehicle_type?: 'auto' | 'moto' | 'camioneta';
    is_approved?: boolean;
    plate?: string;
  } = {},
): Promise<number> {
  const plate = overrides.plate ?? `TST${randomUUID().replace(/-/g, '').slice(0, 5).toUpperCase()}`;
  const norm = plate.trim().toUpperCase();

  const [v] = await db
    .insert(vehicles)
    .values({
      userId,
      plateEnc: encrypt(norm),
      plateHash: plateHash(norm),
      vehicleType: overrides.vehicle_type ?? 'auto',
      isApproved: overrides.is_approved ?? false,
    })
    .returning({ id: vehicles.id });

  return v.id;
}

let _adminId: number | null = null;
export async function ensureAdmin(): Promise<{ id: number; email: string; password: string; token: string }> {
  const email = 'sysadmin@test.internal';
  const password = 'Admin1234!';

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (!existing) {
    await db.insert(users).values({
      email,
      fullName: 'System Admin',
      passwordHash: bcrypt.hashSync(password, 4),
      systemRole: 'admin',
      category: null,
      isActive: true,
    });
  }

  const res = await request.post('/auth/login').send({ email, password });
  const token = (res.body as { token: string }).token;
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  _adminId = u.id;
  return { id: u.id, email, password, token };
}
