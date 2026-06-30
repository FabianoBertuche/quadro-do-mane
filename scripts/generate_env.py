#!/usr/bin/env python3
"""Gera .env com secrets fortes para Quadro do Mané."""
import secrets
from pathlib import Path

env_path = Path(".env")

# Secrets de 64 bytes hex (>= 32 bytes exigidos pela validação)
JWT_SECRET = secrets.token_hex(64)
JWT_REFRESH_SECRET = secrets.token_hex(64)
# Encryption key de 32 bytes hex
ENCRYPTION_KEY = secrets.token_hex(32)

content = f"""# Quadro do Mané — variáveis de ambiente (geradas em {__import__('datetime').datetime.utcnow().isoformat()}Z)
# NÃO versionar este arquivo. Mantenha fora do git.

# ─── Database ─────────────────────────────────────────────────────────────
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/quadro_do_mane?schema=public"

# ─── JWT ─────────────────────────────────────────────────────────────────
JWT_SECRET="{JWT_SECRET}"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="{JWT_REFRESH_SECRET}"
JWT_REFRESH_EXPIRES_IN="7d"

# ─── Encryption (AES-256-GCM) ─────────────────────────────────────────────
ENCRYPTION_KEY="{ENCRYPTION_KEY}"

# ─── API ─────────────────────────────────────────────────────────────────
API_PORT=3001
API_PREFIX=/api

# ─── Frontend ────────────────────────────────────────────────────────────
NEXT_PUBLIC_API_URL=http://localhost:3001/api

# ─── Redis ───────────────────────────────────────────────────────────────
REDIS_HOST=localhost
REDIS_PORT=6379

# ─── S3 / Object Storage ─────────────────────────────────────────────────
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=quadro-do-mane

# ─── Cookie / CORS ───────────────────────────────────────────────────────
COOKIE_DOMAIN=localhost
COOKIE_SECURE=false
CORS_ORIGINS=http://localhost:3000

# ─── Security ────────────────────────────────────────────────────────────
BCRYPT_ROUNDS=12

# ─── Seed ────────────────────────────────────────────────────────────────
SEED_ADMIN_EMAIL=admin@quadrodomane.local
SEED_ADMIN_PASSWORD="AlterarNoPrimeiroLogin123!"
"""

env_path.write_text(content, encoding="utf-8")
print(f"OK: .env gerado com secrets de {len(JWT_SECRET)} chars cada")