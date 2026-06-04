-- Seed data for local development and testing.
-- Run: psql "postgres://postgres:postgres@localhost:5432/parking" -f backend/sql/seed.sql
-- Passwords (bcrypt cost 12):
--   admin@parking.test      → Admin1234!
--   driver.ejecutivo@...    → Driver1234!
--   driver.operativo@...    → Driver1234!
--   driver.visitante@...    → Driver1234!

BEGIN;

-- ── Users ─────────────────────────────────────────────────────────────────────
INSERT INTO users (email, password_hash, full_name, system_role, category) VALUES
  ('admin@parking.test',
   '$2a$12$toHaht3RdFxAB7NiMVejDO.Lv93l/Pr/UdrRKK3l/kOwDIdkWonXW',
   'Admin Sistema',
   'admin',
   NULL),
  ('driver.ejecutivo@parking.test',
   '$2a$12$3sL9eTTIuHR91B092btJ8uA3tLDw9.bbmppHw.7.wDJ03C1q55zn6',
   'Ana Ejecutivo',
   'driver',
   'ejecutivo'),
  ('driver.operativo@parking.test',
   '$2a$12$cmiSJQy2DUWhDUE64T49auLm9hiI2Owz/Xwk1/06lAJefMn1hEIFK',
   'Bruno Operativo',
   'driver',
   'operativo'),
  ('driver.visitante@parking.test',
   '$2a$12$kS5sJZt7DA0kyH8w757quetGdpZ7dg4DoiOYoO7ohGyVggrnMMSNG',
   'Carla Visitante',
   'driver',
   'visitante_frecuente');

-- ── Parking spaces ────────────────────────────────────────────────────────────
INSERT INTO parking_spaces (label, vehicle_type) VALUES
  ('E-001', 'auto'),
  ('E-002', 'auto'),
  ('E-003', 'auto'),
  ('E-004', 'moto'),
  ('E-005', 'moto'),
  ('E-006', 'camioneta'),
  ('E-007', 'camioneta');

-- ── Allowed categories per space (Fn2) ────────────────────────────────────────
-- E-001 (auto): ejecutivo + operativo
INSERT INTO space_allowed_category (space_id, category)
  SELECT id, 'ejecutivo'::collaborator_category  FROM parking_spaces WHERE label = 'E-001'
  UNION ALL
  SELECT id, 'operativo'::collaborator_category  FROM parking_spaces WHERE label = 'E-001';

-- E-002 (auto): ejecutivo only
INSERT INTO space_allowed_category (space_id, category)
  SELECT id, 'ejecutivo'::collaborator_category  FROM parking_spaces WHERE label = 'E-002';

-- E-003 (auto): all three
INSERT INTO space_allowed_category (space_id, category)
  SELECT id, 'ejecutivo'::collaborator_category           FROM parking_spaces WHERE label = 'E-003'
  UNION ALL
  SELECT id, 'operativo'::collaborator_category           FROM parking_spaces WHERE label = 'E-003'
  UNION ALL
  SELECT id, 'visitante_frecuente'::collaborator_category FROM parking_spaces WHERE label = 'E-003';

-- E-004 (moto): operativo + visitante_frecuente
INSERT INTO space_allowed_category (space_id, category)
  SELECT id, 'operativo'::collaborator_category           FROM parking_spaces WHERE label = 'E-004'
  UNION ALL
  SELECT id, 'visitante_frecuente'::collaborator_category FROM parking_spaces WHERE label = 'E-004';

-- E-005 (moto): all three
INSERT INTO space_allowed_category (space_id, category)
  SELECT id, 'ejecutivo'::collaborator_category           FROM parking_spaces WHERE label = 'E-005'
  UNION ALL
  SELECT id, 'operativo'::collaborator_category           FROM parking_spaces WHERE label = 'E-005'
  UNION ALL
  SELECT id, 'visitante_frecuente'::collaborator_category FROM parking_spaces WHERE label = 'E-005';

-- E-006 (camioneta): ejecutivo only
INSERT INTO space_allowed_category (space_id, category)
  SELECT id, 'ejecutivo'::collaborator_category FROM parking_spaces WHERE label = 'E-006';

-- E-007 (camioneta): ejecutivo + operativo
INSERT INTO space_allowed_category (space_id, category)
  SELECT id, 'ejecutivo'::collaborator_category FROM parking_spaces WHERE label = 'E-007'
  UNION ALL
  SELECT id, 'operativo'::collaborator_category FROM parking_spaces WHERE label = 'E-007';

-- ── Tariffs (append-only; created_by = admin user) ────────────────────────────
INSERT INTO tariffs (vehicle_type, price, currency, created_by)
  SELECT v.vehicle_type::vehicle_type, v.price, 'GTQ', u.id
  FROM (VALUES
    ('auto',      15.00::numeric),
    ('moto',       8.00::numeric),
    ('camioneta', 20.00::numeric)
  ) AS v(vehicle_type, price)
  CROSS JOIN (SELECT id FROM users WHERE email = 'admin@parking.test') AS u;

-- ── Settings (Fn5 policy defaults) ────────────────────────────────────────────
INSERT INTO settings (key, value) VALUES
  ('cancellation_window_hours',    '24'),
  ('max_late_cancellations_month', '3');

COMMIT;
