import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '../config/env';
import * as schema from './schema';

// A single pooled connection per container instance. (RDS Proxy is an open
// infra question — data-model.md "Red"; for the MVP an in-container pool is fine.)
export const pool = new Pool({ connectionString: env.DATABASE_URL });

export const db = drizzle(pool, { schema });
export type DB = typeof db;
