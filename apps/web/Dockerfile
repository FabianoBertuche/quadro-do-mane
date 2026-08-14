FROM node:18-alpine AS builder
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

# build
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /usr/src/app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /usr/src/app/.next ./.next
COPY --from=builder /usr/src/app/public ./public
COPY --from=builder /usr/src/app/node_modules ./node_modules

EXPOSE 3000
CMD ["npm","run","start"]
