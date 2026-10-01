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

function migrationBySuffix(suffix: string): string {
  const migrationName = readdirSync(migrationDirectory).find((entry) =>
    entry.endsWith(suffix),
  );
  assert.ok(migrationName, `missing migration ending in ${suffix}`);
  return readFileSync(join(migrationDirectory, migrationName, 'migration.sql'), 'utf8');
}

function runtimeMigration(): string {
  return migrationBySuffix('_add_ai_server_runtime');
}

function providerConfigMigration(): string {
  return migrationBySuffix('_ai_provider_config');
}

test('defines one global AI runtime with optional OAuth connection', () => {
  const runtime = modelBlock('AiServerRuntime');

  assert.equal(modelLine(runtime, 'id'), 'id                       String   @id @default("global")');
  assert.equal(modelLine(runtime, 'oauthConnectionId'), 'oauthConnectionId        String?  @unique @map("oauth_connection_id")');
  assert.match(modelLine(runtime, 'createdAt'), /DateTime.*@default\(now\(\)\).*created_at/);
  assert.match(modelLine(runtime, 'updatedAt'), /DateTime.*@updatedAt.*updated_at/);
  assert.match(
    runtime,
    /oauthConnection\s+AiOAuthConnection\?\s+@relation\(fields: \[oauthConnectionId\], references: \[id\], onDelete: SetNull\)/,
  );
  assert.match(runtime, /@@map\("ai_server_runtime"\)/);
});

test('defines one global AI runtime with provider config and per-provider model metadata', () => {
  const runtime = modelBlock('AiServerRuntime');

  assert.equal(modelLine(runtime, 'id'), 'id                       String   @id @default("global")');
  assert.equal(modelLine(runtime, 'oauthConnectionId'), 'oauthConnectionId        String?  @unique @map("oauth_connection_id")');
  assert.equal(modelLine(runtime, 'primaryProvider'), 'primaryProvider          String   @default("chatgpt") @map("primary_provider")');
  assert.equal(modelLine(runtime, 'failoverProvider'), 'failoverProvider         String?  @map("failover_provider")');
  assert.equal(modelLine(runtime, 'chatgptModelSlug'), 'chatgptModelSlug         String?  @map("chatgpt_model_slug")');
  assert.equal(modelLine(runtime, 'chatgptModelDisplayName'), 'chatgptModelDisplayName  String?  @map("chatgpt_model_display_name")');
  assert.equal(modelLine(runtime, 'ollamaModelSlug'), 'ollamaModelSlug          String?  @map("ollama_model_slug")');
  assert.equal(modelLine(runtime, 'ollamaModelDisplayName'), 'ollamaModelDisplayName   String?  @map("ollama_model_display_name")');
  assert.equal(modelLine(runtime, 'ollamaApiKeyCiphertext'), 'ollamaApiKeyCiphertext   String?  @map("ollama_api_key_ciphertext")');
  assert.equal(modelLine(runtime, 'ollamaApiKeyIv'), 'ollamaApiKeyIv           String?  @map("ollama_api_key_iv")');
  assert.equal(modelLine(runtime, 'ollamaApiKeyAuthTag'), 'ollamaApiKeyAuthTag      String?  @map("ollama_api_key_auth_tag")');
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
  assert.match(
    migration,
    /INSERT INTO "ai_server_runtime" \("id", "updated_at"\)\s+VALUES \('global', CURRENT_TIMESTAMP\);/,
  );
  assert.match(migration, /CREATE UNIQUE INDEX "ai_server_runtime_oauth_connection_id_key"/);
  assert.match(
    migration,
    /FOREIGN KEY \("oauth_connection_id"\) REFERENCES "ai_oauth_connections"\("id"\) ON DELETE SET NULL/,
  );
  assert.match(migration, /ALTER COLUMN "tenant_id" DROP NOT NULL/);
  assert.match(migration, /ALTER COLUMN "tenant_user_id" DROP NOT NULL/);
  assert.match(
    migration,
    /CONSTRAINT "ai_oauth_connections_ownership_pair_check"\s+CHECK \(\("tenant_id" IS NULL\) = \("tenant_user_id" IS NULL\)\)/,
  );
  assert.doesNotMatch(migration, /INSERT INTO "ai_server_runtime"[\s\S]*SELECT/);
});

test('migration copies legacy selected model into the chatgpt columns and drops the old ones', () => {
  const migration = providerConfigMigration();
  assert.match(migration, /ADD COLUMN "primary_provider" TEXT NOT NULL DEFAULT 'chatgpt'/);
  assert.match(migration, /ADD COLUMN "failover_provider" TEXT/);
  assert.match(migration, /ADD COLUMN "chatgpt_model_slug" TEXT/);
  assert.match(migration, /ADD COLUMN "ollama_api_key_ciphertext" TEXT/);
  assert.match(migration, /UPDATE "ai_server_runtime" SET "chatgpt_model_slug" = "selected_model_slug"/);
  assert.match(migration, /DROP COLUMN "selected_model_slug"/);
  assert.match(migration, /DROP COLUMN "selected_model_display_name"/);
  assert.doesNotMatch(migration, /CREATE TABLE "ai_server_runtime"/);
});