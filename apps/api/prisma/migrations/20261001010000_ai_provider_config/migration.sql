-- AlterTable
ALTER TABLE "ai_server_runtime" ADD COLUMN "primary_provider" TEXT NOT NULL DEFAULT 'chatgpt';
ALTER TABLE "ai_server_runtime" ADD COLUMN "failover_provider" TEXT;
ALTER TABLE "ai_server_runtime" ADD COLUMN "chatgpt_model_slug" TEXT;
ALTER TABLE "ai_server_runtime" ADD COLUMN "chatgpt_model_display_name" TEXT;
ALTER TABLE "ai_server_runtime" ADD COLUMN "ollama_model_slug" TEXT;
ALTER TABLE "ai_server_runtime" ADD COLUMN "ollama_model_display_name" TEXT;
ALTER TABLE "ai_server_runtime" ADD COLUMN "ollama_api_key_ciphertext" TEXT;
ALTER TABLE "ai_server_runtime" ADD COLUMN "ollama_api_key_iv" TEXT;
ALTER TABLE "ai_server_runtime" ADD COLUMN "ollama_api_key_auth_tag" TEXT;
UPDATE "ai_server_runtime" SET "chatgpt_model_slug" = "selected_model_slug", "chatgpt_model_display_name" = "selected_model_display_name" WHERE "selected_model_slug" IS NOT NULL;
ALTER TABLE "ai_server_runtime" DROP COLUMN "selected_model_slug";
ALTER TABLE "ai_server_runtime" DROP COLUMN "selected_model_display_name";