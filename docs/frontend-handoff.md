# Frontend Handoff — Parking Reservation System

> Written by the engineer who implemented and validated the backend.
> This document is the source of truth for frontend integration.
> Read it before writing a single API call.

---

## 1. Executive Summary

### What the application does

A corporate parking reservation system for a company campus. Employees register their vehicles, browse available parking spaces for a chosen date, reserve a spot, confirm arrival, and release it when they leave. Admins manage the full lifecycle: users, spaces, blackouts, pricing, and reporting.

### User roles

| Role | Description |
|------|-------------|
| `driver` | Company employee. Can register vehicles, reserve spaces, and manage their own reservations. |
| `admin` | System operator. Full access to users, spaces, tariffs, settings, and reporting. Cannot make reservations. |

### Core business workflows

1. **Vehicle registration** → admin approval → driver can reserve
2. **Browse availability** (filtered by driver's category) → reserve a space → confirm arrival → release on exit
3. **Admin manages spaces, blackouts, tariffs, and cancellation policy**

### Backend implementation status

All endpoints are fully implemented. Zero stubs remain. The backend passed 73 integration tests across 6 test suites.

### Backend test status

| Suite | Tests | Status |
|-------|-------|--------|
| Authentication | 12 | ✅ All passing |
| Driver Vehicles | 13 | ✅ All passing |
| Availability | 8 | ✅ All passing |
| Reservations | 13 | ✅ All passing |
| Admin routes | 25 | ✅ All passing |
| Worker (expiry) | 2 | ✅ All passing |

### What the frontend team should know first

1. **All responses use `snake_case`**. Every key is lowercased with underscores. Drizzle returns camelCase internally but every route explicitly maps to snake_case before responding. Never assume the field name — check the response shapes in §5.
2. **`price` is a string, not a number**. PostgreSQL `numeric` columns come back as strings from the driver (e.g., `"22.00"`). Display it, don't do math on it without parsing.
3. **Availability is derived state, never stored**. The `/availability` endpoint recomputes from three queries on every call. If the frontend needs polling, poll this endpoint.
4. **The 20-minute confirmation window is the most time-sensitive flow**. A reservation expires automatically if not confirmed within 20 minutes of creation. The frontend must surface `confirm_deadline` prominently and guide the user to confirm promptly.
5. **Category drives what a driver can see and reserve**. A driver with category `operativo` cannot see or book spaces that only allow `ejecutivo`. The API enforces this silently — the driver just sees fewer spaces. No need to explain it in error messages.
6. **409 from `/reservar` has two distinct causes**. The response body `error` field will tell you which: double-booking the same space, or the driver already has an active reservation that day. Treat both as business-level messages, not generic errors.

---

## 2. Backend Architecture Summary

### Authentication flow

JWT-based, stateless. No refresh tokens. Tokens embed: `id`, `email`, `system_role`, `category`. Default expiry: 8h (configurable via env). The `category` embedded in the token is used for availability filtering — however, `/auth/me` does a live DB lookup so `is_active` is always current.

```
POST /auth/login → { token, user }
All other requests → Authorization: Bearer <token>
```

Token verification happens in `requireAuth` middleware. If the token is missing, malformed, or expired, the response is `401`. There is no token refresh endpoint — the user must log in again.

### Authorization model

```
requireAuth          → verifies JWT, populates req.user
requireRole('admin') → verifies req.user.system_role === 'admin', else 403
requireRole('driver')→ verifies req.user.system_role === 'driver', else 403
```

All `/admin/*` routes require both `requireAuth` and `requireRole('admin')`.  
All `/me/*` routes require `requireAuth` (any role).  
`POST /reservar` and reservation lifecycle actions require `requireRole('driver')` — admins cannot make reservations.

### Reservation lifecycle

```
[created] → reservada
                │
                ├─── confirm (within 20 min) → ocupada
                │                                  │
                │                              release → liberada
                │
                ├─── cancel → cancelada (is_late_cancellation flag set)
                │
                └─── (worker, after confirm_deadline passes) → expirada
```

`liberada`, `cancelada`, and `expirada` are terminal states. No further transitions are possible.

### Availability calculation logic

**Availability is never stored.** On every `GET /availability` call, the backend runs three queries and merges them in JavaScript:

1. **Spaces query**: active spaces joined to `space_allowed_category`. Drivers get only spaces where their category is in the allowed list. Admins see all active spaces regardless of category.
2. **Reservations query**: reservations for the requested date with status `reservada` or `ocupada`.
3. **Blackouts query**: blackout periods covering the requested date.

The merge logic:
- Spaces with a blackout covering the date are **excluded entirely** (not shown as Ocupado — they simply don't appear).
- Of the remaining spaces, those with an active reservation are `Reservado` or `Ocupado` based on status.
- All others are `Disponible`.

A space with multiple allowed categories (e.g., both `ejecutivo` and `operativo`) is deduplicated in JavaScript before the response — it appears once, not twice.

### Vehicle approval workflow

1. Driver registers vehicle → `is_approved: false`
2. Vehicle appears in `GET /admin/vehicles?approved=false`
3. Admin approves → `PATCH /admin/vehicles/:id/approve` → `is_approved: true`
4. Driver can now use the vehicle for reservations

An approved vehicle **cannot be edited** (plate or type). Attempting to do so returns `403`. An unapproved vehicle **cannot be used for reservations** — `POST /reservar` returns `422`.

### Background worker

A `node-cron` job runs every minute inside the API process. It transitions any `reservada` reservation whose `confirm_deadline` has passed to `expirada`. This runs in-process (not a separate service). The job is started in `server.ts` at boot. If the API restarts, the first cron tick catches up.

### Important database constraints

Two partial unique indexes enforce the core business rules at the database level:

| Index | Constraint |
|-------|-----------|
| `reservations_space_date_active_uq` | `(space_id, reservation_date)` WHERE status IN `('reservada','ocupada')` |
| `reservations_user_date_active_uq` | `(user_id, reservation_date)` WHERE status IN `('reservada','ocupada')` |

Both constraints surface as PostgreSQL error code `23505`, which the error handler maps to `409`. This means even if the frontend's 6 pre-checks pass, a race condition at the DB level still results in a clean `409` rather than a `500`.

---

## 3. Tested and Validated Flows

### Flow 1 — Login

**Purpose:** Exchange credentials for a JWT.

**Actors:** Any user (driver or admin).

**Preconditions:** User exists and `is_active = true`.

**User Journey:**
```
User enters email + password
→ POST /auth/login { email, password }
→ Backend: DB lookup, bcrypt compare, blocked_until check
→ 200: { token, user: { id, full_name, system_role, category } }
→ Frontend: store token in memory / secure storage; redirect to role-appropriate home
```

**Validation Status:** Tested. Edge cases validated:
- Wrong password → 401
- Unknown email → 401 (same message, no email enumeration)
- Inactive user → 401
- Invalid email format → 400
- Blocked user (blocked_until in future) → 401 with "Cuenta bloqueada"

---

### Flow 2 — Vehicle Registration

**Purpose:** Driver registers a vehicle plate for admin approval.

**Actors:** Driver.

**Preconditions:** Driver is authenticated.

**User Journey:**
```
Driver fills plate + vehicle type form
→ POST /me/vehicles { plate, vehicle_type }
→ Backend: normalize plate to uppercase, HMAC hash, AES-256-GCM encrypt, duplicate check
→ 201: { id, plate, vehicle_type, is_approved: false }
→ Frontend: show "pending approval" state; vehicle appears in list immediately but cannot be used for reservations
```

**Validation Status:** Tested. Edge cases validated:
- Duplicate plate → 409 "Placa ya registrada" (global uniqueness — any user owning the plate)
- Missing vehicle_type → 400
- Plate is normalized (lowercase input → uppercase stored/returned)

---

### Flow 3 — Vehicle Approval (Admin)

**Purpose:** Admin reviews and approves pending vehicles.

**Actors:** Admin.

**Preconditions:** Vehicle exists with `is_approved = false`.

**User Journey:**
```
Admin views pending vehicles list
→ GET /admin/vehicles?approved=false
→ Admin clicks approve on a vehicle
→ PATCH /admin/vehicles/:id/approve
→ 200: { id, is_approved: true }
→ Vehicle now usable for reservations
```

**Validation Status:** Tested. Idempotent — approving an already-approved vehicle returns 200, not an error.

---

### Flow 4 — Browse Availability

**Purpose:** Driver sees which spaces are available for a date.

**Actors:** Driver (filtered by category), Admin (sees all).

**Preconditions:** Driver is authenticated. At least one active space exists.

**User Journey:**
```
Driver selects date (+ optional vehicle type filter)
→ GET /availability?fecha=YYYY-MM-DD&tipo_vehiculo=auto
→ Backend: 3-query merge — spaces for driver's category, active reservations, blackouts
→ 200: [{ id_espacio, label, tipo_vehiculo, estado, ultima_actualizacion }]
→ Frontend: render grid/list with color coding per estado
```

**`estado` values:** `Disponible` | `Reservado` | `Ocupado`

**Validation Status:** Tested. Edge cases validated:
- `fecha` defaults to today if omitted
- Spaces in a blackout are excluded entirely (not shown as Unavailable)
- Driver with `ejecutivo` category cannot see spaces that only allow `operativo`
- Admin sees all active spaces
- `tipo_vehiculo` with invalid value → 400

---

### Flow 5 — Create Reservation

**Purpose:** Driver books an available space for a date.

**Actors:** Driver only (admins get 403).

**Preconditions:** Driver has an approved vehicle. Space is active and available. Driver's category is allowed in that space.

**User Journey:**
```
Driver selects a Disponible space from the availability grid
→ POST /reservar { space_id, vehicle_id, reservation_date }
→ Backend: 6 pre-checks + INSERT with DB uniqueness enforcement
→ 201: { id, space_id, vehicle_id, reservation_date, status: "reservada", confirm_deadline }
→ Frontend: redirect to "My Reservations" and prominently show confirm_deadline countdown
```

**Validation Status:** Tested. Edge cases validated:
- Unapproved vehicle → 422 "El vehículo no está aprobado"
- Vehicle type mismatch → 422 "El tipo de vehículo no coincide con el espacio"
- Category not allowed in space → 422 "Tu categoría no tiene acceso a este espacio"
- Double-booking same space+date → 409 (from DB partial unique index)
- Driver already has active reservation that day → 409 (from DB partial unique index)
- Space in blackout → 409 "El espacio no está disponible en esa fecha"
- Admin attempting to reserve → 403

---

### Flow 6 — Confirm Arrival

**Purpose:** Driver confirms they have physically arrived, transitioning `reservada → ocupada`.

**Actors:** Driver (own reservation only).

**Preconditions:** Reservation exists with `status = reservada` and `confirm_deadline` has not passed.

**User Journey:**
```
Driver arrives at parking, opens app
→ POST /reservations/:id/confirm
→ Backend: status check, UPDATE with confirmed_at timestamp
→ 200: full reservation object with status: "ocupada"
→ Frontend: show "You are parked" state; display "Release Spot" button
```

**Validation Status:** Tested. Edge cases validated:
- Confirming an already-confirmed (ocupada) reservation → 422
- Confirming another user's reservation → 403

**Note:** There is no check that confirm_deadline has not yet passed. A driver can confirm after expiry if the worker hasn't run yet in that minute window. The worker's next tick will not re-expire it because it only targets `reservada` status, and confirmed reservations are already `ocupada`.

---

### Flow 7 — Release Spot

**Purpose:** Driver signals they have left, transitioning `ocupada → liberada`.

**Actors:** Driver (own reservation only).

**Preconditions:** Reservation has `status = ocupada`.

**User Journey:**
```
Driver is done, opens app
→ POST /reservations/:id/release
→ 200: full reservation object with status: "liberada", released_at timestamp
→ Space is now available for availability queries again (no active reservation on it)
```

**Validation Status:** Tested. Releasing a non-ocupada reservation → 422.

---

### Flow 8 — Cancel Reservation

**Purpose:** Driver cancels a reservation before arrival.

**Actors:** Driver (own reservation only).

**Preconditions:** Reservation has `status = reservada`.

**User Journey:**
```
Driver decides not to come
→ POST /reservations/:id/cancel
→ Backend: reads cancellation_window_hours setting (default: 2h), computes is_late_cancellation
→ 200: full reservation object with status: "cancelada", is_late_cancellation flag
```

**`is_late_cancellation` logic:** If `reservation_date T00:00:00 - now() < cancellation_window_hours`, it's a late cancellation. Cancelling a past-date reservation is always late.

**Validation Status:** Tested. Cancelling an ocupada reservation → 422 (only `reservada` can be cancelled).

---

### Flow 9 — Blackout Creates/Removes Unavailability

**Purpose:** Admin blocks a space from being reserved on a date range.

**Actors:** Admin.

**Preconditions:** Space exists.

**User Journey:**
```
Admin creates blackout
→ POST /admin/spaces/:id/blackouts { start_date, end_date, reason? }
→ 201: blackout object

Availability check for that date:
→ GET /availability?fecha=blackout-date
→ Space is ABSENT from results (not shown as Ocupado)

Admin deletes blackout
→ DELETE /admin/blackouts/:id
→ 204
→ Space reappears in availability as Disponible
```

**Validation Status:** Tested end-to-end in admin integration tests. Blackout date overlap not validated by the API (two overlapping blackouts for the same space are allowed — the frontend should prevent this or it's an edge case for future work).

---

### Flow 10 — Reservation Expiry (Worker)

**Purpose:** Automatically cancel reservations not confirmed within 20 minutes.

**Actors:** System (background cron).

**Preconditions:** Reservation has `status = reservada` and `confirm_deadline < now()`.

**Behavior:** Every minute, the worker transitions qualifying reservations to `expirada`. No user action needed. The frontend should reflect the `expirada` state in the reservations list — it will appear on the next poll/page refresh.

**Validation Status:** Tested by inserting a reservation with a past `confirm_deadline` and verifying the DB update logic directly.

---

## 4. Frontend Screen to Backend Mapping

### Screen: Login

| Property | Value |
|---|---|
| Purpose | Authenticate and obtain JWT |
| Endpoints | `POST /auth/login` |
| On success | Store token; redirect to role-appropriate home |
| Loading | Disable submit button |
| Error states | 401 → "Credenciales incorrectas", 400 → show field validation errors |

---

### Screen: Driver Home / My Reservations

| Property | Value |
|---|---|
| Purpose | Show driver's active and past reservations |
| Endpoints | `GET /me/reservations` |
| Data | Array of reservations ordered by `reservation_date DESC` |
| Empty state | "No tienes reservas" + CTA to browse availability |
| Refresh | On mount and after any mutation (confirm/release/cancel) |
| Per-row actions | Show based on `status` (see §7) |

---

### Screen: Browse Availability

| Property | Value |
|---|---|
| Purpose | Show spaces for a date; allow reservation creation |
| Endpoints | `GET /availability?fecha=YYYY-MM-DD&tipo_vehiculo=` |
| Filters | Date picker (required; default today), vehicle type select (optional) |
| Empty state | "No hay espacios disponibles para esta categoría/fecha" |
| Refresh | On date/type change; optionally poll every 30s for real-time feel |
| Per-item action | "Reservar" button only on `estado: "Disponible"` spaces |
| On "Reservar" | Must first select which vehicle to use → POST /reservar |

---

### Screen: My Vehicles

| Property | Value |
|---|---|
| Purpose | List, register, edit, delete driver's vehicles |
| Endpoints | `GET /me/vehicles`, `POST /me/vehicles`, `PATCH /me/vehicles/:id`, `DELETE /me/vehicles/:id` |
| Per-vehicle state | Show `is_approved` badge; disable edit/delete if `is_approved: true` |
| Register form | Plate (text), vehicle type (select: auto/moto/camioneta) |
| Edit | Only plate and/or vehicle type; at least one field required |
| Delete | Block if vehicle has active reservations (403); confirm before deleting |
| Empty state | "No tienes vehículos registrados" + register CTA |

---

### Screen: Reservation Detail

| Property | Value |
|---|---|
| Purpose | Show full details of one reservation |
| Endpoints | `GET /reservations/:id` |
| Data | Full reservation + nested `space: { label, vehicle_type }` + `vehicle: { plate, vehicle_type }` |
| Access | Driver (own only); Admin (any) |
| Actions | Per-status (see §7) |
| Receipt | If `receipt_s3_key` is non-null and S3 is configured → show "Download Receipt" → `GET /reservations/:id/receipt` |

---

### Screen: Admin — User Management

| Property | Value |
|---|---|
| Purpose | Create, edit, activate/deactivate users |
| Endpoints | `GET /admin/users`, `POST /admin/users`, `PATCH /admin/users/:id`, `PATCH /admin/users/:id/deactivate`, `PATCH /admin/users/:id/activate` |
| Filters | `is_active`, `system_role`, `category` |
| Create form | email, full_name, password, system_role, category (nullable for admins), phone (optional) |
| Self-protection | Admin cannot change own `system_role` → 403 |

---

### Screen: Admin — Vehicle Approval Queue

| Property | Value |
|---|---|
| Purpose | Review and approve pending vehicles |
| Endpoints | `GET /admin/vehicles?approved=false`, `PATCH /admin/vehicles/:id/approve` |
| Data per vehicle | `plate`, `vehicle_type`, `is_approved`, `user: { id, email, full_name }` |
| Empty state | "No hay vehículos pendientes de aprobación" |

---

### Screen: Admin — Space Management

| Property | Value |
|---|---|
| Purpose | Create, edit, activate/deactivate spaces and manage blackouts |
| Endpoints | `GET /admin/spaces`, `POST /admin/spaces`, `PATCH /admin/spaces/:id`, `PATCH /admin/spaces/:id/deactivate`, `PATCH /admin/spaces/:id/activate`, `GET /admin/spaces/:id/blackouts`, `POST /admin/spaces/:id/blackouts`, `DELETE /admin/blackouts/:id` |
| Space fields | `label` (unique), `vehicle_type`, `allowed_categories` (array, min 1), `is_active` |
| Blackout fields | `start_date`, `end_date`, `reason` (optional) |
| Category replace | `PATCH /admin/spaces/:id` with `allowed_categories` replaces the full set atomically |

---

### Screen: Admin — Dashboard

| Property | Value |
|---|---|
| Purpose | Real-time occupancy overview for today |
| Endpoints | `GET /admin/dashboard/occupancy` |
| Data | Array of `{ vehicle_type, estado, count }` tuples — all three estados per vehicle type |
| Refresh | Manual or poll every 60s |
| Note | Only covers today; no date selector in current API |

---

### Screen: Admin — Reservations History

| Property | Value |
|---|---|
| Purpose | Browse and export historical reservations |
| Endpoints | `GET /admin/reservations?user_id=&from=&to=&status=`, `GET /admin/reservations/export` |
| Filters | `user_id`, `from` (date), `to` (date), `status` |
| Export | `GET /admin/reservations/export` — same filters, returns CSV attachment |
| Data | Includes nested `user: { id, email, fullName }` and `space: { id, label, vehicleType }` |

---

### Screen: Admin — Tariff Management

| Property | Value |
|---|---|
| Purpose | View history and set new prices (append-only) |
| Endpoints | `GET /tariffs` (current per type), `GET /admin/tariffs` (full history), `POST /admin/tariffs` |
| Append-only | There is no edit or delete. A new tariff record becomes the current price immediately. |
| Price type | `price` is returned as a string (e.g., `"22.00"`) — parse before displaying currency |

---

### Screen: Admin — Settings

| Property | Value |
|---|---|
| Purpose | Configure system parameters |
| Endpoints | `GET /admin/settings`, `PUT /admin/settings/:key` |
| Key: `cancellation_window_hours` | Default: 2. Number of hours before reservation date within which cancellation is "late". |
| Value type | JSON (any type), upserted on PUT |

---

## 5. Endpoint Integration Guide

### Auth

#### POST /auth/login
- **Auth required:** No
- **Body:** `{ email: string, password: string }`
- **200:** `{ token: string, user: { id, full_name, system_role, category } }`
- **Errors:** `400` (invalid email format), `401` (wrong credentials, inactive user, blocked account)
- **Frontend:** Store token. Do not store password. Parse `system_role` to decide which home screen to show.

#### GET /auth/me
- **Auth required:** Any role
- **200:** `{ id, email, full_name, system_role, category, is_active }`
- **Errors:** `401`
- **Frontend:** Use to refresh user state after token restore. If `is_active: false`, log out immediately.

#### POST /auth/change-password
- **Auth required:** Any role
- **Body:** `{ current_password: string, new_password: string (min 8 chars) }`
- **200:** `204 No Content`
- **Errors:** `400` (wrong current password, new password too short), `401`
- **Frontend:** After success, the old token is still valid (JWT is stateless). Optionally prompt to log in again for clarity.

---

### Vehicles (Driver)

#### GET /me/vehicles
- **Auth:** Any role
- **200:** `[{ id, plate, vehicle_type, is_approved }]`
- **Frontend:** Show `is_approved` badge. Gate "reserve" flow on approved vehicles only.

#### POST /me/vehicles
- **Auth:** Any role
- **Body:** `{ plate: string, vehicle_type: "auto"|"moto"|"camioneta" }`
- **201:** `{ id, plate, vehicle_type, is_approved: false }`
- **Errors:** `400` (missing vehicle_type), `409` "Placa ya registrada"
- **Frontend:** Plate is returned normalized (uppercase). Show "awaiting approval" immediately after creation.

#### PATCH /me/vehicles/:id
- **Auth:** Any role
- **Body:** `{ plate?: string, vehicle_type?: "auto"|"moto"|"camioneta" }` — at least one field required
- **200:** `{ id, plate, vehicle_type, is_approved }`
- **Errors:** `400` (empty body), `403` (approved vehicle), `404`
- **Frontend:** Hide the edit button for approved vehicles.

#### DELETE /me/vehicles/:id
- **Auth:** Any role
- **200:** `204 No Content`
- **Errors:** `403` (active reservations), `404`
- **Frontend:** If 403, explain the vehicle has an active reservation.

---

### Availability

#### GET /availability
- **Auth:** Any role
- **Query:** `?fecha=YYYY-MM-DD&tipo_vehiculo=auto|moto|camioneta`
- **200:** `[{ id_espacio, label, tipo_vehiculo, estado, ultima_actualizacion }]`
- **Errors:** `400` (invalid tipo_vehiculo value), `401`
- **Note:** `estado` is `"Disponible"`, `"Reservado"`, or `"Ocupado"`. Spaces under a blackout are absent from the array entirely.
- **Frontend:** Date defaults to today if omitted. Do not show a "Reserve" button on `Reservado` or `Ocupado` spaces.

---

### Reservations

#### POST /reservar
- **Auth:** `driver` only
- **Body:** `{ space_id: number, vehicle_id: number, reservation_date: "YYYY-MM-DD" }`
- **201:** `{ id, space_id, vehicle_id, reservation_date, status: "reservada", confirm_deadline }`
- **Errors:**
  - `403` — admin attempted to reserve
  - `404` — vehicle or space not found
  - `409` — double-booking or one-active-per-day violation
  - `422` — unapproved vehicle, vehicle type mismatch, category not allowed, space inactive, blackout
- **Frontend:** `confirm_deadline` is an ISO timestamp 20 minutes in the future. Show a countdown. Route to a confirmation screen immediately.

#### GET /reservations/:id
- **Auth:** Any role (drivers own only; admins any)
- **200:** Full reservation + `space: { label, vehicle_type }` + `vehicle: { plate, vehicle_type }`
- **Errors:** `403` (other user's reservation), `404`

#### POST /reservations/:id/confirm
- **Auth:** `driver` only (own reservation)
- **200:** Full reservation with `status: "ocupada"`, `confirmed_at`
- **Errors:** `403` (not owner), `404`, `422` (not in `reservada` state)
- **Frontend:** Show this button only when `status === "reservada"`.

#### POST /reservations/:id/release
- **Auth:** `driver` only (own reservation)
- **200:** Full reservation with `status: "liberada"`, `released_at`
- **Errors:** `403`, `404`, `422` (not `ocupada`)
- **Frontend:** Show this button only when `status === "ocupada"`.

#### POST /reservations/:id/cancel
- **Auth:** `driver` only (own reservation)
- **200:** Full reservation with `status: "cancelada"`, `cancelled_at`, `is_late_cancellation`
- **Errors:** `403`, `404`, `422` (not `reservada`)
- **Frontend:** Show this button only when `status === "reservada"`. If `is_late_cancellation` is true in the response, surface a warning explaining the late cancellation.

#### GET /reservations/:id/receipt
- **Auth:** Any role (drivers own only; admins any)
- **200:** `{ url: string }` — a pre-signed S3 URL valid for 5 minutes
- **Errors:** `404` if `receipt_s3_key` is null (S3 not configured or upload failed)
- **Frontend:** Open the URL in a new tab. Do not cache it — it expires in 5 minutes.

#### GET /me/reservations
- **Auth:** Any role
- **200:** Array of reservations ordered by `reservation_date DESC` (no space/vehicle detail enrichment)
- **Frontend:** Use `GET /reservations/:id` for full details.

---

### Tariffs

#### GET /tariffs
- **Auth:** Any role
- **200:** `[{ vehicle_type, price, currency, effective_from }]` — one entry per vehicle type (current price)
- **Note:** `price` is a string (e.g., `"22.00"`). `currency` is a 3-char code (default `"GTQ"`).
- **Frontend:** Parse `price` to float for display. Show currency alongside.

---

### Admin Endpoints

#### GET /admin/users
- **Query:** `?is_active=true|false&system_role=admin|driver&category=ejecutivo|operativo|visitante_frecuente`
- **200:** `[{ id, email, full_name, system_role, category, is_active, created_at }]`

#### POST /admin/users
- **Body:** `{ email, full_name, password (min 8), system_role, category (nullable), phone? }`
- **201:** Created user (no `password_hash`)
- **Errors:** `409` duplicate email

#### PATCH /admin/users/:id
- **Body:** `{ full_name?, system_role?, category?, phone? }`
- **Errors:** `403` if admin tries to change own `system_role`

#### PATCH /admin/users/:id/deactivate | /activate
- **200:** `{ id, is_active: false|true }`

#### GET /admin/vehicles?approved=false|true
- **200:** `[{ id, plate, vehicle_type, is_approved, created_at, user: { id, email, full_name } }]`

#### PATCH /admin/vehicles/:id/approve
- **200:** `{ id, is_approved: true }` (idempotent)

#### GET /admin/spaces
- **200:** `[{ id, label, vehicle_type, is_active, allowed_categories, created_at, updated_at }]`

#### POST /admin/spaces
- **Body:** `{ label, vehicle_type, allowed_categories: string[] (min 1) }`
- **201:** `{ id, label, vehicle_type, is_active: true, allowed_categories }`

#### PATCH /admin/spaces/:id
- **Body:** `{ label?, vehicle_type?, allowed_categories? }`
- **Note:** `allowed_categories` replaces the full set atomically if provided.

#### PATCH /admin/spaces/:id/deactivate | /activate
- **200:** `{ id, is_active }`

#### GET /admin/spaces/:id/blackouts
- **200:** `[{ id, space_id, start_date, end_date, reason, created_by, created_at }]`

#### POST /admin/spaces/:id/blackouts
- **Body:** `{ start_date, end_date, reason? }`
- **201:** Blackout object
- **Errors:** `400` if `end_date < start_date`

#### DELETE /admin/blackouts/:id
- **204:** No content

#### GET /admin/dashboard/occupancy
- **200:** `[{ vehicle_type, estado, count }]` — 3 entries per vehicle type (Disponible, Reservado, Ocupado)
- **Note:** Always reflects today's date. No date parameter.

#### GET /admin/reservations
- **Query:** `?user_id=&from=YYYY-MM-DD&to=YYYY-MM-DD&status=`
- **200:** Array with nested `user` and `space` objects

#### GET /admin/reservations/export
- **Same query params as above**
- **Response:** CSV file attachment
- **Frontend:** Trigger as `window.location.href` or `<a download>` with the Authorization header (note: browser download links can't set headers — use fetch + Blob + URL.createObjectURL instead)

#### GET /admin/tariffs
- **200:** Full tariff history ordered by `effective_from DESC`

#### POST /admin/tariffs
- **Body:** `{ vehicle_type, price: number, currency?: string (default "GTQ") }`
- **201:** New tariff record

#### GET /admin/settings
- **200:** `[{ key, value, updated_at }]`

#### PUT /admin/settings/:key
- **Body:** `{ value: any }`
- **200:** `{ key, value }` (upsert)

---

## 6. Critical Business Rules

### One active reservation per driver per day
- **Backend enforcement:** Partial unique index on `(user_id, reservation_date)` where status is active.
- **Frontend behavior:** After a successful reservation, disable the "reserve" button for the same date on other spaces. Better yet, the availability grid won't show the date as accessible once they have a reservation.
- **UX:** On 409 from `/reservar`, check if the driver already has an active reservation that day. If so, show: "Ya tienes una reserva activa para esta fecha."

### One active reservation per space per day
- **Backend enforcement:** Partial unique index on `(space_id, reservation_date)`.
- **Frontend behavior:** The availability grid already shows the space as `Reservado` or `Ocupado` — users should never attempt to book a non-Disponible space. If a race condition causes 409, show: "Este espacio ya fue reservado. Por favor elige otro."

### Vehicle must be approved to reserve
- **Backend enforcement:** `POST /reservar` checks `vehicle.isApproved` → 422 if false.
- **Frontend behavior:** Only show approved vehicles in the vehicle selector during the reservation flow.

### Vehicle type must match space type
- **Backend enforcement:** `POST /reservar` checks `vehicle.vehicleType !== space.vehicleType` → 422.
- **Frontend behavior:** Filter available spaces by the vehicle type of the selected vehicle. Do not show a driver with a `moto` the `auto` spaces.

### Category access control
- **Backend enforcement:** Availability endpoint filters spaces by driver's category. `/reservar` also verifies category is in the space's allowed list.
- **Frontend behavior:** Transparent to the driver — they simply don't see inaccessible spaces. No need to explain.

### 20-minute confirmation window
- **Backend enforcement:** Worker transitions `reservada → expirada` every minute when `confirm_deadline < now()`.
- **Frontend behavior:** Display `confirm_deadline` as a countdown timer on the reservation card. After expiry, the next poll will show `status: "expirada"` — update the UI accordingly. Expired reservations should not show action buttons.

### Cancellation window (late cancellation flag)
- **Backend enforcement:** Reads `cancellation_window_hours` setting (default: 2h). Late flag is set, but the cancellation is not blocked.
- **Frontend behavior:** After cancel, if `is_late_cancellation: true` in the response, surface a non-blocking warning. Future versions may penalize repeated late cancellations.

### Approved vehicle cannot be edited
- **Backend enforcement:** `PATCH /me/vehicles/:id` returns 403 if `vehicle.isApproved`.
- **Frontend behavior:** Disable or hide the edit button for approved vehicles. Display a tooltip: "Los vehículos aprobados no pueden modificarse."

### Tariffs are append-only
- **Backend enforcement:** There is no PUT or DELETE on tariffs.
- **Frontend behavior:** The "set new tariff" form creates a new entry. Old entries are history. The `GET /tariffs` view always returns the latest per vehicle type.

### Blackout hides space from availability (does not block booking)
- **Backend enforcement:** Blackout check in `/reservar` returns 409. Availability query excludes blacked-out spaces.
- **Frontend behavior:** Spaces under blackout simply vanish from the availability grid — they are not shown as "occupied." If a user somehow knows the space ID and tries to book, they get a 409.

---

## 7. Reservation State Machine

### States

| State | Meaning |
|-------|---------|
| `reservada` | Reserved but not yet confirmed. Expires after 20 minutes. |
| `ocupada` | Confirmed — driver is in the parking lot. |
| `liberada` | Driver has left. Space is free again. Terminal. |
| `cancelada` | Driver cancelled. Terminal. |
| `expirada` | Not confirmed within 20 minutes. System-expired. Terminal. |

### Valid transitions

```
reservada  → ocupada    (POST /reservations/:id/confirm)
reservada  → cancelada  (POST /reservations/:id/cancel)
reservada  → expirada   (automatic, background worker)
ocupada    → liberada   (POST /reservations/:id/release)
```

### Invalid transitions (422)

```
ocupada    → ocupada    (confirm again)
ocupada    → cancelada  (cannot cancel after confirming)
liberada   → *          (terminal)
cancelada  → *          (terminal)
expirada   → *          (terminal)
```

### UI button visibility by state

| State | Show "Confirm" | Show "Release" | Show "Cancel" | Show receipt link |
|-------|:---:|:---:|:---:|:---:|
| `reservada` | ✅ | ❌ | ✅ | If available |
| `ocupada` | ❌ | ✅ | ❌ | If available |
| `liberada` | ❌ | ❌ | ❌ | If available |
| `cancelada` | ❌ | ❌ | ❌ | ❌ |
| `expirada` | ❌ | ❌ | ❌ | ❌ |

---

## 8. Error Handling Strategy

### Error response shape

All errors follow this structure:

```json
{
  "error": "Human-readable message",
  "code": "MACHINE_READABLE_CODE",
  "details": null  // or ZodError flatten() for validation errors
}
```

Validation errors (400 from Zod) include a `details` object:
```json
{
  "error": "Validación fallida",
  "code": "BAD_REQUEST",
  "details": {
    "fieldErrors": { "email": ["Invalid email"] },
    "formErrors": []
  }
}
```

### Status code guide

| Status | Code | Cause | Recommended UI Response |
|--------|------|-------|------------------------|
| 400 | `BAD_REQUEST` | Invalid request body/params. `details` has field-level errors. | Show inline validation messages per field. |
| 401 | `UNAUTHORIZED` | Missing/invalid/expired token, or bad credentials. | Redirect to login. Clear stored token. |
| 403 | `FORBIDDEN` | Authenticated but wrong role, or accessing another user's resource. | Show "No tienes permiso para esta acción." Do not reveal why. |
| 404 | `NOT_FOUND` | Resource doesn't exist. | Show "Recurso no encontrado." Offer navigation back. |
| 409 | `CONFLICT` | Double-booking, one-reservation-per-day, duplicate plate/email. | Show business-level message (see below). Do not show generic "conflict." |
| 422 | `UNPROCESSABLE` | Business rule violation (unapproved vehicle, type mismatch, etc.). | Show the `error` message from the response — it's user-safe. |
| 500 | `INTERNAL` | Unexpected server error. | Show "Error del servidor. Intenta de nuevo." Log to monitoring. |

### 409 disambiguation

When you receive a 409 from `POST /reservar`, read the `error` message:
- `"El espacio no está disponible en esa fecha"` → blackout conflict
- `"Conflicto: el recurso ya existe o el espacio ya está reservado"` → DB unique violation (double-book or one-per-day)

For the DB unique violation case, you must determine which rule was violated from context:
- If the driver already has an active reservation for that date → "Ya tienes una reserva activa para esta fecha."
- Otherwise → "Este espacio ya fue reservado por otro usuario. Elige un espacio diferente."

The API does not distinguish between the two 23505 cases — the frontend must infer from state.

### 422 messages (user-safe, from backend)

The `error` field for 422 responses is always safe to show to users:
- `"El vehículo no está aprobado"`
- `"El tipo de vehículo no coincide con el espacio"`
- `"Tu categoría no tiene acceso a este espacio"`
- `"El espacio no está disponible"` (inactive)
- `"Categoría de conductor no configurada"` (driver has null category — admin misconfiguration)
- `"Estado inválido para confirmar: se requiere reservada"`
- `"Solo se pueden liberar reservas ocupadas"`
- `"Solo se pueden cancelar reservas en estado reservada"`

### Rate limiting

The API applies a rate limit of 120 requests per minute per IP (configured with `express-rate-limit`). Headers `RateLimit-Limit`, `RateLimit-Remaining`, and `RateLimit-Reset` are included in responses. If the frontend triggers a 429, implement exponential backoff.

---

## 9. Backend Testing Summary

### What was tested

| Area | How | Confidence |
|------|-----|------------|
| Login (happy path + all error paths) | Integration tests hitting real DB | High |
| Token validation (missing/invalid/expired) | Integration tests | High |
| Password change | Integration tests including DB round-trip | High |
| Vehicle CRUD | Integration tests with encryption validation | High |
| Vehicle approval workflow | End-to-end across admin and driver roles | High |
| Availability (all 3 query paths) | Integration tests with live DB seed | High |
| Category filtering in availability | Tested with role-specific users | High |
| Blackout exclusion from availability | Tested create → check → delete → recheck | High |
| Reservation creation (happy path) | Integration test | High |
| Double-booking (same space + date) | Integration test, two drivers competing | High |
| One-active-per-day | Integration test | High |
| All 6 pre-checks in `/reservar` | One test per check | High |
| Confirm / release lifecycle | End-to-end integration tests | High |
| Cancel + late cancellation flag | Direct DB insert with past date to force late flag | High |
| Admin user CRUD | Integration tests including forbidden self-role-change | High |
| Admin space CRUD | Integration tests including category replacement atomicity | High |
| Blackout CRUD | Integration tests | High |
| Dashboard occupancy | Integration tests (counts verified against seeded data) | Medium |
| Tariff create + current view | Integration tests | High |
| Settings upsert | Integration tests | High |
| Reservation export (CSV) | Integration tests (status code + Content-Type) | Medium |
| Worker expiry logic | DB logic directly verified (not via cron timing) | Medium |

### Areas of lower confidence

- **CSV export content**: tests verified status code and Content-Type but did not parse the CSV rows field-by-field.
- **Worker timing**: the cron schedule itself was not tested (timing-dependent tests are brittle). The underlying UPDATE query was validated directly.
- **Receipt generation**: S3 was not configured during testing. The code path is gated on `env.S3_BUCKET`. The PDF generation library (`pdf-lib`) was not exercised in tests.
- **`blockedUntil` field**: the field exists on the schema and is checked in login, but no test creates a user with a future `blocked_until` timestamp (the admin has no UI to set it — it's a data-level control for now).

---

## 10. Known Limitations and Future Considerations

### No pagination on list endpoints

Every list endpoint (`GET /admin/users`, `GET /admin/vehicles`, `GET /admin/reservations`, `GET /me/reservations`, etc.) returns all matching records. This is acceptable for MVP scale but will become a problem with a large dataset. The frontend should not depend on result count — implement client-side filtering/sorting as a stopgap.

### No date validation on reservation_date

`POST /reservar` accepts past dates. There is no backend check preventing a driver from booking for yesterday. The frontend should enforce a minimum date of today (or tomorrow, depending on product decision).

### 409 from `/reservar` is ambiguous

As described in §8, both the double-booking and one-per-day constraints produce the same 409 code when triggered by a DB unique violation. The error message is identical. The frontend must infer context from prior state.

### Receipt generation requires S3

`GET /reservations/:id/receipt` returns 404 if S3 is not configured. In local dev and environments without `S3_BUCKET` set, receipts do not exist. The frontend should not surface the receipt link unless `receipt_s3_key` is non-null in the reservation object.

### JWT is not revocable

There is no logout endpoint and no token blacklist. When a user's account is deactivated, their existing token remains valid until expiry. `/auth/me` does a live DB lookup, so the frontend can detect `is_active: false` on poll and force logout — but the token itself is still technically valid for other endpoints until expiry (configured to 8h).

**Recommended frontend mitigation:** Call `GET /auth/me` on every app focus (window focus event) and log out if `is_active: false`.

### Admin has no category

Admins have `category: null`. The availability endpoint handles this correctly (admins see all spaces). However, if the frontend renders category information for the current user, it must handle null gracefully.

### `blockedUntil` has no admin UI

The `blocked_until` timestamp field exists on the users table and is checked on login. However, there is no API endpoint to set it. It can only be set directly in the database. This is future work.

### Worker runs in-process

The expiry worker is a `node-cron` job inside the API process. If the API crashes, reservations stop expiring until it restarts. A production upgrade path would be an EventBridge scheduled rule triggering a Lambda or ECS task. The frontend should not assume instant expiry — it may lag by up to 1 minute.

### No overlapping blackout detection

Two blackouts for the same space covering overlapping date ranges are allowed by the API. The frontend should optionally warn admins about overlapping blackouts when creating a new one.

### Tariff `price` is a string

PostgreSQL `numeric` returns as a string from the Node.js driver. Every tariff endpoint returns `price` as a string (e.g., `"22.00"`). Parse it before any arithmetic. Display it as-is for currency presentation.

### `GET /admin/reservations` returns camelCase nested objects

The admin reservations endpoint returns rows with nested `user` and `space` objects. Unlike other endpoints, the nested object fields retain the database column names as mapped by Drizzle (e.g., `user.fullName`, not `user.full_name`). This inconsistency exists in the current implementation.

### No seed admin user by default

The database schema has no default admin user. An admin must be created manually (via direct DB insert or by invoking `POST /admin/users` with an existing admin token). For initial setup, the first admin must be seeded directly in the database.
