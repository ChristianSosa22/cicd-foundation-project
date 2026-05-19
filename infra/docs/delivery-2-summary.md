
## 1. Compute target and rationale
Se eligió **AWS Lambda** como recurso de compute para esta entrega. Lambda es una función serverless que ejecuta código sin necesidad de aprovisionar ni administrar servidores.

Se eligió sobre las otras opciones disponibles (EC2 y ECS Fargate) por las siguientes razones:
- No requiere configuración de red (VPC, subnets, security groups) para existir, lo que reduce la complejidad del módulo.
- Es el recurso de compute más simple de provisionar con Terraform en AWS.
- Tiene un free tier generoso (1 millón de invocaciones gratuitas al mes), por lo que el costo para esta entrega es prácticamente cero.

**Trade-off considerado:** Lambda tiene un límite de 15 minutos de ejecución por invocación y no es adecuado para procesos de larga duración. Si el proyecto requiriera procesamiento continuo o de larga duración, ECS Fargate sería una mejor opción. Para esta entrega, Lambda es suficiente porque el objetivo es demostrar el aprovisionamiento del recurso, no ejecutar lógica de negocio real.

## 2. Module design
Se crearon tres módulos reutilizables en `infra/modules/`:

### Módulo Compute 

Ubicación: `infra/modules/compute/`

- **Inputs:** `environment` (string), `name` (string), `memory_size` (number, default 128). Todas con `description` y `type`.
- **Outputs:** `function_arn` y `function_name`.
- **Recursos internos:** IAM execution role, IAM policy con permisos mínimos (solo logs en CloudWatch), y la función Lambda.
- **Decisión de diseño:** Se separó la policy del role en un recurso `aws_iam_role_policy` independiente en lugar de usar `managed_policy_arns`. Esto permite definir permisos específicos al nombre de la función usando interpolación de variables, evitando wildcards en el `Resource` de la policy.

### Módulo Storage 

Ubicación: `infra/modules/storage/`

- **Inputs:** `environment` (string), `bucket_name` (string). Ambas con `description` y `type`.
- **Outputs:** `bucket_arn` y `bucket_name`.
- **Recursos internos:** bucket S3, versioning, SSE AES256, lifecycle rule con prefix `uploads/` que transiciona objetos a `STANDARD_IA` a los 30 días, public access block, y bucket policy que fuerza HTTPS mediante `aws:SecureTransport`.
- **Decisión de diseño:** El lifecycle rule se definió con `prefix = "uploads/"` en lugar de aplicarlo al bucket completo. Esto cumple el requisito de la especificación de tener un scope específico y evita mover objetos del sistema a almacenamiento de acceso infrecuente prematuramente.

### Módulo Database 

Ubicación: `infra/modules/database/`

- **Inputs:** `environment` (string), `project_name` (string), `db_name` (string), `db_username` (string), `db_password` (string, sensitive), `db_port` (number, default 5432), `db_instance_class` (string, default `db.t3.micro`), `db_allocated_storage` (number, default 20), `db_engine_version` (string, default `16.0`), `multi_az` (bool, default false).
- **Outputs:** `db_instance_arn`, `db_endpoint`, `db_security_group_id`.
- **Recursos internos:** data sources del VPC por defecto y subnets, security groups para app y DB, subnet group, y una instancia RDS Postgres 16.x con `storage_encrypted = true`.
- **Decisión de diseño:** Se usa el VPC por defecto y sus subnets para evitar crear una VPC dedicada en esta entrega, pero se restringe el acceso al puerto de la base de datos usando reglas SG a SG (solo desde el security group de la app).


### Root Module Wiring

El `infra/main.tf` llama a los tres módulos pasando variables del root como inputs. Los outputs de los módulos se exponen en `infra/outputs.tf`, cumpliendo el requisito de que al menos un output de módulo sea referenciado en el root module.

## 3. Remote State Migration

En la entrega 1 el estado de Terraform se mantenía como archivo local (`terraform.tfstate` en `infra/`). En esta entrega se migró el estado a un **backend remoto** sobre AWS, usando **S3** para almacenamiento y **DynamoDB** para state locking.

### Recursos de backend provisionados

| Recurso             | Nombre                                | Región      |
|---------------------|---------------------------------------|-------------|
| **S3 Bucket**       | `cicd-foundation-project`             | `us-east-1` |
| **DynamoDB Table**  | `cicd-foundation-project-lock`        | `us-east-1` |
| **State key**       | `infra/terraform.tfstate`             | —           |

- El bucket S3 tiene **versionado** (`aws_s3_bucket_versioning`) y **cifrado en reposo AES256** (`aws_s3_bucket_server_side_encryption_configuration`) habilitados.
- La tabla DynamoDB usa `LockID` (string) como hash key y billing `PAY_PER_REQUEST`, que es lo que Terraform espera para el lock.
- Ambos recursos llevan `lifecycle { prevent_destroy = true }` para evitar borrados accidentales que dejarían el state huérfano.

### Pasos seguidos para el bootstrap y migración

El bootstrap del backend se hace **una sola vez** desde un workspace aislado (`infra/bootstrap/`) que mantiene su propio estado local. Esto resuelve el problema del huevo-y-la-gallina: el backend remoto necesita existir antes de que el workspace principal pueda usarlo.

1. **Provisionar bucket + tabla** desde `infra/bootstrap/` con estado local:

   ```bash
   cd infra/bootstrap/
   terraform init
   terraform apply -var-file=envs/dev/dev.tfvars
   ```

   Esto crea `aws_s3_bucket.tfstate`, `aws_s3_bucket_versioning.tfstate`, `aws_s3_bucket_server_side_encryption_configuration.tfstate` y `aws_dynamodb_table.tfstate_lock`.

2. **Declarar el backend en el workspace principal** (`infra/backend.tf`):

   ```hcl
   terraform {
     backend "s3" {
       bucket         = "cicd-foundation-project"
       key            = "infra/terraform.tfstate"
       region         = "us-east-1"
       dynamodb_table = "cicd-foundation-project-lock"
       encrypt        = true
     }
   }
   ```

3. **Migrar el estado local existente** al backend remoto desde `infra/`:

   ```bash
   cd infra/
   terraform init -migrate-state
   ```

   Terraform detecta que existe un `terraform.tfstate` local y un backend nuevo declarado, y pide confirmación explícita antes de copiar el estado a S3.

### Extracto del output de `terraform init -migrate-state`

```
Initializing the backend...

Successfully configured the backend "s3"! Terraform will automatically
use this backend unless the backend configuration changes.

Do you want to copy existing state to the new backend?
  Pre-existing state was found while migrating the previous "local" backend to the
  newly configured "s3" backend. No existing state was found in the newly
  configured "s3" backend. Do you want to copy this state to the new "s3"
  backend? Enter "yes" to copy and "no" to start with an empty state.

  Enter a value: yes


Successfully configured the backend "s3"! Terraform will automatically
use this backend unless the backend configuration changes.

Initializing provider plugins...
- Reusing previous version of hashicorp/aws from the dependency lock file
- Using previously-installed hashicorp/aws v5.100.0

Terraform has been successfully initialized!

You may now begin working with Terraform. Try running "terraform plan" to see
any changes that are required for your infrastructure.
```

Después de la migración, el archivo `terraform.tfstate` local queda vacío (Terraform lo deja como respaldo en `terraform.tfstate.backup`) y todas las operaciones siguientes (`plan`, `apply`, `destroy`) leen y escriben directamente contra el bucket S3, adquiriendo el lock en DynamoDB antes de modificar el state.


## Verificación del State Locking

Para confirmar que el lock de DynamoDB funciona, se corrieron dos `terraform apply` en paralelo sobre el mismo workspace desde dos terminales distintas. La primera sesión adquirió el lock; la segunda fue rechazada por DynamoDB con `ConditionalCheckFailedException`, mostrando el ID del lock activo, el path del state, el usuario que lo tomó y el timestamp:

![Terraform state lock contention en DynamoDB](../evidence/state-lock-contention.png)

Esta evidencia confirma que el backend remoto está protegiendo el state contra escrituras concurrentes, que era el objetivo principal de la migración.

## 4. Database security

La credencial de la base de datos se define como variable `db_password` marcada como **sensitive** y no se escribe en ningun archivo commiteado. En local, el valor se pasa por variable de entorno (`TF_VAR_db_password`) o por `-var`, y en CI se inyecta desde GitHub Secrets. Esto evita que el password quede en `.tf`, `.tfvars` o logs.

La instancia RDS esta cifrada en reposo con `storage_encrypted = true`. El acceso de red se restringe con un **security group** exclusivo para la DB, que solo permite ingreso al puerto configurado (`db_port`) desde el **security group de la aplicacion**. No se permite `0.0.0.0/0` en ingreso. La DB vive en un **subnet group** compuesto por las subnets del VPC por defecto, lo que mantiene la base en red privada sin exponerla directamente a internet.

## 5. Two architectural trade-offs

**Trade-off 1: instancia economica y single-AZ vs. alta disponibilidad.** Se eligio `db.t3.micro` y `multi_az = false` para reducir costos en un MVP. El costo es menor y el aprovisionamiento es mas rapido, pero se sacrifica tolerancia a fallos y tiempo de recuperacion ante una caida de zona. Para un ambiente productivo, se recomendaria habilitar `multi_az` y evaluar clases de instancia mas robustas.

**Trade-off 2: VPC por defecto vs. red dedicada.** Usar el VPC por defecto acelera la entrega y evita agregar mas infraestructura en esta fase. La desventaja es que se pierde control fino sobre subnets, routing y segmentacion avanzada. En una siguiente fase, el proyecto podria mover la DB a una VPC dedicada con subnets privadas y reglas de red mas estrictas para mejorar aislamiento y gobernanza.