# API Endpoint Map — Sistema de Reserva de Parqueos

Maps every endpoint needed to exercise the data model (`infra/docs/data-model.md`) and cover the use
cases (UC1–UC8) and project functionalities (Fn1–Fn5). Stays consistent with the existing test
contract `tests/CU-02-consulta-disponibilidad.md`.

**Conventions.** JWT bearer auth on all routes except `POST /auth/login` and `GET /health`. Roles
(`driver` / `admin`) enforced in middleware. Errors: `400` validation · `401` missing/invalid token
(body `{ "error": "Token inválido o no proporcionado" }`) · `403` role/rule · `404` · `409` conflict
(double-booking / one-active-per-day, from the Postgres `23505` on the partial unique index) · `422`
business rule. Vehicle types: `auto` | `moto` | `camioneta`.

## Auth & profile (UC1)
| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/auth/login` | public | `{email,password}` → `{token, user:{id,full_name,system_role,category}}`; `401` bad creds |
| GET | `/auth/me` | any | Current user from JWT |
| POST | `/auth/change-password` | any | `{current_password,new_password}` |

## Driver vehicles / plates (Fn1; first-login, Pantalla 1)
| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/me/vehicles` | driver | Own vehicles (`plate` decrypted, `vehicle_type`, `is_approved`) |
| POST | `/me/vehicles` | driver | `{plate,vehicle_type}` → `is_approved=false` |
| PATCH | `/me/vehicles/:id` | driver | Edit own plate (pre-approval) |
| DELETE | `/me/vehicles/:id` | driver | Remove own plate |

## Availability (UC2 — `tests/CU-02`)
| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/availability?tipo_vehiculo=&fecha=` | any | Role/category-scoped derived state. Array of `{id_espacio, label, tipo_vehiculo, estado, ultima_actualizacion}`; `estado` ∈ `Disponible/Reservado/Ocupado`. Bad `tipo_vehiculo` → `400` |

## Reservations (UC3, Fn1, Fn4, Fn5)
| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/reservar` | driver | `{space_id,vehicle_id,reservation_date}`; `201`; `409` double-book / already-active; `403` category/approval/`blocked_until` |
| GET | `/me/reservations` | driver | Own active + history |
| GET | `/reservations/:id` | owner/admin | Detail incl. receipt pointer |
| POST | `/reservations/:id/confirm` | driver | "Ocupar Parqueo": `reservada → ocupada`, `confirmed_at` |
| POST | `/reservations/:id/release` | driver | Early release (Fn4): `ocupada → liberada`, `released_at` |
| POST | `/reservations/:id/cancel` | driver | `reservada → cancelada`; sets `is_late_cancellation` (Fn5) |
| GET | `/reservations/:id/receipt` | owner/admin | Presigned S3 URL to QR/PDF (UC3) |

## Admin — users (UC4) & vehicle approval (Fn1)
| Method | Path | Notes |
|---|---|---|
| GET | `/admin/users` | Filter by `is_active`, `system_role`, `category` |
| POST | `/admin/users` | `{email,full_name,password,system_role,category,phone}` |
| PATCH | `/admin/users/:id` | Edit role/category/name/phone (no self-role edit) |
| PATCH | `/admin/users/:id/deactivate` · `/activate` | Toggle access (keeps history) |
| GET | `/admin/vehicles?approved=false` | Pending plate approvals |
| PATCH | `/admin/vehicles/:id/approve` | Approve a plate |

## Admin — spaces & blackouts (UC5; CU-02-04)
| Method | Path | Notes |
|---|---|---|
| GET | `/admin/spaces` | Full inventory incl. inactive |
| POST | `/admin/spaces` | `{label,vehicle_type,allowed_categories[]}` |
| PATCH | `/admin/spaces/:id` | Edit label/type/allowed categories |
| PATCH | `/admin/spaces/:id/deactivate` · `/activate` | Toggle reservation visibility |
| GET · POST | `/admin/spaces/:id/blackouts` | List / create date-range disable |
| DELETE | `/admin/blackouts/:id` | Remove a blackout |

## Admin — dashboard, tariffs, history, settings (UC7, UC8, Fn3, Fn5)
| Method | Path | Notes |
|---|---|---|
| GET | `/admin/dashboard/occupancy` | Counts by `estado` × `vehicle_type` (FE polls ≤30s) |
| GET | `/tariffs` | Current price per type (view `current_tariffs`) |
| GET · POST | `/admin/tariffs` | History + append new price (append-only) |
| GET | `/admin/reservations?user_id=&from=&to=&status=` | Immutable attendance/history (Pantalla 7) |
| GET | `/admin/reservations/export` | CSV export (Fn3) |
| GET | `/admin/settings` · PUT `/admin/settings/:key` | `cancellation_window_hours`, `max_late_cancellations_month` |

## Ops & internal
| Method | Path | Notes |
|---|---|---|
| GET | `/health` | Liveness (no auth) |
| GET | `/ready` | DB-connectivity readiness |
| — | `releaseExpired` worker | Not HTTP. Scans `(status, confirm_deadline)`, `reservada → expirada` after 20 min (P1/UC6) |

## Open contract note
`tests/CU-02-02` uses `PATCH /spaces/:id` with `{estado}` to force a state change, but **availability
state is derived** (`data-model.md` §1, §7) — a space becomes `Ocupado` by confirming a reservation,
not by writing `estado`. Recommend updating that test step to drive state via the reservation flow
(or add an explicit admin/test-only override). To be confirmed before editing the test.
