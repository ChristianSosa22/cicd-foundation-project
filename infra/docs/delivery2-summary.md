
## 1. Compute target and rationale
## 2. Module design
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

## 5. Two architectural trade-offs