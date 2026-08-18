INSERT INTO "tenants" ("id", "name", "slug", "updatedAt") VALUES ('92c862d7-f6a9-498a-ae80-fbbc1b8ae1e3', 'Test Tenant', 'test-tenant', now());
INSERT INTO "users" ("id", "name", "email", "passwordHash", "updatedAt") VALUES ('u1', 'Test User', 'test@test.com', 'hash', now());
INSERT INTO "tenant_users" ("id", "tenantId", "userId", "updatedAt") VALUES ('9ad25863-ef50-487f-ada8-866d2d636e93', '92c862d7-f6a9-498a-ae80-fbbc1b8ae1e3', 'u1', now());
