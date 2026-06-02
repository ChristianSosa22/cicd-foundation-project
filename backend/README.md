# Backend — Sistema de Reserva de Parqueos

Express + TypeScript + Drizzle (PostgreSQL 16). Ships as a Docker container (ECS Fargate).

## Quick start
```bash
cp .env.example .env        # set DATABASE_URL + JWT_SECRET
npm install
psql "$DATABASE_URL" -f sql/schema.sql   # or: npm run db:generate && npm run db:migrate
npm run dev                 # http://localhost:8080/health
```

## Layout
- `src/db/schema.ts` — Drizzle schema (source of truth). `sql/schema.sql` — canonical DDL reference.
- `src/middleware/` — `auth` (JWT), `validate` (Zod), `errorHandler` (maps errors incl. pg `23505` → 409).
- `src/modules/<domain>/*.routes.ts` — route surface. Handlers are stubs (501) this increment.
- `src/lib/` — `crypto` (AES-GCM + HMAC), `s3` (presigned receipts), `receipts` (QR/PDF). Passwords hashed with `bcryptjs` (pure JS, no native build).
- `src/workers/releaseExpired.ts` — 20-min auto-release (node-cron; cloud upgrade → EventBridge/SQS).

See `docs/api-endpoints.md` for the full endpoint map.
