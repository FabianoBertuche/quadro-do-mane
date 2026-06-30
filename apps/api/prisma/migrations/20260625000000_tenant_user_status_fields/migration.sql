-- TenantUser hardening: status enum + campos de auditoria/convite.
-- Adiciona visibilidade granular ao vínculo usuário ↔ tenant sem quebrar o isActive legado.

CREATE TYPE "TenantUserStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED');

ALTER TABLE "tenant_users"
  ADD COLUMN "status" "TenantUserStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "last_invite_at" TIMESTAMP(3),
  ADD COLUMN "disabled_at" TIMESTAMP(3),
  ADD COLUMN "disabled_reason" TEXT;

-- Backfill: qualquer vínculo legado desativado recebe SUSPENDED para manter semântica.
UPDATE "tenant_users"
   SET "status" = 'SUSPENDED',
       "disabled_at" = COALESCE("disabled_at", "updated_at"),
       "disabled_reason" = COALESCE("disabled_reason", 'Desativado antes desta migration')
 WHERE "is_active" = FALSE;

-- Índice de suporte ao filtro por status dentro do tenant.
CREATE INDEX "tenant_users_tenant_id_status_idx" ON "tenant_users"("tenant_id", "status");