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

## 4. Remote State (S3 + DynamoDB)

El estado de Terraform se almacena de forma remota para permitir colaboración entre múltiples usuarios y proteger contra escrituras concurrentes. La configuración del backend está definida en `backend.tf`:

- **Bucket S3:** `cicd-foundation-project` — guarda el archivo `infra/terraform.tfstate` con **versionado** y **cifrado en reposo (AES256)** habilitados.
- **Tabla DynamoDB:** `cicd-foundation-project-lock` — implementa el mecanismo de **state locking**. Cada vez que un usuario corre `terraform plan` o `apply`, Terraform escribe un registro de lock en esta tabla; si otro usuario intenta correr una operación al mismo tiempo, recibirá un error y deberá esperar.

Los recursos del backend (bucket + tabla) se provisionan una sola vez desde el subdirectorio `bootstrap/`, que mantiene su propio estado local fuera del backend remoto para evitar el problema del "huevo y la gallina".

### Evidencia de state lock contention

La siguiente captura muestra dos sesiones de `terraform apply` ejecutándose en paralelo sobre el mismo workspace. La sesión de la izquierda adquirió el lock primero y está pidiendo el valor de `project_name`; la sesión de la derecha intentó adquirir el mismo lock y DynamoDB rechazó la operación con `ConditionalCheckFailedException`, mostrando el ID del lock activo, la ruta del state, el usuario y el timestamp de creación:

![Terraform state lock contention en DynamoDB](evidence/state-lock-contention.png)

Este comportamiento confirma que el remote state está protegiendo el archivo contra modificaciones concurrentes, evitando corrupción del estado.