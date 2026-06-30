-- Migration: introduzir EmailTenantSetting (config de servidor por tenant)
-- e encolher EmailSetting para conter apenas a senha criptografada.
--
-- MOTIVAÇÃO
-- Antes, cada usuário informava host/porta/user/secure. Agora:
--   * EmailTenantSetting  → servidor IMAP/SMTP configurado UMA vez pelo admin do tenant
--   * EmailSetting        → apenas senha (cifrada) por usuário, por protocolo
--   * Email do usuário (User.email) já existe e é único no cadastro do colaborador
--
-- IMPORTANTE: registros antigos de email_settings (com host/port/user/secure em texto puro)
-- serão descartados nesta migration — usuários precisarão re-cadastrar a senha.
-- Os campos removidos são cobertos pela nova tabela email_tenant_settings + User.email.

-- ============================================================
-- 1. Nova tabela: email_tenant_settings
-- ============================================================
CREATE TABLE "email_tenant_settings" (
    "id"                              TEXT NOT NULL,
    "tenant_id"                       TEXT NOT NULL,
    "email_domain"                    TEXT NOT NULL,
    "detection_mode"                  TEXT NOT NULL DEFAULT 'PRESET',
    "preset_key"                      TEXT,
    "imap_host"                       TEXT NOT NULL,
    "imap_port"                       INTEGER NOT NULL,
    "imap_secure"                     BOOLEAN NOT NULL DEFAULT true,
    "smtp_host"                       TEXT NOT NULL,
    "smtp_port"                       INTEGER NOT NULL,
    "smtp_secure"                     BOOLEAN NOT NULL DEFAULT true,
    "updated_by_tenant_user_id"       TEXT,
    "created_at"                      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"                      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_tenant_settings_pkey" PRIMARY KEY ("id")
);

-- 1 tenant → 1 config (unique)
CREATE UNIQUE INDEX "email_tenant_settings_tenant_id_key" ON "email_tenant_settings"("tenant_id");

CREATE INDEX "email_tenant_settings_email_domain_idx" ON "email_tenant_settings"("email_domain");

ALTER TABLE "email_tenant_settings"
  ADD CONSTRAINT "email_tenant_settings_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_tenant_settings"
  ADD CONSTRAINT "email_tenant_settings_updated_by_tenant_user_id_fkey"
  FOREIGN KEY ("updated_by_tenant_user_id") REFERENCES "tenant_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 2. Encolher email_settings — remover host/port/user/secure
-- ============================================================
-- Os registros antigos não têm utilidade sem host/port/user (agora vêm do tenant).
-- Apagamos tudo: cada usuário precisará salvar a senha novamente.
DELETE FROM "email_settings";

ALTER TABLE "email_settings"
  DROP COLUMN "host",
  DROP COLUMN "port",
  DROP COLUMN "user",
  DROP COLUMN "secure";

-- ============================================================
-- 3. Adicionar coluna tenant na relação reversa do Tenant (opcional)
-- O Prisma schema já declara a relação; o cascade está OK.
-- ============================================================