-- AlterTable
ALTER TABLE "events" ADD COLUMN "remind_days_before" INTEGER;

-- CreateTable
CREATE TABLE "event_reminder_actions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "tenant_user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "action_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_reminder_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_reminder_actions_event_id_tenant_user_id_action_action_d_key"
ON "event_reminder_actions"("event_id", "tenant_user_id", "action", "action_date");

-- Índice único parcial: uma dispensação permanente por evento+usuário
CREATE UNIQUE INDEX "event_reminder_actions_forever_unique"
ON "event_reminder_actions"("event_id", "tenant_user_id")
WHERE "action" = 'DISMISS_FOREVER';

CREATE INDEX "event_reminder_actions_tenant_id_idx" ON "event_reminder_actions"("tenant_id");
CREATE INDEX "event_reminder_actions_event_id_idx" ON "event_reminder_actions"("event_id");
CREATE INDEX "event_reminder_actions_tenant_user_id_idx" ON "event_reminder_actions"("tenant_user_id");

-- AddForeignKey
ALTER TABLE "event_reminder_actions" ADD CONSTRAINT "event_reminder_actions_event_id_fkey"
FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_reminder_actions" ADD CONSTRAINT "event_reminder_actions_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_reminder_actions" ADD CONSTRAINT "event_reminder_actions_tenant_user_id_fkey"
FOREIGN KEY ("tenant_user_id") REFERENCES "tenant_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;