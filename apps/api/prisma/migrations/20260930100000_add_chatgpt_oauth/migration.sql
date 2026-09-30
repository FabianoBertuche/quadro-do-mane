CREATE TABLE "ai_oauth_connections" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "tenant_user_id" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "access_token_ciphertext" TEXT NOT NULL,
    "access_token_iv" TEXT NOT NULL,
    "access_token_auth_tag" TEXT NOT NULL,
    "refresh_token_ciphertext" TEXT NOT NULL,
    "refresh_token_iv" TEXT NOT NULL,
    "refresh_token_auth_tag" TEXT NOT NULL,
    "id_token_ciphertext" TEXT NOT NULL,
    "id_token_iv" TEXT NOT NULL,
    "id_token_auth_tag" TEXT NOT NULL,
    "email" TEXT,
    "display_name" TEXT,
    "scopes" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ext_agent_host_id" TEXT NOT NULL,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "revoked_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_oauth_connections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_oauth_attempts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "tenant_user_id" TEXT NOT NULL,
    "state_hash" TEXT NOT NULL,
    "nonce_hash" TEXT NOT NULL,
    "pkce_verifier_hash" TEXT NOT NULL,
    "redirect_uri" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "ext_agent_host_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_oauth_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_oauth_connections_tenant_user_id_issuer_subject_client_id_key"
    ON "ai_oauth_connections"("tenant_user_id", "issuer", "subject", "client_id");
CREATE INDEX "ai_oauth_connections_tenant_id_tenant_user_id_expires_at_idx"
    ON "ai_oauth_connections"("tenant_id", "tenant_user_id", "expires_at");
CREATE UNIQUE INDEX "ai_oauth_attempts_state_hash_key"
    ON "ai_oauth_attempts"("state_hash");
CREATE INDEX "ai_oauth_attempts_tenant_id_tenant_user_id_expires_at_idx"
    ON "ai_oauth_attempts"("tenant_id", "tenant_user_id", "expires_at");

ALTER TABLE "ai_oauth_connections" ADD CONSTRAINT "ai_oauth_connections_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_oauth_connections" ADD CONSTRAINT "ai_oauth_connections_tenant_user_id_fkey"
    FOREIGN KEY ("tenant_user_id") REFERENCES "tenant_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_oauth_attempts" ADD CONSTRAINT "ai_oauth_attempts_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_oauth_attempts" ADD CONSTRAINT "ai_oauth_attempts_tenant_user_id_fkey"
    FOREIGN KEY ("tenant_user_id") REFERENCES "tenant_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
