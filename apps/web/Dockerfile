FROM node:18-alpine AS builder
WORKDIR /usr/src/app

COPY package*.json ./
# Use `npm install` in builder to work without lockfile
RUN npm install

# build
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /usr/src/app
ENV NODE_ENV=production

COPY package*.json ./
# Install production deps when lockfile is missing
RUN npm install --omit=dev

COPY --from=builder /usr/src/app/.next ./.next
COPY --from=builder /usr/src/app/public ./public
COPY --from=builder /usr/src/app/node_modules ./node_modules

EXPOSE 3000
CMD ["npm","run","start"]
