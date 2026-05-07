# Summary — Delivery 1

| Parametro             | Detalle                       |
|-----------------------|-------------------------------|
| **Curso**             | Optimizaciones y Desempeño    |
| **Fecha de entrega**  | 10 de mayo de 2026            |
| **Tag de entrega**    | `oyd-delivery-1`              |

---

## 1. Cloud Provider and Region Selected

Se eligió **AWS** como proveedor cloud, configurado en la región **`us-east-1` (N. Virginia)**.

La elección de AWS responde a que es el proveedor con mayor cobertura de servicios gestionados y documentación disponible, lo que reduce la fricción al arrancar un proyecto desde cero. El proveedor se configura en `provider.tf` usando el plugin oficial de HashiCorp, pinado a la versión `~> 5.0` para garantizar compatibilidad sin actualizaciones automáticas que puedan romper la configuración:

```hcl
terraform {
  required_version = ">= 1.8, < 2.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}
```

La región `us-east-1` se eligió por ser la región principal de AWS, con la mayor cantidad de servicios disponibles y la latencia más baja hacia la mayoría de las APIs de AWS (como S3 y IAM). No se hardcodeó la región en el provider, se toma del archivo de variables, lo que permite cambiarla por ambiente sin modificar código.

---

## 2. Provisioned Resource

Se aprovisionó un **bucket de S3** (`aws_s3_bucket`) como primer recurso del workspace.

Se eligió S3 por ser un recurso simple, sin dependencias de red ni de otros servicios, que permite validar que el proveedor está bien configurado, que las credenciales funcionan, y que el ciclo completo de plan → apply → destroy opera correctamente. Es la forma más directa de confirmar que Terraform puede comunicarse con AWS.

El bucket se define en `main.tf`:

```hcl
resource "aws_s3_bucket" "this" {
  bucket = "${var.bucket_name_prefix}-${var.environment}"

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}
```

El nombre del bucket se construye dinámicamente combinando el prefijo (`oyd`) con el ambiente (`dev`), resultando en `oyd-dev`. Las etiquetas (`tags`) permiten identificar a qué proyecto y ambiente pertenece el recurso directamente desde la consola de AWS.

Extracto del output de `terraform plan`:

```
# aws_s3_bucket.this will be created
+ resource "aws_s3_bucket" "this" {
    + bucket      = "oyd-dev"
    + force_destroy = false
    + tags        = {
        + "Environment" = "dev"
        + "Project"     = "oyd-project"
      }
    + tags_all    = {
        + "Environment" = "dev"
        + "Project"     = "oyd-project"
      }
    + arn         = (known after apply)
    + id          = (known after apply)
    + region      = (known after apply)
  }

Plan: 1 to add, 0 to change, 0 to destroy.

Changes to Outputs:
  + bucket_arn  = (known after apply)
  + bucket_name = "oyd-dev"
```

---

## 3. CI Pipeline Architecture

El pipeline se define en `.github/workflows/terraform-ci.yml` y se activa automáticamente en cada Pull Request que apunte a la rama `main`. Está compuesto por 5 pasos en orden:

| Paso  | Comando | Propósito |
|-------|---------|-----------|
| 1     | `terraform fmt --check -recursive`                | Verifica que todos los archivos `.tf` estén correctamente formateados. Si alguno necesita cambios, el paso falla y bloquea el merge. |
| 2     | `terraform init -backend=false`                   | Descarga los plugins del proveedor AWS para que los pasos siguientes puedan funcionar. El flag `-backend=false` evita que intente conectarse a un backend remoto. |
| 3     | `terraform validate`                              | Analiza estáticamente la configuración: verifica que los tipos de variables sean correctos, que todas las referencias existan, y que no haya errores de sintaxis. |
| 4     | `terraform plan -var-file=envs/dev/dev.tfvars`    | Conecta con AWS y calcula exactamente qué recursos se crearían o modificarían. Este paso requiere credenciales reales y no puede fallar sin bloquear el merge. |
| 5     | Post del plan como comentario en el PR            | Usa `actions/github-script` para publicar el output del `plan` dentro del PR como un bloque colapsable `<details>`. Es no-bloqueante (`continue-on-error: true`) porque es informativo, no funcional. |

### Estrategia de credenciales
Las credenciales de AWS (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`) se inyectan al runner exclusivamente a través de **GitHub Secrets** usando la action oficial `aws-actions/configure-aws-credentials@v4`. Nunca se escriben en el YAML del workflow ni en ningún archivo del repositorio.

### PR de verificación
El pipeline fue verificado exitosamente en el siguiente PR

[Ver PR de prueba ]()

---

## 4. Variable Design

Las variables se definen en `variables.tf` y sus valores para el ambiente de desarrollo se proveen en `envs/dev/dev.tfvars`.

| Variable              | Tipo   | Valor en `dev`   | En `prod` sería                                                   |
|-----------------------|--------|------------------|-------------------------------------------------------------------|
| `environment`         | string | `"dev"`          | `"prod"`                                                          |
| `project_name`        | string | `"oyd-project"`  | `"oyd-project"`                                                   |
| `region`              | string | `"us-east-1"`    | Podría ser `"us-west-2"` u otra región según la latencia objetivo |
| `bucket_name_prefix`  | string | `"oyd"`          | `"oyd"` (igual, el ambiente lo diferencia en el nombre final)     |

### Cómo se diferencia dev de prod
El valor de `environment` es el que cambia entre ambientes y funciona como sufijo en todos los nombres de recursos. Así, el bucket en `dev` se llama `oyd-dev` y en `prod` se llamaría `oyd-prod`. Esto evita colisiones de nombres entre ambientes dentro de la misma cuenta de AWS. Las variables de `project_name` y `bucket_name_prefix` son constantes entre ambientes porque son parte de la identidad del proyecto, no del ambiente de despliegue.

---

## 5. Decisions and Trade-Offs

### Decisión 1: Estado de Terraform local en lugar de backend remoto

Se optó por usar **estado local** (`terraform.tfstate` en el directorio `infra/`) en lugar de configurar un backend remoto (como S3 + DynamoDB para lock). La razón principal es que en esta primera entrega el objetivo es validar que el proveedor, las variables y el pipeline funcionen end-to-end sin agregar capas de infraestructura adicionales que requieran su propio proceso de bootstrap. Un backend remoto en S3 requiere que ese bucket ya exista antes de correr `terraform init`, lo que crea un problema de dependencia circular cuando el workspace mismo está arrancando desde cero. El trade-off aceptado es que el archivo de estado puede quedar en el repositorio, lo que no es una práctica recomendada para ambientes productivos, pero es aceptable para esta fase de fundación.

### Decisión 2: Pinning de versión del proveedor con `~> 5.0` en lugar de una versión exacta

Se usó el operador `~>` (pessimistic constraint) para el proveedor de AWS en lugar de fijar una versión exacta como `= 5.100.0`. Esto permite que Terraform actualice automáticamente a parches y versiones menores dentro de la serie `5.x` (por ejemplo, de `5.100.0` a `5.101.0`), pero impide saltos a versiones mayores que pueden incluir breaking changes. El archivo `.terraform.lock.hcl` complementa esta estrategia al registrar la versión exacta que se resolvió (`5.100.0`) y sus hashes de verificación, garantizando que todos los miembros del equipo y el runner de CI usen exactamente el mismo binario del proveedor, sin importar cuándo corran `terraform init`.