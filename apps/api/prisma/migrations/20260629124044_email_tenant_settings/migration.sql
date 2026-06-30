-- DropIndex
DROP INDEX "tenant_users_tenant_id_status_idx";

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");
