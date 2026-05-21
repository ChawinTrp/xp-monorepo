# ── Build stage ──
FROM node:22-slim AS build
WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/ packages/

# Install all deps (workspace-aware)
RUN npm ci --workspace=api

# Copy API source and build
COPY apps/api/ apps/api/
RUN npm run build --workspace=api

# ── Production stage ──
FROM node:22-slim AS prod
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/ packages/

RUN npm ci --workspace=api --omit=dev

# Copy compiled output
COPY --from=build /app/apps/api/dist apps/api/dist

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "apps/api/dist/main.js"]
