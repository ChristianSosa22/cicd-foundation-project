// Drizzle schema — programmatic source of truth for the data model.
// Mirrors infra/docs/data-model.md and backend/sql/schema.sql.
// `npm run db:generate` emits SQL migrations from this file.
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  char,
  check,
  customType,
  date,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  pgView,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// Postgres bytea (Drizzle has no first-class bytea builder).
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

// --- Enums (data-model.md §3) ---
export const systemRole = pgEnum('system_role', ['admin', 'driver']);
export const collaboratorCategory = pgEnum('collaborator_category', [
  'ejecutivo',
  'operativo',
  'visitante_frecuente',
]);
export const vehicleType = pgEnum('vehicle_type', ['auto', 'moto', 'camioneta']);
export const reservationStatus = pgEnum('reservation_status', [
  'reservada',
  'ocupada',
  'liberada',
  'cancelada',
  'expirada',
]);

// --- Tables (data-model.md §4) ---
export const users = pgTable('users', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  fullName: text('full_name').notNull(),
  phoneEnc: bytea('phone_enc'),
  systemRole: systemRole('system_role').notNull(),
  category: collaboratorCategory('category'),
  isActive: boolean('is_active').notNull().default(true),
  blockedUntil: timestamp('blocked_until', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const vehicles = pgTable(
  'vehicles',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id),
    plateEnc: bytea('plate_enc').notNull(),
    plateHash: text('plate_hash').notNull().unique(),
    vehicleType: vehicleType('vehicle_type').notNull(),
    isApproved: boolean('is_approved').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('vehicles_user_id_idx').on(t.userId),
  }),
);

export const parkingSpaces = pgTable('parking_spaces', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  label: text('label').notNull().unique(),
  vehicleType: vehicleType('vehicle_type').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const spaceAllowedCategory = pgTable(
  'space_allowed_category',
  {
    spaceId: bigint('space_id', { mode: 'number' })
      .notNull()
      .references(() => parkingSpaces.id, { onDelete: 'cascade' }),
    category: collaboratorCategory('category').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.spaceId, t.category] }),
  }),
);

export const spaceBlackouts = pgTable(
  'space_blackouts',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    spaceId: bigint('space_id', { mode: 'number' })
      .notNull()
      .references(() => parkingSpaces.id),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    reason: text('reason'),
    createdBy: bigint('created_by', { mode: 'number' })
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    dateChk: check('space_blackouts_date_chk', sql`${t.endDate} >= ${t.startDate}`),
    spaceIdx: index('space_blackouts_space_id_idx').on(t.spaceId),
  }),
);

export const reservations = pgTable(
  'reservations',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id),
    vehicleId: bigint('vehicle_id', { mode: 'number' })
      .notNull()
      .references(() => vehicles.id),
    spaceId: bigint('space_id', { mode: 'number' })
      .notNull()
      .references(() => parkingSpaces.id),
    reservationDate: date('reservation_date').notNull(),
    status: reservationStatus('status').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    confirmDeadline: timestamp('confirm_deadline', { withTimezone: true }).notNull(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    isLateCancellation: boolean('is_late_cancellation').notNull().default(false),
    receiptS3Key: text('receipt_s3_key'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // Atomicity (data-model.md §5): partial unique indexes over the ACTIVE set.
    noDoubleBooking: uniqueIndex('reservations_space_date_active_uq')
      .on(t.spaceId, t.reservationDate)
      .where(sql`status IN ('reservada', 'ocupada')`),
    oneActivePerUser: uniqueIndex('reservations_user_date_active_uq')
      .on(t.userId, t.reservationDate)
      .where(sql`status IN ('reservada', 'ocupada')`),
    availabilityIdx: index('reservations_date_status_idx').on(t.reservationDate, t.status),
    workerIdx: index('reservations_status_deadline_idx').on(t.status, t.confirmDeadline),
    attendanceIdx: index('reservations_user_date_idx').on(t.userId, t.reservationDate),
  }),
);

export const tariffs = pgTable(
  'tariffs',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    vehicleType: vehicleType('vehicle_type').notNull(),
    price: numeric('price', { precision: 10, scale: 2 }).notNull(),
    currency: char('currency', { length: 3 }).notNull().default('GTQ'),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull().defaultNow(),
    createdBy: bigint('created_by', { mode: 'number' })
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    typeEffectiveIdx: index('tariffs_type_effective_idx').on(t.vehicleType, t.effectiveFrom),
  }),
);

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Current price per vehicle type (data-model.md §7).
export const currentTariffs = pgView('current_tariffs', {
  vehicleType: vehicleType('vehicle_type'),
  price: numeric('price', { precision: 10, scale: 2 }),
  currency: char('currency', { length: 3 }),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }),
}).as(
  sql`SELECT DISTINCT ON (vehicle_type) vehicle_type, price, currency, effective_from FROM tariffs ORDER BY vehicle_type, effective_from DESC`,
);
