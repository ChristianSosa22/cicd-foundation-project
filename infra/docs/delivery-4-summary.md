# Delivery 4 — Async Infrastructure & Full CD Pipeline — Summary


## 1. Async messaging design

**Servicio elegido: SQS Standard (no FIFO).** El sistema utiliza Amazon SQS en modo estándar como servicio de mensajería asíncrona. Se descartó SQS FIFO porque el sistema no requiere ordenamiento estricto de mensajes: cada reserva tiene un `reservation_id` único en el payload, y el procesamiento de un comprobante o una liberación es independiente del orden en que ocurran. FIFO añade un costo adicional por mensaje ($0.01/M vs $0.00/M en modo estándar, con un free tier más reducido) y limita el throughput a 300 mensajes por segundo (3,000 con batching), mientras que SQS Standard no tiene límites de throughput. Para el volumen esperado del sistema de parqueos (decenas a cientos de reservas diarias), el modo estándar es la opción correcta.

**Tres colas con DLQ independiente.** Se crearon tres colas SQS, cada una con su Dead Letter Queue dedicada:

| Cola principal | DLQ | Flujo de negocio |
|---|---|---|
| `oyd-project-dev-receipt-queue` | `oyd-project-dev-receipt-dlq` | GenerateReceiptCommand: la API encola la solicitud de comprobante; el receipt-worker genera el PDF y lo sube a S3. |
| `oyd-project-dev-release-queue` | `oyd-project-dev-release-dlq` | ReleaseExpiredReservationCommand: el EventBridge Scheduler publica un barrido periódico; el release-worker libera reservas expiradas. |
| `oyd-project-dev-receipt-email-queue` | `oyd-project-dev-receipt-email-dlq` | ReceiptReadyEvent: el SNS topic distribuye el evento de comprobante listo; el email-worker envía el correo al conductor. |

**Configuración de la DLQ y reintentos.** Cada cola principal tiene una `redrive_policy` que mueve los mensajes fallidos a su DLQ después de 3 intentos (`max_receive_count = 3`). Tres intentos son suficientes para absorber fallos transitorios (un timeout de red, una indisponibilidad momentánea de RDS o S3) sin insistir indefinidamente en un mensaje irrecuperable. El `visibility_timeout` se configuró diferenciado por flujo según la carga de procesamiento esperada: 60 segundos para receipt (generación de PDF + subida a S3), 30 segundos para release (un batch UPDATE condicionado) y 30 segundos para email (llamada a API de correo). Los mensajes en las DLQ se retienen durante 14 días (`dlq_message_retention_seconds = 1209600`), ventana suficiente para inspección manual y redrive antes de que expiren. Las colas principales retienen mensajes 4 días en dev (`message_retention_seconds = 345600`) y 7 días en staging (`604800`).

**Decisión de módulo reutilizable.** Las tres colas se instancian desde un único módulo Terraform en `infra/modules/async/` que crea el par queue + DLQ con `redrive_policy`. Esto garantiza que la configuración de DLQ sea idéntica en los tres flujos y permite agregar colas futuras sin duplicar código. Todas las configuraciones son variables de entrada — ningún valor está hardcodeado en el módulo.

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

**Aislamiento de estado por entorno (partial backend).** El backend S3 original usaba
una clave hardcodeada (`infra/terraform.tfstate`), lo que hacía imposible operar dos
entornos sin que uno sobreescribiera el estado del otro. Se migró a un **partial
backend**: `infra/backend.tf` declara el bucket, la región y la tabla DynamoDB, pero
omite la `key`. Cada entorno aporta su propia clave en tiempo de `init` mediante un
archivo `backend-<env>.hcl` dedicado (`infra/envs/dev/backend-dev.hcl` →
`env/dev/terraform.tfstate`, `infra/envs/staging/backend-staging.hcl` →
`env/staging/terraform.tfstate`, `infra/envs/prod/backend-prod.hcl` →
`env/prod/terraform.tfstate`). El comando de inicialización pasa a ser
`terraform init -backend-config=envs/<env>/backend-<env>.hcl`, y todos los workflows de
CI (`terraform-ci.yml`, `drift-detection.yml`, `destroy.yml`) lo aplican de forma
consistente. Los entornos comparten el mismo bucket y la misma tabla de locks, pero sus
estados son completamente independientes: un `apply` sobre `prod` no puede tocar el
estado de `dev` ni viceversa.

**Estructura de entornos dev, staging y prod.** La separación de entornos se gestiona
con `-var-file`, no con Terraform workspaces, manteniendo los estados explícitos y
auditables. `infra/envs/dev/dev.tfvars` define el entorno de desarrollo (un solo NAT
Gateway, `db.t3.micro`, sin Multi-AZ, `deletion_protection = false`).
`infra/envs/staging/staging.tfvars` provee un entorno production-like que difiere de dev
en al menos tres valores: NAT por AZ (`single_nat_gateway = false`), `db.t3.small`,
`multi_az = true`, `deletion_protection = true` y retención de SQS de 7 días.
`infra/envs/prod/prod.tfvars` replica los ajustes de alta disponibilidad: NAT por AZ
(`single_nat_gateway = false`), `db.t3.small`, `multi_az = true`, retención de SQS de
7 días y `deletion_protection = true` — garantizando que un `terraform destroy` en
producción falle de forma intencional hasta que se relaje la protección manualmente.

**Autenticación OIDC (sin credenciales de larga vida).** Las credenciales estáticas
(`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`) fueron reemplazadas por **federación
OIDC de GitHub Actions con AWS IAM**. El módulo bootstrap (`infra/bootstrap/oidc.tf`)
provisiona un `aws_iam_openid_connect_provider` para `token.actions.githubusercontent.com`
y dos roles IAM dedicados: `gha-deploy-dev` y `gha-deploy-prod`. Cada rol restringe su
trust policy con la condición `sub` de OIDC — `gha-deploy-dev` solo puede ser asumido
por jobs corriendo bajo el GitHub Environment `dev` o desde la rama `main` (para
detección de drift); `gha-deploy-prod`, exclusivamente desde el Environment `prod` o
`main`. Los jobs en el workflow usan `aws-actions/configure-aws-credentials@v4` con
`role-to-assume`, lo que emite credenciales temporales de 1 hora sin ninguna clave
almacenada en GitHub Secrets.

**Ruleset de rama sobre `main`.** El ruleset (`infra/docs/main-ruleset.json`, aplicado
con `gh api repos/<org>/<repo>/rulesets -X POST`) está en modo **Active** y exige: (1)
**Pull Request** antes de mergear (con ≥1 aprobación) — los pushes directos a `main` se
rechazan; (2) **tres required status checks** que el workflow de PR expone como jobs
independientes con nombres exactos — **`terraform fmt`**, **`terraform validate`** y
**`terraform plan`** — de modo que un PR con cualquiera fallando o pendiente no puede
mergearse; (3) **branches up to date** (`strict_required_status_checks_policy: true`): un
PR atrasado respecto a `main` debe actualizarse y re-correr sus checks antes de habilitar
el merge; (4) **block force pushes** (`non_fast_forward`) para todos, incluidos admins; y
(5) **block deletions** (`deletion`) de la rama. El `bypass_actors` está vacío: nadie
saltea el ruleset por el flujo normal (un break-glass de repo-admin sería aceptable pero
no es la vía de merge habitual). Los tres checks son jobs separados —y no steps— porque
GitHub reporta el status a nivel de job; el nombre en el ruleset debe coincidir
exactamente con el `name:` del job o el check nunca reporta y la regla se daría por
satisfecha en silencio.

**Pipeline de cuatro fases (plan → deploy-dev → deploy-staging → deploy-prod).** El
workflow `.github/workflows/terraform-ci.yml` reemplaza el job único anterior por jobs
condicionales encadenados. El job `plan` corre en cada PR contra `main`, autentica con
el rol dev, inicializa con `envs/dev/backend-dev.hcl` y ejecuta
`terraform plan -var-file=envs/dev/dev.tfvars`, publicando el diff como comentario
colapsable en el PR — este job es el required status check del ruleset. Al mergear,
`deploy-dev` corre automáticamente (environment `dev`, sin gate) y aplica el plan sobre
dev seguido del seed idempotente de la base de datos vía `ecs run-task`. Cuando
`deploy-dev` termina exitosamente se activa `deploy-staging` (cláusula
`needs: deploy-dev`, environment `staging`), que **pausa en "Waiting for review" hasta la
aprobación de un required reviewer** antes de inicializar con
`envs/staging/backend-staging.hcl` y aplicar `-var-file=envs/staging/staging.tfvars`.
Solo tras el éxito de staging se habilita `deploy-prod` (`needs: deploy-staging`,
environment `prod`), que vuelve a pausar para aprobación y aplica `prod.tfvars`. El grupo
de `concurrency` por job (`deploy-dev` / `deploy-staging` / `deploy-prod`) garantiza que
dos merges simultáneos no generen applies paralelos sobre el mismo entorno.

**GitHub Environments, required reviewers y namespacing de secretos.** Se configuran tres
GitHub Environments en *Settings → Environments*:

| Environment | Required reviewers | Secreto de BD (env-scoped) | Rol OIDC (variable `AWS_DEPLOY_ROLE_ARN`) |
|---|---|---|---|
| `dev`     | ninguno (deploy automático al mergear) | `DEV_DB_PASSWORD`     | `gha-deploy-dev`     |
| `staging` | **ChristianSosa22, analopez-24, Pablokill2004** | `STAGING_DB_PASSWORD` | `gha-deploy-staging` |
| `prod`    | ChristianSosa22, analopez-24, Pablokill2004 | — (default `db_password = ""`) | `gha-deploy-prod` |

Los secretos sensibles por entorno se almacenan **a nivel de Environment, nunca como
secretos de repositorio**: `deploy-dev` lee `secrets.DEV_DB_PASSWORD` y `deploy-staging`
lee `secrets.STAGING_DB_PASSWORD`, cada uno inyectado como `TF_VAR_db_password`. Así un
job no puede acceder al secreto de otro entorno. El rol IAM de cada entorno se crea en
`infra/bootstrap/oidc.tf` (`gha-deploy-staging` con trust policy restringida a la claim
`environment:staging`) y su ARN se publica como output del bootstrap
(`gha_deploy_staging_role_arn`) para copiarlo en la variable `AWS_DEPLOY_ROLE_ARN` del
Environment correspondiente.

**Plan-artifact promotion (aplicar exactamente lo revisado).** El apply nunca usa
`-auto-approve` ni re-planifica: aplica un plan guardado. En el path de dev el job `plan`
(que corre en el PR y es el required check) genera `terraform plan -out=tfplan`, sube
`tfplan` como artifact (`actions/upload-artifact`, nombre `tfplan-dev`) y publica el diff
legible como comentario en el PR. Al mergear, `deploy-dev` localiza el run del `plan` por
el `head SHA` del PR (`gh run list`), descarga ese **mismo** `tfplan`
(`actions/download-artifact` con `run-id` — por eso el job declara `permissions: actions:
read`) y ejecuta `terraform apply tfplan`. Como el plan se aplica verbatim, si el state
cambió entre el plan del PR y el merge Terraform falla con *"saved plan is stale"* — la
protección exacta que exige el requisito frente a re-planificar contra un state distinto.
Para staging y prod —que aplican sobre state y `var-file` propios, donde un `tfplan` de
dev no es válido— cada deploy job genera su `plan -out=tfplan` y hace `apply tfplan`
dentro del mismo job (mismo state, sin ventana de drift), subiendo además el `tfplan` como
artifact (`tfplan-staging` / `tfplan-prod`) para auditoría. Ningún apply del pipeline usa
`-auto-approve`.

**Detección de drift.** El workflow `.github/workflows/drift-detection.yml` corre
diariamente a las 06:00 UTC (y bajo `workflow_dispatch`) sobre ambos entornos en
paralelo. Usa `terraform plan -detailed-exitcode`: el código de salida `0` indica que
el estado está sincronizado; el código `2` indica drift — recursos modificados fuera de
Terraform. En ese caso el job abre o actualiza un Issue en GitHub etiquetado con
`drift` y el nombre del entorno, y falla el run para que quede visible en el dashboard
de Actions. Los jobs de drift no usan el GitHub Environment como gate (usarían el
revisor de prod, bloqueando la ejecución automatizada); en su lugar se autentican con
variables de repositorio (`AWS_DEPLOY_ROLE_ARN_DEV` / `AWS_DEPLOY_ROLE_ARN_PROD`) que
referencian los mismos roles IAM, cuya trust policy permite la claim `ref:refs/heads/main`.

**Destroy con gate.** El workflow `.github/workflows/destroy.yml` es exclusivamente
`workflow_dispatch` y recibe dos inputs: `environment` (dropdown `dev` / `prod`) y
`confirm` (texto libre). El primer paso compara ambos valores y falla si no coinciden,
previniendo que un operador destruya el entorno equivocado por error de selección. Al
seleccionar `prod`, el job hereda el gate del GitHub Environment `prod` y requiere
aprobación antes de ejecutar ningún paso — incluyendo el `terraform destroy`. La
protección a nivel de RDS (`deletion_protection = true`) actúa como segunda línea de
defensa: incluso con el destroy aprobado y confirmado, AWS rechaza la eliminación de la
instancia hasta que se deshabilite explícitamente ese flag en `prod.tfvars`.

---

## 4. Scheduled jobs

**Función programada.** Se configuró un schedule de Amazon EventBridge Scheduler denominado `oyd-project-dev-release-expired`. Su propósito es barrer periódicamente las reservas que no fueron confirmadas por el conductor dentro de la ventana de 20 minutos, publicando un `ReleaseExpiredReservationCommand` en la cola SQS `release-queue`. El release-worker consume ese comando y ejecuta un UPDATE condicionado sobre la tabla `reservations` (`SET status = 'expirada' WHERE status = 'reservada' AND confirm_deadline < NOW()`), liberando el espacio para que otro conductor pueda tomarlo.

**Expresión de schedule y zona horaria.** La expresión es `rate(20 minutes)`, disparándose cada 20 minutos. Se eligió esta frecuencia porque coincide con la ventana de confirmación del sistema: una reserva no confirmada se marca como expirada 20 minutos después de la hora pactada. Un barrido cada 20 minutos garantiza que las reservas expiradas se liberen con un retraso máximo de 20 minutos adicionales (en el peor caso, el barrido ocurre justo antes de que la reserva expire y debe esperar al siguiente ciclo). La zona horaria es `America/Guatemala` (CST, UTC-6), alineada con el horario laboral del público objetivo LATAM, de modo que el schedule evalúa las expresiones cron relativas a la hora local del negocio.

**Target de SQS, no Lambda directo.** El schedule apunta a la cola `release-queue` (ARN del módulo async), no a una función Lambda. Esto es consistente con el patrón de comandos del sistema: el Scheduler produce un mensaje `ReleaseExpiredReservationCommand` y el release-worker lo consume vía long-polling. Esta separación permite que los reintentos y el manejo de fallos se beneficien del mecanismo de DLQ de SQS: si el worker falla al procesar el barrido, el mensaje se reintenta automáticamente y, tras 3 intentos fallidos, se traslada a la DLQ para inspección. Si el Scheduler invocara Lambda directamente, un fallo del worker se perdería sin mecanismo de recuperación automático.

**IAM least-privilege.** El rol IAM asumido por EventBridge Scheduler (`oyd-project-dev-scheduler-role`) tiene una única política inline con `sqs:SendMessage` como acción y el ARN de `release-queue` como recurso — sin wildcard `"Resource": "*"`. Este rol es significativamente más estrecho que el rol de ejecución de las tareas ECS (`oyd-project-dev-ecs-exec-role`), que necesita permisos sobre SSM (para leer secretos), ECR (para descargar imágenes) y CloudWatch (para logs). El scheduler solo necesita publicar un mensaje en una cola específica; cualquier permiso adicional sería una violación del principio de mínimo privilegio. La policy fue verificada con `aws iam get-role-policy` para confirmar que no contiene wildcard en el recurso.


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


