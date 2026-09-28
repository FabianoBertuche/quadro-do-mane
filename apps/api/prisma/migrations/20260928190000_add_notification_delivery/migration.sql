-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('TASKS', 'CALENDAR', 'ROUTINE', 'COLLABORATION', 'PROJECTS_TEAMS', 'SECURITY');

-- CreateEnum
CREATE TYPE "NotificationPreferenceSource" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "NotificationPushStatus" AS ENUM ('PENDING', 'SENT', 'SKIPPED', 'FAILED');

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "tenant_user_id" TEXT NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "push_enabled" BOOLEAN NOT NULL DEFAULT true,
    "locked_by_admin" BOOLEAN NOT NULL DEFAULT false,
    "updated_by_tenant_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preference_audits" (
    "id" TEXT NOT NULL,
    "notification_preference_id" TEXT NOT NULL,
    "actor_tenant_user_id" TEXT,
    "source" "NotificationPreferenceSource" NOT NULL,
    "previous_value_json" TEXT,
    "next_value_json" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_preference_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_dispatches" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "tenant_user_id" TEXT NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "type" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "occurrence_key" TEXT NOT NULL,
    "notification_id" TEXT,
    "push_status" "NotificationPushStatus" NOT NULL DEFAULT 'PENDING',
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),

    CONSTRAINT "notification_dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_push_receipts" (
    "id" TEXT NOT NULL,
    "dispatch_id" TEXT NOT NULL,
    "push_device_id" TEXT NOT NULL,
    "expo_ticket_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error_code" TEXT,
    "checked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_push_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_tenant_user_id_category_key" ON "notification_preferences"("tenant_user_id", "category");

-- CreateIndex
CREATE INDEX "notification_preference_audits_notification_preference_id_idx" ON "notification_preference_audits"("notification_preference_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_dispatches_notification_id_key" ON "notification_dispatches"("notification_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_dispatches_tenant_user_id_type_entity_id_occurrence_key_key" ON "notification_dispatches"("tenant_user_id", "type", "entity_id", "occurrence_key");

-- CreateIndex
CREATE INDEX "notification_dispatches_tenant_id_push_status_idx" ON "notification_dispatches"("tenant_id", "push_status");

-- CreateIndex
CREATE INDEX "notification_push_receipts_status_idx" ON "notification_push_receipts"("status");

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_tenant_user_id_fkey" FOREIGN KEY ("tenant_user_id") REFERENCES "tenant_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_updated_by_tenant_user_id_fkey" FOREIGN KEY ("updated_by_tenant_user_id") REFERENCES "tenant_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preference_audits" ADD CONSTRAINT "notification_preference_audits_notification_preference_id_fkey" FOREIGN KEY ("notification_preference_id") REFERENCES "notification_preferences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preference_audits" ADD CONSTRAINT "notification_preference_audits_actor_tenant_user_id_fkey" FOREIGN KEY ("actor_tenant_user_id") REFERENCES "tenant_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_dispatches" ADD CONSTRAINT "notification_dispatches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_dispatches" ADD CONSTRAINT "notification_dispatches_tenant_user_id_fkey" FOREIGN KEY ("tenant_user_id") REFERENCES "tenant_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_dispatches" ADD CONSTRAINT "notification_dispatches_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_push_receipts" ADD CONSTRAINT "notification_push_receipts_dispatch_id_fkey" FOREIGN KEY ("dispatch_id") REFERENCES "notification_dispatches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_push_receipts" ADD CONSTRAINT "notification_push_receipts_push_device_id_fkey" FOREIGN KEY ("push_device_id") REFERENCES "push_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
