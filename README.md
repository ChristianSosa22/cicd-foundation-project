# Sistema de Reserva de Parqueos — Monorepo

Este repositorio contiene un backend (API) y un frontend (web) para un sistema de reservas de parqueos. El backend expone una API HTTP y persiste datos en PostgreSQL. El frontend consume la API via HTTP.

## Componentes
- **Backend**: Express + TypeScript + Drizzle. Expone la API en `http://localhost:8080`.
- **Frontend**: Next.js (App Router) + TypeScript + Tailwind. UI en `http://localhost:3000`.
- **DB**: PostgreSQL 16. Se levanta con Docker Compose.

## Flujo de comunicacion
- El frontend llama al backend usando `NEXT_PUBLIC_API_URL`.
- El backend valida JWT, procesa logica y consulta PostgreSQL.
- La base de datos guarda reservas, usuarios, tarifas, etc.

## Requisitos
- Node.js LTS
- Docker Desktop (para DB y API en local)
- pnpm (o pnpm si prefieres, pero los ejemplos usan pnpm)

## Opcion recomendada (Docker para DB + API, frontend local)

1. **Levanta DB + API con Docker**
   ```bash
   docker compose up --build
   ```
   Esto usa el archivo `docker-compose.yml` en la raiz y crea una DB local junto con la API.

2. **Configura y levanta el frontend**
   ```bash
   cd frontend
   cp .env.example .env
   pnpm install
   pnpm run dev
   ```

3. **Abre la app**
   - Frontend: `http://localhost:3000`
   - API health: `http://localhost:8080/health`

## Opcion alternativa (todo local, sin Docker para API)

1. **Levanta Postgres con Docker**
   ```bash
   docker compose up db
   ```

2. **Configura y levanta el backend**
   ```bash
   cd backend
   cp .env.example .env
   pnpm install
   pnpm run dev
   ```

3. **Configura y levanta el frontend**
   ```bash
   cd frontend
   cp .env.example .env
   pnpm install
   pnpm run dev
   ```

## Variables de entorno

### Backend (cuando corre local con pnpm)
Archivo: `backend/.env`

- `NODE_ENV`: `development`
- `PORT`: `8080`
- `DATABASE_URL`: ejemplo local `postgres://postgres:postgres@localhost:5432/parking`
- `JWT_SECRET`: string largo y aleatorio (>=16 chars)
- `JWT_EXPIRES_IN`: por ejemplo `8h`
- `AWS_REGION`: opcional en local
- `S3_BUCKET`: opcional en local
- `ENCRYPTION_KEY`: base64 de 32 bytes (AES-256-GCM)
- `HMAC_KEY`: clave para hash de placa

Si usas Docker Compose para la API, estas variables ya estan definidas en `docker-compose.yml`.

### Frontend
Archivo: `frontend/.env`

- `NEXT_PUBLIC_API_URL`: `http://localhost:8080`

## Base de datos y esquema
- El esquema canonical esta en `backend/sql/schema.sql`.
- Docker aplica el esquema la primera vez que se crea el volumen.
- Si cambias el esquema, recrea la DB:
  ```bash
  docker compose down -v
  docker compose up --build
  ```

## Layout del repositorio
- `backend/` API y logica de negocio
- `frontend/` UI web
- `docker-compose.yml` DB + API local
- `docs/` y `infra/` documentacion e infraestructura

## Troubleshooting
- **La API no levanta**: revisa que `docker compose up --build` no tenga errores y que Postgres este healthy.
- **Frontend no conecta**: valida `NEXT_PUBLIC_API_URL` y que `http://localhost:8080/health` responda 200.
- **Puerto ocupado**: cambia `PORT` y `NEXT_PUBLIC_API_URL` en consecuencia.

## Documentacion adicional
- Backend: `backend/README.md`
- Frontend: `frontend/README.md`
- API endpoints: `backend/docs/api-endpoints.md`
