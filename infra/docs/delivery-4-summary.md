# Delivery 4 — Async Infrastructure & Full CD Pipeline — Summary


## 1. Async messaging design

---

## 2. Event-driven architecture

**Compute target y patrón de trigger.** El consumidor se implementó como un
**worker ECS Fargate que hace long-polling de SQS** (camino "Worker / VPC track"
del Deliverable B), no como Lambda. Esta decisión es coherente con la arquitectura
de D2/D3: todo el cómputo del proyecto corre en ECS Fargate (API y web), no hay
componentes serverless, y el equipo está en el VPC-required track. Reutilizar el
patrón de contenedores evita introducir un runtime y empaquetado nuevos (zip/imagen
de Lambda) y un módulo Terraform aparte. El worker corre como su propio servicio ECS
(`oyd-project-dev-worker-svc`), separado de la API, usando la **misma imagen** del
backend con el comando sobrescrito a `node dist/worker.js`.

**Consumo de los outputs del Deliverable A.** La task definition del worker recibe
la URL de la cola desde el output del módulo async (`module.async_receipt.queue_url`),
inyectada como variable de entorno `RECEIPT_QUEUE_URL` — sin valores hardcodeados.
El tamaño de lote de polling es la variable `polling_batch_size` (default 10, el
máximo de SQS), inyectada como `POLLING_BATCH_SIZE`. El worker hace `ReceiveMessage`
con `WaitTimeSeconds=20` (long-poll) para reducir recepciones vacías y costo.

**Ruteo de fallos al DLQ.** La cola receipt está configurada con
`max_receive_count = 3`: si el worker no logra procesar un mensaje (p. ej. falla la
escritura a S3) y por tanto no lo borra, SQS lo vuelve a entregar tras el
`visibility_timeout` de 60 segundos. Tras 3 intentos fallidos, el `redrive_policy`
mueve el mensaje al DLQ (`oyd-project-dev-receipt-dlq`), que retiene los mensajes
**14 días** (`dlq_message_retention_seconds = 1209600`) — ventana suficiente para
inspección manual y redrive. El worker solo borra el mensaje (`DeleteMessage`)
**después** de escribir el objeto a S3 con éxito, garantizando at-least-once
processing: un fallo nunca descarta silenciosamente el mensaje. La acción esperada
sobre mensajes en el DLQ es inspección manual de la causa raíz y redrive una vez
corregida.

**Concurrencia.** Al ser un worker de polling (no un event source mapping de Lambda),
la concurrencia está acotada naturalmente por `worker_desired_count` (número de tasks
del servicio) y por `polling_batch_size`. Esto evita el riesgo de agotar el pool de
conexiones de la RDS, ya que el número de consumidores es fijo y controlado, no
auto-escalado por profundidad de cola.

---

## 3. Terraform environment layout and CD pipeline


---

## 4. Scheduled jobs


---

## 5. End-to-end async proof

**Lenguaje y runtime.** Node.js + TypeScript (Express), el mismo stack comprometido
en Infraestructura en la Nube y D3.

**Flujo completo enqueue → consumer → object storage.**

1. **Productor.** El endpoint `POST /reservas/enqueue` (Express, montado en la API
   detrás del ALB de D3) recibe un body JSON, lo encola en la cola receipt mediante
   `SendMessageCommand` y responde **HTTP 202** con el `MessageId` real asignado por
   SQS — nunca un ID hardcodeado. El control de acceso es de red: el endpoint solo es
   alcanzable a través del ingress del ALB, no por la IP privada de la task. La URL de
   la cola se lee de `RECEIPT_QUEUE_URL` (inyectada por Terraform), no hardcodeada.

2. **Cola.** El mensaje viaja por `oyd-project-dev-receipt-queue`. SQS lo retiene
   hasta que un consumidor lo recibe (retención de 4 días en la cola principal).

3. **Consumidor.** El worker ECS (`node dist/worker.js`) hace long-polling de la cola,
   recibe el mensaje, escribe **un objeto** al bucket S3 de recibos
   (`oyd-project-receipts-dev`), loguea el `MessageId` procesado, y borra el mensaje.
   La **clave del objeto se deriva del MessageId**: `receipts/async/<MessageId>.json`.
   El objeto contiene el `message_id`, el `received_at` y el `body` original del mensaje.

**IAM y scoping (least privilege).** El worker asume un **rol de task dedicado**
(`oyd-project-dev-worker-task-role`), distinto del rol de la API. Sus permisos están
scoped a recursos específicos, **sin wildcards**:
- SQS: `sqs:ReceiveMessage`, `sqs:DeleteMessage`, `sqs:GetQueueAttributes` sobre
  `arn:aws:sqs:us-east-1:733202870569:oyd-project-dev-receipt-queue`.
- S3: `s3:PutObject` sobre `arn:aws:s3:::oyd-project-receipts-dev/*`.

**Verificación.** Se envió un mensaje vía `curl` al endpoint `/reservas/enqueue`
(respuesta 202 + MessageId), el worker lo consumió y escribió el objeto correspondiente
en S3 con el mismo MessageId como clave. El mismo identificador aparece en la respuesta
del productor, en el log del consumidor y en la clave del objeto en S3, demostrando el
camino async de punta a punta. Ver evidencias en `async-enqueue.txt`,
`async-consumer.png`, `async-object.png`, `event-source-plan.txt`.

---

## 6. Two architectural trade-offs

**Worker ECS de polling vs. Lambda event source mapping (Estudiante 2).**
Se optó por un worker ECS Fargate que hace polling de SQS en lugar de una función
Lambda con `aws_lambda_event_source_mapping`. La opción Lambda ofrece auto-escalado
por profundidad de cola y un modelo serverless sin gestión de infraestructura, pero
habría introducido un runtime y empaquetado nuevos, un módulo Terraform adicional, y
configuración de VPC/endpoints para que la función alcanzara S3 y la RDS desde subnets
privadas — un quiebre con la arquitectura 100% contenedores de D2/D3. El worker de
polling reutiliza la imagen, la red, los secretos y el patrón de servicio ya existentes,
a costa de mantener una task corriendo de forma continua (costo fijo pequeño) y de no
auto-escalar automáticamente. Para la carga esperada del sistema de parqueos (volumen
moderado y predecible de recibos) y para mantener la coherencia arquitectónica del
VPC track, el control explícito y la reutilización pesaron más que el auto-escalado.


