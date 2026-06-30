#!/usr/bin/env python3
"""Insere models RefreshToken e LoginAttempt no schema.prisma canônico."""
from pathlib import Path

path = Path("apps/api/prisma/schema.prisma")
content = path.read_text(encoding="utf-8")

# 1) Adicionar relation refreshTokens ao User.
#    No schema atual: auditLogs vem antes de tenantUsers.
user_old = """  auditLogs    AuditLog[]
  tenantUsers  TenantUser[]

  @@map("users")
}"""
user_new = """  auditLogs     AuditLog[]
  tenantUsers   TenantUser[]
  refreshTokens RefreshToken[]

  @@map("users")
}"""
if user_old not in content:
    print("PADRAO DO USER NAO ENCONTRADO")
    raise SystemExit(1)
content = content.replace(user_old, user_new, 1)

# 2) Adicionar relation refreshTokens no Tenant
tenant_old = """  emailSettings      EmailSetting[]

  @@map("tenants")
}"""
tenant_new = """  emailSettings      EmailSetting[]
  refreshTokens      RefreshToken[]

  @@map("tenants")
}"""
if tenant_old not in content:
    print("PADRAO DO TENANT NAO ENCONTRADO")
    raise SystemExit(1)
content = content.replace(tenant_old, tenant_new, 1)

# 3) Adicionar models no final do arquivo
extra = """

model RefreshToken {
  id           String   @id @default(uuid())
  userId       String   @map("user_id")
  tenantId     String   @map("tenant_id")
  // SHA-256 do refresh token em texto puro - nunca armazenar o token.
  tokenHash    String   @unique @map("token_hash")
  // Família: detecta reuso de token revogado (alerta de roubo).
  family       String
  isRevoked    Boolean  @default(false) @map("is_revoked")
  replacedById String?  @map("replaced_by_id")
  userAgent    String?  @map("user_agent")
  ipAddress    String?  @map("ip_address")
  expiresAt    DateTime @map("expires_at")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tenant       Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([family])
  @@index([tenantId])
  @@index([expiresAt])
  @@map("refresh_tokens")
}

model LoginAttempt {
  id         String   @id @default(uuid())
  email      String
  ipAddress  String?  @map("ip_address")
  userAgent  String?  @map("user_agent")
  success    Boolean
  reason     String?
  createdAt  DateTime @default(now()) @map("created_at")

  @@index([email])
  @@index([ipAddress])
  @@index([createdAt])
  @@map("login_attempts")
}
"""

if "model RefreshToken" in content:
    print("RefreshToken ja presente, pulando insercao")
else:
    content = content.rstrip() + "\n" + extra

path.write_text(content, encoding="utf-8")
print("OK: schema.prisma com RefreshToken + LoginAttempt")