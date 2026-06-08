## 1. Networking track and rationale

El equipo está en el **VPC-required track**. La razón principal es que ECS Fargate en modo `awsvpc` — que es el único modo de red compatible con Fargate — requiere subnets reales donde colocar las interfaces de red de cada task. Sin VPC propia, los tasks y la base de datos vivirían en el VPC por defecto de AWS, que no ofrece control sobre routing, segmentación ni aislamiento entre ambientes. Adicionalmente, RDS necesita un `db_subnet_group` con subnets privadas sin acceso público, lo que tampoco es posible con el VPC por defecto de forma controlada.

### Diseño CIDR

El diseño de tres niveles (public, private-app, private-data) fue definido por el **Estudiante A** en el módulo de red. Las subnets se segmentaron en tres tiers para aplicar controles de acceso diferenciados por capa.

| Recurso | CIDR | Propósito |
|---|---|---|
| VPC | `10.0.0.0/16` | Bloque raíz — suficiente para 65 534 IPs, ampliable |
| Subnet pública us-east-1a | `10.0.0.0/24` | ALB, NAT Gateway |
| Subnet pública us-east-1b | `10.0.1.0/24` | ALB (HA segunda AZ) |
| Subnet privada app us-east-1a | `10.0.11.0/24` | ECS Fargate tasks (API + Web) |
| Subnet privada app us-east-1b | `10.0.12.0/24` | ECS Fargate tasks (HA) |
| Subnet privada data us-east-1a | `10.0.21.0/24` | RDS PostgreSQL (aislada, sin ruta a internet) |
| Subnet privada data us-east-1b | `10.0.22.0/24` | RDS PostgreSQL (HA) |

El bloque `/16` en el VPC y los `/24` en subnets dan margen para agregar subnets adicionales sin reasignar CIDRs. Los rangos se separaron deliberadamente en tres tiers (público `10.0.0.x`, app `10.0.11.x`, data `10.0.21.x`) para facilitar la lectura de SGs y ACLs.

### Decisión de NAT

Se eligió **Single NAT Gateway** (`single_nat_gateway = true`) para el ambiente de desarrollo. Un NAT Gateway en us-east-1 cuesta aproximadamente $32/mes más procesamiento de datos; con un NAT por AZ el costo se duplica. Para dev, donde la tolerancia a fallos no es crítica, compartir un solo NAT entre las dos AZs privadas es el balance correcto. En producción se recomienda `single_nat_gateway = false` para que una caída de AZ no corte el egress de todas las subnets privadas.

---

## 2. Module and architecture design

### Módulo `infra/modules/network/`

El módulo provisiona un VPC completo y autocontenido con tres tiers de subnets. No depende de data sources externos ni del VPC por defecto.

**Inputs:**

| Variable | Tipo | Propósito |
|---|---|---|
| `name` | string | Prefijo de nombres de recursos |
| `environment` | string | Sufijo de ambiente (dev, prod) |
| `vpc_cidr` | string | CIDR del VPC — ningún valor hardcodeado |
| `az_count` | number | Número de AZs a cubrir (mín. 2) |
| `public_subnet_cidrs` | list(string) | Un CIDR por AZ para subnets públicas |
| `private_app_subnet_cidrs` | list(string) | Un CIDR por AZ para subnets privadas de aplicación |
| `private_data_subnet_cidrs` | list(string) | Un CIDR por AZ para subnets privadas de datos (RDS) |
| `single_nat_gateway` | bool | `true` = 1 NAT compartido; `false` = 1 NAT por AZ |

**Recursos internos:** `aws_vpc`, `aws_subnet` (pública × az_count, private_app × az_count, private_data × az_count), `aws_internet_gateway`, `aws_eip` + `aws_nat_gateway` (1 ó az_count según toggle), `aws_route_table` público (1), privado-app (1 ó az_count), y privado-data (1, sin ruta 0.0.0.0/0). Las route tables son **recursos explícitos**. Incluye `aws_network_acl` público y privado con reglas stateless.

**Outputs:**

| Output | Descripción |
|---|---|
| `vpc_id` | ID del VPC custom |
| `vpc_cidr` | CIDR del VPC |
| `public_subnet_ids` | Lista de IDs de subnets públicas |
| `private_app_subnet_ids` | Lista de IDs de subnets privadas de aplicación |
| `private_data_subnet_ids` | Lista de IDs de subnets privadas de datos |
| `nat_gateway_ids` | Lista de IDs de NAT Gateways |
| `public_nacl_id` | ID del NACL público |
| `private_nacl_id` | ID del NACL privado |

### Módulo `infra/modules/security/`

Creado por el **Estudiante B** para centralizar los controles de acceso de red. Provisiona cuatro security groups encadenados con reglas tipo SG-to-SG usando recursos independientes `aws_security_group_rule` para evitar dependencias circulares.

| SG | Recursos asignados | Reglas principales |
|---|---|---|
| `web-sg` | ALB (capa pública) | Ingress 80/443 desde 0.0.0.0/0. Egress a app-sg:8080, web-service-sg:3000. |
| `app-sg` | API ECS tasks | Ingress 8080 desde web-sg y web-service-sg. Egress a db-sg:5432 + internet vía NAT. |
| `web-service-sg` | Web ECS tasks (Next.js) | Ingress 3000 desde web-sg. Egress a app-sg:8080 + internet vía NAT. |
| `db-sg` | RDS PostgreSQL | Ingress 5432 desde app-sg únicamente. **Sin reglas de egress** — los SGs son stateful. |

Todos los puertos (`app_port`, `web_port`, `db_port`) y CIDRs son variables de entrada con valores default.

### Cómo los módulos consumen el network y el security

El root `infra/main.tf` llama a los módulos en orden de dependencia y pasa sus outputs directamente:

```hcl
module "network" { ... }        # Crea VPC + subnets + NACLs
module "security" {             # Crea SGs en la VPC del network
  vpc_id = module.network.vpc_id
}
module "database" {
  subnet_ids           = module.network.private_data_subnet_ids
  db_security_group_id = module.security.db_security_group_id
}
module "compute" {
  private_subnet_ids            = module.network.private_app_subnet_ids
  api_security_group_id         = module.security.app_security_group_id
  web_service_security_group_id = module.security.web_service_security_group_id
}
```

- **Compute:** recibe los SG IDs del módulo de seguridad y los asigna a los ECS services. Tasks en subnets privadas app con `assign_public_ip = false`.
- **Database:** recibe `db_security_group_id` del módulo de seguridad. RDS se despliega en subnets privadas data (aisladas, sin ruta NAT).

### Módulos adicionales introducidos en D3

**`infra/modules/ecr/`** — Aprovisiona dos repositorios ECR (`oyd-project-api`, `oyd-project-web`) con scan-on-push, cifrado AES256, y una lifecycle policy que expira imágenes sin tag después de 14 días. Esto resuelve el problema de que ECS no puede hacer pull de imágenes locales: el flujo es `docker build → docker tag → docker push a ECR → ECS hace pull desde ECR`. Los URLs de los repositorios son outputs que el root pasa al módulo compute para construir la URI completa: `"${module.ecr.api_repository_url}:${var.api_image_tag}"`.

**`infra/modules/secrets/`** — Aprovisiona cuatro parámetros SSM SecureString (`DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`, `HMAC_KEY`) bajo el path `/<project>/<env>/<KEY>`. Se usa el **Patrón A**: Terraform crea el recurso con un valor placeholder y `lifecycle { ignore_changes = [value] }` — los valores reales se inyectan una sola vez con `aws ssm put-parameter --overwrite` fuera de Terraform. Esto garantiza que ninguna credencial real entra al `terraform.tfstate`. Los ARNs de los parámetros se pasan al módulo compute, que los referencia en el bloque `secrets` de la task definition para que el agente Fargate los inyecte al arrancar el contenedor.

**`infra/modules/alb/`** — Provisiona el ingress público de la aplicación: un Application Load Balancer internet-facing colocado en las subnets públicas (`module.network.public_subnet_ids`), su security group, dos target groups (`api` en `:8080`, `web` en `:3000`) con `target_type = ip` (requerido por el modo `awsvpc` de Fargate), y un listener en el puerto 80. El listener usa enrutamiento por path: una regla de prioridad 100 envía `/api/*`, `/availability`, `/reservar`, `/reservations/*`, `/health` y `/ready` al target group del API; el resto del tráfico (acción por defecto) va al target group del web. El health check del target group web usa `var.health_check_path` (default `/`, con matcher `200-399` porque Next.js responde `307 → /login` en la raíz), mientras que el del API usa `/health`. El módulo exporta `alb_dns_name` y `alb_url` (la URL pública dinámica expuesta como output del root), además de `alb_security_group_id` y los ARNs de los target groups, que el módulo `compute` consume para registrar los tasks de Fargate y para restringir el ingress de sus security groups.

---

## 3. D2 wiring update

### Wiring de subnets (Estudiante A)

El **Estudiante A** completó el refactor de red en `infra/modules/network/`:
- Separó las subnets privadas en dos tiers: `private_app` y `private_data`.
- Creó una route table `data` dedicada sin ruta 0.0.0.0/0, aislando RDS de internet.
- El root `infra/main.tf` y sus variables fueron actualizados para consumir los nuevos outputs separados.

### Refactor de Security Groups (Estudiante B)

En D2, los security groups se creaban dentro de los módulos `compute` y `database` con reglas inline usando `cidr_blocks = ["0.0.0.0/0"]`:

```hcl
# D2 — eliminado en D3
resource "aws_security_group" "api" {
  ingress {
    cidr_blocks = ["0.0.0.0/0"]   # Abierto a toda la VPC
    ...
  }
}
```

En D3, todos los security groups se movieron a `infra/modules/security/` con reglas SG-to-SG (referencia por ID, no CIDR). Los módulos `compute` y `database` ahora reciben los SG IDs como variables de entrada. Esto:

1. **Elimina el uso de CIDR abierto** (`0.0.0.0/0`) en reglas entre tiers.
2. **Centraliza la gestión** de reglas en un solo lugar.
3. **Elimina la dependencia circular** usando recursos `aws_security_group_rule` independientes.
4. **Elimina el egress a internet** del `db-sg` — al ser stateful, solo necesita el ingress rule.

Adicionalmente, el módulo `database` tenía `engine_version = "16.14"` hardcodeado en el recurso `aws_db_instance`, ignorando `var.db_engine_version`. Eso se corrigió usando la variable directamente, haciendo que el parámetro sea realmente autoritativo.

El módulo `compute` pasó de una sola task con imagen nginx placeholder y `assign_public_ip = true` a dos tasks (`api:8080`, `web:3000`) con imágenes reales de ECR, `assign_public_ip = false`, y secrets inyectados desde SSM.

### Extracto de `terraform output` post-apply

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

---

## 4. Security

### Estrategia SG-to-SG

Se eligió usar **referencias por ID de security group** (`source_security_group_id`) en lugar de CIDR blocks para todo el tráfico entre tiers. Las razones:

1. **Granularidad:** Una regla SG-to-SG permite que cualquier recurso en el SG origen tenga acceso, sin importar su IP. Si se escalan tareas, las nuevas IPs privadas se incluyen automáticamente sin modificar reglas.
2. **Seguridad por aislamiento:** En lugar de abrir un CIDR de VPC completo (`10.0.0.0/16`) entre tiers, solo el SG específico puede comunicarse. Por ejemplo, `db-sg` solo acepta tráfico desde `app-sg`, no desde cualquier recurso en la VPC.
3. **Mantenibilidad:** Si un SG origen se refactoriza (nuevo nombre, nuevas reglas), las referencias se mantienen válidas.

### Reglas implementadas

| SG | Dirección | Fuente/Destino | Puerto | Protocolo |
|---|---|---|---|---|
| web-sg | Ingress | `0.0.0.0/0` | 80, 443 | TCP |
| web-sg | Egress | app-sg (SG ID) | 8080 | TCP |
| web-sg | Egress | web-service-sg (SG ID) | 3000 | TCP |
| app-sg | Ingress | web-sg (SG ID) | 8080 | TCP |
| app-sg | Ingress | web-service-sg (SG ID) | 8080 | TCP |
| app-sg | Egress | db-sg (SG ID) | 5432 | TCP |
| app-sg | Egress | `0.0.0.0/0` | -1 (todo) | -1 |
| web-service-sg | Ingress | web-sg (SG ID) | 3000 | TCP |
| web-service-sg | Egress | app-sg (SG ID) | 8080 | TCP |
| web-service-sg | Egress | `0.0.0.0/0` | -1 (todo) | -1 |
| db-sg | Ingress | app-sg (SG ID) | 5432 | TCP |
| db-sg | Egress | *(ninguna — stateful)* | — | — |

`db-sg` **no tiene reglas de egress**. Los security groups de AWS son stateful: el tráfico de respuesta para conexiones entrantes permitidas fluye automáticamente. Tampoco tiene ingress desde `0.0.0.0/0` en ningún puerto, cumpliendo con el requisito de "no direct internet egress/ingress" para la capa de datos.

### Network ACLs

Se implementaron dos NACLs stateless en el módulo `infra/modules/network/nacl.tf`:

**NACL público** (asociado a subnets públicas):
- Inbound: HTTP(80), HTTPS(443) y efímeros(1024-65535) desde `0.0.0.0/0`.
- Outbound: HTTP, HTTPS, efímeros a `0.0.0.0/0`, y puertos app(8080)+web(3000) al VPC CIDR.

**NACL privado** (asociado a subnets `private_app` y `private_data`):
- Inbound: puertos app(8080), web(3000) y db(5432) desde VPC CIDR, efímeros desde `0.0.0.0/0`.
- Outbound: HTTP, HTTPS y efímeros a `0.0.0.0/0`, efímeros al VPC CIDR.

Al ser stateless, ambos NACLs incluyen reglas explícitas para el rango de puertos efímeros (`1024-65535`) en inbound y outbound, permitiendo que las respuestas de peticiones legítimas fluyan sin bloqueos. Todas las reglas son recursos Terraform explícitos (`aws_network_acl_rule`).

---

## 5. Capa de Ingress, Endpoints, Seeders y CI/CD

Esta sección documenta la capa de exposición pública, la lógica funcional de negocio, la automatización de datos semilla y la extensión del pipeline de integración continua.

### 4.1 Ingress público (ALB)

El Application Load Balancer (módulo `infra/modules/alb/`, descrito en la sección 2) es el único punto de entrada desde internet. Su diseño aplica el principio de mínimo perímetro expuesto:

- **Aislamiento de cómputo:** los tasks de ECS Fargate viven en subnets privadas sin IP pública (`assign_public_ip = false`). El tráfico de los usuarios nunca llega directo a los contenedores; siempre pasa por el ALB.
- **Security group encadenado:** el `alb-sg` acepta tráfico público solo en los puertos 80/443. A su vez, los security groups del API (`:8080`) y del web (`:3000`) fueron refactorizados para aceptar ingress **únicamente desde el `alb-sg`** (vía `security_groups = [var.alb_security_group_id]`), eliminando los bloques `0.0.0.0/0` que existían en D2. Así, aunque alguien conociera la IP privada de un task, no podría alcanzarlo sin pasar por el balanceador.
- **URL pública dinámica:** el root expone `alb_url` como output, evitando hardcodear DNS. Este valor es el que se usa en las evidencias `curl` y como base pública de la aplicación.

### 4.2 Endpoints funcionales de negocio

Los dos endpoints críticos definidos por la especificación ya están implementados en el backend (Node/Express) y fueron verificados contra los requisitos de la entrega:

- **`GET /availability`** (`availability.routes.ts`): requiere autenticación (`requireAuth`), consulta RDS PostgreSQL en tiempo real cruzando tres fuentes (espacios activos, reservas vigentes del día y blackouts), y devuelve un JSON estructurado por espacio con su `estado` (`Disponible` / `Ocupado` / `Reservado`) y `ultima_actualizacion`. Para conductores, filtra los espacios según su `category`. Decisión de diseño: el endpoint retorna el **detalle por espacio** en lugar de un conteo agregado, porque el conteo es derivable trivialmente del detalle y este último es más útil para el frontend.

- **`POST /reservar`** (`reservations.routes.ts`): requiere rol `driver`, valida el payload con Zod (`space_id`, `vehicle_id`, `reservation_date`) y aplica seis validaciones de negocio (propiedad y aprobación del vehículo, existencia y estado del espacio, compatibilidad de tipo, categoría permitida, ausencia de blackout) antes de un INSERT atómico. Tras crear la reserva, genera un comprobante PDF y lo persiste en el bucket S3 de comprobantes. Responde **HTTP 201 Created** incluyendo el identificador único del archivo (`receipt_s3_key`, con formato determinista `receipts/<id>.pdf`).

**Ajuste realizado en esta entrega:** originalmente la respuesta 201 no incluía la Key del comprobante porque la subida a S3 era completamente asíncrona (fire-and-forget). Para cumplir la especificación ("responder con la Key del archivo generado"), se calculó la Key de forma determinista **antes** del bloque asíncrono y se incluyó en la respuesta 201, manteniendo la subida del PDF en segundo plano para no bloquear la respuesta. La verificación de tipos (`tsc --noEmit`) pasa sin errores.

### 4.3 Automatización de seeders

La especificación prohíbe la inserción manual de datos y exige que el catálogo (usuarios, espacios, categorías permitidas, tarifas y settings) se inyecte automáticamente tras el aprovisionamiento. La solución tiene dos piezas:

**Pieza 1 — Script de seed idempotente.** El archivo `backend/sql/seed.sql` se hizo idempotente para que pueda ejecutarse múltiples veces (reintentos de CI, merges sucesivos) sin fallar por claves duplicadas ni insertar datos repetidos:
- Los INSERT con restricción única usan `ON CONFLICT ... DO NOTHING` (`users` por `email`, `parking_spaces` por `label`, `space_allowed_category` por su PK `(space_id, category)`, `settings` por `key`).
- La tabla `tariffs` es append-only y no tiene restricción única sobre el tipo de vehículo, por lo que se usó `WHERE NOT EXISTS (SELECT 1 FROM tariffs)` para que el bloque solo siembre cuando la tabla está vacía.
- Se corrigió además un fragmento de texto inválido que rompía la sintaxis del archivo original.

Se agregaron los scripts `db:seed` (aplica `seed.sql` con `ON_ERROR_STOP=1`) y `db:init` (aplica schema + seed en orden para entornos nuevos) en `backend/package.json`.

**Pieza 2 — Ejecución dentro de la VPC.** Como la instancia RDS está en subnet privada (sin acceso público, por diseño de seguridad), el runner de GitHub Actions no puede conectarse a ella directamente. Ejecutar el seed desde una "terminal externa" violaría tanto la regla de la especificación como el aislamiento de red. Por eso el seed se ejecuta como una **tarea puntual de ECS Fargate** (`aws ecs run-task`) lanzada dentro de las subnets privadas, donde el security group del API sí tiene permitido alcanzar la base de datos. La tarea sobreescribe el comando del contenedor para ejecutar `npm run db:seed` y termina al finalizar. La imagen del API se extendió para incluir `postgresql-client` (psql), necesario para el script.

### 4.4 Extensión del pipeline de CI/CD (GitHub Actions)

El workflow `.github/workflows/terraform-ci.yml` se extendió para cubrir el ciclo completo de infraestructura como código, manteniendo la higiene de credenciales vía GitHub Secrets:

- **Plan-on-PR (job `plan`):** se dispara en Pull Requests hacia `main` (eventos `opened`, `synchronize`, `reopened`). Ejecuta `init`, `fmt --check`, `validate` y `terraform plan` con `envs/dev/dev.tfvars`, y publica el output completo del plan como comentario en la conversación del PR mediante `actions/github-script`, permitiendo revisar los cambios de infraestructura antes de aprobar.

- **Apply-on-Merge (job `apply`):** se dispara **única y exclusivamente** cuando un PR es cerrado y fusionado a `main` (`types: [closed]` + condición `github.event.pull_request.merged == true`). Ejecuta `terraform apply -auto-approve` con el mismo `dev.tfvars`. Inmediatamente después, dispara el seed automatizado vía `aws ecs run-task` (descrito en 4.3), leyendo los outputs de Terraform (`ecs_cluster_name`, `ecs_api_service_name`, `ecs_api_security_group_id`, `private_subnet_ids`) para configurar la red de la tarea.

- **Higiene de secretos:** las credenciales de AWS (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`) y la contraseña de la base de datos (`DB_PASSWORD`) se inyectan desde GitHub Secrets; ningún valor sensible está hardcodeado en el repositorio.

**Limitaciones conocidas (mejoras futuras):** (1) el step de seed es fire-and-forget — lanza la tarea ECS pero no espera su finalización ni verifica el exit code; una mejora sería añadir `aws ecs wait tasks-stopped` y validar el resultado. (2) El job `apply` asume que las imágenes Docker del API y web ya fueron construidas y publicadas en ECR por un flujo de build separado.

---

## 6. Anexo uso de IA
Esta sección documenta las consultas de diseño realizadas a una IA asistente durante la construcción de la capa de ingress, endpoints, seeders y CI/CD, detallando qué propuestas fueron aceptadas, cuáles editadas y cuáles descartadas.

### Propuestas aceptadas

- **Enrutamiento por path en un solo ALB:** se aceptó usar un único ALB con listener en `:80` y reglas de path (API a `/api`, `/availability`, `/reservar`, etc.; web por defecto) en lugar de dos balanceadores. Razón: una sola URL pública sirve toda la aplicación y simplifica el costo y la operación.
- **Target groups gestionados dentro del módulo ALB:** se aceptó que el módulo ALB cree los target groups y los exponga como outputs, y que `compute` los consuma. Evita dependencias circulares (compute solo necesita el ARN, no al revés).
- **`target_type = ip` en los target groups:** aceptado por ser el requerido para Fargate en modo `awsvpc`.
- **Seed idempotente con `ON CONFLICT` / `WHERE NOT EXISTS`:** aceptado para permitir ejecuciones repetidas del pipeline sin fallos ni duplicados.

### Propuestas editadas

- **Respuesta de `POST /reservar`:** la implementación original subía el comprobante a S3 de forma totalmente asíncrona y no devolvía la Key en el 201. Se editó la propuesta para calcular la Key de forma determinista antes del bloque asíncrono e incluirla en la respuesta, cumpliendo la especificación sin bloquear la subida del PDF.
- **Health check del target group web:** se editó el matcher a `200-399` (en vez de solo `200`), porque la raíz de Next.js responde `307 → /login`; sin ese ajuste el target nunca se reportaría `Healthy`.
- **Disparo del Apply-on-Merge:** se evaluaron dos triggers. Se editó la propuesta inicial (`push` a `main`) hacia `pull_request closed + merged == true`, por ser literal a la especificación ("única y exclusivamente cuando el PR sea fusionado") y reforzar la disciplina de PRs.

### Propuestas descartadas

- **Seed vía `null_resource` en Terraform:** descartado. Mezclar ejecución de datos en el ciclo de vida de la infraestructura es un anti-patrón, y además el runner no alcanza la RDS privada por red.
- **Hacer la RDS accesible temporalmente para sembrar desde el runner:** descartado por violar el aislamiento de subred privada (que la propia especificación exige) y el espíritu de la regla de "no usar terminales externas". En su lugar se adoptó `aws ecs run-task` dentro de la VPC.
