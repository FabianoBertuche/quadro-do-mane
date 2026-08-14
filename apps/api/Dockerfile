FROM node:20-bullseye-slim AS builder
WORKDIR /usr/src/app

# install deps (including dev) for build
COPY package*.json ./
# Prefer `npm ci` when a lockfile is present for reproducible builds
RUN npm ci || npm install

# copy source and build
COPY . .
# Generate Prisma Client during the build (must succeed to include correct engines)
RUN npx prisma generate --schema=prisma/schema.prisma
RUN npm run build

FROM node:20-bullseye-slim
WORKDIR /usr/src/app
ENV NODE_ENV=production

# Ensure OpenSSL / libssl are available for Prisma query engine
RUN apt-get update \
	&& apt-get install -y --no-install-recommends openssl ca-certificates libssl1.1 \
	&& rm -rf /var/lib/apt/lists/*

# install only production deps
COPY package*.json ./
# Use `npm install --omit=dev` when no lockfile is present
RUN npm install --omit=dev

# copy built app and production node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/prisma ./prisma

EXPOSE 3001
CMD ["node", "dist/src/main.js"]
