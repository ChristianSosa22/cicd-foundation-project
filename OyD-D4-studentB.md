# OyD D4 — Student B: Network Security, NACLs & Refactoring

**Fecha:** 2026-06-07
**Rol:** Estudiante B — Seguridad Cohesiva, NACLs y Refactorización de Recursos

---

## Resumen General

Se implementaron las tareas asignadas al Estudiante B según `OyD-D3-Distribucion.md` y `Delivery_3-Networking_Layer_Fully_Automated.md`: creación del módulo de seguridad con SGs encadenados, implementación de NACLs stateless, refactorización de los módulos compute y database para consumir los SGs del nuevo módulo, higiene de credenciales, y actualización de la documentación.

---

## 1. Módulo `infra/modules/security/` (Nuevo)

Se creó el módulo de seguridad centralizado con **4 Security Groups** usando recursos independientes `aws_security_group_rule` para evitar dependencias circulares:

### SGs Creados

| SG | Asignado a | Reglas principales | Archivo |
|---|---|---|---|
| `web-sg` | ALB (capa pública, futura creación por Estudiante C) | Ingress 80/443 desde `0.0.0.0/0`. Egress a app-sg:8080 y web-service-sg:3000. | `infra/modules/security/main.tf` |
| `app-sg` | API ECS tasks | Ingress 8080 desde web-sg y web-service-sg. Egress a db-sg:5432 + internet vía NAT. | `infra/modules/security/main.tf` |
| `web-service-sg` | Web ECS tasks (Next.js) | Ingress 3000 desde web-sg. Egress a app-sg:8080 + internet vía NAT. | `infra/modules/security/main.tf` |
| `db-sg` | RDS PostgreSQL | Ingress 5432 desde app-sg únicamente. **Sin reglas de egress** (los SGs son stateful). | `infra/modules/security/main.tf` |

### Variables del Módulo (`variables.tf`)

| Variable | Default | Descripción |
|---|---|---|
| `name` | — | Prefijo de nombres de recursos |
| `environment` | — | Sufijo de ambiente (dev, prod) |
| `vpc_id` | — | ID de la VPC donde se crean los SGs |
| `http_port` | 80 | Puerto HTTP para web-sg |
| `https_port` | 443 | Puerto HTTPS para web-sg |
| `app_port` | 8080 | Puerto de la API |
| `web_port` | 3000 | Puerto del frontend web |
| `db_port` | 5432 | Puerto de la base de datos |
| `allowed_ingress_cidrs` | `["0.0.0.0/0"]` | CIDRs permitidos en web-sg |

### Outputs del Módulo (`outputs.tf`)

| Output | Descripción |
|---|---|
| `web_security_group_id` | ID del SG web/ALB |
| `app_security_group_id` | ID del SG de la API |
| `web_service_security_group_id` | ID del SG del servicio web |
| `db_security_group_id` | ID del SG de la base de datos |

---

## 2. Network ACLs (`infra/modules/network/nacl.tf`)

Se implementaron **2 NACLs stateless** en el módulo de red, con reglas explícitas para tráfico entrante y saliente:

### NACL Público (asociado a subnets públicas)

| Dirección | Rule# | Puerto | Fuente/Destino | Acción |
|---|---|---|---|---|
| Inbound | 100 | HTTP (80) | `0.0.0.0/0` | ALLOW |
| Inbound | 110 | HTTPS (443) | `0.0.0.0/0` | ALLOW |
| Inbound | 120 | Efímeros (1024-65535) | `0.0.0.0/0` | ALLOW |
| Outbound | 100 | HTTP (80) | `0.0.0.0/0` | ALLOW |
| Outbound | 110 | HTTPS (443) | `0.0.0.0/0` | ALLOW |
| Outbound | 120 | Efímeros (1024-65535) | `0.0.0.0/0` | ALLOW |
| Outbound | 130 | App (8080) | VPC CIDR | ALLOW |
| Outbound | 140 | Web (3000) | VPC CIDR | ALLOW |

### NACL Privado (asociado a subnets private_app y private_data)

| Dirección | Rule# | Puerto | Fuente/Destino | Acción |
|---|---|---|---|---|
| Inbound | 100 | App (8080) | VPC CIDR | ALLOW |
| Inbound | 110 | Web (3000) | VPC CIDR | ALLOW |
| Inbound | 120 | Efímeros (1024-65535) | `0.0.0.0/0` | ALLOW |
| Inbound | 130 | DB (5432) | VPC CIDR | ALLOW |
| Outbound | 100 | HTTP (80) | `0.0.0.0/0` | ALLOW |
| Outbound | 110 | HTTPS (443) | `0.0.0.0/0` | ALLOW |
| Outbound | 120 | Efímeros (1024-65535) | `0.0.0.0/0` | ALLOW |
| Outbound | 130 | Efímeros (1024-65535) | VPC CIDR | ALLOW |
| Outbound | 140 | DB (5432) | VPC CIDR | ALLOW |

### Variables de NACL agregadas a `infra/modules/network/variables.tf`

| Variable | Default | Descripción |
|---|---|---|
| `http_port` | 80 | Puerto HTTP para reglas NACL |
| `https_port` | 443 | Puerto HTTPS para reglas NACL |
| `app_port` | 8080 | Puerto de aplicación para reglas NACL |
| `web_port` | 3000 | Puerto web para reglas NACL |
| `db_port` | 5432 | Puerto de base de datos para reglas NACL |
| `ephemeral_from` | 1024 | Inicio rango puertos efímeros |
| `ephemeral_to` | 65535 | Fin rango puertos efímeros |

---

## 3. Refactorización de Módulos Existentes

### `infra/modules/compute/`

**Cambios:**
- **Eliminados** los recursos `aws_security_group.api` y `aws_security_group.web` que usaban `cidr_blocks = ["0.0.0.0/0"]` en ingress.
- Los ECS services ahora reciben los SG IDs como variables de entrada:
  - `aws_ecs_service.api` usa `var.api_security_group_id`
  - `aws_ecs_service.web` usa `var.web_service_security_group_id`
- **Eliminada** la variable `vpc_id` (ya no era necesaria sin los SGs locales).
- **Eliminados** los outputs `api_security_group_id` y `web_security_group_id` (ahora en `module.security`).
- **Agregadas** variables `api_security_group_id` y `web_service_security_group_id`.

### `infra/modules/database/`

**Cambios:**
- **Eliminado** el recurso `aws_security_group.db_sg` que tenía egress a `0.0.0.0/0` (violación del spec: "No direct internet egress").
- El RDS instance ahora usa `var.db_security_group_id` en lugar de un SG local.
- **Eliminada** la variable `vpc_id` (ya no era necesaria).
- **Eliminada** la variable `ingress_security_group_ids` (la regla de ingress se crea en el módulo security).
- **Agregada** variable `db_security_group_id`.
- El output `db_security_group_id` ahora referencia a la variable de entrada.

---

## 4. Cambios en el Módulo Raíz (`infra/main.tf`)

- **Agregada** llamada a `module.security` que recibe `vpc_id` del módulo network.
- **Reemplazada** la referencia `module.compute.api_security_group_id` por `module.security.db_security_group_id` en `module.database`.
- **Agregados** `api_security_group_id = module.security.app_security_group_id` y `web_service_security_group_id = module.security.web_service_security_group_id` a `module.compute`.
- **Eliminado** `vpc_id = module.network.vpc_id` de `module.compute`.

---

## 5. Variables y Outputs del Root

### Variables agregadas (`infra/variables.tf`)

| Variable | Default | Descripción |
|---|---|---|
| `app_port` | 8080 | Puerto de la API |
| `web_port` | 3000 | Puerto del frontend web |

### Outputs actualizados (`infra/outputs.tf`)

| Output | Fuente anterior | Fuente nueva |
|---|---|---|
| `web_security_group_id` | *(no existía)* | `module.security.web_security_group_id` |
| `app_security_group_id` | *(no existía)* | `module.security.app_security_group_id` |
| `web_service_security_group_id` | *(no existía)* | `module.security.web_service_security_group_id` |
| `db_security_group_id` | *(no existía)* | `module.security.db_security_group_id` |
| `public_nacl_id` | *(no existía)* | `module.network.public_nacl_id` |
| `private_nacl_id` | *(no existía)* | `module.network.private_nacl_id` |

Los outputs antiguos `ecs_api_security_group_id` y `ecs_web_security_group_id` fueron eliminados.

---

## 6. Higiene de Credenciales

Verificado que:
- `db_password` tiene `sensitive = true` en `infra/variables.tf` (línea 67) y en `infra/modules/database/variables.tf` (línea 24). ✅
- `infra/envs/dev/dev.tfvars` NO contiene `db_password`. ✅
- `db-sg` no tiene egress a `0.0.0.0/0` (el SG stateful solo necesita la regla de ingress). ✅
- `db-sg` no tiene ingress desde `0.0.0.0/0` en ningún puerto. ✅

---

## 7. Documentación Actualizada

### `infra/docs/delivery-3-summary.md`

Se actualizaron las siguientes secciones:

- **Sección 1 (Networking track):** Tabla CIDR actualizada con los 3 tiers (public, private-app, private-data).
- **Sección 2 (Module design):** Agregada documentación del módulo `infra/modules/security/` con sus inputs, outputs y reglas. Actualizados los diagramas de wiring.
- **Sección 3 (D2 wiring):** Documentado el refactor de SGs (migración de SGs inline de compute/database al módulo security centralizado).
- **Sección 4 (Security):** Nueva sección completa que explica:
  - Estrategia SG-to-SG (por qué referencias de ID en lugar de CIDRs).
  - Tabla de reglas implementadas por cada SG.
  - Justificación de que `db-sg` no tiene reglas de egress (stateful).
  - Descripción de los NACLs público y privado con sus reglas.

### `infra/evidence/security-groups-plan.txt`

Archivo placeholder creado listo para ser reemplazado con el output de `terraform plan`.

---

## 8. Archivos Modificados/Creados (Lista Completa)

### Creados:
1. `infra/modules/security/main.tf`
2. `infra/modules/security/variables.tf`
3. `infra/modules/security/outputs.tf`
4. `infra/modules/network/nacl.tf`
5. `infra/evidence/security-groups-plan.txt`

### Modificados:
6. `infra/main.tf`
7. `infra/variables.tf`
8. `infra/outputs.tf`
9. `infra/modules/network/variables.tf`
10. `infra/modules/network/outputs.tf`
11. `infra/modules/compute/main.tf`
12. `infra/modules/compute/variables.tf`
13. `infra/modules/compute/outputs.tf`
14. `infra/modules/database/main.tf`
15. `infra/modules/database/variables.tf`
16. `infra/modules/database/outputs.tf`
17. `infra/docs/delivery-3-summary.md`

---

## 9. Próximos Pasos (para el equipo)

### Pendientes del Estudiante B (verificar post-apply):
1. Ejecutar `terraform plan -var-file=envs/dev/dev.tfvars` para verificar que no hay drift inesperado.
2. Ejecutar `terraform apply` para aplicar los cambios de SGs y NACLs.
3. Reemplazar `infra/evidence/security-groups-plan.txt` con el output del plan.
4. Tomar screenshot de los SGs en AWS Console y guardar como `infra/evidence/security-groups.png`.
5. Verificar que los SGs tengan las reglas correctas con:
   ```bash
   aws ec2 describe-security-groups --filters Name=vpc-id,Values=$(terraform output -raw vpc_id) --output table
   ```
6. Verificar que los NACLs estén asociados correctamente:
   ```bash
   aws ec2 describe-network-acls --filters Name=vpc-id,Values=$(terraform output -raw vpc_id) --output table
   ```

### Dependencias con otros estudiantes:
- **Estudiante A (Network):** Ya completó el módulo de red con subnets separadas y route tables. No hay dependencias pendientes.
- **Estudiante C (Ingress + CI/CD):** Deberá:
  - Usar `module.security.web_security_group_id` para el ALB.
  - Usar `module.security.app_security_group_id` y `module.security.web_service_security_group_id` como target groups del ALB.
  - Resolver los conflict markers en `.github/workflows/terraform-ci.yml`.
  - Crear los endpoints `GET /availability` y `POST /reservar` (E2E proof).
  - Implementar el mecanismo de seed data automatizado para PostgreSQL.
