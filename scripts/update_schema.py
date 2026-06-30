#!/usr/bin/env python3
"""Script one-shot para atualizar o schema.prisma do Quadro do Mané."""
from pathlib import Path

path = Path("apps/api/prisma/schema.prisma")
content = path.read_text(encoding="utf-8")

old = '''model EmailSetting {
  id           String     @id @default(uuid())
  tenantId     String     @map("tenant_id")
  tenantUserId String     @map("tenant_user_id")
  protocol     String     @default("imap") // imap, smtp
  host         String
  port         Int
  user         String
  password     String
  secure       Boolean    @default(true)
  createdAt    DateTime   @default(now()) @map("created_at")
  updatedAt    DateTime   @updatedAt @map("updated_at")

  tenantUser   TenantUser @relation(fields: [tenantUserId], references: [id], onDelete: Cascade)
  tenant       Tenant     @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantUserId, protocol])
  @@map("email_settings")
}'''

new = '''model EmailSetting {
  id                String     @id @default(uuid())
  tenantId          String     @map("tenant_id")
  tenantUserId      String     @map("tenant_user_id")
  protocol          String     @default("imap") // imap, smtp
  host              String
  port              Int
  user              String
  // AES-256-GCM fields - IV aleatorio por registro, authTag para integridade
  passwordCiphertext String     @map("password_ciphertext")
  passwordIv         String     @map("password_iv")
  passwordAuthTag    String     @map("password_auth_tag")
  secure            Boolean    @default(true)
  createdAt         DateTime   @default(now()) @map("created_at")
  updatedAt         DateTime   @updatedAt @map("updated_at")

  tenantUser        TenantUser @relation(fields: [tenantUserId], references: [id], onDelete: Cascade)
  tenant            Tenant     @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantUserId, protocol])
  @@map("email_settings")
}'''

if old not in content:
    print("PADRAO ANTIGO NAO ENCONTRADO — schema ja pode ter sido atualizado.")
    raise SystemExit(1)

content = content.replace(old, new, 1)
path.write_text(content, encoding="utf-8")
print("OK: schema.prisma atualizado (AES-256-GCM).")