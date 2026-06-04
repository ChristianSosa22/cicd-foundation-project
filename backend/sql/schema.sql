-- Canonical executable DDL for the Parking Reservation System.
-- Mirrors infra/docs/data-model.md (PostgreSQL 16). The Drizzle schema in
-- src/db/schema.ts is the programmatic source of truth; this file is the
-- human-readable reference and can be applied directly:  psql "$DATABASE_URL" -f sql/schema.sql

BEGIN;

-- 1. Enums (data-model.md §3)
CREATE TYPE system_role            AS ENUM ('admin', 'driver');
CREATE TYPE collaborator_category  AS ENUM ('ejecutivo', 'operativo', 'visitante_frecuente');
CREATE TYPE vehicle_type           AS ENUM ('auto', 'moto', 'camioneta');
CREATE TYPE reservation_status     AS ENUM ('reservada', 'ocupada', 'liberada', 'cancelada', 'expirada');

-- 2. Tables (data-model.md §4)

-- Colaboradores y administradores en una sola tabla, diferenciados por system_role.
CREATE TABLE users (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  full_name     text NOT NULL,
  phone_enc     bytea,                                  -- teléfono cifrado (AES-GCM)
  system_role   system_role NOT NULL,
  category      collaborator_category,                  -- NULL para admin; obligatorio para driver
  is_active     boolean NOT NULL DEFAULT true,
  blocked_until timestamptz,                            -- bloqueo temporal (Fn5)
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Vehículos del colaborador (1:N). Reservar exige una placa registrada y aprobada (Fn1).
CREATE TABLE vehicles (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      bigint NOT NULL REFERENCES users(id),
  plate_enc    bytea NOT NULL,                          -- placa cifrada (AES-GCM)
  plate_hash   text NOT NULL UNIQUE,                    -- HMAC: unicidad + búsqueda sin descifrar
  vehicle_type vehicle_type NOT NULL,
  is_approved  boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vehicles_user_id_idx ON vehicles (user_id);

-- Inventario de espacios (UC5).
CREATE TABLE parking_spaces (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  label        text NOT NULL UNIQUE,                    -- ej. E-007
  vehicle_type vehicle_type NOT NULL,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- M:N categorías permitidas por espacio (Fn2).
CREATE TABLE space_allowed_category (
  space_id bigint NOT NULL REFERENCES parking_spaces(id) ON DELETE CASCADE,
  category collaborator_category NOT NULL,
  PRIMARY KEY (space_id, category)
);

-- Inhabilitación de un espacio por rango de fechas (UC5).
CREATE TABLE space_blackouts (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  space_id   bigint NOT NULL REFERENCES parking_spaces(id),
  start_date date NOT NULL,
  end_date   date NOT NULL,
  reason     text,
  created_by bigint NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT space_blackouts_date_chk CHECK (end_date >= start_date)
);
CREATE INDEX space_blackouts_space_id_idx ON space_blackouts (space_id);

-- Núcleo del modelo: disponibilidad, atomicidad, liberación, asistencia, comprobante.
CREATE TABLE reservations (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id              bigint NOT NULL REFERENCES users(id),
  vehicle_id           bigint NOT NULL REFERENCES vehicles(id),
  space_id             bigint NOT NULL REFERENCES parking_spaces(id),
  reservation_date     date NOT NULL,
  status               reservation_status NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  confirm_deadline     timestamptz NOT NULL,            -- created_at + 20 min (worker P1)
  confirmed_at         timestamptz,                     -- "Ocupar Parqueo" (asistencia, Fn3)
  released_at          timestamptz,                     -- salida / liberación anticipada (Fn4)
  cancelled_at         timestamptz,
  is_late_cancellation boolean NOT NULL DEFAULT false,  -- Fn5
  receipt_s3_key       text,                            -- puntero al PDF/QR en S3 (UC3)
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- Atomicidad (data-model.md §5): índices únicos PARCIALES sobre el conjunto ACTIVO.
-- Dos INSERT concurrentes para el mismo espacio/día: solo uno gana; el otro recibe 23505 -> 409.
CREATE UNIQUE INDEX reservations_space_date_active_uq
  ON reservations (space_id, reservation_date)
  WHERE status IN ('reservada', 'ocupada');
-- Fn1: una sola reserva activa por colaborador y día.
CREATE UNIQUE INDEX reservations_user_date_active_uq
  ON reservations (user_id, reservation_date)
  WHERE status IN ('reservada', 'ocupada');
-- Índices de apoyo.
CREATE INDEX reservations_date_status_idx     ON reservations (reservation_date, status); -- GET /availability
CREATE INDEX reservations_status_deadline_idx ON reservations (status, confirm_deadline); -- worker P1
CREATE INDEX reservations_user_date_idx       ON reservations (user_id, reservation_date); -- asistencia / Fn5

-- Historial de precios append-only (UC8).
CREATE TABLE tariffs (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vehicle_type   vehicle_type NOT NULL,
  price          numeric(10,2) NOT NULL,
  currency       char(3) NOT NULL DEFAULT 'GTQ',
  effective_from timestamptz NOT NULL DEFAULT now(),
  created_by     bigint NOT NULL REFERENCES users(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tariffs_type_effective_idx ON tariffs (vehicle_type, effective_from);

-- Política configurable por el admin (Fn5).
CREATE TABLE settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Precio vigente por tipo de vehículo (data-model.md §7).
CREATE VIEW current_tariffs AS
SELECT DISTINCT ON (vehicle_type) vehicle_type, price, currency, effective_from
FROM tariffs
ORDER BY vehicle_type, effective_from DESC;

COMMIT;
