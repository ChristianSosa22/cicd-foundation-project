import type { Config } from 'drizzle-kit';

// drizzle-kit reads this directly (outside the tsc build). `db/schema.ts` is the
// source of truth; `npm run db:generate` emits SQL migrations to ./drizzle/migrations.
export default {
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
} satisfies Config;
