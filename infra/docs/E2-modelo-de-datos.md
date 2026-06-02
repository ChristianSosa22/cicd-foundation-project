# E2 — Modelo de Datos y Preguntas Abiertas

> Secciones para la Entrega 2. El detalle técnico completo (DDL conceptual, índices, ERD
> renderizable) vive en [`data-model.md`](./data-model.md); aquí se resume para el documento de E2.

---

## Modelo de datos

### Estructura de los datos del dominio

El dominio se modela como un esquema **relacional sobre PostgreSQL 16 (RDS)**, en modo
**single-company** (un despliegue = una empresa, sin tabla de tenants). Se eligió un modelo
relacional porque el negocio gira en torno a **invariantes transaccionales** (no permitir doble
reserva, una reserva activa por día) y a **integridad referencial** entre colaboradores, vehículos,
espacios y reservas — propiedades que una base relacional garantiza de forma nativa.

Entidades principales:

| Entidad | Rol en el dominio |
|---|---|
| `users` | Colaboradores y administradores en una sola tabla, diferenciados por `system_role`. |
| `vehicles` | Vehículos del colaborador (1:N). Reservar exige una placa **registrada y aprobada**. |
| `parking_spaces` | Inventario de espacios; cada uno con un tipo de vehículo admitido. |
| `space_allowed_category` | Relación **M:N** que define qué categorías de colaborador pueden usar cada espacio. |
| `space_blackouts` | Inhabilitación de un espacio por rango de fechas. |
| `reservations` | **Núcleo del modelo**: sostiene disponibilidad, atomicidad, liberación, asistencia y el comprobante. |
| `tariffs` | Historial de precios **append-only** (auditoría); el precio vigente es la fila más reciente por tipo. |
| `settings` | Política configurable por el admin (ventana de cancelación, máximo de cancelaciones tardías). |

Tres principios sostienen la coherencia del modelo:

1. **El estado del espacio (`Disponible/Reservado/Ocupado`) se *deriva*, no se almacena.** Se calcula
   por `(espacio, fecha)` a partir de la reserva activa. Una columna `estado` fija no puede expresar
   "ocupado hoy, libre mañana" y se desincronizaría con las reservas.
2. **Atomicidad por índice único parcial**, no por bloqueos de aplicación (ver patrón de acceso 2).
3. **Dos ejes de "rol" separados**: `system_role` (admin/driver, para permisos) y `category`
   (ejecutivo/operativo/visitante_frecuente, para el pool de espacios accesible). No se fusionan.

### Patrones de acceso principales

La estructura (tablas e índices) se diseñó **a partir de** los siguientes patrones de acceso, de
mayor a menor frecuencia esperada:

| # | Patrón de acceso | Tipo | Frecuencia | Estructura que lo soporta |
|---|---|---|---|---|
| 1 | **Consultar disponibilidad** (`GET /availability`), filtrada por tipo de vehículo y categoría del conductor | Lectura | Muy alta | `LEFT JOIN parking_spaces ↔ reservations` del día activo; índice `(reservation_date, status)`; exclusión de inactivos y `space_blackouts`. |
| 2 | **Crear reserva** (`POST /reservar`), atómica | Escritura (alta contención) | Alta | Índices **únicos parciales** `(space_id, reservation_date)` y `(user_id, reservation_date)` con `WHERE status IN ('reservada','ocupada')`. |
| 3 | **Confirmar llegada / liberar** (ocupar, salida, liberación anticipada) | Escritura | Media | `UPDATE reservations` de `status` + marcas de tiempo (`confirmed_at`, `released_at`). |
| 4 | **Liberación automática a los 20 min** (worker P1) | Lectura + escritura batch | Periódica | Índice `(status, confirm_deadline)` para escanear reservas por expirar. |
| 5 | **Historial de asistencia por colaborador** (export del admin) | Lectura | Baja | Índice `(user_id, reservation_date)`; campos `confirmed_at`/`released_at`. |
| 6 | **Conteo de cancelaciones tardías del mes** (penalización Fn5) | Lectura | Baja | `is_late_cancellation` + índice `(user_id, reservation_date)`. |
| 7 | **Precio vigente / historial de tarifas** | Lectura | Baja | `tariffs` append-only + vista `current_tariffs` (`DISTINCT ON (vehicle_type)`). |
| 8 | **Gestión (CRUD) de usuarios y espacios** | Escritura | Baja | Claves primarias e índices únicos (`email`, `label`, `plate_hash`). |

El patrón #1 es el más frecuente (la pantalla de disponibilidad se refresca cada ≤30 s) y por eso se
optimiza con un índice dedicado y un conjunto de datos pequeño (decenas de espacios). El patrón #2 es
el más crítico en correctitud: la **atomicidad la garantiza la base de datos**. Dos reservas
simultáneas para el mismo espacio/día ejecutan `INSERT` concurrentes; el índice único parcial deja
pasar solo uno y el otro recibe una violación de unicidad que el API traduce a `HTTP 409`. Es ACID,
sin bloqueo pesimista ni cola de mensajes — responde la pregunta de E1 sobre cómo se evita el
double-booking.

### Qué va en base de datos vs. almacenamiento de objetos

| Dato | Dónde | Justificación |
|---|---|---|
| Usuarios, vehículos, espacios, reservas, tarifas, settings | **PostgreSQL (RDS)** | Datos estructurados y relacionales, registros pequeños, requieren transacciones (reserva atómica), integridad referencial (FKs) y consultas indexadas (disponibilidad, historial). |
| **Comprobantes de reserva (QR en PDF/PNG)** | **S3 (object storage)** | Blobs binarios, **inmutables** (write-once), de tamaño medio, que se sirven por descarga/URL prefirmada. No requieren consultas relacionales; almacenarlos en BD inflaría el tamaño y degradaría backups. |
| Imágenes estáticas de referencia (entradas del parqueo) | **S3** | Contenido estático servido directamente; no es dato transaccional. |
| **Puntero al comprobante** (`reservations.receipt_s3_key`) | **PostgreSQL** | La BD guarda solo la **clave/URL** del objeto en S3, no el binario. Mantiene la fila ligera y enlaza el dato relacional con el objeto. |

Regla práctica aplicada: **lo consultable y transaccional → BD; lo binario, grande e inmutable →
S3, referenciado desde la BD por su clave**. Esto encaja con la regla de ciclo de vida ya definida en
el módulo de storage (`uploads/` → `STANDARD_IA` a los 30 días), coherente con comprobantes que se
escriben una vez y se leen con poca frecuencia.

### Decisión de caché

**Decisión para E2/MVP: no se introduce una capa de caché dedicada** (ej. Redis/ElastiCache). La
consulta de disponibilidad (patrón #1) opera sobre un conjunto pequeño (decenas de espacios) con un
índice apropiado, por lo que PostgreSQL cumple holgadamente los SLAs (`< 2 s` de respuesta, reflejo
del cambio en `≤ 30 s`) sin caché. Añadir una caché ahora introduciría un problema de **invalidación
y consistencia** (datos desactualizados) que contradice el requisito de tiempo real, a cambio de un
beneficio de rendimiento que aún no se necesita.

Se reconoce el requisito de reflejar cambios en `≤ 30 s`; se cubre sirviendo la consulta directa a la
BD. **Disparador para revisar la decisión:** si la concurrencia de lecturas crece hasta presionar la
instancia, las opciones son (a) caché de aplicación con TTL `≤ 30 s`, (b) ElastiCache/Redis con la
misma TTL, o (c) una vista materializada refrescada periódicamente. Cualquiera de las tres respeta el
límite de 30 s y se evalúa con datos de carga reales, no por anticipado.

---

## Preguntas abiertas

Conforme a la consigna, las preguntas de **red, asíncrono, seguridad y observabilidad** permanecen
abiertas para próximas entregas; se añaden algunas específicas del modelo de datos.

### Red
- ¿Se migra la BD del **VPC por defecto a una VPC dedicada** con subredes privadas, dejando RDS sin
  ruta a internet? (Hoy se usa el VPC por defecto por simplicidad.)
- Con cómputo en **ECS Fargate**, ¿basta el pool de conexiones persistente del contenedor o se
  necesita **RDS Proxy** para acotar conexiones contra `max_connections`?
- ¿Se requiere un **VPC endpoint para S3** para que la subida/descarga de comprobantes no salga a
  internet público?

### Asíncrono
- ¿Qué tecnología ejecuta la **liberación automática a los 20 min**: EventBridge + tarea programada,
  SQS con *delay*, un *poller* en Fargate o `pg_cron`? El índice `(status, confirm_deadline)` soporta
  cualquiera, pero la confiabilidad difiere.
- ¿Cómo se garantiza **idempotencia** si el worker se ejecuta dos veces sobre la misma reserva?
- ¿La generación del comprobante QR (UC3) y su envío por correo se hacen de forma síncrona en la
  reserva o se delegan a una cola para cumplir el SLA de `< 30 s`?

### Seguridad
- Cifrado a nivel de columna de `plate_enc`/`phone_enc`: ¿**AES-GCM en la aplicación con AWS Secrets
  Manager** o `pgcrypto` en la BD? ¿Cómo se hace la **rotación de llaves**?
- ¿Quién (qué rol IAM / servicio) puede **descifrar** datos sensibles, y se audita cada acceso?
- ¿La inmutabilidad del historial (Pantalla 7) se fuerza con **permisos/triggers** que impidan
  `UPDATE`/`DELETE` sobre `reservations`, o solo por convención de aplicación?

### Observabilidad
- ¿Qué métricas de BD se monitorean (conexiones activas, *locks*, *slow queries*, espacio en disco) y
  con qué umbrales de alarma?
- La **alarma de saturación** (disponibilidad = 0): ¿se calcula con una consulta a la BD o con una
  métrica emitida por el API? ¿Cada cuánto?
- ¿Cómo se observa la **contención del índice único** (rechazos `409` por double-booking) para
  distinguir comportamiento normal de un problema real?

### Específicas del modelo de datos
- ¿Mantener **enums** para `vehicle_type`/categorías o migrar a **tablas de catálogo** si el negocio
  necesita agregarlos sin desplegar cambios de esquema?
- Vocabulario de tipos: el documento dice "moto/carro" y las pruebas usan `auto/moto/camioneta`.
  ¿Cuál se estandariza?
- ¿Cuándo conviene **particionar `reservations` por fecha** al crecer el historial, y qué política de
  retención/archivado aplica?
- ¿La tabla `settings` (clave/valor) es suficiente para la política configurable o conviene
  promoverla a columnas tipadas cuando crezca?
