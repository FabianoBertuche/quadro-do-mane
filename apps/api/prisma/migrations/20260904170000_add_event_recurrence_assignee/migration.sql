-- AlterTable
ALTER TABLE "events" ADD COLUMN "assignee_tenant_user_id" TEXT,
ADD COLUMN "recurrence_rule" TEXT,
ADD COLUMN "recurrence_interval" INTEGER,
ADD COLUMN "recurrence_unit" TEXT,
ADD COLUMN "recurrence_end_at" TIMESTAMP(3),
ADD COLUMN "series_id" TEXT;

-- CreateIndex
CREATE INDEX "events_series_id_idx" ON "events"("series_id");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_assignee_tenant_user_id_fkey"
FOREIGN KEY ("assignee_tenant_user_id") REFERENCES "tenant_users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;