CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "owner_tenant_user_id" TEXT NOT NULL,
    "context_project_id" TEXT,
    "title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_messages" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'TEXT',
    "content" TEXT,
    "audio_object_key" TEXT,
    "provider_meta_json" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_action_proposals" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "created_by_tenant_user_id" TEXT NOT NULL,
    "tool_name" TEXT NOT NULL,
    "arguments_json" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "summary" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "result_json" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_action_proposals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_conversations_tenant_id_owner_tenant_user_id_updated_at_idx"
    ON "ai_conversations"("tenant_id", "owner_tenant_user_id", "updated_at");
CREATE INDEX "ai_messages_tenant_id_conversation_id_created_at_idx"
    ON "ai_messages"("tenant_id", "conversation_id", "created_at");
CREATE INDEX "ai_action_proposals_tenant_id_created_by_tenant_user_id_status_idx"
    ON "ai_action_proposals"("tenant_id", "created_by_tenant_user_id", "status");

ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_owner_tenant_user_id_fkey"
    FOREIGN KEY ("owner_tenant_user_id") REFERENCES "tenant_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_action_proposals" ADD CONSTRAINT "ai_action_proposals_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_action_proposals" ADD CONSTRAINT "ai_action_proposals_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_action_proposals" ADD CONSTRAINT "ai_action_proposals_created_by_tenant_user_id_fkey"
    FOREIGN KEY ("created_by_tenant_user_id") REFERENCES "tenant_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
