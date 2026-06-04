import bcrypt from 'bcryptjs';
import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { db } from '../../db';
import {
  currentTariffs,
  parkingSpaces,
  reservations,
  settings,
  spaceAllowedCategory,
  spaceBlackouts,
  tariffs,
  users,
  vehicles,
} from '../../db/schema';
import { decrypt, encrypt } from '../../lib/crypto';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { categoryEnum, dateString, idParam, vehicleTypeEnum } from '../common/validators';

// All /admin/* routes require an authenticated admin.
export const adminRouter: Router = Router();
adminRouter.use(requireAuth, requireRole('admin'));

// --- Users (UC4) ---
adminRouter.get('/users', async (req, res, next) => {
  try {
    const q = req.query as { is_active?: string; system_role?: string; category?: string };
    const conditions = [];
    if (q.is_active !== undefined) conditions.push(eq(users.isActive, q.is_active === 'true'));
    if (q.system_role) conditions.push(eq(users.systemRole, q.system_role as 'admin' | 'driver'));
    if (q.category) conditions.push(eq(users.category, q.category as 'ejecutivo' | 'operativo' | 'visitante_frecuente'));

    const rows = await db
      .select({ id: users.id, email: users.email, fullName: users.fullName, systemRole: users.systemRole, category: users.category, isActive: users.isActive, createdAt: users.createdAt })
      .from(users)
      .where(conditions.length ? and(...conditions) : undefined);

    res.json(rows.map((r) => ({ id: r.id, email: r.email, full_name: r.fullName, system_role: r.systemRole, category: r.category, is_active: r.isActive, created_at: r.createdAt })));
  } catch (err) {
    next(err);
  }
});

adminRouter.post(
  '/users',
  validate({
    body: z.object({
      email: z.string().email(),
      full_name: z.string().min(1),
      password: z.string().min(8),
      system_role: z.enum(['admin', 'driver']),
      category: categoryEnum.nullish(),
      phone: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const body = req.body as { email: string; full_name: string; password: string; system_role: 'admin' | 'driver'; category?: 'ejecutivo' | 'operativo' | 'visitante_frecuente' | null; phone?: string };

      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, body.email)).limit(1);
      if (existing) return next(conflict('Email ya registrado'));

      const passwordHash = bcrypt.hashSync(body.password, env.BCRYPT_ROUNDS);
      const phoneEnc = body.phone ? encrypt(body.phone) : null;

      const [user] = await db
        .insert(users)
        .values({ email: body.email, fullName: body.full_name, passwordHash, systemRole: body.system_role, category: body.category ?? null, phoneEnc: phoneEnc ?? undefined, isActive: true })
        .returning({ id: users.id, email: users.email, fullName: users.fullName, systemRole: users.systemRole, category: users.category, isActive: users.isActive });

      res.status(201).json({ id: user.id, email: user.email, full_name: user.fullName, system_role: user.systemRole, category: user.category, is_active: user.isActive });
    } catch (err) {
      next(err);
    }
  },
);

adminRouter.patch(
  '/users/:id',
  validate({
    params: idParam,
    body: z.object({
      full_name: z.string().min(1).optional(),
      system_role: z.enum(['admin', 'driver']).optional(),
      category: categoryEnum.nullish(),
      phone: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const userId = Number((req.params as { id: string }).id);
      const body = req.body as { full_name?: string; system_role?: 'admin' | 'driver'; category?: 'ejecutivo' | 'operativo' | 'visitante_frecuente' | null; phone?: string };

      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
      if (!existing) return next(notFound());

      if (body.system_role && userId === req.user!.id) return next(forbidden('No puedes cambiar tu propio rol'));

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (body.full_name !== undefined) updates.fullName = body.full_name;
      if (body.system_role !== undefined) updates.systemRole = body.system_role;
      if ('category' in body) updates.category = body.category ?? null;
      if (body.phone !== undefined) updates.phoneEnc = encrypt(body.phone);

      const [updated] = await db
        .update(users)
        .set(updates)
        .where(eq(users.id, userId))
        .returning({ id: users.id, email: users.email, fullName: users.fullName, systemRole: users.systemRole, category: users.category, isActive: users.isActive });

      res.json({ id: updated.id, email: updated.email, full_name: updated.fullName, system_role: updated.systemRole, category: updated.category, is_active: updated.isActive });
    } catch (err) {
      next(err);
    }
  },
);

adminRouter.patch('/users/:id/deactivate', validate({ params: idParam }), async (req, res, next) => {
  try {
    const userId = Number((req.params as { id: string }).id);
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
    if (!existing) return next(notFound());

    await db.update(users).set({ isActive: false, updatedAt: new Date() }).where(eq(users.id, userId));
    res.json({ id: userId, is_active: false });
  } catch (err) {
    next(err);
  }
});

adminRouter.patch('/users/:id/activate', validate({ params: idParam }), async (req, res, next) => {
  try {
    const userId = Number((req.params as { id: string }).id);
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
    if (!existing) return next(notFound());

    await db.update(users).set({ isActive: true, updatedAt: new Date() }).where(eq(users.id, userId));
    res.json({ id: userId, is_active: true });
  } catch (err) {
    next(err);
  }
});

// --- Vehicle approval (Fn1) ---
adminRouter.get('/vehicles', async (req, res, next) => {
  try {
    const q = req.query as { approved?: string };
    const conditions = [];
    if (q.approved !== undefined) conditions.push(eq(vehicles.isApproved, q.approved === 'true'));

    const rows = await db
      .select({
        id: vehicles.id,
        plateEnc: vehicles.plateEnc,
        vehicleType: vehicles.vehicleType,
        isApproved: vehicles.isApproved,
        createdAt: vehicles.createdAt,
        userId: users.id,
        userEmail: users.email,
        userFullName: users.fullName,
      })
      .from(vehicles)
      .innerJoin(users, eq(users.id, vehicles.userId))
      .where(conditions.length ? and(...conditions) : undefined);

    res.json(
      rows.map((r) => ({
        id: r.id,
        plate: decrypt(r.plateEnc),
        vehicle_type: r.vehicleType,
        is_approved: r.isApproved,
        created_at: r.createdAt,
        user: { id: r.userId, email: r.userEmail, full_name: r.userFullName },
      })),
    );
  } catch (err) {
    next(err);
  }
});

adminRouter.patch('/vehicles/:id/approve', validate({ params: idParam }), async (req, res, next) => {
  try {
    const vehicleId = Number((req.params as { id: string }).id);
    const [vehicle] = await db.select({ id: vehicles.id, isApproved: vehicles.isApproved }).from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1);
    if (!vehicle) return next(notFound());
    if (vehicle.isApproved) return res.json({ id: vehicleId, is_approved: true });

    await db.update(vehicles).set({ isApproved: true }).where(eq(vehicles.id, vehicleId));
    res.json({ id: vehicleId, is_approved: true });
  } catch (err) {
    next(err);
  }
});

// --- Spaces & blackouts (UC5) ---
adminRouter.get('/spaces', async (_req, res, next) => {
  try {
    const spaces = await db.select().from(parkingSpaces);
    if (spaces.length === 0) {
      res.json([]);
      return;
    }

    const cats = await db
      .select({ spaceId: spaceAllowedCategory.spaceId, category: spaceAllowedCategory.category })
      .from(spaceAllowedCategory)
      .where(inArray(spaceAllowedCategory.spaceId, spaces.map((s) => s.id)));

    const catMap = new Map<number, string[]>();
    for (const c of cats) {
      const arr = catMap.get(c.spaceId) ?? [];
      arr.push(c.category);
      catMap.set(c.spaceId, arr);
    }

    res.json(
      spaces.map((s) => ({
        id: s.id,
        label: s.label,
        vehicle_type: s.vehicleType,
        is_active: s.isActive,
        allowed_categories: catMap.get(s.id) ?? [],
        created_at: s.createdAt,
        updated_at: s.updatedAt,
      })),
    );
  } catch (err) {
    next(err);
  }
});

adminRouter.post(
  '/spaces',
  validate({
    body: z.object({
      label: z.string().min(1),
      vehicle_type: vehicleTypeEnum,
      allowed_categories: z.array(categoryEnum).min(1),
    }),
  }),
  async (req, res, next) => {
    try {
      const body = req.body as { label: string; vehicle_type: 'auto' | 'moto' | 'camioneta'; allowed_categories: Array<'ejecutivo' | 'operativo' | 'visitante_frecuente'> };

      const space = await db.transaction(async (tx) => {
        const [s] = await tx.insert(parkingSpaces).values({ label: body.label, vehicleType: body.vehicle_type, isActive: true }).returning({ id: parkingSpaces.id });
        await tx.insert(spaceAllowedCategory).values(body.allowed_categories.map((c) => ({ spaceId: s.id, category: c })));
        return s;
      });

      res.status(201).json({ id: space.id, label: body.label, vehicle_type: body.vehicle_type, is_active: true, allowed_categories: body.allowed_categories });
    } catch (err) {
      next(err);
    }
  },
);

adminRouter.patch(
  '/spaces/:id',
  validate({
    params: idParam,
    body: z.object({
      label: z.string().min(1).optional(),
      vehicle_type: vehicleTypeEnum.optional(),
      allowed_categories: z.array(categoryEnum).min(1).optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const spaceId = Number((req.params as { id: string }).id);
      const body = req.body as { label?: string; vehicle_type?: 'auto' | 'moto' | 'camioneta'; allowed_categories?: Array<'ejecutivo' | 'operativo' | 'visitante_frecuente'> };

      const [existing] = await db.select({ id: parkingSpaces.id }).from(parkingSpaces).where(eq(parkingSpaces.id, spaceId)).limit(1);
      if (!existing) return next(notFound());

      await db.transaction(async (tx) => {
        if (body.label || body.vehicle_type) {
          const upd: Record<string, unknown> = { updatedAt: new Date() };
          if (body.label) upd.label = body.label;
          if (body.vehicle_type) upd.vehicleType = body.vehicle_type;
          await tx.update(parkingSpaces).set(upd).where(eq(parkingSpaces.id, spaceId));
        }
        if (body.allowed_categories) {
          await tx.delete(spaceAllowedCategory).where(eq(spaceAllowedCategory.spaceId, spaceId));
          await tx.insert(spaceAllowedCategory).values(body.allowed_categories.map((c) => ({ spaceId, category: c })));
        }
      });

      const [updated] = await db.select().from(parkingSpaces).where(eq(parkingSpaces.id, spaceId)).limit(1);
      const cats = await db.select({ category: spaceAllowedCategory.category }).from(spaceAllowedCategory).where(eq(spaceAllowedCategory.spaceId, spaceId));

      res.json({ id: updated.id, label: updated.label, vehicle_type: updated.vehicleType, is_active: updated.isActive, allowed_categories: cats.map((c) => c.category), updated_at: updated.updatedAt });
    } catch (err) {
      next(err);
    }
  },
);

adminRouter.patch('/spaces/:id/deactivate', validate({ params: idParam }), async (req, res, next) => {
  try {
    const spaceId = Number((req.params as { id: string }).id);
    const [existing] = await db.select({ id: parkingSpaces.id }).from(parkingSpaces).where(eq(parkingSpaces.id, spaceId)).limit(1);
    if (!existing) return next(notFound());
    await db.update(parkingSpaces).set({ isActive: false, updatedAt: new Date() }).where(eq(parkingSpaces.id, spaceId));
    res.json({ id: spaceId, is_active: false });
  } catch (err) {
    next(err);
  }
});

adminRouter.patch('/spaces/:id/activate', validate({ params: idParam }), async (req, res, next) => {
  try {
    const spaceId = Number((req.params as { id: string }).id);
    const [existing] = await db.select({ id: parkingSpaces.id }).from(parkingSpaces).where(eq(parkingSpaces.id, spaceId)).limit(1);
    if (!existing) return next(notFound());
    await db.update(parkingSpaces).set({ isActive: true, updatedAt: new Date() }).where(eq(parkingSpaces.id, spaceId));
    res.json({ id: spaceId, is_active: true });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/spaces/:id/blackouts', validate({ params: idParam }), async (req, res, next) => {
  try {
    const spaceId = Number((req.params as { id: string }).id);
    const rows = await db.select().from(spaceBlackouts).where(eq(spaceBlackouts.spaceId, spaceId)).orderBy(asc(spaceBlackouts.startDate));
    res.json(rows.map((r) => ({ id: r.id, space_id: r.spaceId, start_date: r.startDate, end_date: r.endDate, reason: r.reason, created_by: r.createdBy, created_at: r.createdAt })));
  } catch (err) {
    next(err);
  }
});

adminRouter.post(
  '/spaces/:id/blackouts',
  validate({
    params: idParam,
    body: z.object({ start_date: dateString, end_date: dateString, reason: z.string().optional() }),
  }),
  async (req, res, next) => {
    try {
      const spaceId = Number((req.params as { id: string }).id);
      const body = req.body as { start_date: string; end_date: string; reason?: string };

      if (body.end_date < body.start_date) return next(badRequest('end_date debe ser mayor o igual a start_date'));

      const [existing] = await db.select({ id: parkingSpaces.id }).from(parkingSpaces).where(eq(parkingSpaces.id, spaceId)).limit(1);
      if (!existing) return next(notFound());

      const [blackout] = await db
        .insert(spaceBlackouts)
        .values({ spaceId, startDate: body.start_date, endDate: body.end_date, reason: body.reason, createdBy: req.user!.id })
        .returning();

      res.status(201).json({ id: blackout.id, space_id: blackout.spaceId, start_date: blackout.startDate, end_date: blackout.endDate, reason: blackout.reason, created_by: blackout.createdBy, created_at: blackout.createdAt });
    } catch (err) {
      next(err);
    }
  },
);

adminRouter.delete('/blackouts/:id', validate({ params: idParam }), async (req, res, next) => {
  try {
    const blackoutId = Number((req.params as { id: string }).id);
    const [existing] = await db.select({ id: spaceBlackouts.id }).from(spaceBlackouts).where(eq(spaceBlackouts.id, blackoutId)).limit(1);
    if (!existing) return next(notFound());
    await db.delete(spaceBlackouts).where(eq(spaceBlackouts.id, blackoutId));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// --- Dashboard (UC7) ---
adminRouter.get('/dashboard/occupancy', async (_req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const totals = await db
      .select({ vehicleType: parkingSpaces.vehicleType, count: sql<number>`count(*)::int` })
      .from(parkingSpaces)
      .where(eq(parkingSpaces.isActive, true))
      .groupBy(parkingSpaces.vehicleType);

    const active = await db
      .select({ vehicleType: parkingSpaces.vehicleType, status: reservations.status, count: sql<number>`count(*)::int` })
      .from(reservations)
      .innerJoin(parkingSpaces, eq(parkingSpaces.id, reservations.spaceId))
      .where(and(eq(reservations.reservationDate, today), inArray(reservations.status, ['reservada', 'ocupada'])))
      .groupBy(parkingSpaces.vehicleType, reservations.status);

    const result: Array<{ vehicle_type: string; estado: string; count: number }> = [];
    for (const t of totals) {
      const reservado = active.find((a) => a.vehicleType === t.vehicleType && a.status === 'reservada')?.count ?? 0;
      const ocupado = active.find((a) => a.vehicleType === t.vehicleType && a.status === 'ocupada')?.count ?? 0;
      const disponible = t.count - reservado - ocupado;
      result.push({ vehicle_type: t.vehicleType, estado: 'Disponible', count: disponible });
      result.push({ vehicle_type: t.vehicleType, estado: 'Reservado', count: reservado });
      result.push({ vehicle_type: t.vehicleType, estado: 'Ocupado', count: ocupado });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// --- Tariffs (UC8, append-only) ---
adminRouter.get('/tariffs', async (_req, res, next) => {
  try {
    const rows = await db.select().from(tariffs).orderBy(desc(tariffs.effectiveFrom));
    res.json(rows.map((r) => ({ id: r.id, vehicle_type: r.vehicleType, price: r.price, currency: r.currency, effective_from: r.effectiveFrom, created_by: r.createdBy, created_at: r.createdAt })));
  } catch (err) {
    next(err);
  }
});

adminRouter.post(
  '/tariffs',
  validate({
    body: z.object({
      vehicle_type: vehicleTypeEnum,
      price: z.number().positive(),
      currency: z.string().length(3).default('GTQ'),
    }),
  }),
  async (req, res, next) => {
    try {
      const body = req.body as { vehicle_type: 'auto' | 'moto' | 'camioneta'; price: number; currency: string };
      const [row] = await db
        .insert(tariffs)
        .values({ vehicleType: body.vehicle_type, price: body.price.toString(), currency: body.currency ?? 'GTQ', createdBy: req.user!.id })
        .returning();
      res.status(201).json({ id: row.id, vehicle_type: row.vehicleType, price: row.price, currency: row.currency, effective_from: row.effectiveFrom, created_by: row.createdBy, created_at: row.createdAt });
    } catch (err) {
      next(err);
    }
  },
);

// --- Reservations history / attendance (Fn3, Pantalla 7) — immutable ---

// Export must be before /:id-style routes to avoid Express routing conflicts
adminRouter.get('/reservations/export', async (req, res, next) => {
  try {
    const q = req.query as { user_id?: string; from?: string; to?: string; status?: string };
    const conditions = [];
    if (q.user_id) conditions.push(eq(reservations.userId, Number(q.user_id)));
    if (q.from) conditions.push(gte(reservations.reservationDate, q.from));
    if (q.to) conditions.push(lte(reservations.reservationDate, q.to));
    if (q.status) conditions.push(eq(reservations.status, q.status as 'reservada' | 'ocupada' | 'liberada' | 'cancelada' | 'expirada'));

    const rows = await db
      .select({
        id: reservations.id,
        userEmail: users.email,
        spaceLabel: parkingSpaces.label,
        vehicleType: parkingSpaces.vehicleType,
        reservationDate: reservations.reservationDate,
        status: reservations.status,
        isLateCancellation: reservations.isLateCancellation,
      })
      .from(reservations)
      .innerJoin(users, eq(users.id, reservations.userId))
      .innerJoin(parkingSpaces, eq(parkingSpaces.id, reservations.spaceId))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(reservations.reservationDate));

    const header = 'id,user_email,space_label,reservation_date,status,vehicle_type,is_late_cancellation';
    const csvRows = rows.map((r) => [r.id, r.userEmail, r.spaceLabel, r.reservationDate, r.status, r.vehicleType, r.isLateCancellation].join(','));

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="reservations.csv"');
    res.send([header, ...csvRows].join('\n'));
  } catch (err) {
    next(err);
  }
});

adminRouter.get(
  '/reservations',
  validate({
    query: z.object({
      user_id: z.coerce.number().int().positive().optional(),
      from: dateString.optional(),
      to: dateString.optional(),
      status: z.enum(['reservada', 'ocupada', 'liberada', 'cancelada', 'expirada']).optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const q = req.query as { user_id?: number; from?: string; to?: string; status?: string };
      const conditions = [];
      if (q.user_id) conditions.push(eq(reservations.userId, q.user_id));
      if (q.from) conditions.push(gte(reservations.reservationDate, q.from));
      if (q.to) conditions.push(lte(reservations.reservationDate, q.to));
      if (q.status) conditions.push(eq(reservations.status, q.status as 'reservada' | 'ocupada' | 'liberada' | 'cancelada' | 'expirada'));

      const rows = await db
        .select({
          id: reservations.id,
          reservationDate: reservations.reservationDate,
          status: reservations.status,
          createdAt: reservations.createdAt,
          confirmedAt: reservations.confirmedAt,
          releasedAt: reservations.releasedAt,
          cancelledAt: reservations.cancelledAt,
          isLateCancellation: reservations.isLateCancellation,
          user: { id: users.id, email: users.email, fullName: users.fullName },
          space: { id: parkingSpaces.id, label: parkingSpaces.label, vehicleType: parkingSpaces.vehicleType },
        })
        .from(reservations)
        .innerJoin(users, eq(users.id, reservations.userId))
        .innerJoin(parkingSpaces, eq(parkingSpaces.id, reservations.spaceId))
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(reservations.reservationDate));

      res.json(rows);
    } catch (err) {
      next(err);
    }
  },
);

// --- Settings (Fn5 policy) ---
adminRouter.get('/settings', async (_req, res, next) => {
  try {
    const rows = await db.select().from(settings);
    res.json(rows.map((r) => ({ key: r.key, value: r.value, updated_at: r.updatedAt })));
  } catch (err) {
    next(err);
  }
});

adminRouter.put(
  '/settings/:key',
  validate({
    params: z.object({ key: z.string().min(1) }),
    body: z.object({ value: z.unknown() }),
  }),
  async (req, res, next) => {
    try {
      const key = (req.params as { key: string }).key;
      const value = (req.body as { value: unknown }).value;

      await db
        .insert(settings)
        .values({ key, value, updatedAt: new Date() })
        .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });

      res.json({ key, value });
    } catch (err) {
      next(err);
    }
  },
);
