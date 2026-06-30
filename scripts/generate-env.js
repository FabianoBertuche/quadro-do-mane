#!/usr/bin/env node
/**
 * Generate .env file with strong secrets for Quadro do Mané.
 * Usage: node scripts/generate-env.js [--force]
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Parse CLI arguments
const args = process.argv.slice(2);
const force = args.includes('--force') || args.includes('-f');

// Paths
const rootDir = process.cwd();
const envPath = path.join(rootDir, '.env');

// Guard: if .env already exists and --force not set, exit early
if (fs.existsSync(envPath) && !force) {
  console.log('.env already exists. Use --force to overwrite.');
  process.exit(0);
}

// Generate secrets (same lengths as Python version)
const JWT_SECRET = crypto.randomBytes(64).toString('hex');
const JWT_REFRESH_SECRET = crypto.randomBytes(64).toString('hex');
const ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');

// Build .env content
const timestamp = new Date().toISOString().replace('Z', '');
const content = `# Quadro do Mané — variáveis de ambiente (geradas em ${timestamp}Z)
# NÃO versionar este arquivo. Mantenha fora do git.

# ─── Database ─────────────────────────────────────────────────────────────
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/quadro_do_mane?schema=public"

# ─── JWT ─────────────────────────────────────────────────────────────────
JWT_SECRET="${JWT_SECRET}"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET}"
JWT_REFRESH_EXPIRES_IN="7d"

# ─── Encryption (AES-256-GCM) ─────────────────────────────────────────────
ENCRYPTION_KEY="${ENCRYPTION_KEY}"

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
`;

// Write .env
try {
  fs.writeFileSync(envPath, content, 'utf-8');
  console.log(`OK: .env generated with secrets of ${JWT_SECRET.length} chars each`);
} catch (error) {
  console.error('Failed to write .env:', error.message);
  process.exit(1);
}