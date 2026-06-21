# Delivery 5 — Security, Observability & One-Click Deployment — Summary

## 1. IAM and secrets design

### Estructura de roles
El módulo `infra/modules/iam/` crea 7 roles centralizados con mínimo privilegio:

| Rol | Assumido por | Acciones | Recursos |
|-----|-------------|----------|----------|
| `compute_exec_role` | ecs-tasks.amazonaws.com | ecr pull, logs, ssm, secretsmanager | ECR repos, log groups, SSM params, Secrets Manager |
| `compute_task_role` | ecs-tasks.amazonaws.com | s3 Get/Put, sqs SendMessage, rds-db connect, kms | receipts bucket, receipt queue, RDS, KMS (opcional) |
| `async_consumer_receipt_role` | lambda.amazonaws.com | sqs consume, s3 PutObject, sns Publish, secretsmanager, logs | receipt queue, bucket, SNS topic, secrets, log groups |
| `async_consumer_release_role` | lambda.amazonaws.com | sqs consume, secretsmanager, logs | release queue, secrets, log groups |
| `async_consumer_email_role` | lambda.amazonaws.com | sqs consume, secretsmanager, logs | email queue, secrets, log groups |
| `scheduler_role` | scheduler.amazonaws.com | sqs SendMessage | release queue |
| `ci_runner_role` | OIDC (GitHub Actions) | terraform plan/apply | S3, DynamoDB, EC2 basic |

**Cambio respecto a entregas anteriores:** Los roles inline en `compute/main.tf`, `compute/worker.tf` y `scheduler/main.tf` se mantienen intactos por decisión deliberada para no romper el stack en ejecución. Los roles `-iam-*` del módulo IAM son los canónicos. La migración de módulos para consumir estos ARNs es el siguiente paso pendiente para puntaje completo.

**Razón del diseño híbrido:** El documento del curso describe roles Lambda, pero la arquitectura real implementada usa ECS Fargate workers. El módulo IAM provisiona roles para ambas arquitecturas para maximizar compatibilidad.

> **Pendiente:** Estudiante C debe conectar `kms_key_arn` al módulo IAM después de crear la CMK en Deliverable B.

---

## 2. KMS key management

### CMK creada

Se creó una Customer-Managed Key (CMK) en AWS KMS mediante el módulo `infra/modules/kms/`.

| Atributo | Valor |
|---|---|
| Alias | `alias/oyd-project-dev-cmk` |
| Región | `us-east-1` |
| Rotación automática | Habilitada (`enable_key_rotation = true`) |
| Periodo de eliminación | 7 días |
| ARN | `arn:aws:kms:us-east-1:733202870569:key/1ce62788-3bbe-4749-8b46-80142c02086c` |
| Key ID | `1ce62788-3bbe-4749-8b46-80142c02086c` |

### Recursos que cifra esta CMK

| Recurso | Servicio AWS | Mecanismo de cifrado |
|---|---|---|
| Bucket de recibos (`oyd-project-receipts-dev`) | Amazon S3 | SSE-KMS con `bucket_key_enabled = true` |
| Instancia RDS PostgreSQL (`oyd-project-dev-db`) | Amazon RDS | Storage encryption con `kms_key_id` |
| Secret de contraseña de BD (`/oyd-project/dev/db_password`) | AWS Secrets Manager | Cifrado del secret con `kms_key_id` |

### Key policy — restricciones de uso

La key policy tiene 5 statements y sigue el principio de mínimo privilegio:

| Statement | Principal | Acciones permitidas | Condición |
|---|---|---|---|
| `KeyAdministration` | `arn:aws:iam::733202870569:root` | Administración (`Create*`, `Describe*`, `Delete*`, etc.) — **sin** `kms:Decrypt` ni `kms:Encrypt` | Ninguna |
| `ComputeRoleUsage` | `oyd-project-dev-iam-compute-exec` y `oyd-project-dev-iam-compute-task` | `kms:Decrypt`, `kms:GenerateDataKey`, `kms:DescribeKey` | Ninguna |
| `SecretsManagerUsage` | `secretsmanager.amazonaws.com` | `kms:Decrypt`, `kms:GenerateDataKey`, `kms:DescribeKey` | `kms:CallerAccount = 733202870569` |
| `RDSServiceUsage` | `rds.amazonaws.com` | `kms:Encrypt`, `kms:Decrypt`, `kms:ReEncrypt*`, `kms:GenerateDataKey*`, `kms:CreateGrant` | `kms:CallerAccount = 733202870569` |
| `S3ServiceUsage` | `s3.amazonaws.com` | `kms:Encrypt`, `kms:Decrypt`, `kms:ReEncrypt*`, `kms:GenerateDataKey*` | `kms:CallerAccount = 733202870569` |

**Puntos clave de la policy:**
- La cuenta root **no puede** usar la llave para cifrar o descifrar datos — solo administrarla
- Los service principals de AWS (Secrets Manager, RDS, S3) tienen la condición `kms:CallerAccount` para evitar el [confused deputy problem](https://docs.aws.amazon.com/IAM/latest/UserGuide/confused-deputy.html)
- El uso criptográfico está restringido a los roles de ECS y los service principals explícitamente listados — ningún otro principal puede usar la CMK

---

## 3. OIDC federation

**Estado:** Implementado — `infra/bootstrap/oidc.tf`.

### Recursos provisionados

| Recurso Terraform | Nombre AWS | Propósito |
|---|---|---|
| `aws_iam_openid_connect_provider.github_actions` | — | OIDC provider que federa GitHub Actions con AWS STS |
| `aws_iam_role.gha_deploy_dev` | `gha-deploy-dev` | Rol asumido por los jobs de CI en environment `dev` |
| `aws_iam_role.gha_deploy_prod` | `gha-deploy-prod` | Rol asumido por los jobs de CI en environment `prod` |

### Configuración del OIDC provider

- **URL del proveedor:** `https://token.actions.githubusercontent.com`
- **Audience (`client_id_list`):** `sts.amazonaws.com`
- **Thumbprint:** `1c58a3a8518e8759bf075b76b750d4f2df264fcd` (CA raíz de GitHub Actions)

### Subject claims (trust policy de cada rol)

Los roles restringen qué tokens de GitHub Actions pueden hacer `AssumeRoleWithWebIdentity` usando la condición `StringLike` sobre el claim `sub`:

| Rol | Subject claim |
|---|---|
| `gha-deploy-dev` | `repo:ChristianSosa22/cicd-foundation-project:environment:dev` y `repo:...:ref:refs/heads/main` |
| `gha-deploy-prod` | `repo:ChristianSosa22/cicd-foundation-project:environment:prod` y `repo:...:ref:refs/heads/main` |

Solo los workflows que corren en el ambiente correcto (o desde `main`) pueden asumir cada rol.

### Integración con los workflows de GitHub Actions

Los tres workflows (`.github/workflows/terraform-ci.yml`, `destroy.yml`, `drift-detection.yml`) autentican con OIDC de forma idéntica:

```yaml
permissions:
  id-token: write   # obligatorio para solicitar el token OIDC
  contents: read

- uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: ${{ vars.AWS_DEPLOY_ROLE_ARN }}   # ARN del rol de deploy
    aws-region: ${{ vars.AWS_REGION }}
```

Los ARNs de los roles se almacenan como **GitHub Variables** (`vars.AWS_DEPLOY_ROLE_ARN`, `vars.AWS_DEPLOY_ROLE_ARN_DEV`, `vars.AWS_DEPLOY_ROLE_ARN_PROD`), no como secrets. **No existe ninguna llave de acceso estática** (`aws-access-key-id` / `aws-secret-access-key`) en el repositorio.

---

## 4. Observability design

**Estado:** Implementado — `infra/modules/observability/` (6 archivos: `main.tf`, `alarms.tf`, `dashboard.tf`, `budget.tf`, `variables.tf`, `outputs.tf`).

### Arquitectura del módulo

```
infra/modules/observability/
├── main.tf       → SNS topic + suscripción email + CloudWatch log group
├── alarms.tf     → 2 alarmas métricas (5xx y release-DLQ)
├── dashboard.tf  → Dashboard dinámico con jsonencode()
├── budget.tf     → AWS Budget mensual
├── variables.tf  → Dimensiones de alarma, email, retención, límite de gasto
└── outputs.tf    → sns_topic_arn, alarm_arns, dashboard_name, budget_name
```

Todas las dimensiones de alarma y los nombres del dashboard se interpolan desde variables → el módulo es reutilizable en `dev`, `staging` y `prod` sin hardcoding.

### Notificaciones (SNS)

- `aws_sns_topic` → `oyd-project-<env>-alerts`
- `aws_sns_topic_subscription` (protocol `email`) → `christiansosa2204@gmail.com`
- Tanto las alarmas como el budget usan este topic como único sink de notificaciones.

> Tras el primer `terraform apply`, AWS envía un correo de confirmación. La suscripción no entrega mensajes hasta que se confirme el link.

### Retención de logs

- `aws_cloudwatch_log_group` → `/observability/oyd-project-<env>/app`
- `retention_in_days = 30` (dev) — configurable por entorno vía variable `observability_log_retention_days`.
- Log group separado de los grupos ECS que gestiona el módulo `compute`; sirve como destino para filtros de métrica personalizados y logs de auditoría centralizados.

### Alarmas métricas

| # | Nombre | Métrica | Umbral | Ventana | Severidad |
|---|---|---|---|---|---|
| 1 | `api-5xx-spike` | `AWS/ApplicationELB` → `HTTPCode_Target_5XX_Count` | > 5 errores | 5 períodos × 60 s | High |
| 2 | `release-dlq-message` | `AWS/SQS` → `ApproximateNumberOfMessagesVisible` | > 0 mensajes | 5 períodos × 60 s | Critical |

**Justificación de selección:**
- **Alarma 1 (5xx):** Cualquier ráfaga de errores en ventana de 5 minutos durante el pico matutino (7–9 AM) bloquea a usuarios de reservar espacios. Umbral de 5 absorbe errores transitorios aislados sin disparar falsos positivos.
- **Alarma 2 (release-DLQ):** Un solo mensaje en la DLQ de release indica que ninguno de los dos paths de liberación (cron in-process + EventBridge) funcionó. Los espacios quedan marcados como ocupados el resto del día — impacto operacional inmediato.

### Dashboard dinámico (`jsonencode`)

`aws_cloudwatch_dashboard` con `dashboard_body = jsonencode({ widgets = [...] })`. Cuatro widgets dispuestos en cuadrícula de 24 columnas:

| Posición | Título | Métrica(s) |
|---|---|---|
| Fila 0, col 0–11 | API HTTP Error Rates (5xx / 4xx) | `HTTPCode_Target_5XX_Count`, `HTTPCode_Target_4XX_Count` |
| Fila 0, col 12–23 | API Request Volume | `RequestCount` |
| Fila 6, col 0–11 | API Response Time (p50 / p95 / p99) | `TargetResponseTime` con stat por percentil |
| Fila 6, col 12–23 | Release DLQ — Messages Visible | `ApproximateNumberOfMessagesVisible` |

Las dimensiones `LoadBalancer`, `TargetGroup` y `QueueName` se inyectan como variables → el mismo código genera el dashboard correcto para cualquier entorno.

### Presupuesto de costos (AWS Budget)

- **Tipo:** `COST`, `time_unit = MONTHLY`, `limit_amount = "30"` USD
- **Notificación 1:** 80 % del gasto **forecasted** → alerta temprana
- **Notificación 2:** 100 % del gasto **actual** → límite alcanzado
- El plan de observabilidad estima $23–27/mes; el límite de $30 deja margen sin ocultar derivas de costo.

### Cambios en módulos existentes

Para exponer las dimensiones que necesitan las alarmas se añadieron outputs a módulos pre-existentes:

| Módulo | Output añadido | Valor |
|---|---|---|
| `modules/alb` | `alb_arn_suffix` | `aws_lb.this.arn_suffix` |
| `modules/alb` | `api_target_group_arn_suffix` | `aws_lb_target_group.api.arn_suffix` |
| `modules/async` | `dlq_name` | `aws_sqs_queue.dlq.name` |

---

## 5. TLS Termination 

### Dominio

- **Dominio:** `grupo5.oyd.solid.com.gt` (sub-delegado, activo en Route 53)
- **Wildcard:** `*.grupo5.oyd.solid.com.gt` — cubre todos los subdominios
- **App FQDN:** `app.grupo5.oyd.solid.com.gt` — alias A record → ALB
- **Validación DNS:** Automática vía Route 53 (records CNAME creados por Terraform)

### Endpoints públicos

| URL | Servicio | Certificate |
|-----|----------|-------------|
| `https://app.grupo5.oyd.solid.com.gt` | Web frontend (Next.js) | `*.grupo5.oyd.solid.com.gt` |
| `https://app.grupo5.oyd.solid.com.gt/api/*` | API backend (Express) | `*.grupo5.oyd.solid.com.gt` |
| `https://app.grupo5.oyd.solid.com.gt/availability` | API — disponibilidad | `*.grupo5.oyd.solid.com.gt` |
| `https://app.grupo5.oyd.solid.com.gt/reservar` | API — reservas | `*.grupo5.oyd.solid.com.gt` |
| `https://app.grupo5.oyd.solid.com.gt/health` | API — health check | `*.grupo5.oyd.solid.com.gt` |

### Configuración TLS

- **Listener HTTPS:443:** Certificate ARN del ACM, policy `ELBSecurityPolicy-TLS13-1-2-2021-06`
- **HTTP:80 → HTTPS redirect:** 301 redirect a `https://:443${path}` (todas las requests)
- **Certificado ACM:** AWS Certificate Manager con DNS validation automática

---

## 6. Two architectural trade-offs

**Trade-off 1: Roles inline vs. módulo IAM centralizado**
Se optó por mantener los roles inline existentes y crear roles paralelos en el módulo IAM en lugar de eliminarlos directamente. Esto minimiza el riesgo de romper el stack en ejecución pero resulta en roles duplicados temporalmente. El beneficio es que los roles canónicos quedan disponibles para que otros módulos los consuman sin prisa.

**Trade-off 2: CMK compartida vs. CMK por servicio**
Se decidió usar una sola CMK compartida para cifrar S3, RDS y Secrets Manager en lugar de crear una CMK independiente por servicio. La alternativa de múltiples CMKs ofrece mayor aislamiento de blast radius — si una key se ve comprometida o se elimina accidentalmente, solo afecta a un servicio. Sin embargo, para un ambiente de un único proyecto con un equipo pequeño, la complejidad operacional de gestionar varias keys (rotación, políticas, aliases, costos adicionales de $1/mes por key) supera el beneficio. La key policy actual ya segmenta los permisos por service principal con la condición `kms:CallerAccount`, lo que proporciona un nivel de control suficiente para este caso de uso.

---

## 7. Slack Deployment Bot

Repositorio del bot: **[analopez-24/deploy-bot](https://github.com/analopez-24/deploy-bot)**

El bot responde al comando `/deploy <environment>` en Slack y dispara el job
`deploy-manual` en `.github/workflows/terraform-ci.yml` de este repositorio
mediante la API `workflow_dispatch` de GitHub Actions. Ambientes soportados: `dev`, `staging`.
