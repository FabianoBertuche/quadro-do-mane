CREATE TABLE "ai_rate_limit_buckets" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "tenant_user_id" TEXT,
    "scope_key" TEXT NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "request_count" INTEGER NOT NULL DEFAULT 0,
    "cost_units" INTEGER NOT NULL DEFAULT 0,
    "request_limit" INTEGER NOT NULL,
    "cost_limit" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_rate_limit_buckets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_rate_limit_buckets_tenant_id_scope_key_window_start_key"
    ON "ai_rate_limit_buckets"("tenant_id", "scope_key", "window_start");
CREATE INDEX "ai_rate_limit_buckets_tenant_id_window_start_idx"
    ON "ai_rate_limit_buckets"("tenant_id", "window_start");

ALTER TABLE "ai_rate_limit_buckets" ADD CONSTRAINT "ai_rate_limit_buckets_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_rate_limit_buckets" ADD CONSTRAINT "ai_rate_limit_buckets_tenant_user_id_fkey"
    FOREIGN KEY ("tenant_user_id") REFERENCES "tenant_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
