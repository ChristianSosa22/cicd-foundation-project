// seed-test-data.ts — Inserts test user + approved vehicle for E2E demo.
// Runs via: npm run seed:test
// Requires: DATABASE_URL, ENCRYPTION_KEY, HMAC_KEY (injected by ECS task secrets).
// Idempotent: uses ON CONFLICT DO NOTHING on both inserts.

import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users, vehicles } from '../db/schema';
import { encrypt, plateHash } from '../lib/crypto';

async function main() {
  console.log('[seed:test] Starting test data seed...');

  // ── 1. Upsert user: pablo.siquinajay@galileo.edu ───────────────────────
  const EMAIL = 'pablo.siquinajay@galileo.edu';
  const PASSWORD = 'Pablo1234!';
  const FULL_NAME = 'Pablo Siquinajay';

  const existingUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, EMAIL))
    .limit(1);

  const existingUser = existingUsers[0];
  let userId: number;

  if (existingUser) {
    userId = existingUser.id;
    console.log(`[seed:test] User ${EMAIL} already exists (id=${userId}). Skipping insert.`);
  } else {
    const passwordHash = bcrypt.hashSync(PASSWORD, 12);
    const [newUser] = await db
      .insert(users)
      .values({
        email: EMAIL,
        passwordHash,
        fullName: FULL_NAME,
        systemRole: 'driver',
        category: 'operativo',
      })
      .returning({ id: users.id });

    userId = newUser.id;
    console.log(`[seed:test] Created user ${EMAIL} (id=${userId}, category=operativo).`);
  }

  // ── 2. Upsert vehicle: P123ABC (auto, approved) ────────────────────────
  const PLATE = 'P123ABC';
  const VEHICLE_TYPE = 'auto' as const;

  const existingVehicles = await db
    .select({ id: vehicles.id })
    .from(vehicles)
    .where(eq(vehicles.plateHash, plateHash(PLATE)))
    .limit(1);

  const existingVehicle = existingVehicles[0];

  if (existingVehicle) {
    console.log(`[seed:test] Vehicle plate ${PLATE} already exists (id=${existingVehicle.id}). Skipping insert.`);
  } else {
    const [newVehicle] = await db
      .insert(vehicles)
      .values({
        userId,
        plateEnc: encrypt(PLATE),
        plateHash: plateHash(PLATE),
        vehicleType: VEHICLE_TYPE,
        isApproved: true,
      })
      .returning({ id: vehicles.id });

    console.log(`[seed:test] Created vehicle ${PLATE} (id=${newVehicle.id}, type=${VEHICLE_TYPE}, approved=true).`);
  }

  // ── 3. Print summary ──────────────────────────────────────────────────
  const [user] = await db.select().from(users).where(eq(users.email, EMAIL)).limit(1);
  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.plateHash, plateHash(PLATE))).limit(1);

  console.log('');
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  SEED COMPLETED — Test Data Summary');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(`  User ID:    ${user?.id}`);
  console.log(`  Email:      ${EMAIL}`);
  console.log(`  Password:   ${PASSWORD}`);
  console.log(`  Category:   ${user?.category}`);
  console.log(`  Role:       ${user?.systemRole}`);
  console.log(`  Vehicle ID: ${vehicle?.id}`);
  console.log(`  Plate:      ${PLATE}`);
  console.log(`  Type:       ${vehicle?.vehicleType}`);
  console.log(`  Approved:   ${vehicle?.isApproved}`);
  console.log('══════════════════════════════════════════════════════════════');
  console.log('');

  await db.$client.end();
}

main().catch((err) => {
  console.error('[seed:test] Fatal error:', err);
  process.exit(1);
});
