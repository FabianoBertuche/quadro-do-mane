#!/bin/bash
# Monte Moria — VPS Deployment Script
# ============================================================
# Usage: bash deploy.sh
# First run: bash deploy.sh --init
# ============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err() { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }
info() { echo -e "${BLUE}[i]${NC} $1"; }

# Pre-flight checks
echo -e "\n${BLUE}=============================================${NC}"
echo -e "${BLUE}  Monte Moria — Deployment${NC}"
echo -e "${BLUE}=============================================${NC}\n"

command -v docker >/dev/null 2>&1 || err "Docker not found. Install: https://docs.docker.com/engine/install/"
command -v docker compose >/dev/null 2>&1 || err "Docker Compose not found."

# Init mode
if [[ "${1:-}" == "--init" ]]; then
    warn "Init mode: first-time setup..."

    if [ ! -f .env.production ]; then
        err ".env.production file not found!"
    fi

    info "Generating secrets..."
    if [ -f scripts/regenerate-secrets.js ]; then
        node scripts/regenerate-secrets.js
    else
        warn "Script regenerate-secrets.js not found. Use secrets from .env.production"
    fi

    info "Creating nginx directory..."
    mkdir -p nginx/conf.d

    log "Init complete! Now run: bash deploy.sh"
    exit 0
fi

# Stop existing containers
info "Stopping existing containers..."
docker compose -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true

# Build images
info "Building Docker images..."
docker compose -f docker-compose.prod.yml build --no-cache

# Run migrations
info "Running database migrations..."
docker compose -f docker-compose.prod.yml up -d postgres
sleep 5

docker compose -f docker-compose.prod.yml run --rm migrate
log "Migrations applied!"

# Start all services
info "Starting all services..."
docker compose -f docker-compose.prod.yml up -d

# Wait for health
info "Waiting for services to be ready..."
sleep 10

# Status check
echo ""
echo -e "${BLUE}=============================================${NC}"
echo -e "${GREEN}  Deploy complete!${NC}"
echo -e "${BLUE}=============================================${NC}"
echo ""

docker compose -f docker-compose.prod.yml ps

SERVER_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "YOUR_SERVER_IP")
echo ""
echo -e "  ${GREEN}App:${NC}     http://${SERVER_IP}"
echo -e "  ${GREEN}API:${NC}     http://${SERVER_IP}/api"
echo -e "  ${GREEN}Swagger:${NC} http://${SERVER_IP}/api/docs"
echo ""
echo -e "  ${YELLOW}Admin:${NC}   admin@montemoria.com.br"
echo -e "  ${YELLOW}Pass:${NC}    AlterarNoPrimeiroLogin123!"
echo ""
echo -e "  ${BLUE}Logs:${NC}    docker compose -f docker-compose.prod.yml logs -f"
echo -e "  ${BLUE}Stop:${NC}    docker compose -f docker-compose.prod.yml down"
echo ""
