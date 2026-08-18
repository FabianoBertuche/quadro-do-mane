-- CreateTable
CREATE TABLE IF NOT EXISTS "daily_routine_items" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tenant_id" TEXT NOT NULL,
    "assigned_tenant_user_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scheduled_time" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_routine_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "daily_routine_logs" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tenant_id" TEXT NOT NULL,
    "routine_item_id" TEXT NOT NULL,
    "tenant_user_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_completed" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,

    CONSTRAINT "daily_routine_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "daily_routine_items_tenant_id_idx" ON "daily_routine_items"("tenant_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "daily_routine_items_assigned_tenant_user_id_idx" ON "daily_routine_items"("assigned_tenant_user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "daily_routine_items_created_by_id_idx" ON "daily_routine_items"("created_by_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "daily_routine_logs_tenant_id_idx" ON "daily_routine_logs"("tenant_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "daily_routine_logs_routine_item_id_idx" ON "daily_routine_logs"("routine_item_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "daily_routine_logs_tenant_user_id_idx" ON "daily_routine_logs"("tenant_user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "daily_routine_logs_date_idx" ON "daily_routine_logs"("date");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "daily_routine_logs_routine_item_id_tenant_user_id_date_key" ON "daily_routine_logs"("routine_item_id", "tenant_user_id", "date");

-- AddForeignKey (conditional: only if not already exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_routine_items_tenant_id_fkey') THEN
    ALTER TABLE "daily_routine_items" ADD CONSTRAINT "daily_routine_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_routine_items_assigned_tenant_user_id_fkey') THEN
    ALTER TABLE "daily_routine_items" ADD CONSTRAINT "daily_routine_items_assigned_tenant_user_id_fkey" FOREIGN KEY ("assigned_tenant_user_id") REFERENCES "tenant_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_routine_items_created_by_id_fkey') THEN
    ALTER TABLE "daily_routine_items" ADD CONSTRAINT "daily_routine_items_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "tenant_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_routine_logs_tenant_id_fkey') THEN
    ALTER TABLE "daily_routine_logs" ADD CONSTRAINT "daily_routine_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_routine_logs_routine_item_id_fkey') THEN
    ALTER TABLE "daily_routine_logs" ADD CONSTRAINT "daily_routine_logs_routine_item_id_fkey" FOREIGN KEY ("routine_item_id") REFERENCES "daily_routine_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_routine_logs_tenant_user_id_fkey') THEN
    ALTER TABLE "daily_routine_logs" ADD CONSTRAINT "daily_routine_logs_tenant_user_id_fkey" FOREIGN KEY ("tenant_user_id") REFERENCES "tenant_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
