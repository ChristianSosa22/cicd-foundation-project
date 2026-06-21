# OyD Project Documentation

Este directorio contiene la configuración de Terraform para aprovisionar la infraestructura base del proyecto en AWS.

---

## 1. How to Initialize the Workspace

Antes de poder usar Terraform, hay que inicializar el directorio de trabajo. Este paso descarga los plugins del proveedor (en este caso AWS) y prepara el entorno local.

```bash
cd infra/
terraform init
```

> **Nota:** El pipeline de CI usa `terraform init -backend=false` para validar sintaxis sin necesidad de credenciales. Localmente, `terraform init` configurará automáticamente el backend remoto definido en `backend.tf` (S3 + DynamoDB).

Después de inicializar, se debe verificar que el formato de todos los archivos sea correcto:

```bash
terraform fmt -recursive
```

Y validar que la configuración no tenga errores de sintaxis o de referencias:

```bash
terraform validate
```

---

## 2. Which Credentials Are Required and How to Set Them

Este workspace se conecta a AWS. Nunca se deben escribir credenciales directamente en ningún archivo `.tf` ni en el YAML del pipeline.

### Variables de entorno necesarias

| Variable de entorno      | Descripción                                      |
|--------------------------|--------------------------------------------------|
| `AWS_ACCESS_KEY_ID`      | Clave de acceso del usuario IAM                  |
| `AWS_SECRET_ACCESS_KEY`  | Clave secreta del usuario IAM                    |
| `AWS_REGION`             | Región de AWS (ejemplo: `us-east-1`)             |

### Configuración local

Para exporta las variables en la terminal antes de correr cualquier comando de Terraform se debe de configurar:

```bash
export AWS_ACCESS_KEY_ID="access-key"
export AWS_SECRET_ACCESS_KEY="secret-key"
export AWS_REGION="us-east-1"
```

### Configuración en GitHub Actions

Para el pipeline de CI, las credenciales se inyectan como **GitHub Secrets**. Esto desde GitHub → Settings → Secrets and variables → Actions y en donde se agregan los tres secrets con los mismos nombres de la tabla anterior (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`).

---

## 3. How to Run Plan and Apply Locally

Todos los comandos deben ejecutarse desde dentro del directorio `infra/`.

### Ver qué recursos se van a crear (plan)

```bash
cd infra/
terraform plan -var-file=envs/dev/dev.tfvars
```

El flag `-var-file` le indica a Terraform que use los valores definidos en `envs/dev/dev.tfvars` para resolver las variables. Sin este flag, Terraform pedirá los valores de forma interactiva.

### Aplicar los cambios (apply)

```bash
terraform apply -var-file=envs/dev/dev.tfvars
```

Terraform mostrará el plan y pedirá confirmación. En donde se debe de escribir `yes` para aprovisionar los recursos.

### Destruir los recursos (cleanup)

```bash
terraform destroy -var-file=envs/dev/dev.tfvars
```

> ⚠️ Este comando elimina todos los recursos manejados por este workspace. Se debe de utilizar con cuidado en ambientes que no sean de desarrollo.

---

## 4. Populating Runtime Secrets (SSM Parameter Store)

After `terraform apply`, the SSM parameters exist with placeholder values. Real values must be set **once out-of-band** before starting the ECS tasks. This keeps secrets out of Terraform state and plan diffs.

First, get the RDS endpoint from Terraform outputs:
```bash
terraform output db_address
terraform output db_port
```

Then set each parameter (replace values as appropriate):
```bash
# DATABASE_URL — assemble from RDS outputs
aws ssm put-parameter \
  --name "/oyd-project/dev/DATABASE_URL" \
  --type SecureString \
  --value "postgres://parking_user:YOUR_PASSWORD@RDS_HOST:5432/parking" \
  --overwrite

# JWT signing secret (minimum 16 characters)
aws ssm put-parameter \
  --name "/oyd-project/dev/JWT_SECRET" \
  --type SecureString \
  --value "$(openssl rand -hex 32)" \
  --overwrite

# AES-256-GCM column encryption key (base64 of 32 random bytes)
aws ssm put-parameter \
  --name "/oyd-project/dev/ENCRYPTION_KEY" \
  --type SecureString \
  --value "$(openssl rand -base64 32)" \
  --overwrite

# HMAC-SHA256 key for deterministic plate hashing
aws ssm put-parameter \
  --name "/oyd-project/dev/HMAC_KEY" \
  --type SecureString \
  --value "$(openssl rand -hex 32)" \
  --overwrite
```

> After setting real values, re-running `terraform apply` will **not** overwrite them — each parameter has `lifecycle { ignore_changes = [value] }`.

---

## 5. Building and Pushing Container Images to ECR

ECS cannot pull images from a local Docker daemon. Images must be pushed to ECR first.

```bash
# 1. Get account ID and ECR repo URLs from Terraform outputs
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
API_REPO=$(terraform output -raw ecr_api_repository_url)
WEB_REPO=$(terraform output -raw ecr_web_repository_url)

# 2. Authenticate Docker to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com"

# 3. Build and push the API image
cd ../backend
docker build -t "${API_REPO}:latest" .
docker push "${API_REPO}:latest"

# 4. Build and push the web image
# IMPORTANT: NEXT_PUBLIC_API_URL is baked into the JS bundle at build time.
# Replace <ALB_URL> with your backend's public URL (ALB DNS name or domain).
cd ../frontend
docker build \
  --build-arg NEXT_PUBLIC_API_URL=http://<ALB_URL> \
  -t "${WEB_REPO}:latest" .
docker push "${WEB_REPO}:latest"
```

Once images are pushed, force a service update so ECS pulls the new image:
```bash
aws ecs update-service \
  --cluster oyd-project-dev-cluster \
  --service oyd-project-dev-api-svc \
  --force-new-deployment

aws ecs update-service \
  --cluster oyd-project-dev-cluster \
  --service oyd-project-dev-web-svc \
  --force-new-deployment
```

---

## 6. Applying the Database Schema

No migration runner is wired. Run the schema DDL manually after RDS is provisioned:
```bash
psql "postgres://parking_user:YOUR_PASSWORD@RDS_HOST:5432/parking" \
  -f ../backend/sql/schema.sql
```

---

## Evidence

### Remote State (S3 + DynamoDB)

El estado de Terraform se almacena de forma remota para permitir colaboración entre múltiples usuarios y proteger contra escrituras concurrentes. La configuración del backend está definida en `backend.tf`:

- **Bucket S3:** `cicd-foundation-project` — guarda el archivo `infra/terraform.tfstate` con **versionado** y **cifrado en reposo (AES256)** habilitados.
- **Tabla DynamoDB:** `cicd-foundation-project-lock` — implementa el mecanismo de **state locking**. Cada vez que un usuario corre `terraform plan` o `apply`, Terraform escribe un registro de lock en esta tabla; si otro usuario intenta correr una operación al mismo tiempo, recibirá un error y deberá esperar.

Los recursos del backend (bucket + tabla) se provisionan una sola vez desde el subdirectorio `bootstrap/`, que mantiene su propio estado local fuera del backend remoto para evitar el problema del "huevo y la gallina".

#### Evidencia de state lock contention

La siguiente captura muestra dos sesiones de `terraform apply` ejecutándose en paralelo sobre el mismo workspace. La sesión de la izquierda adquirió el lock primero y está pidiendo el valor de `project_name`; la sesión de la derecha intentó adquirir el mismo lock y DynamoDB rechazó la operación con `ConditionalCheckFailedException`, mostrando el ID del lock activo, la ruta del state, el usuario y el timestamp de creación:

![Terraform state lock contention en DynamoDB](evidence/state-lock-contention.png)

Este comportamiento confirma que el remote state está protegiendo el archivo contra modificaciones concurrentes, evitando corrupción del estado.

### Compute: ECS Fargate Deployed

El siguiente output confirma que el cluster ECS Fargate `oyd-project-dev-cluster` fue aprovisionado exitosamente en AWS. El cluster fue creado mediante el módulo `infra/modules/compute/` en la región `us-east-1`:

![Compute ECS Fargate deployed](evidence/compute-deployed.png)

El output del comando CLI utilizado para verificar el despliegue fue guardado en `evidence/compute-deployed.txt`:

```json
{
    "ClusterName": "oyd-project-dev-cluster",
    "Status": "ACTIVE",
    "ActiveServicesCount": 0
}
```

### Network Foundation: `terraform output`

El siguiente output fue capturado con `terraform output` desde `infra/` y guardado en `evidence/network-foundation.txt`. Refleja el state remoto en S3 en el momento de la entrega D3, antes de ejecutar `terraform apply` con la nueva configuración de red (el apply completo requiere credenciales AWS y propagación del nuevo módulo `network`). Los outputs de VPC, subnets, NAT y ECR aparecerán en su totalidad tras el primer apply con la configuración D3.

```
compute_cluster_arn         = "arn:aws:ecs:us-east-1:733202870569:cluster/oyd-project-dev-cluster"
compute_cluster_name        = "oyd-project-dev-cluster"
compute_task_definition_arn = "arn:aws:ecs:us-east-1:733202870569:task-definition/oyd-project-dev:1"
db_endpoint                 = "oyd-project-dev-db.cutyuaiiee0n.us-east-1.rds.amazonaws.com:5432"
db_instance_arn             = "arn:aws:rds:us-east-1:733202870569:db:oyd-project-dev-db"
db_security_group_id        = "sg-073b317381f74d96c"
storage_bucket_arn          = "arn:aws:s3:::oyd-dev"
storage_bucket_name         = "oyd-dev"
```

El archivo completo se encuentra en [`evidence/network-foundation.txt`](evidence/network-foundation.txt).

### Async Messaging Foundation: `terraform output`

El siguiente output fue capturado con `terraform output` desde `infra/` tras ejecutar `terraform apply -var-file=envs/dev/dev.tfvars`. Refleja las colas SQS y sus DLQs aprovisionadas por el módulo `infra/modules/async/`:

```
email_dlq_arn = "arn:aws:sqs:us-east-1:733202870569:oyd-project-dev-receipt-email-dlq"
email_dlq_url = "https://sqs.us-east-1.amazonaws.com/733202870569/oyd-project-dev-receipt-email-dlq"
email_queue_arn = "arn:aws:sqs:us-east-1:733202870569:oyd-project-dev-receipt-email-queue"
email_queue_url = "https://sqs.us-east-1.amazonaws.com/733202870569/oyd-project-dev-receipt-email-queue"
receipt_dlq_arn = "arn:aws:sqs:us-east-1:733202870569:oyd-project-dev-receipt-dlq"
receipt_dlq_url = "https://sqs.us-east-1.amazonaws.com/733202870569/oyd-project-dev-receipt-dlq"
receipt_queue_arn = "arn:aws:sqs:us-east-1:733202870569:oyd-project-dev-receipt-queue"
receipt_queue_url = "https://sqs.us-east-1.amazonaws.com/733202870569/oyd-project-dev-receipt-queue"
release_dlq_arn = "arn:aws:sqs:us-east-1:733202870569:oyd-project-dev-release-dlq"
release_dlq_url = "https://sqs.us-east-1.amazonaws.com/733202870569/oyd-project-dev-release-dlq"
release_queue_arn = "arn:aws:sqs:us-east-1:733202870569:oyd-project-dev-release-queue"
release_queue_url = "https://sqs.us-east-1.amazonaws.com/733202870569/oyd-project-dev-release-queue"
```

El archivo completo se encuentra en [`evidence/async-foundation.txt`](evidence/async-foundation.txt).

### Event-Driven Compute

### Terraform plan — event-source-plan.txt

El archivo [`evidence/event-source-plan.txt`](evidence/event-source-plan.txt) muestra el
`terraform plan` con los recursos del worker de ECS Fargate y su conexión al módulo async:
el `RECEIPT_QUEUE_URL` de SQS se inyecta como variable de entorno en el task definition
del worker, implementando el VPC track de cómputo asíncrono.

### ECS Worker — variable de entorno RECEIPT_QUEUE_URL

![Variable RECEIPT_QUEUE_URL configurada en el task definition del worker de ECS](evidence/event-source.png)

> Capturado desde **AWS Console → ECS → Task Definitions → oyd-project-dev-worker**,
> mostrando `RECEIPT_QUEUE_URL` apuntando a la SQS queue de recibos — el trigger
> que conecta el módulo async al servicio de cómputo.


### Scheduler: EventBridge Release Sweep

El EventBridge Scheduler `oyd-project-dev-release-expired` dispara un `ReleaseExpiredReservationCommand` cada 20 minutos hacia la `release-queue`. El IAM role del scheduler tiene `sqs:SendMessage` scoped exclusivamente al ARN de la release-queue (sin wildcard).

```
scheduler_role_arn = "arn:aws:iam::733202870569:role/oyd-project-dev-scheduler-role"
scheduler_schedule_name = "oyd-project-dev-release-expired"
```

El archivo completo se encuentra en [`evidence/async-foundation.txt`](evidence/async-foundation.txt).

### IAM Module — Centralized Least-Privilege Roles (Deliverable A)


A continuación se detalla el plan de ejecución enfocado exclusivamente en el módulo centralizado de IAM (`infra/modules/iam/`). Se verifica el aprovisionamiento de los 7 roles canónicos sin el uso de acciones o recursos comodín (`*`).

| Rol Canónico | Componente / Servicio | Principio de Mínimo Privilegio Aplicado |
| :--- | :--- | :--- |
| `compute_exec_role` | ECS Fargate Agent | Descarga de ECR, creación de logs y lectura selectiva de secretos. |
| `compute_task_role` | App (Next.js / Express) | Interacción directa con S3, SQS y conexiones RDS. |
| `async_consumer_receipt_role` | Lambda Recibos | Consumo de SQS y escritura en Bucket S3 de recibos. |
| `async_consumer_release_role` | Lambda Liberación | Consumo de SQS y lectura en Secrets Manager. |
| `async_consumer_email_role` | Lambda Correos | Consumo de SQS de notificaciones. |
| `scheduler_role` | EventBridge Scheduler | Permiso único de SQS:SendMessage hacia la cola destino. |
| `ci_runner_role` | GitHub Actions (OIDC) | Permisos de despliegue acotados por la rama principal (main). |

<details>
<summary><b>Haz clic aquí para expandir el extracto del terraform plan (IAM)</b></summary>

```text
  # module.iam.aws_iam_role.compute_task will be created
  + resource "aws_iam_role" "compute_task" {
      + arn                   = (known after apply)
      + assume_role_policy    = jsonencode(
            {
              + Statement = [
                  + {
                      + Action    = "sts:AssumeRole"
                      + Effect    = "Allow"
                      + Principal = {
                          + Service = "ecs-tasks.amazonaws.com"
                        }
                    },
                ]
              + Version   = "2012-10-17"
            }
        )
      + name                  = "oyd-project-dev-iam-compute-task"
    }

  # module.iam.aws_iam_role_policy.compute_task_s3 will be created
  + resource "aws_iam_role_policy" "compute_task_s3" {
      + name   = "oyd-project-dev-iam-compute-task-s3"
      + policy = jsonencode(
            {
              + Statement = [
                  + {
                      + Action   = [
                          + "s3:GetObject",
                          + "s3:PutObject",
                        ]
                      + Effect   = "Allow"
                      + Resource = "arn:aws:s3:::oyd-project-receipts-dev/*"
                    },
                ]
            }
        )
    }

  # module.iam.aws_iam_role.scheduler will be created
  + resource "aws_iam_role" "scheduler" {
      + name                  = "oyd-project-dev-iam-scheduler"
      + assume_role_policy    = jsonencode(
            {
              + Statement = [
                  + {
                      + Action    = "sts:AssumeRole"
                      + Effect    = "Allow"
                      + Principal = {
                          + Service = "scheduler.amazonaws.com"
                        }
                    },
                ]
            }
        )
    }

  # module.iam.aws_iam_role_policy.scheduler_sqs will be created
  + resource "aws_iam_role_policy" "scheduler_sqs" {
      + name   = "oyd-project-dev-iam-scheduler-sqs"
      + policy = jsonencode(
            {
              + Statement = [
                  + {
                      + Action   = [
                          + "sqs:SendMessage",
                        ]
                      + Effect   = "Allow"
                      + Resource = "arn:aws:sqs:us-east-1:<account-id>:oyd-project-dev-release-queue"
                    },
                ]
            }
        )
    }

  # module.iam.aws_iam_role.ci_runner will be created
  + resource "aws_iam_role" "ci_runner" {
      + name                  = "oyd-project-dev-iam-ci-runner"
      + assume_role_policy    = jsonencode(
            {
              + Statement = [
                  + {
                      + Action    = "sts:AssumeRoleWithWebIdentity"
                      + Condition = {
                          + StringLike = {
                              + "token.actions.githubusercontent.com:sub" = "repo:ChristianSosa22/cicd-foundation-project:ref:refs/heads/main"
                            }
                        }
                      + Principal = {
                          + Federated = "arn:aws:iam::<account-id>:oidc-provider/token.actions.githubusercontent.com"
                        }
                    },
                ]
            }
        )
    }

Plan: 20 to add, 0 to change, 0 to destroy.
```

El plan completo con los 7 roles y sus políticas se encuentra en [`evidence/iam-plan.txt`](evidence/iam-plan.txt).

</details>


### TLS Termination — HTTPS on All Endpoints (Deliverable D)

Certificado ACM wildcard `*.grupo5.oyd.solid.com.gt` con validación DNS automática vía Route 53. Listener HTTPS:443 con policy TLS 1.3. HTTP:80 → HTTPS 301 redirect.

```
acm_certificate_arn  = "arn:aws:acm:us-east-1:733202870569:certificate/3b4bf94b-250c-4f11-89f8-ad97e2eb3434"
acm_status           = "ISSUED"
alb_https_url        = "https://app.grupo5.oyd.solid.com.gt"
app_fqdn             = "app.grupo5.oyd.solid.com.gt"
```

#### Evidencia de TLS

El siguiente extracto muestra los dos curl ejecutados contra `app.grupo5.oyd.solid.com.gt`:

```text
# 1. HTTPS — TLS handshake exitoso + HTTP 200
$ curl -v https://app.grupo5.oyd.solid.com.gt/health
* Connected to app.grupo5.oyd.solid.com.gt (54.162.69.107) port 443
* schannel: SSL/TLS connection renegotiated
< HTTP/1.1 200 OK
< Strict-Transport-Security: max-age=31536000; includeSubDomains
{"status":"ok"}

# 2. HTTP → HTTPS 301 redirect
$ curl -v http://app.grupo5.oyd.solid.com.gt
< HTTP/1.1 301 Moved Permanently
< Location: https://app.grupo5.oyd.solid.com.gt:443/

# 3. ACM Certificate Status + Subject
$ aws acm describe-certificate --certificate-arn arn:aws:acm:us-east-1:733202870569:certificate/3b4bf94b-250c-4f11-89f8-ad97e2eb3434 --query "Certificate.[Status,Subject]"
[
    "ISSUED",
    "CN=app.grupo5.oyd.solid.com.gt"
]
```

La evidencia completa se encuentra en [`evidence/tls-curl.txt`](evidence/tls-curl.txt).