# ─── Stage 1: Build ──────────────────────────────────────────────────
FROM node:20-bullseye-slim AS builder
WORKDIR /usr/src/app

# Copy root + workspace package.json files for npm workspaces resolution
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/database/package.json ./packages/database/
COPY packages/ui/package.json ./packages/ui/
COPY packages/utils/package.json ./packages/utils/

# Install all dependencies (including dev for build tools)
RUN npm ci || npm install

# Copy full source tree
COPY . .

# Generate Prisma Client (must match runtime platform)
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma

# Build the API workspace only
RUN npm run build:api

# ─── Stage 2: Production ─────────────────────────────────────────────
FROM node:20-bullseye-slim
WORKDIR /usr/src/app
ENV NODE_ENV=production

# OpenSSL / libssl for Prisma query engine
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Re-install production deps only (needs ALL workspace package.json files)
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/database/package.json ./packages/database/
COPY packages/ui/package.json ./packages/ui/
COPY packages/utils/package.json ./packages/utils/
RUN npm ci --omit=dev || npm install --omit=dev

# Copy Prisma schema + generated client
COPY --from=builder /usr/src/app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /usr/src/app/node_modules/@prisma ./node_modules/@prisma

# Copy built API
COPY --from=builder /usr/src/app/apps/api/dist ./apps/api/dist

EXPOSE 3001
CMD ["node", "apps/api/dist/src/main.js"]
