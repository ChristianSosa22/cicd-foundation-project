# Estado actual del frontend — Sistema de Reserva de Parqueos

Fecha de implementación: 2026-06-01  
Stack: Next.js 15 (App Router) + Tailwind CSS + TypeScript  
Backend: Express + PostgreSQL (Drizzle ORM), corriendo en `http://localhost:8080`

---

## Resumen ejecutivo

El frontend fue transformado de un scaffold con contrato de API imaginado a una aplicación completamente funcional integrada con el backend real. Se corrigieron todos los nombres de campos, valores de estado y cuerpos de solicitud, y se construyeron 7 pantallas que faltaban por completo.

- **Rutas totales:** 19 archivos de página (17 rutas de navegación + raíz + login)
- **TypeScript:** 0 errores (`tsc --noEmit`)
- **Build de Next.js:** limpio, 19 rutas generadas
- **Verificación:** E2E con Playwright contra backend real en Docker

---

## Infraestructura base

### `frontend/lib/api.ts`
Capa tipada centralizada. Todas las páginas consumen esta capa; ninguna hardcodea paths ni nombres de campo.

**Correcciones críticas:**
- `apiFetch` maneja respuestas `204 No Content` (antes causaba crash por `res.json()`)
- `Content-Type: application/json` solo se pone cuando hay body (antes se mandaba siempre)
- Tipos en snake_case que coinciden con el backend. Excepción documentada: `GET /admin/reservations` devuelve camelCase anidado (quirk del ORM)

**Interfaces exportadas:**
| Interfaz | Uso |
|---|---|
| `SessionUser` | Usuario en sesión (id, email, full_name, system_role, category, is_active) |
| `Vehicle` | Vehículo del conductor (id, plate, vehicle_type, is_approved) |
| `AvailabilitySpace` | Espacio en grilla de disponibilidad (id_espacio, label, tipo_vehiculo, estado) |
| `Reservation` | Reserva completa con anidados opcionales space/vehicle |
| `MeReservation` | Reserva propia sin anidados (del endpoint /me/reservations) |
| `Tariff` | Tarifa con `price: string` (PostgreSQL numeric → string en Node.js) |
| `AdminTariff` | Tarifa de historial de admin con id, created_by, created_at |
| `AdminUser` | Usuario en panel admin |
| `AdminVehicle` | Vehículo con nested user (email, full_name) |
| `Space` | Espacio de parqueo con allowed_categories: string[] |
| `Blackout` | Bloqueo de espacio (start_date, end_date, reason) |
| `OccupancyRow` | Fila del dashboard de ocupación |
| `Setting` | Configuración del sistema (key, value, updated_at) |
| `AdminReservation` | Reserva en historial admin — camelCase anidado (quirk del ORM) |

**Helpers disponibles:**
- Auth: `login`, `getMe`, `changePassword`
- Vehículos driver: `getVehicles`, `createVehicle`, `updateVehicle`, `deleteVehicle`
- Disponibilidad: `getAvailability`
- Reservas driver: `createReservation`, `myReservations`, `getReservation`, `reservationAction`, `getReceiptUrl`
- Tarifas: `getTariffs`, `getAdminTariffs`, `createTariff`
- Admin usuarios: `getAdminUsers`, `createAdminUser`, `updateAdminUser`, `setUserActive`
- Admin vehículos: `getAdminVehicles`, `approveVehicle`
- Admin espacios: `getAdminSpaces`, `createSpace`, `updateSpace`, `setSpaceActive`, `getBlackouts`, `createBlackout`, `deleteBlackout`
- Admin dashboard: `getOccupancy`
- Admin reservas: `getAdminReservations`, `exportReservationsCsv`
- Admin settings: `getSettings`, `updateSetting`

**Nota sobre CSV export:** el browser no puede setear el header `Authorization` en un `<a download>`. Se resolvió con `fetch + Blob + URL.createObjectURL` + click programático.

---

### `frontend/lib/auth.tsx`
Contexto de sesión con persistencia en `localStorage`.

**Funcionalidades:**
- Restauración de sesión al montar (lee `localStorage`)
- Verificación con `GET /auth/me` al restaurar y al hacer `window focus`
- Auto-logout si el token expira (401) o si `is_active: false`
- Flag `loading: boolean` para que las guards no redirijan antes de hidratar
- `tokenRef` para acceso estable en callbacks sin recrearlos

---

### `frontend/components/RouteGuard.tsx` *(nuevo)*
Componente cliente que protege rutas según autenticación y rol.

- Muestra spinner mientras `loading = true`
- Redirige a `/login` si no hay token
- Redirige al home del rol correcto si el rol no coincide (driver → `/availability`, admin → `/dashboard`)
- Se usa dentro de ambos layouts (`(driver)` y `(admin)`)

---

### `frontend/lib/errors.ts` *(nuevo)*
Función `extractError(err, opts?)` que mapea errores de API a mensajes en español.

| Código | Mensaje |
|---|---|
| `UNAUTHORIZED` | "Sesión expirada. Por favor, inicia sesión nuevamente." |
| `FORBIDDEN` | Mensaje del backend o fallback genérico |
| `NOT_FOUND` | Mensaje del backend o fallback genérico |
| `CONFLICT` en `/reservar` con reserva activa | "Ya tienes una reserva activa para esta fecha." |
| `CONFLICT` en `/reservar` sin reserva activa | "Este espacio ya fue reservado por otro usuario. Elige un espacio diferente." |
| `UNPROCESSABLE` | Mensaje del backend (siempre seguro para mostrar) |
| `BAD_REQUEST` | Aplana `details.fieldErrors` en una sola línea |

---

## Pantallas implementadas

### Rol: Driver

#### `/login` — Login
- `POST /auth/login`
- Redirige a `/availability` (driver) o `/dashboard` (admin) según `system_role`
- Si ya hay sesión activa, redirige automáticamente

#### `/availability` — Disponibilidad de espacios *(corregido)*
- `GET /availability?fecha=...&tipo_vehiculo=...`
- Consume `id_espacio` y `label` (antes usaba `id` y `code` que no existen)
- Grilla de tarjetas con código de colores por estado (Disponible / Reservado / Ocupado)
- Poll automático cada 30 segundos
- Filtro por tipo de vehículo y por fecha (mínimo: hoy)
- Al hacer clic en un espacio disponible, navega a `/reserve?space=<id_espacio>&label=<label>&tipo=<tipo_vehiculo>`

#### `/reserve` — Reservar espacio *(corregido)*
- Elimina llamada inexistente `GET /spaces/:id`
- Lee label y tipo del espacio desde query params (pasados por `/availability`)
- Carga `GET /me/vehicles`, filtra a los aprobados cuyo `vehicle_type` coincide con el espacio
- Si no hay vehículos aprobados del tipo correcto, muestra guía con link a `/vehicles`
- `POST /reservar { space_id, vehicle_id, reservation_date }`
- En 409: llama a `/me/reservations` para distinguir "espacio tomado" de "ya tengo reserva ese día"
- Al éxito, redirige a `/reservations`

#### `/reservations` — Mis reservas *(reescrito)*
- `GET /me/reservations` devuelve solo IDs y estado
- Para reservas activas (`reservada`/`ocupada`), enriquece con `GET /reservations/:id` para obtener `space.label` y `vehicle.plate`
- Estados en minúscula: `reservada`, `ocupada`, `liberada`, `cancelada`, `expirada`
- **Botones por estado:**
  - `reservada` → Confirmar + Cancelar + cuenta regresiva live a `confirm_deadline`
  - `ocupada` → Liberar espacio
  - terminales → sin botones
- Banner de advertencia cuando `is_late_cancellation: true`
- Link "Ver detalle" en historial de reservas terminadas → `/receipt?id=<id>`
- Cuenta regresiva implementada con `useCountdown` hook (actualización cada 1 segundo)

#### `/receipt` — Detalle de reserva *(repropuesto)*
- Era un mock estático; ahora es pantalla de detalle real
- `GET /reservations/:id` con campos snake_case correctos
- Muestra `space.label`, `vehicle.plate`, fecha, estado
- Botones de acción según estado (Confirmar / Cancelar / Liberar)
- Link de comprobante S3 solo si `receipt_s3_key` no es null (en desarrollo local no está configurado S3)

#### `/vehicles` — Mis vehículos *(nuevo)*
- `GET /me/vehicles` con lista de vehículos del conductor
- Badge "Aprobado" / "Pendiente" por vehículo
- Formulario de registro inline (toggle)
- Edición inline deshabilitada cuando `is_approved: true` (backend devuelve 403; el frontend también bloquea el botón con indicador "Aprobado · no editable")
- Eliminación con diálogo de confirmación; 403 se muestra como "tiene reservas activas"
- Estado vacío con CTA para registrar primer vehículo

#### `/onboarding` — Onboarding *(fix menor)*
- Redirige a `/vehicles` tras crear vehículo (antes redirigía a `/availability`)

#### `/change-password` — Cambiar contraseña *(nuevo)*
- Colocado en `app/change-password/page.tsx` (sin grupo de layout) para evitar conflicto de URL entre `(driver)` y `(admin)`
- `POST /auth/change-password { current_password, new_password }`
- Validación client-side: confirmación de contraseña + mínimo 8 caracteres
- Banner de éxito explicando que el token actual sigue siendo válido
- Usa `<RouteGuard>` sin `requiredRole` (ambos roles pueden cambiar contraseña)

---

### Rol: Admin

#### `/dashboard` — Dashboard *(ya funcionaba, sin cambios)*
- `GET /admin/dashboard/occupancy`
- Tabla de ocupación por tipo de vehículo y estado

#### `/users` — Gestión de usuarios *(reemplazó Placeholder)*
- `GET /admin/users` con filtros por estado (activo/inactivo), rol y categoría
- Formulario de creación: email, nombre, contraseña (≥8), rol, categoría (null para admins), teléfono opcional
- Edición inline por fila (nombre, rol, categoría)
- Toggle Activar/Desactivar por usuario
- 403 al intentar cambiar propio rol → mensaje de `extractError`
- 409 en email duplicado → mensaje específico

#### `/spaces` — Parqueos + Bloqueos *(reemplazó Placeholder)*
- `GET /admin/spaces` — tarjetas con label, tipo, categorías permitidas, estado
- Edición inline: label, tipo de vehículo, categorías (checkboxes multi-select: ejecutivo / operativo / visitante_frecuente)
- Toggle Activar/Desactivar espacio
- Panel de bloqueos expandible por espacio
  - `GET /admin/spaces/:id/blackouts` — lista de bloqueos activos
  - `POST /admin/spaces/:id/blackouts { start_date, end_date, reason? }` — crear bloqueo
  - `DELETE /admin/blackouts/:id` — eliminar bloqueo
  - Validación client-side: `end_date >= start_date`

#### `/approvals` — Aprobación de vehículos *(nuevo)*
- URL `/approvals` (evita conflicto con `/vehicles` del driver)
- `GET /admin/vehicles?approved=false` — pendientes de aprobación
- Tabla: placa, tipo, propietario, correo, fecha de registro, botón Aprobar
- `PATCH /admin/vehicles/:id/approve`
- Sección colapsable "Ver vehículos aprobados"

#### `/tariffs` — Tarifas *(corregido)*
- `price` tratado como `string` (PostgreSQL numeric → string). Se muestra con `parseFloat(t.price).toFixed(2)`
- Columna `currency` agregada
- Tabla de tarifas actuales de `GET /tariffs`
- Tabla de historial de `GET /admin/tariffs`
- Formulario de nueva tarifa: `POST /admin/tariffs { vehicle_type, price: number, currency? }`

#### `/history` — Historial de reservas *(corregido)*
- Consume la forma camelCase anidada del ORM: `r.user.fullName`, `r.space.label`, `r.space.vehicleType`, `r.reservationDate`, `r.status`, `r.createdAt`
- Filtros: desde/hasta (fecha), estado (dropdown con los 5 estados), user_id (número)
- Export CSV: `GET /admin/reservations/export` con header `Authorization` (no se puede usar `<a download>` para headers autenticados)

#### `/settings` — Configuración del sistema *(nuevo)*
- `GET /admin/settings` — lista de todas las claves
- Control dedicado para `cancellation_window_hours`: input numérico con descripción del comportamiento
- Editor genérico para otras claves: input de texto con validación JSON parse
- `PUT /admin/settings/:key { value }` para guardar

---

## Navegación

### Header driver (`(driver)/layout.tsx`)
Disponibilidad | Mis Reservas | Mis Vehículos  
[nombre usuario] | Contraseña | Cerrar sesión

### Header admin (`(admin)/layout.tsx`)
Dashboard | Usuarios | Parqueos | Aprobaciones | Tarifas | Historial | Configuración  
[nombre usuario] | Contraseña | Cerrar sesión

Ambos layouts envuelven su contenido en `<RouteGuard requiredRole="driver|admin">`.

---

## Comportamientos de sesión

| Evento | Comportamiento |
|---|---|
| Login exitoso | Guarda token + user en `localStorage`, redirige por rol |
| Recarga de página | Restaura desde `localStorage`, verifica con `GET /auth/me` |
| Cambio de pestaña (window focus) | Re-verifica `GET /auth/me` |
| Usuario desactivado (is_active: false) | Auto-logout en cualquier verificación |
| Token expirado / 401 | Auto-logout y redirect a `/login` |
| Rol incorrecto en ruta protegida | Redirect al home del rol correcto |

---

## Reglas de negocio implementadas

| Regla | Dónde |
|---|---|
| Solo vehículos aprobados del tipo correcto pueden reservar un espacio | `/reserve` |
| 409 al reservar: distingue "espacio tomado" vs "ya tenés reserva ese día" | `/reserve` via `/me/reservations` |
| Confirmación requerida dentro de `confirm_deadline` (20 min por defecto) | `/reservations` |
| Cancelación tardía marcada si está dentro de `cancellation_window_hours` | `/reservations` + `/receipt` |
| Vehículos aprobados no se pueden editar | `/vehicles` (bloqueo UI + manejo 403) |
| Vehículos con reservas activas no se pueden eliminar | `/vehicles` (manejo 403) |
| Admin no puede cambiar su propio rol | `/users` (manejo 403) |
| Link de comprobante S3 solo cuando `receipt_s3_key` no es null | `/receipt` + `/reservations` |
| Fechas de bloqueo: `end_date >= start_date` | `/spaces` (validación client-side) |

---

## Cuentas de prueba (seed)

| Email | Contraseña | Rol | Categoría |
|---|---|---|---|
| admin@parking.test | Admin1234! | admin | — |
| driver.ejecutivo@parking.test | Driver1234! | driver | ejecutivo |
| driver.operativo@parking.test | Driver1234! | driver | operativo |
| driver.visitante@parking.test | Driver1234! | driver | visitante_frecuente |

Espacios seed: E-001 a E-007 (mix de auto/moto/camioneta con diferentes categorías permitidas).

---

## Cómo correr localmente

```bash
# 1. Levantar backend
docker compose up -d

# 2. Frontend
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

`.env.local` ya apunta a `http://localhost:8080`.

**Nota:** Los comprobantes de reserva requieren S3 configurado. En desarrollo local, el link de comprobante no aparece (esperado — `receipt_s3_key` es null).
