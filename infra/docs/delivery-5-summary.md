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

<!-- Pendiente: Estudiante C describe la CMK creada, alias, key policy y recursos cifrados -->

**Estado:** Pendiente — será implementado por el Estudiante C (Deliverable B).

---

## 3. OIDC federation

<!-- Pendiente: Estudiante B describe el OIDC provider, audience, subject claim y eliminación de credenciales estáticas -->

**Estado:** Pendiente — será implementado por el Estudiante B (Deliverable C).

El CI runner role en el módulo IAM ya tiene la trust policy parameterizada con `repo:ChristianSosa22/cicd-foundation-project:ref:refs/heads/main`. Una vez que Estudiante B provisione el OIDC provider, debe pasarlo al módulo via `oidc_provider_arn`.

---

## 4. Observability design

<!-- Pendiente: Estudiante B describe las alarmas, dashboard y presupuesto de costos -->

**Estado:** Pendiente — será implementado por el Estudiante B (Deliverable E).

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

<!-- Pendiente: Estudiante A describe 2 trade-offs de esta entrega -->

**Trade-off 1: Roles inline vs. módulo IAM centralizado**
Se optó por mantener los roles inline existentes y crear roles paralelos en el módulo IAM en lugar de eliminarlos directamente. Esto minimiza el riesgo de romper el stack en ejecución pero resulta en roles duplicados temporalmente. El beneficio es que los roles canónicos quedan disponibles para que otros módulos los consuman sin prisa.

