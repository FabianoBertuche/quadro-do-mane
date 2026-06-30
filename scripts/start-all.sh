#!/usr/bin/env bash
# Script de bootstrap e execução do Quadro do Mané para teste local.
# Pré-requisitos: Docker Desktop rodando, Node 20+, npm 10+
# Uso: ./scripts/start-all.sh

set -e

cd "$(dirname "$0")/.."

echo "================================================"
echo "  Quadro do Mané — Bootstrap + Start"
echo "================================================"

# 1. Garante .env com secrets fortes
if [ ! -f .env ]; then
  echo "[1/7] Gerando .env com secrets fortes..."
  python scripts/generate_env.py
else
  echo "[1/7] .env já existe, mantendo."
fi

# 2. Sobe Postgres + Redis via Docker Compose
echo "[2/7] Subindo Postgres + Redis (Docker Compose)..."
docker compose up -d

echo "  Aguardando Postgres (15s)..."
sleep 15

# 3. Instala dependências do monorepo
echo "[3/7] Instalando dependências..."
npm install --silent

# 4. Aplica migrations + gera Prisma Client
echo "[4/7] Aplicando migrations e gerando Prisma Client..."
cd apps/api
npx prisma migrate deploy
npx prisma generate
cd ../..

# 5. Roda seed
echo "[5/7] Executando seed..."
cd apps/api
npm run seed
cd ../..

# 6. Sobe API (porta 3001)
echo "[6/7] Subindo API na porta 3001..."
cd apps/api
npm run dev &
API_PID=$!
cd ../..

# 7. Sobe Web (porta 3000)
echo "[7/7] Subindo Web na porta 3000..."
cd apps/web
npm run dev &
WEB_PID=$!
cd ../..

echo ""
echo "================================================"
echo "  Serviços iniciados!"
echo "================================================"
echo "  API:    http://localhost:3001/api"
echo "  Docs:   http://localhost:3001/api/docs"
echo "  Web:    http://localhost:3000"
echo ""
echo "  Login padrão:"
echo "    Email:    admin@quadrodomane.local"
echo "    Senha:    AlterarNoPrimeiroLogin123!"
echo ""
echo "  PIDs: API=$API_PID, Web=$WEB_PID"
echo "  Para parar: kill $API_PID $WEB_PID"
echo "================================================"

# Espera Ctrl+C para encerrar
trap "kill $API_PID $WEB_PID 2>/dev/null || true; echo 'Serviços encerrados.'" INT TERM
wait