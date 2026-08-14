FROM node:18-alpine AS builder
WORKDIR /usr/src/app

# install deps (including dev) for build
COPY package*.json ./
RUN npm ci

# copy source and build
COPY . .
RUN npx prisma generate --schema=prisma/schema.prisma || true
RUN npm run build

FROM node:18-alpine
WORKDIR /usr/src/app
ENV NODE_ENV=production

# install only production deps
COPY package*.json ./
RUN npm ci --only=production

# copy built app and production node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/prisma ./prisma

EXPOSE 3001
CMD ["node", "dist/src/main.js"]
