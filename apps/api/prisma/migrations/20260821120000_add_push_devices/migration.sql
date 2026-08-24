-- Tabela de dispositivos registrados para push notifications (Expo)
CREATE TABLE "push_devices" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "tenant_user_id" TEXT NOT NULL,
    "expo_push_token" TEXT NOT NULL,
    "platform" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_devices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "push_devices_expo_push_token_key" ON "push_devices"("expo_push_token");
CREATE INDEX "push_devices_tenant_user_id_idx" ON "push_devices"("tenant_user_id");

ALTER TABLE "push_devices"
  ADD CONSTRAINT "push_devices_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "push_devices"
  ADD CONSTRAINT "push_devices_tenant_user_id_fkey"
  FOREIGN KEY ("tenant_user_id") REFERENCES "tenant_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
