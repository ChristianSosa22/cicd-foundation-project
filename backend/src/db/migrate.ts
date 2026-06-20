import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});
const db = drizzle(pool);

migrate(db, { migrationsFolder: './drizzle/migrations' })
  .then(() => {
    console.log('Migrations applied successfully.');
    return pool.end();
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    pool.end().finally(() => process.exit(1));
  });
