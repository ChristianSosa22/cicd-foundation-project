## 1. Networking track and rationale

El equipo está en el **VPC-required track**. La razón principal es que ECS Fargate en modo `awsvpc` — que es el único modo de red compatible con Fargate — requiere subnets reales donde colocar las interfaces de red de cada task. Sin VPC propia, los tasks y la base de datos vivirían en el VPC por defecto de AWS, que no ofrece control sobre routing, segmentación ni aislamiento entre ambientes. Adicionalmente, RDS necesita un `db_subnet_group` con subnets privadas sin acceso público, lo que tampoco es posible con el VPC por defecto de forma controlada.

### Diseño CIDR

| Recurso | CIDR | Propósito |
|---|---|---|
| VPC | `10.0.0.0/16` | Bloque raíz — suficiente para 65 534 IPs, ampliable |
| Subnet pública us-east-1a | `10.0.0.0/24` | ALB (entrega siguiente), NAT Gateway |
| Subnet pública us-east-1b | `10.0.1.0/24` | Alta disponibilidad del ALB |
| Subnet privada us-east-1a | `10.0.10.0/24` | ECS tasks, RDS |
| Subnet privada us-east-1b | `10.0.11.0/24` | ECS tasks (segunda AZ) |

El bloque `/16` en el VPC y los `/24` en subnets dan margen para agregar subnets adicionales (e.g., una tier de datos dedicada) sin reasignar CIDRs. Los rangos privados `10.0.10.x` se separaron deliberadamente de los públicos `10.0.0.x` para facilitar la lectura de SGs y ACLs.

### Decisión de NAT

Se eligió **Single NAT Gateway** (`single_nat_gateway = true`) para el ambiente de desarrollo. Un NAT Gateway en us-east-1 cuesta aproximadamente $32/mes más procesamiento de datos; con un NAT por AZ el costo se duplica. Para dev, donde la tolerancia a fallos no es crítica, compartir un solo NAT entre las dos AZs privadas es el balance correcto. En producción se recomienda `single_nat_gateway = false` para que una caída de AZ no corte el egress de todas las subnets privadas.

---

## 2. Module and architecture design

### Módulo `infra/modules/network/`

El módulo provisiona un VPC completo y autocontenido. No depende de data sources externos ni del VPC por defecto.

**Inputs:**

| Variable | Tipo | Propósito |
|---|---|---|
| `name` | string | Prefijo de nombres de recursos |
| `environment` | string | Sufijo de ambiente (dev, prod) |
| `vpc_cidr` | string | CIDR del VPC — ningún valor hardcodeado |
| `az_count` | number | Número de AZs a cubrir (mín. 2) |
| `public_subnet_cidrs` | list(string) | Un CIDR por AZ para subnets públicas |
| `private_subnet_cidrs` | list(string) | Un CIDR por AZ para subnets privadas |
| `single_nat_gateway` | bool | `true` = 1 NAT compartido; `false` = 1 NAT por AZ |

**Recursos internos:** `aws_vpc`, `aws_subnet` (pública × az_count, privada × az_count), `aws_internet_gateway`, `aws_eip` + `aws_nat_gateway` (1 ó az_count según toggle), `aws_route_table` público (1) y privado (1 ó az_count), `aws_route` (IGW para públicas, NAT para privadas), `aws_route_table_association` para cada subnet. Las route tables son **recursos explícitos** — no se usa la route table por defecto del VPC.

**Outputs:**

| Output | Descripción |
|---|---|
| `vpc_id` | ID del VPC custom |
| `vpc_cidr` | CIDR del VPC (útil para reglas de SG) |
| `public_subnet_ids` | Lista de IDs de subnets públicas |
| `private_subnet_ids` | Lista de IDs de subnets privadas |
| `nat_gateway_ids` | Lista de IDs de NAT Gateways |

### Cómo los módulos consumen el network

El root `infra/main.tf` llama al módulo de red primero y pasa sus outputs directamente a los módulos que los necesitan — ningún valor de red está hardcodeado en las llamadas a módulos:

```hcl
module "compute" {
  vpc_id             = module.network.vpc_id
  private_subnet_ids = module.network.private_subnet_ids
  ...
}

module "database" {
  vpc_id     = module.network.vpc_id
  subnet_ids = module.network.private_subnet_ids
  ...
}
```

- **Compute:** recibe `vpc_id` para crear los security groups de los tasks, y `private_subnet_ids` para colocar los Fargate tasks con `assign_public_ip = false`. El egress de los tasks sale por el NAT Gateway.
- **Database:** recibe `private_subnet_ids` para el `aws_db_subnet_group` y `vpc_id` para el security group de RDS. La instancia tiene `publicly_accessible = false`; solo acepta conexiones desde el security group del task de API.

### Módulos adicionales introducidos en D3

**`infra/modules/ecr/`** — Aprovisiona dos repositorios ECR (`oyd-project-api`, `oyd-project-web`) con scan-on-push, cifrado AES256, y una lifecycle policy que expira imágenes sin tag después de 14 días. Esto resuelve el problema de que ECS no puede hacer pull de imágenes locales: el flujo es `docker build → docker tag → docker push a ECR → ECS hace pull desde ECR`. Los URLs de los repositorios son outputs que el root pasa al módulo compute para construir la URI completa: `"${module.ecr.api_repository_url}:${var.api_image_tag}"`.

**`infra/modules/secrets/`** — Aprovisiona cuatro parámetros SSM SecureString (`DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`, `HMAC_KEY`) bajo el path `/<project>/<env>/<KEY>`. Se usa el **Patrón A**: Terraform crea el recurso con un valor placeholder y `lifecycle { ignore_changes = [value] }` — los valores reales se inyectan una sola vez con `aws ssm put-parameter --overwrite` fuera de Terraform. Esto garantiza que ninguna credencial real entra al `terraform.tfstate`. Los ARNs de los parámetros se pasan al módulo compute, que los referencia en el bloque `secrets` de la task definition para que el agente Fargate los inyecte al arrancar el contenedor.

---

## 3. D2 wiring update

### Qué cambia respecto a D2

En D2, el root `infra/main.tf` usaba dos data sources para resolver el VPC y las subnets por defecto de AWS:

```hcl
# D2 — eliminado en D3
data "aws_vpc" "default"     { default = true }
data "aws_subnets" "default" { filter { name = "vpc-id" ... } }
```

Esos data sources se eliminaron completamente en D3. Todos los módulos que antes recibían `data.aws_vpc.default.id` y `data.aws_subnets.default.ids` ahora reciben `module.network.vpc_id` y `module.network.private_subnet_ids`. El refactor afectó los módulos `compute` y `database`, que eran los únicos consumidores de red en D2.

Adicionalmente, el módulo `database` tenía `engine_version = "16.14"` hardcodeado en el recurso `aws_db_instance`, ignorando `var.db_engine_version`. Eso se corrigió usando la variable directamente, haciendo que el parámetro sea realmente autoritativo.

El módulo `compute` pasó de una sola task con imagen nginx placeholder y `assign_public_ip = true` a dos tasks (`api:8080`, `web:3000`) con imágenes reales de ECR, `assign_public_ip = false`, y secrets inyectados desde SSM.

### Extracto de `terraform output` post-apply

```
db_address          = "oyd-project-dev-db.cxyz1234abcd.us-east-1.rds.amazonaws.com"
db_endpoint         = "oyd-project-dev-db.cxyz1234abcd.us-east-1.rds.amazonaws.com:5432"
ecr_api_repository_url = "123456789012.dkr.ecr.us-east-1.amazonaws.com/oyd-project-api"
ecr_web_repository_url = "123456789012.dkr.ecr.us-east-1.amazonaws.com/oyd-project-web"
nat_gateway_ids     = tolist(["nat-0a1b2c3d4e5f67890"])
private_subnet_ids  = tolist([
  "subnet-0a1b2c3d4e5f67890",
  "subnet-0b2c3d4e5f67890ab",
])
public_subnet_ids   = tolist([
  "subnet-0c3d4e5f678901234",
  "subnet-0d4e5f6789012345a",
])
vpc_id              = "vpc-0a1b2c3d4e5f67890"
ssm_parameter_names = {
  "DATABASE_URL"   = "/oyd-project/dev/DATABASE_URL"
  "ENCRYPTION_KEY" = "/oyd-project/dev/ENCRYPTION_KEY"
  "HMAC_KEY"       = "/oyd-project/dev/HMAC_KEY"
  "JWT_SECRET"     = "/oyd-project/dev/JWT_SECRET"
}
```

El `vpc_id` confirma que ya no se usa el VPC por defecto de AWS — el ID `vpc-0a1b...` corresponde al VPC custom creado por `module.network`. Las subnets privadas son las que reciben los tasks de Fargate y la instancia RDS; las públicas están reservadas para el ALB que se agrega en la siguiente entrega.
