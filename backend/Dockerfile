# --- build stage ---
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json drizzle.config.ts ./
COPY src ./src
COPY sql ./sql
RUN npm run build && npm prune --omit=dev

# --- runtime stage ---
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# postgresql-client provides psql, used by the automated seed (npm run db:seed)
# executed as a one-off ECS task after terraform apply.
RUN apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client \
  && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/sql ./sql
EXPOSE 8080
USER node
CMD ["node", "dist/server.js"]
