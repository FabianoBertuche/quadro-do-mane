-- Denylist de access tokens JWT revogados (substitui o Redis).
-- Linhas expiram em expires_at e são limpas periodicamente pelo pg_cron
-- (job configurado separadamente: cleanup_token_denylist).

CREATE TABLE IF NOT EXISTS "token_denylist" (
    "id"         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "token_hash" TEXT         NOT NULL UNIQUE,
    "user_id"    UUID         NULL,
    "reason"     TEXT         NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "token_denylist_expires_at_idx" ON "token_denylist" ("expires_at");
CREATE INDEX IF NOT EXISTS "token_denylist_user_id_idx"   ON "token_denylist" ("user_id");
