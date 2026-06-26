-- seed-if-empty.sql — First-time baseline seed guard.
-- Runs the baseline seed (sql/seed.sql) ONLY when the database has not been
-- seeded yet (no users present). This makes the seed safe to run on every
-- staging deploy: it populates a fresh DB exactly once and is a no-op
-- thereafter, so real data created after the first deploy is never overwritten
-- or resurrected.
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --no-psqlrc -f sql/seed-if-empty.sql
-- The \i path is relative to psql's working directory (backend root), matching
-- how db:seed already invokes -f sql/seed.sql.

SELECT (NOT EXISTS (SELECT 1 FROM users)) AS should_seed \gset
\if :should_seed
\echo 'Database is empty — running baseline seed...'
\i sql/seed.sql
\else
\echo 'Database already has users — skipping baseline seed.'
\endif
