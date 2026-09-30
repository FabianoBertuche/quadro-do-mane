ALTER TABLE "ai_oauth_connections"
    ADD COLUMN "refresh_lease_token" TEXT,
    ADD COLUMN "refresh_lease_expires_at" TIMESTAMP(3);

ALTER TABLE "ai_oauth_attempts"
    ADD COLUMN "pkce_verifier_ciphertext" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "pkce_verifier_iv" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "pkce_verifier_auth_tag" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "nonce_ciphertext" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "nonce_iv" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "nonce_auth_tag" TEXT NOT NULL DEFAULT '';

DROP INDEX "ai_oauth_connections_tenant_user_id_issuer_subject_client_id_key";
CREATE UNIQUE INDEX "ai_oauth_connections_tenant_id_tenant_user_id_issuer_subject_client_id_key"
    ON "ai_oauth_connections"("tenant_id", "tenant_user_id", "issuer", "subject", "client_id");
