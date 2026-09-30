import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const apiRoot = join(__dirname, '../../..');
const schema = readFileSync(join(apiRoot, 'prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  join(
    apiRoot,
    'prisma/migrations/20260930100000_add_chatgpt_oauth/migration.sql',
  ),
  'utf8',
);

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

test('defines encrypted tenant-user ChatGPT OAuth connection persistence', () => {
  const connection = modelBlock('AiOAuthConnection');
  const tenantUser = modelBlock('TenantUser');

  for (const field of [
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
  for (const field of [
    'tenantId',
    'tenantUserId',
    'issuer',
    'subject',
    'clientId',
    'scopes',
    'expiresAt',
    'extAgentHostId',
    'isRevoked',
    'revokedAt',
    'lastUsedAt',
  ]) {
    assert.ok(modelLine(connection, field));
  }
  assert.match(
    connection,
    /tenant\s+Tenant\s+@relation\(fields: \[tenantId\], references: \[id\], onDelete: Cascade\)/,
  );
  assert.match(
    connection,
    /tenantUser\s+TenantUser\s+@relation\(fields: \[tenantId, tenantUserId\], references: \[tenantId, id\], onDelete: Cascade\)/,
  );
  assert.match(connection, /@@unique\(\[tenantUserId, issuer, subject, clientId\]\)/);
  assert.match(connection, /@@index\(\[tenantId, tenantUserId/);
  assert.match(tenantUser, /@@unique\(\[tenantId, id\]\)/);
});

test('defines expiring one-time OAuth attempts without token storage', () => {
  const attempt = modelBlock('AiOAuthAttempt');

  for (const field of [
    'tenantId',
    'tenantUserId',
    'stateHash',
    'nonceHash',
    'pkceVerifierHash',
    'redirectUri',
    'clientId',
    'extAgentHostId',
    'expiresAt',
    'consumedAt',
  ]) {
    assert.ok(modelLine(attempt, field));
  }
  assert.match(
    attempt,
    /tenant\s+Tenant\s+@relation\(fields: \[tenantId\], references: \[id\], onDelete: Cascade\)/,
  );
  assert.match(
    attempt,
    /tenantUser\s+TenantUser\s+@relation\(fields: \[tenantId, tenantUserId\], references: \[tenantId, id\], onDelete: Cascade\)/,
  );
  assert.equal(modelLine(attempt, 'consumedAt'), 'consumedAt       DateTime? @map("consumed_at")');
  assert.match(attempt, /@@index\(\[tenantId, tenantUserId, consumedAt, expiresAt\]\)/);
  assert.doesNotMatch(attempt, /accessToken|refreshToken|idToken/);
});

test('migration creates OAuth tables, encrypted columns, identity constraint, and tenant indexes', () => {
  assert.match(migration, /CREATE TABLE "ai_oauth_connections"/);
  assert.match(migration, /"access_token_ciphertext" TEXT NOT NULL/);
  assert.match(migration, /"refresh_token_ciphertext" TEXT NOT NULL/);
  assert.match(migration, /"id_token_ciphertext" TEXT NOT NULL/);
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "ai_oauth_connections_tenant_user_id_issuer_subject_client_id_key"/,
  );
  assert.match(migration, /CREATE TABLE "ai_oauth_attempts"/);
  assert.match(migration, /"state_hash" TEXT NOT NULL/);
  assert.match(migration, /"pkce_verifier_hash" TEXT NOT NULL/);
  assert.match(migration, /"consumed_at" TIMESTAMP\(3\)/);
  assert.match(
    migration,
    /ai_oauth_attempts_tenant_id_tenant_user_id_expires_at_idx/,
  );
  assert.match(
    migration,
    /ai_oauth_attempts_tenant_id_tenant_user_id_consumed_at_expires_at_idx/,
  );
  assert.match(migration, /CREATE UNIQUE INDEX "tenant_users_tenant_id_id_key"/);
  assert.match(
    migration,
    /FOREIGN KEY \("tenant_id", "tenant_user_id"\) REFERENCES "tenant_users"\("tenant_id", "id"\) ON DELETE CASCADE/,
  );
  assert.match(migration, /REFERENCES "tenants"\("id"\) ON DELETE CASCADE/);
});
