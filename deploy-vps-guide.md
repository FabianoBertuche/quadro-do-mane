# Monte Moria — Deploy na VPS

## Pre-requisites

- VPS with Ubuntu 22.04+ (2 vCPU / 8GB RAM minimum)
- Docker and Docker Compose installed
- SSH access to VPS
- (Optional) Domain pointing to VPS IP

## Step 1: Prepare the VPS

### Install Docker (if not installed)

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Logout and login again for the group to take effect
```

### Install Docker Compose (if not installed)

```bash
sudo apt update && sudo apt install -y docker-compose-plugin
```

## Step 2: Copy the project to the VPS

### Option A: Via Git (recommended)

```bash
# On the VPS
cd ~
git clone https://github.com/YOUR_USERNAME/quadro-do-mane.git
cd quadro-do-mane
```

### Option B: Via SCP (from your local machine)

```bash
# From your local machine
scp -r C:\FB\quadro-do-mane user@VPS_IP:/home/user/quadro-do-mane
```

## Step 3: Configure environment variables

```bash
cd ~/quadro-do-mane

# Generate automatic secrets (if available)
node scripts/regenerate-secrets.js

# OR edit manually
nano .env.production
```

### What you MUST change in `.env.production`:

| Variable              | What to do                                                          |
| --------------------- | ------------------------------------------------------------------- |
| `POSTGRES_PASSWORD`     | Replace with a strong password (minimum 16 characters)                |
| `JWT_SECRET`            | Generate new: `openssl rand -hex 64`                                   |
| `JWT_REFRESH_SECRET`    | Generate new: `openssl rand -hex 64`                                   |
| `ENCRYPTION_KEY`        | Generate new: `openssl rand -hex 32`                                   |
| `SEED_ADMIN_PASSWORD`   | Change the admin password                                            |

## Step 4: Create Nginx directory

```bash
mkdir -p nginx/conf.d
```

The files `nginx/nginx.conf` and `nginx/conf.d/default.conf` should already be in the repository.

## Step 5: Deploy!

```bash
# Make the script executable
chmod +x deploy.sh

# Run deploy
bash deploy.sh
```

Or manually:

```bash
# Build images
docker compose -f docker-compose.prod.yml build

# Start PostgreSQL first
docker compose -f docker-compose.prod.yml up -d postgres
sleep 5

# Run migrations
docker compose -f docker-compose.prod.yml run --rm migrate

# Start everything
docker compose -f docker-compose.prod.yml up -d
```

## Step 6: Verify

```bash
# Check container status
docker compose -f docker-compose.prod.yml ps

# View logs in real time
docker compose -f docker-compose.prod.yml logs -f

# Test the API
curl http://localhost/api/auth/me
# Should return 401 Unauthorized (means the API is working)
```

## Access the application

| URL                          | Description           |
| ---------------------------- | --------------------- |
| `http://VPS_IP`                | App (Frontend)        |
| `http://VPS_IP/api`           | API                   |
| `http://VPS_IP/api/docs`      | Swagger Docs          |

**Default login:**
- Email: `admin@montemoria.com.br`
- Password: `AlterarNoPrimeiroLogin123!` (change after first login!)

## Useful commands

```bash
# View logs for a specific service
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f web
docker compose -f docker-compose.prod.yml logs -f postgres

# Restart a service
docker compose -f docker-compose.prod.yml restart api

# Stop everything
docker compose -f docker-compose.prod.yml down

# Stop and delete data (CAUTION!)
docker compose -f docker-compose.prod.yml down -v

# Update after code changes
git pull
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml run --rm migrate
```

## Configure Domain (future)

When you have a domain:

1. Point DNS to the VPS IP:
   - Type: `A` -> Name: `@` -> Value: `VPS_IP`
   - Type: `A` -> Name: `api` -> Value: `VPS_IP`

2. Edit `.env.production`:
   ```bash
   COOKIE_DOMAIN=yourdomain.com
   COOKIE_SECURE=true
   CORS_ORIGINS=https://yourdomain.com,https://api.yourdomain.com
   NEXT_PUBLIC_API_URL=/api
   ```

3. Update `nginx/conf.d/default.conf`:
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com www.yourdomain.com;
       # ...
   }

   server {
       listen 80;
       server_name api.yourdomain.com;
       # ...
   }
   ```

4. (Optional) Install SSL certificate with Certbot:
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com
   ```

5. Restart nginx:
   ```bash
   docker compose -f docker-compose.prod.yml restart nginx
   ```

## Database Backup

```bash
# Create backup
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres quadro_do_mane > backup_$(date +%Y%m%d).sql

# Restore backup
cat backup_20260818.sql | docker compose -f docker-compose.prod.yml exec -T postgres psql -U postgres quadro_do_mane
```

## Troubleshooting

| Problem                         | Solution                                            |
| ------------------------------- | --------------------------------------------------- |
| API not responding              | `docker compose logs api` — check error              |
| Database error                  | Check if migrations ran: `run --rm migrate`          |
| 502 Bad Gateway                 | Container not running: `docker compose ps`            |
| CORS error                      | Check `CORS_ORIGINS` in `.env.production`             |
| Password not working            | Check `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`   |
