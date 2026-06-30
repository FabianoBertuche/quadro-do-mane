-- Migration: tabela de RefreshTokens (com rotação e detecção de reuso)
-- + tabela de LoginAttempt para auditoria e rate-limiting futuro.

CREATE TABLE "refresh_tokens" (
    "id"            TEXT         NOT NULL,
    "user_id"       TEXT         NOT NULL,
    "tenant_id"     TEXT         NOT NULL,
    "token_hash"    TEXT         NOT NULL,
    "family"        TEXT         NOT NULL,
    "is_revoked"    BOOLEAN      NOT NULL DEFAULT false,
    "replaced_by_id" TEXT,
    "user_agent"    TEXT,
    "ip_address"    TEXT,
    "expires_at"    TIMESTAMP(3) NOT NULL,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");
CREATE INDEX "refresh_tokens_user_id_idx"           ON "refresh_tokens"("user_id");
CREATE INDEX "refresh_tokens_family_idx"            ON "refresh_tokens"("family");
CREATE INDEX "refresh_tokens_tenant_id_idx"         ON "refresh_tokens"("tenant_id");

ALTER TABLE "refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "login_attempts" (
    "id"          TEXT         NOT NULL,
    "email"       TEXT         NOT NULL,
    "ip_address"  TEXT,
    "user_agent"  TEXT,
    "success"     BOOLEAN      NOT NULL,
    "reason"      TEXT,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "login_attempts_email_idx"      ON "login_attempts"("email");
CREATE INDEX "login_attempts_ip_address_idx" ON "login_attempts"("ip_address");
CREATE INDEX "login_attempts_created_at_idx" ON "login_attempts"("created_at");