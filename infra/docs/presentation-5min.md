# Presentación 5 min — Tres highlights del proyecto

**Tesis:** Tres decisiones técnicas, una por área, que cambian cómo trabaja un equipo en IaC.

**Distribución de tiempo (≈5 min):**

| Slide | Sección | Duración |
|------:|---------|---------:|
| 1 | Intro | 20 s |
| 2 | CI: Plan como comentario en PR | 90 s |
| 3 | Módulo Storage: defensa en profundidad | 90 s |
| 4 | Remote state: bootstrap + lock + CI alineado | 90 s |
| 5 | Cierre | 20 s |

---

## Slide 1 — Intro (20 s)

**En pantalla:**
- Proyecto: `cicd-foundation-project` (Entregas 1 y 2)
- Christian Sosa
- Tesis: **3 decisiones técnicas → 3 efectos en el equipo**
- No es un walkthrough: tres highlights con profundidad

> **Guion:** "Buenas. En vez de pasear por las dos entregas, voy a enfocarme en tres decisiones —una de CI, una de módulo, y una de state— que cambian cómo trabaja el equipo todos los días. Cinco minutos, tres puntos, mucho concreto."

---

## Slide 2 — CI: Plan como comentario en PR (90 s)

**En pantalla:**
- **Trigger:** sólo `pull_request` a `main`. No se ejecuta en push directo.
- **Permisos mínimos:** `contents: read`, `pull-requests: write`.
- **Pipeline:** `init` → `fmt -check -recursive` → `validate` → `plan -var-file=envs/dev/dev.tfvars` (capturado a `plan.txt`).
- **Publicación:** `actions/github-script@v7` lee `plan.txt` y lo postea en el PR como `<details>` colapsable.
- **Plan-only:** no hay auto-apply. Aplicar sigue siendo paso manual y consciente.

**Snippet clave** (`.github/workflows/terraform-ci.yml:53-64`):

```yaml
- name: Post plan as PR comment
  uses: actions/github-script@v7
  continue-on-error: true
  with:
    script: |
      const fs = require('fs');
      const plan = fs.readFileSync('infra/plan.txt', 'utf8');
      github.rest.issues.createComment({
        ...context.repo,
        issue_number: context.issue.number,
        body: `<details><summary>Terraform Plan</summary>\n\n\`\`\`\n${plan}\n\`\`\`\n</details>`
      });
```

> **Guion:** "Cada PR a `main` dispara este pipeline. No sólo valida formato y sintaxis: ejecuta el `plan` real contra el state remoto, captura la salida y la postea como comentario colapsable en el propio PR. El revisor ve el diff de infraestructura sin clonar el repo, sin correr terraform local, sin esperar a un compañero. Eso convierte el review de IaC en algo simétrico al review de código: discutís diff en línea, en GitHub, antes de mergear. Y nota lo que NO hace: no aplica. Aplicar sigue siendo manual, consciente. El CI te muestra la verdad; vos decidís cuándo materializarla."

**Referencias:**
- `.github/workflows/terraform-ci.yml:3-6` — trigger PR a `main`
- `.github/workflows/terraform-ci.yml:17-19` — permisos mínimos
- `.github/workflows/terraform-ci.yml:41-51` — init / fmt / validate / plan
- `.github/workflows/terraform-ci.yml:53-64` — script de comentario

---

## Slide 3 — Módulo Storage: defensa en profundidad (90 s)

**Contexto:** este bucket guarda los **comprobantes QR/PDF** de las reservas. El QR es **credencial física de entrada al parqueo**, y el PDF contiene placa, nombre y horarios del colaborador (PII).

**En pantalla:**
- **Capa 1 — PII cifrado en reposo.** Los comprobantes guardan placa, nombre y horarios. AES256 los cifra en disco por defecto; la app no maneja claves. Si AWS pierde un disco físico o alguien accede al backend de bajo nivel, los PDFs no se leen.
- **Capa 2 — El QR nunca se sirve público.** El PDF es credencial de acceso físico al parqueo: si se filtra, alguien entra con datos ajenos. Los 4 flags del `public_access_block` cierran las cuatro vías por las que S3 puede exponer un objeto (ACL y policy, al leer y al escribir). Única forma de descargar el comprobante: **pre-signed URL** emitida por la Lambda al correo del titular.
- **Capa 3 — Descarga sólo por TLS.** El usuario descarga el comprobante en redes potencialmente inseguras (WiFi público, hotspots). La bucket policy rechaza cualquier request HTTP con `403`, impidiendo que un atacante en el medio capture o sustituya el QR en tránsito.
- **Capa 4 — Inalterabilidad por construcción.** El PDF se promete *"inalterable"* (Pantalla 4 del diseño). El versionado de S3 lo garantiza: un `PUT` no sobrescribe — crea una versión nueva. Si un bug o un actor malicioso corrompe el comprobante, la versión válida sigue accesible.
- **Bonus — Costos alineados al patrón de acceso.** Lifecycle pasa `uploads/` a `STANDARD_IA` a 30 días y purga versiones obsoletas a 90 días. Refleja la realidad: el comprobante se descarga mucho el día de la reserva y rara vez después.
- **Decisión: módulo opinionado.** Sin toggle para apagar cifrado, abrir acceso público o permitir HTTP. Configuración floja del bucket = comprobante filtrado = entrada física comprometida. Esa decisión no se delega al consumidor del módulo.

**Snippet clave** (`infra/modules/storage/main.tf:64-89`):

```hcl
resource "aws_s3_bucket_policy" "this" {
  bucket     = aws_s3_bucket.this.id
  depends_on = [aws_s3_bucket_public_access_block.this]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "DenyNonSSL"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource  = [aws_s3_bucket.this.arn, "${aws_s3_bucket.this.arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })
}
```

> **Guion:** "El módulo de Storage es a propósito. No hay variable `encryption_enabled` ni `public_access_allowed`. Lo cifrado está cifrado, lo privado está privado, y además la bucket policy rechaza cualquier conexión sin TLS. Son tres capas que se sobreponen: si una falla por configuración, las otras siguen. Esto previene un escenario clásico —un dev pasa `acl = public-read` por accidente y queda un bucket expuesto en internet—. Acá no puede pasar: el `public_access_block` ignora ACLs públicas; y aunque alguien forzara una policy permisiva, la nuestra deniega no-TLS encima. Defensa en profundidad, no checkbox de seguridad."

**Referencias:**
- `infra/modules/storage/main.tf:20-28` — encryption AES256 hardcodeado
- `infra/modules/storage/main.tf:31-51` — lifecycle a STANDARD_IA + expiración de versiones
- `infra/modules/storage/main.tf:54-61` — public access block (4 flags `true`)
- `infra/modules/storage/main.tf:64-89` — bucket policy deny non-SSL

---

## Slide 4 — Remote state: bootstrap + lock + CI alineado (90 s)

**En pantalla:**
- **Antes:** `terraform.tfstate` local. Riesgo de corrupción concurrente. CI corría `terraform init -backend=false` (sólo syntax check).
- **Bootstrap** (`infra/bootstrap/`, workspace separado con state local) crea una vez:
  - **S3** `cicd-foundation-project` — versionado + AES256 + `prevent_destroy = true`.
  - **DynamoDB** `cicd-foundation-project-lock` — `hash_key = "LockID"`, `PAY_PER_REQUEST`, `prevent_destroy = true`.
- **Migración:** `terraform init -migrate-state` movió el state local al backend S3.
- **CI alineado** (commit `aba8979`): credenciales AWS antes del init + `terraform init` completo (sin `-backend=false`).
- **Evidencia de lock:** dos `apply` en paralelo → el segundo recibe `ConditionalCheckFailedException` con ID, path y timestamp del holder.

**Snippet clave** (`infra/backend.tf:1-9`):

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

> **Guion:** "Esto es lo que más cambia el trabajo en equipo. Antes el state vivía en una laptop —si dos personas aplicaban a la vez, alguien perdía cambios o corrompía el archivo—. Hoy, el `bootstrap` crea de una vez un bucket S3 versionado y una tabla DynamoDB para el lock; ese workspace tiene state local a propósito, porque resuelve el huevo-y-la-gallina: necesitás el bucket antes de poder usarlo como backend. Cualquier `plan` o `apply` ahora pide el lock primero; si otro lo tiene, falla limpio en vez de corromper. Lo probamos: dos `apply` en paralelo, y el segundo rebota con `ConditionalCheckFailedException`, mostrando quién tiene el lock. Y el CI dejó de ser teatro: antes hacía `init -backend=false`, que es básicamente un linter; ahora se autentica con secrets, lee el state real desde S3, y el plan que publica en el PR es el diff real contra el entorno dev. Misma verdad para todos."

**Referencias:**
- `infra/backend.tf:1-9` — backend S3 + DynamoDB
- `infra/bootstrap/main.tf:14-26` — bucket de state con `prevent_destroy`
- `infra/bootstrap/main.tf:28-44` — versioning + AES256 del bucket de state
- `infra/bootstrap/main.tf:46-65` — tabla DynamoDB de lock
- Commit `ed88743` — bootstrap aplicado y migración a state remoto
- Commit `aba8979` — CI pipeline usando el remote state
- `infra/docs/delivery-2-summary.md` — evidencia de lock contention

---

## Slide 5 — Cierre (20 s)

**En pantalla:**
- **3 decisiones → 3 efectos:**
  - CI: review de IaC sin salir del PR.
  - Storage: configuración segura por default, sin opciones para equivocarse.
  - Remote state: colaboración sin pisarse el state.
- *"¿Preguntas?"*

> **Guion:** "Estos tres highlights no son features sueltas: son decisiones que cambian cómo trabaja el equipo todos los días. Review más rápido, configuración segura por default, y colaboración sin pisones. Gracias —¿preguntas?"

---

## Notas para el presentador

- **Cronometraje:** ensayar con timer; objetivo 4:40–5:00.
- **Si te pasás de tiempo,** recortá en este orden:
  1. El "bonus operativo" del lifecycle en Slide 3.
  2. La línea sobre `continue-on-error` en Slide 2.
  3. La frase sobre el huevo-y-la-gallina del bootstrap en Slide 4.
- **Preguntas probables y respuesta corta:**
  - *"¿Por qué no auto-apply en CI?"* → "Plan-only por diseño: aplicar exige intencionalidad. Para auto-apply hace falta gate de aprobación y entorno separado; lo dejamos como evolución."
  - *"¿Por qué Secrets y no OIDC?"* → "OIDC es el siguiente paso natural. Hoy usamos secrets para mantenernos en el alcance de la entrega; OIDC elimina las claves de larga vida."
  - *"¿Y si destruyo el bootstrap por error?"* → "`prevent_destroy = true` en bucket y tabla; Terraform aborta antes de tocarlos."
