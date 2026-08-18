# Monte Moria — VPS Deployment Guide

## 1. Docker Compose Setup

### Files created at project root (`C:\FB\quadro-do-mane`):
- `docker-compose.yml` — PostgreSQL, API (NestJS), and Web (NextJS) services
- `ecosystem.config.js` — PM2 process manager configuration
- `.env.docker` — Environment variables for Docker deployments

### Start Docker services:

```powershell
# From the project root, start all containers in detached mode
docker-compose up -d
```

### Verify containers are running:

```powershell
docker ps
```

Expected output should show 3 containers:
- `quadro-postgres` — PostgreSQL database
- `quadro-api` — NestJS API server
- `quadro-web` — NextJS web application

### Check Docker logs:

```powershell
# Follow logs for all services
docker-compose logs -f

# Or follow logs for a specific service
docker-compose logs -f api
docker-compose logs -f web
docker-compose logs -f postgres
```

### Execute into PostgreSQL container:

```powershell
# Access PostgreSQL prompt inside the container
docker exec -it quadro-postgres psql -U postgres -d quadro_do_mane
```

### Common Docker commands:

```powershell
# Restart a specific service
docker-compose restart api

# Stop all services
docker-compose down

# View resource usage
docker stats

# Enter container shell
docker exec -it quadro-api sh
docker exec -it quadro-web sh
```

### Restart with PM2 (if needed):

If you need to manage the Node processes directly with PM2 (outside Docker), run:

```powershell
# From the project root
npm run pm2:start     # Start PM2 with production env
npm run pm2:restart   # Restart all PM2 processes
npm run pm2:stop      # Stop PM2 processes
npm run pm2:logs      # View PM2 logs
```

## 2. PM2 Ecosystem Configuration

The `ecosystem.config.js` file at the project root configures PM2 for the API server:

- **Name**: `quadro-api`
- **Script**: `./apps/api/dist/main.js` (built NestJS entry point)
- **Instance count**: `max` (utilizes all available CPU cores)
- **Environment**:
  - `NODE_ENV=production` (default)
  - `API_PORT=3001` (production)
  - `API_PORT=3001` (development)
- **Restart policy**: auto-restart with max 10 restarts
- **Watch mode**: disabled

To start with PM2:

```powershell
npm run pm2:start
```

To restart after code changes (within Docker, use `docker-compose restart api` instead).

## 3. .env.docker File

The `.env.docker` file contains all environment variables needed for Docker:

- `DATABASE_URL` — Connects to PostgreSQL via Docker network DNS (`postgres:5432`)
- `API_PORT=3001`
- `NODE_ENV=production`
- JWT secrets, encryption keys, and other app configs
- CORS and cookie settings configured for Docker network access

**Note**: The `DATABASE_URL` is set to resolve via Docker's internal DNS to the `postgres` service name defined in `docker-compose.yml`.

## 4. VS Code in Browser / Codespaces Setup

### Option A: GitHub Codespaces (Recommended)

If this repository is on GitHub, you can use Codespaces for a full development environment in the browser:

```powershell
# 1. Ensure the .github/workflows/codespaces.yml or codespaces configuration exists
# 2. Go to https://github.com/your-org/your-repo/settings/codespaces
# 3. Click "Create codespace" branch selector
# 4. Wait for the container to build (uses Dockerfile + compose setup)
# 5. VS Code IDE will open in your browser
```

The Codespace will automatically:
- Build and start Docker containers via `docker-compose up`
- Install Node dependencies
- Provide VS Code with terminal access to exec into containers
- Forward ports (3000, 3001) to the browser

### Option B: gitpod.io

```powershell
# 1. Go to https://gitpod.io/#https://github.com/your-org/your-repo
# 2. A temporary dev environment will spin up
# 3. VS Code IDE opens in browser with the repo ready
# 4. Run `docker-compose up -d` in the terminal
```

### Option C: VS Code Web URL After Docker Setup

If you already have Docker running locally and VS Code installed:

```powershell
# 1. Open VS Code
# 2. Install the "Remote - Containers" extension
# 3. Open the project folder
# 4. Press F1 → "Containers: Open in Container"
# 5. The container will rebuild with the dev setup
# 6. VS Code will open in a remote session via local Docker
```

### Port Forwarding Notes

- **Port 3000**: NextJS web application (access via `localhost:3000` or the browser URL)
- **Port 3001**: NestJS API (access via `localhost:3001/api` or the frontend configures `NEXT_PUBLIC_API_URL`)
- Both ports are forwarded from the Docker containers to the host

### Domain/Traefik Setup (for production VPS)

If deploying to a VPS with a domain and Traefik:

```powershell
# Ensure these env vars are set in .env.docker or your host environment:
TRAEFIK_EMAIL=your@email.com
HOST_WEB=yourdomain.com
HOST_API=api.yourdomain.com
COOKIE_DOMAIN=yourdomain.com
COOKIE_SECURE=true

# Then Traefik (included in production compose) will auto-generate Let's Encrypt certs
```

## 5. Production Deployment Checklist

- [ ] Generate strong JWT secrets: `openssl rand -hex 64`
- [ ] Generate strong ENCRYPTION_KEY: `openssl rand -hex 32`
- [ ] Update `.env.production` with real domain names
- [ ] Set `NEXT_PUBLIC_API_URL` to the production API URL
- [ ] Configure Traefik/nginx reverse proxy
- [ ] Set up PostgreSQL backup strategy
- [ ] Run database migrations: `docker exec quadro-api npx prisma migrate deploy`
- [ ] Seed the database with admin account
- [ ] Test SSL/TLS termination at the proxy level