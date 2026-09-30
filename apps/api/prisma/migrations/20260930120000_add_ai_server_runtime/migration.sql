ALTER TABLE "ai_oauth_connections"
    ALTER COLUMN "tenant_id" DROP NOT NULL,
    ALTER COLUMN "tenant_user_id" DROP NOT NULL;

CREATE TABLE "ai_server_runtime" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "oauth_connection_id" TEXT,
    "selected_model_slug" TEXT,
    "selected_model_display_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_server_runtime_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ai_server_runtime_singleton_key" CHECK ("id" = 'global')
);

CREATE UNIQUE INDEX "ai_server_runtime_oauth_connection_id_key"
    ON "ai_server_runtime"("oauth_connection_id");

ALTER TABLE "ai_server_runtime" ADD CONSTRAINT "ai_server_runtime_oauth_connection_id_fkey"
    FOREIGN KEY ("oauth_connection_id") REFERENCES "ai_oauth_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
