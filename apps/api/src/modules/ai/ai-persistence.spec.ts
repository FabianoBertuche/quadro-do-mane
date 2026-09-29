import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEnv } from '../../common/config/env.validation';

const apiRoot = join(__dirname, '../../..');
const schema = readFileSync(join(apiRoot, 'prisma/schema.prisma'), 'utf8');
const seed = readFileSync(join(apiRoot, 'prisma/seed.ts'), 'utf8');
const rolesService = readFileSync(
  join(apiRoot, 'src/modules/roles/roles.service.ts'),
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

function baseEnv(overrides: Record<string, unknown> = {}) {
  return {
    DATABASE_URL: 'postgresql://localhost:5432/monte_moria',
    API_PORT: '3001',
    JWT_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
    ENCRYPTION_KEY: 'c'.repeat(64),
    NEXT_PUBLIC_API_URL: 'http://localhost:3001',
    COOKIE_DOMAIN: 'localhost',
    COOKIE_SECURE: 'false',
    CORS_ORIGINS: 'http://localhost:3000',
    SEED_ADMIN_EMAIL: 'admin@example.com',
    SEED_ADMIN_PASSWORD: 'password123',
    ...overrides,
  };
}

test('defines concrete tenant-safe AI persistence contracts', () => {
  const conversation = modelBlock('AiConversation');
  assert.equal(modelLine(conversation, 'id'), 'id                String              @id @default(uuid())');
  assert.equal(modelLine(conversation, 'tenantId'), 'tenantId          String              @map("tenant_id")');
  assert.equal(modelLine(conversation, 'ownerTenantUserId'), 'ownerTenantUserId String              @map("owner_tenant_user_id")');
  assert.match(conversation, /tenant\s+Tenant\s+@relation\(fields: \[tenantId\], references: \[id\], onDelete: Cascade\)/);
  assert.match(conversation, /owner\s+TenantUser\s+@relation\(fields: \[ownerTenantUserId\], references: \[id\], onDelete: Cascade\)/);
  assert.match(conversation, /messages\s+AiMessage\[\]/);
  assert.match(conversation, /proposals\s+AiActionProposal\[\]/);
  assert.match(conversation, /@@index\(\[tenantId, ownerTenantUserId, updatedAt\]\)/);

  const message = modelBlock('AiMessage');
  assert.equal(modelLine(message, 'format'), 'format           String         @default("TEXT")');
  assert.equal(modelLine(message, 'audioObjectKey'), 'audioObjectKey   String?        @map("audio_object_key")');
  assert.equal(modelLine(message, 'providerMetaJson'), 'providerMetaJson String?        @map("provider_meta_json")');
  assert.match(message, /tenant\s+Tenant\s+@relation\(fields: \[tenantId\], references: \[id\], onDelete: Cascade\)/);
  assert.match(message, /conversation\s+AiConversation\s+@relation\(fields: \[conversationId\], references: \[id\], onDelete: Cascade\)/);
  assert.match(message, /@@index\(\[tenantId, conversationId, createdAt\]\)/);

  const proposal = modelBlock('AiActionProposal');
  assert.equal(modelLine(proposal, 'status'), 'status               String         @default("PENDING")');
  assert.equal(modelLine(proposal, 'expiresAt'), 'expiresAt            DateTime       @map("expires_at")');
  assert.match(proposal, /tenant\s+Tenant\s+@relation\(fields: \[tenantId\], references: \[id\], onDelete: Cascade\)/);
  assert.match(proposal, /conversation\s+AiConversation\s+@relation\(fields: \[conversationId\], references: \[id\], onDelete: Cascade\)/);
  assert.match(proposal, /createdBy\s+TenantUser\s+@relation\(fields: \[createdByTenantUserId\], references: \[id\], onDelete: Cascade\)/);
  assert.match(proposal, /@@index\(\[tenantId, createdByTenantUserId, status\]\)/);

  assert.match(seed, /\{\s*code:\s*'ai\.use',\s*name:\s*'Usar Assistente de IA',\s*module:\s*'ai'\s*\}/);
  const basicPermissions = rolesService.match(/const basicPermissionCodes = \[([\s\S]*?)\];/)?.[1];
  assert.ok(basicPermissions);
  assert.match(basicPermissions, /'ai\.use'/);
});

test('rejects an invalid AI_ENABLED value instead of coercing it to false', () => {
  assert.throws(
    () => validateEnv(baseEnv({ AI_ENABLED: 'sometimes' })),
    /AI_ENABLED/,
  );
});

test('requires the OpenAI key only when AI is enabled', () => {
  const disabledConfig = validateEnv(baseEnv({ AI_ENABLED: 'false' }));
  assert.equal(disabledConfig.AI_ENABLED, false);
  assert.equal(disabledConfig.OPENAI_MODEL, 'gpt-4o-mini');
  assert.equal(disabledConfig.OPENAI_STT_MODEL, 'gpt-4o-mini-transcribe');
  assert.equal(disabledConfig.OPENAI_TTS_MODEL, 'gpt-4o-mini-tts');
  assert.throws(() => validateEnv(baseEnv({ AI_ENABLED: 'true' })), /OPENAI_API_KEY/);
});
