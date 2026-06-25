# Final Presentation — Candidate Application-Behavior Areas

**Fecha:** 2026-06-25
**Equipo:** Sistema de Reserva de Parqueos
**Propósito:** Listar áreas candidatas de cambio de comportamiento de la aplicación para Session 10 (Segment D).

> **Nota sobre las reglas:** Cada candidato es un **cambio de comportamiento observable en la respuesta de la API** (no cosmético, no configuración, no infraestructura), implementable de forma quirúrgica en 2–3 minutos, en **un solo archivo** y **sin cambios de esquema**. Todos despliegan por el pipeline CD y son observables por el ingress.
>
> Por consigna, **no se pre-escribe ni se pre-stagea el código** de ningún cambio: cada entrada describe *dónde* vive el handler, *qué tipo* de cambio sería observable y *cómo* se verificaría. La implementación exacta la define el instructor en clase.
>
> El backend se monta con prefijo `/api` (ver [app.ts](../../backend/src/app.ts)); las rutas de abajo se muestran con ese prefijo tal como las ve el cliente a través del ingress.

---

## Candidato 1 — Campo derivado de tiempo en el detalle de reserva

- **Title:** Campo computado en `GET /reservations/:id`.
- **Observable behavior:** Hoy el endpoint devuelve los campos crudos de la reserva (incluidos `status` y `confirm_deadline`) más datos de `space`/`vehicle`. No expone ningún valor **derivado del tiempo**. Un cambio observable sería agregar un campo calculado **en el servidor** a partir de columnas existentes — por ejemplo, segundos restantes hasta `confirm_deadline`, un booleano `is_expired`, o la antigüedad de la reserva. Como en este proyecto el `confirm_deadline` se fija a ~1 minuto, el valor cambia visiblemente entre llamadas.
- **Affected endpoint and handler:** `GET /api/reservations/:id` → `reservationsRouter.get('/:id', ...)` en [reservations.routes.ts](../../backend/src/modules/reservations/reservations.routes.ts).
- **Verification method:** `curl -H "Authorization: Bearer $TOKEN" $INGRESS/api/reservations/<id>` y observar el nuevo campo en el JSON; repetir la llamada un par de veces para ver cómo cambia su valor con el tiempo.
- **Rough scope:** Pocas líneas dentro de un solo handler (un cálculo a partir de `confirm_deadline`/`status` y un campo extra en `res.json(...)`). Sin esquema nuevo. Campo aditivo: no rompe clientes existentes.

---

## Candidato 2 — Filtro por query parameter en "Mis reservas"

- **Title:** Query parameter de filtrado en `GET /me/reservations`.
- **Observable behavior:** Hoy el endpoint devuelve **todas** las reservas del usuario autenticado, ordenadas por fecha descendente, **sin aceptar ningún parámetro de filtro**. Un cambio observable sería aceptar un query parameter (por ejemplo `status`, o un rango `from`/`to`) y limitar las filas devueltas a las que cumplen el filtro, ejerciendo realmente el `WHERE` contra la base de datos.
- **Affected endpoint and handler:** `GET /api/me/reservations` → `meRouter.get('/reservations', ...)` en [me.routes.ts](../../backend/src/modules/me/me.routes.ts).
- **Verification method:** Comparar `curl ".../api/me/reservations"` (sin filtro) contra `curl ".../api/me/reservations?status=cancelada"`; verificar que el conteo baja y que **todas** las filas devueltas cumplen el filtro.
- **Rough scope:** Un esquema `zod` de query + una condición `where` adicional en la consulta existente; pocas líneas, un solo archivo. (El módulo admin ya usa este patrón, así que el equipo tiene referencia cercana.)

---

## Candidato 3 — Validación de entrada que devuelve HTTP 400

- **Title:** Validación semántica en `POST /reservar`.
- **Observable behavior:** Hoy el endpoint valida que `reservation_date` tenga el **formato** `YYYY-MM-DD`, pero **acepta fechas en el pasado** y otros valores semánticamente inválidos. Un cambio observable sería rechazar una entrada inválida (p. ej. una fecha anterior a hoy) devolviendo **HTTP 400** con un cuerpo de error descriptivo, en lugar de crear la reserva.
- **Affected endpoint and handler:** `POST /api/reservar` → `reservarRouter.post('/', ...)` en [reservations.routes.ts](../../backend/src/modules/reservations/reservations.routes.ts).
- **Verification method:** `curl -X POST .../api/reservar` con un `reservation_date` en el pasado → esperar `HTTP 400` y un cuerpo JSON con mensaje descriptivo; una fecha futura válida debe seguir devolviendo `201`.
- **Rough scope:** Un guard que retorna `badRequest(...)` antes del `INSERT` (el helper `badRequest` y el middleware `validate` ya existen); pocas líneas, un solo archivo.

---

## Candidato 4 — Semántica de respuesta: límite/paginación en historial admin

- **Title:** Parámetro `limit` (o paginación / orden) en `GET /admin/reservations`.
- **Observable behavior:** Hoy el endpoint devuelve **todas** las filas que cumplen los filtros, ordenadas por `reservation_date` descendente, **sin cota de tamaño**. Un cambio observable sería agregar un query parameter `limit` (y opcionalmente `offset`, o un toggle de orden `asc`/`desc`) que cambie de forma significativa qué/ cuántos registros se devuelven.
- **Affected endpoint and handler:** `GET /api/admin/reservations` → `adminRouter.get('/reservations', ...)` en [admin.routes.ts](../../backend/src/modules/admin/admin.routes.ts).
- **Verification method:** `curl ".../api/admin/reservations?limit=5"` y verificar que se devuelven a lo sumo 5 filas; comparar con la respuesta sin `limit`. (Para orden: comparar el primer elemento con `?sort=asc` vs `?sort=desc`.)
- **Rough scope:** Agregar el parámetro al esquema `zod` de query y un `.limit()` (o cambio de `orderBy`) a la consulta existente; pocas líneas, un solo archivo.

---

## Candidato 5 — Nuevo endpoint de estado que verifica DB y almacenamiento

- **Title:** `GET /status` con chequeo de reachability de base de datos y bucket S3.
- **Observable behavior:** Hoy `GET /health` devuelve `{ status: "ok" }` sin verificar nada, y `GET /ready` solo verifica la base de datos (`SELECT 1`). **Nada comprueba el almacenamiento de objetos.** Un cambio observable sería un nuevo endpoint que verifique **ambos** (DB con `SELECT 1` y S3 con un `HeadBucket`) y devuelva una respuesta estructurada con el estado de cada dependencia y un código de estado acorde (`200` si todo sano, `503` si alguno falla).
- **Affected endpoint and handler:** Nuevo `GET /status` (o `/health/deep`) en [health.routes.ts](../../backend/src/modules/health/health.routes.ts), reutilizando `pool` ([db/index.ts](../../backend/src/db/index.ts)) y el cliente S3 ([lib/s3.ts](../../backend/src/lib/s3.ts)).
- **Verification method:** `curl $INGRESS/status` → JSON estructurado con campos como `{ db: "ok", storage: "ok", status: "ok" }`; observar el código `200`/`503` y los campos por dependencia.
- **Rough scope:** Una nueva función handler + una llamada `HeadBucket` al cliente S3 (quizás un pequeño helper en `lib/s3.ts`). Es el más grande de los cinco (~15–25 líneas), pero sigue siendo un solo feature aislado.

---

## Resumen

| # | Área | Categoría | Endpoint | Esfuerzo |
|---|---|---|---|---|
| 1 | Campo derivado de tiempo | Campo computado en GET | `GET /api/reservations/:id` | Pocas líneas |
| 2 | Filtro por query param | Query param que filtra | `GET /api/me/reservations` | Pocas líneas |
| 3 | Validación → 400 | Validación de entrada | `POST /api/reservar` | Pocas líneas |
| 4 | Límite/paginación | Semántica de respuesta | `GET /api/admin/reservations` | Pocas líneas |
| 5 | Endpoint de estado DB+S3 | Endpoint nuevo | `GET /status` (nuevo) | Función nueva |

