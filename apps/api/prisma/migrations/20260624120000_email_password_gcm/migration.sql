-- Migration: substituir password em texto puro por ciphertext/iv/authTag (AES-256-GCM)
-- ATENÇÃO: registros existentes de email_settings com senhas precisarão ser re-cadastrados
-- pelo usuário. Como o IV era estático no esquema antigo, não é possível recuperar
-- os segredos — esta é uma operação destrutiva intencional (criptografia inválida).

-- Adicionar novas colunas como NULL temporariamente
ALTER TABLE "email_settings"
  ADD COLUMN "password_ciphertext" TEXT,
  ADD COLUMN "password_iv"         TEXT,
  ADD COLUMN "password_auth_tag"   TEXT;

-- Remover coluna antiga em plaintext
ALTER TABLE "email_settings" DROP COLUMN "password";

-- Tornar novas colunas obrigatórias
ALTER TABLE "email_settings"
  ALTER COLUMN "password_ciphertext" SET NOT NULL,
  ALTER COLUMN "password_iv"         SET NOT NULL,
  ALTER COLUMN "password_auth_tag"   SET NOT NULL;