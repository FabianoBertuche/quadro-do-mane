import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const apiRoot = join(__dirname, '../../..');
const schema = readFileSync(join(apiRoot, 'prisma/schema.prisma'), 'utf8');
const migrationDirectory = join(apiRoot, 'prisma/migrations');

function modelBlock(modelName: string): string {
  const match = schema.match(
    new RegExp(`model\\s+${modelName}\\s+\\{([\\s\\S]*?)\\n\\}`),
  );
  assert.ok(match, `missing Prisma model ${modelName}`);
  return match[1];
}

function modelLine(model: string, field: string): string {
  const line = model
    .split('\n')
    .find((candidate) => new RegExp(`^\\s*${field}\\s+`).test(candidate));
  assert.ok(line, `missing field ${field}`);
  return line.trim();
}

function runtimeMigration(): string {
  const migrationName = readdirSync(migrationDirectory).find((entry) =>
    entry.endsWith('_add_ai_server_runtime'),
  );
  assert.ok(migrationName, 'missing AI server runtime migration');
  return readFileSync(join(migrationDirectory, migrationName, 'migration.sql'), 'utf8');
}

test('defines one global AI runtime with optional OAuth connection and selected model metadata', () => {
  const runtime = modelBlock('AiServerRuntime');

  assert.equal(modelLine(runtime, 'id'), 'id                       String   @id @default("global")');
  assert.equal(modelLine(runtime, 'oauthConnectionId'), 'oauthConnectionId        String?  @unique @map("oauth_connection_id")');
  assert.equal(modelLine(runtime, 'selectedModelSlug'), 'selectedModelSlug        String?  @map("selected_model_slug")');
  assert.equal(modelLine(runtime, 'selectedModelDisplayName'), 'selectedModelDisplayName String?  @map("selected_model_display_name")');
  assert.match(modelLine(runtime, 'createdAt'), /DateTime.*@default\(now\(\)\).*created_at/);
  assert.match(modelLine(runtime, 'updatedAt'), /DateTime.*@updatedAt.*updated_at/);
  assert.match(
    runtime,
    /oauthConnection\s+AiOAuthConnection\?\s+@relation\(fields: \[oauthConnectionId\], references: \[id\], onDelete: SetNull\)/,
  );
  assert.match(runtime, /@@map\("ai_server_runtime"\)/);
});

test('allows encrypted OAuth credentials to be globally owned without tenant or user ownership', () => {
  const connection = modelBlock('AiOAuthConnection');

  assert.match(modelLine(connection, 'tenantId'), /String\?\s+@map\("tenant_id"\)/);
  assert.match(modelLine(connection, 'tenantUserId'), /String\?\s+@map\("tenant_user_id"\)/);
  assert.match(
    connection,
    /tenant\s+Tenant\?\s+@relation\(fields: \[tenantId\], references: \[id\], onDelete: Cascade\)/,
  );
  assert.match(
    connection,
    /tenantUser\s+TenantUser\?\s+@relation\(fields: \[tenantId, tenantUserId\], references: \[tenantId, id\], onDelete: Cascade\)/,
  );
  assert.match(connection, /serverRuntime\s+AiServerRuntime\?/);

  for (const field of [
    'issuer',
    'subject',
    'accessTokenCiphertext',
    'accessTokenIv',
    'accessTokenAuthTag',
    'refreshTokenCiphertext',
    'refreshTokenIv',
    'refreshTokenAuthTag',
    'idTokenCiphertext',
    'idTokenIv',
    'idTokenAuthTag',
  ]) {
    assert.match(modelLine(connection, field), /String/);
  }
});

test('migration enforces singleton runtime and preserves disconnected legacy ownership safely', () => {
  const migration = runtimeMigration();

  assert.match(migration, /CREATE TABLE "ai_server_runtime"/);
  assert.match(migration, /"id" TEXT NOT NULL DEFAULT 'global'/);
  assert.match(migration, /CHECK \("id" = 'global'\)/);
  assert.match(migration, /"oauth_connection_id" TEXT/);
  assert.match(migration, /"selected_model_slug" TEXT/);
  assert.match(migration, /"selected_model_display_name" TEXT/);
  assert.match(migration, /CREATE UNIQUE INDEX "ai_server_runtime_oauth_connection_id_key"/);
  assert.match(
    migration,
    /FOREIGN KEY \("oauth_connection_id"\) REFERENCES "ai_oauth_connections"\("id"\) ON DELETE SET NULL/,
  );
  assert.match(migration, /ALTER COLUMN "tenant_id" DROP NOT NULL/);
  assert.match(migration, /ALTER COLUMN "tenant_user_id" DROP NOT NULL/);
  assert.doesNotMatch(migration, /INSERT INTO "ai_server_runtime"[\s\S]*SELECT/);
});
