import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const apiRoot = join(__dirname, '../../..');
const schema = readFileSync(join(apiRoot, 'prisma/schema.prisma'), 'utf8');
const seed = readFileSync(join(apiRoot, 'prisma/seed.ts'), 'utf8');
const rolesService = readFileSync(
  join(apiRoot, 'src/modules/roles/roles.service.ts'),
  'utf8',
);
const envValidation = readFileSync(
  join(apiRoot, 'src/common/config/env.validation.ts'),
  'utf8',
);

test('defines tenant-safe AI persistence and the ai.use access contract', () => {
  for (const model of ['AiConversation', 'AiMessage', 'AiActionProposal']) {
    assert.match(schema, new RegExp(`model\\s+${model}\\s+\\{`));
  }

  for (const status of ['PENDING', 'CONFIRMED', 'CANCELLED', 'EXECUTED', 'FAILED']) {
    assert.match(schema, new RegExp(status));
  }

  assert.match(seed, /code:\s*'ai\.use'/);
  assert.match(rolesService, /'ai\.use'/);
  assert.match(envValidation, /AI_ENABLED/);
  assert.match(envValidation, /OPENAI_API_KEY/);
  assert.match(envValidation, /OPENAI_MODEL/);
  assert.match(envValidation, /OPENAI_STT_MODEL/);
  assert.match(envValidation, /OPENAI_TTS_MODEL/);
});
