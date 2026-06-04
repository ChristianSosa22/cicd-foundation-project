# Escenario de Pruebas — CU-02: Consulta de Disponibilidad en Tiempo Real

## Información general

| Campo | Valor |
|---|---|
| **ID del caso de prueba** | CU-02 |
| **Módulo** | Disponibilidad de espacios |
| **Endpoint bajo prueba** | `GET /availability` |
| **Tipo de prueba** | Funcional / API / Integración |
| **Prioridad** | Alta |
| **Autor** | Christian Sosa |
| **Fecha de creación** | 2026-05-20 |

---

## ES-CU02-01 — Consulta exitosa de disponibilidad con token válido

### Título descriptivo
Verificar que un usuario autenticado obtiene la lista completa de espacios con su estado actual al consultar `GET /availability`.

### Precondiciones
- El servicio de disponibilidad se encuentra desplegado y accesible en el entorno de pruebas.
- Existen al menos 5 espacios activos registrados en la base de datos con distintos estados (Disponible, Reservado, Ocupado).
- El usuario de prueba posee un token JWT válido y no expirado.
- La caché de disponibilidad se encuentra sincronizada con la base de datos.

### Pasos a ejecutar
1. Autenticarse contra `POST /auth/login` con las credenciales del usuario de prueba para obtener el token JWT.
2. Realizar una petición `GET /availability` incluyendo en la cabecera `Authorization: Bearer <token>`.
3. Capturar el código de respuesta HTTP, el cuerpo de la respuesta y los tiempos de respuesta.
4. Validar que cada elemento de la lista contenga los campos: `id_espacio`, `tipo_vehiculo`, `estado`, `ultima_actualizacion`.

### Resultados esperados
- HTTP `200 OK`.
- El cuerpo de la respuesta es un arreglo JSON con todos los espacios activos.
- Cada espacio incluye un campo `estado` con uno de los valores: `Disponible`, `Reservado`, `Ocupado`.
- El tiempo de respuesta es menor a 2 segundos.

### Acciones post-ejecución
- Cerrar sesión / invalidar el token utilizado.
- Limpiar logs locales generados por la herramienta de pruebas.

### Data
| Campo | Valor |
|---|---|
| Usuario | `qa_user_01@parking.test` |
| Contraseña | `Qa$2026!` |
| Endpoint | `https://api.qa.parking.test/availability` |

### Adjuntos
- `evidencias/ES-CU02-01_response.json`
- `evidencias/ES-CU02-01_postman_run.png`

### Estado de ejecución
`Pendiente`

---

## ES-CU02-02 — Reflejo en tiempo real de cambios (≤ 30 segundos)

### Título descriptivo
Verificar que un cambio de estado realizado sobre un espacio se refleja en `GET /availability` dentro de los 30 segundos siguientes, sin servir datos de caché desactualizados.

### Precondiciones
- Existe el espacio `E-007` en estado `Disponible`.
- Se cuenta con permisos para invocar el endpoint interno que modifica el estado (`PATCH /spaces/{id}`).
- El TTL de caché del endpoint está configurado en ≤ 30 segundos.

### Pasos a ejecutar
1. Consultar `GET /availability` y confirmar que `E-007` aparece como `Disponible`.
2. Ejecutar `PATCH /spaces/E-007` con `{ "estado": "Ocupado" }`.
3. Iniciar un cronómetro inmediatamente después de la respuesta `200` del PATCH.
4. Realizar consultas repetidas a `GET /availability` cada 5 segundos hasta detectar el cambio.
5. Registrar el tiempo transcurrido hasta que el endpoint refleje el nuevo estado.

### Resultados esperados
- El nuevo estado `Ocupado` para `E-007` aparece en la respuesta en un tiempo ≤ 30 segundos.
- Ninguna respuesta intermedia devuelve un estado contradictorio una vez confirmado el cambio.
- El campo `ultima_actualizacion` del espacio refleja la marca de tiempo del PATCH.

### Acciones post-ejecución
- Restaurar `E-007` a su estado original (`Disponible`) mediante `PATCH /spaces/E-007`.
- Documentar el tiempo medido en el reporte de ejecución.

### Data
| Campo | Valor |
|---|---|
| Espacio | `E-007` |
| Estado inicial | `Disponible` |
| Estado a aplicar | `Ocupado` |
| TTL caché esperado | ≤ 30 s |

### Adjuntos
- `evidencias/ES-CU02-02_timeline.csv`
- `evidencias/ES-CU02-02_logs_servicio.txt`

### Estado de ejecución
`Pendiente`

---

## ES-CU02-03 — Filtrado por tipo de vehículo

### Título descriptivo
Verificar que el parámetro `tipo_vehiculo` filtra correctamente la respuesta de `GET /availability`.

### Precondiciones
- Existen espacios registrados de tipo `auto`, `moto` y `camioneta`.
- El usuario cuenta con un token JWT válido.

### Pasos a ejecutar
1. Ejecutar `GET /availability?tipo_vehiculo=moto` con token válido.
2. Validar que el código de respuesta sea `200 OK`.
3. Recorrer el arreglo de la respuesta y verificar el campo `tipo_vehiculo` de cada elemento.
4. Repetir la prueba con los valores `auto` y `camioneta`.
5. Ejecutar la consulta con un valor no soportado (`tipo_vehiculo=barco`) y registrar la respuesta.

### Resultados esperados
- Todas las entradas devueltas tienen `tipo_vehiculo` igual al solicitado.
- No se devuelven espacios de un tipo distinto al filtrado.
- Con un valor inválido, el servicio responde `400 Bad Request` con un mensaje descriptivo.

### Acciones post-ejecución
- No requiere limpieza adicional.

### Data
| Filtro | Resultado esperado |
|---|---|
| `tipo_vehiculo=auto` | Solo autos |
| `tipo_vehiculo=moto` | Solo motos |
| `tipo_vehiculo=camioneta` | Solo camionetas |
| `tipo_vehiculo=barco` | HTTP 400 |

### Adjuntos
- `evidencias/ES-CU02-03_responses.zip`

### Estado de ejecución
`Pendiente`

---

## ES-CU02-04 — Exclusión de espacios inactivos

### Título descriptivo
Verificar que un espacio marcado como inactivo por el administrador no aparece en la respuesta de `GET /availability`.

### Precondiciones
- Existe el espacio `E-015` actualmente activo y visible en la respuesta.
- Se cuenta con credenciales de administrador para invocar `PATCH /admin/spaces/{id}/deactivate`.

### Pasos a ejecutar
1. Ejecutar `GET /availability` y confirmar que `E-015` aparece en la lista.
2. Autenticarse como administrador y ejecutar `PATCH /admin/spaces/E-015/deactivate`.
3. Volver a ejecutar `GET /availability` con el token del usuario regular.
4. Verificar que `E-015` ya no figure en la respuesta.
5. Verificar que el resto de espacios activos sigan presentes.

### Resultados esperados
- HTTP `200 OK` en ambas consultas.
- `E-015` está presente antes de la desactivación y ausente después.
- La cantidad total de espacios devuelta disminuye exactamente en 1.

### Acciones post-ejecución
- Reactivar `E-015` mediante `PATCH /admin/spaces/E-015/activate` para restaurar el estado original del entorno.

### Data
| Campo | Valor |
|---|---|
| Espacio de prueba | `E-015` |
| Usuario admin | `admin_qa@parking.test` |
| Usuario regular | `qa_user_01@parking.test` |

### Adjuntos
- `evidencias/ES-CU02-04_antes.json`
- `evidencias/ES-CU02-04_despues.json`

### Estado de ejecución
`Pendiente`

---

## ES-CU02-05 — Petición sin token de autenticación

### Título descriptivo
Verificar que el servicio rechaza con HTTP 401 cualquier petición a `GET /availability` que no incluya un token de autenticación válido.

### Precondiciones
- El servicio `GET /availability` se encuentra activo.
- El cliente de pruebas no envía cabecera `Authorization`.

### Pasos a ejecutar
1. Realizar una petición `GET /availability` sin cabecera `Authorization`.
2. Registrar el código de respuesta y el cuerpo.
3. Repetir la prueba con un token mal formado (`Authorization: Bearer abc123`).
4. Repetir la prueba con un token expirado.

### Resultados esperados
- En los tres casos el servicio responde HTTP `401 Unauthorized`.
- El cuerpo de la respuesta incluye un mensaje del tipo `{ "error": "Token inválido o no proporcionado" }`.
- No se filtra información sensible (estados, IDs internos, trazas).

### Acciones post-ejecución
- Ninguna.

### Data
| Caso | Cabecera Authorization |
|---|---|
| Sin token | _(omitida)_ |
| Token mal formado | `Bearer abc123` |
| Token expirado | `Bearer <jwt_expirado>` |

### Adjuntos
- `evidencias/ES-CU02-05_401_responses.png`

### Estado de ejecución
`Pendiente`

---

## Resumen de ejecución

| ID | Escenario | Estado |
|---|---|---|
| ES-CU02-01 | Consulta exitosa con token válido | Pendiente |
| ES-CU02-02 | Reflejo en tiempo real (≤ 30 s) | Pendiente |
| ES-CU02-03 | Filtrado por tipo de vehículo | Pendiente |
| ES-CU02-04 | Exclusión de espacios inactivos | Pendiente |
| ES-CU02-05 | Petición sin token → HTTP 401 | Pendiente |

> **Criterio de aceptación global:** el CU-02 se considera aprobado únicamente cuando los cinco escenarios alcanzan estado `Exitoso`.
