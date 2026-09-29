import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException, ForbiddenException, GoneException, HttpException } from '@nestjs/common';
import { AiAuditService } from './ai-audit.service';
import { AiService, AiSecurityLimits } from './ai.service';
import { AiContextService } from './ai-context.service';
import { AiToolRegistryService } from './tools/ai-tool-registry.service';
import { AiResponseMode } from './dto/send-ai-message.dto';
import { OpenAiProvider } from './providers/openai.provider';

const actor = { tenantId: 'tenant-a', tenantUserId: 'user-a' };

function setup(overrides: { limits?: Partial<AiSecurityLimits>; conversation?: unknown; proposal?: unknown; provider?: any } = {}) {
  const provider = overrides.provider ?? { complete: async () => ({ text: 'ok', toolCalls: [] }) };
  const calls: any[] = [];
  const history: any[] = [];
  const auditLog: any[] = [];
  const prisma = {
    aiConversation: {
      findFirst: async ({ where }: any) => overrides.conversation === undefined
        ? where.id === 'conversation-1' && where.tenantId === actor.tenantId && where.ownerTenantUserId === actor.tenantUserId
          ? { id: 'conversation-1', tenantId: actor.tenantId, ownerTenantUserId: actor.tenantUserId, contextProjectId: null }
          : null
        : overrides.conversation,
      create: async ({ data }: any) => ({ id: 'conversation-1', ...data }),
    },
    aiMessage: {
      create: async ({ data }: any) => ({ id: `message-${calls.length}`, ...data }),
      findMany: async ({ take }: any) => {
        history.push(take);
        return [];
      },
    },
    aiActionProposal: {
      findFirst: async ({ where }: any) => overrides.proposal === undefined
        ? where.id === 'proposal-1' ? { id: 'proposal-1', tenantId: actor.tenantId, createdByTenantUserId: actor.tenantUserId, status: 'PENDING', expiresAt: new Date(Date.now() + 60_000), toolName: 'demo', argumentsJson: '{}' } : null
        : overrides.proposal,
      findMany: async () => [],
      create: async ({ data }: any) => ({ id: 'proposal-1', ...data }),
      updateMany: async () => ({ count: 1 }),
    },
  };
  const context = new AiContextService({ project: { findFirst: async () => null }, task: { findMany: async () => [] } } as any);
  const service = new AiService(
    prisma as any,
    provider,
    context,
    new AiToolRegistryService([]),
    new AiAuditService({ log: async (entry: any) => auditLog.push(entry) } as any),
    overrides.limits,
  );
  return { service, calls, history, auditLog };
}

test('rejects oversized messages before persistence or provider calls', async () => {
  const provider = { complete: async () => { throw new Error('provider must not be called'); } };
  const { service, calls } = setup({ provider, limits: { maxMessageLength: 4 } });

  await assert.rejects(
    () => service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: '12345', responseMode: AiResponseMode.TEXT }),
    BadRequestException,
  );
  assert.equal(calls.length, 0);
});

test('bounds provider history using the configured limit', async () => {
  const { service, history } = setup({ limits: { maxHistoryMessages: 3 } });

  await service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'question', responseMode: AiResponseMode.TEXT });
  assert.equal(history.at(-1), 3);
});

test('rejects requests after the per-user and per-tenant rate limits', async () => {
  const { service } = setup({ limits: { userRequestsPerMinute: 1, tenantRequestsPerMinute: 1 } });
  const input = { ...actor, conversationId: 'conversation-1' };

  await service.sendMessage(input, { text: 'first', responseMode: AiResponseMode.TEXT });
  await assert.rejects(
    () => service.sendMessage(input, { text: 'second', responseMode: AiResponseMode.TEXT }),
    (error: HttpException) => error.getStatus() === 429,
  );
});

test('redacts secrets and prompt content from AI audit metadata', async () => {
  const auditLog: any[] = [];
  const audit = new AiAuditService({ log: async (entry: any) => auditLog.push(entry) } as any);

  await audit.record({
    tenantId: 'tenant-a', actorTenantUserId: 'user-a', action: 'provider.failed',
    metadata: { prompt: 'Authorization: Bearer provider-secret', error: 'raw provider payload', safeStatus: 'failed' },
  });

  assert.equal(auditLog[0].metadata.prompt, '[REDACTED]');
  assert.equal(auditLog[0].metadata.error, '[REDACTED]');
  assert.equal(auditLog[0].metadata.safeStatus, 'failed');
  assert.doesNotMatch(JSON.stringify(auditLog[0]), /provider-secret|raw provider payload/);
});

test('maps provider timeout/failure without leaking provider tokens', async () => {
  const provider = new OpenAiProvider(
    { get: (key: string, fallback?: string) => ({ OPENAI_API_KEY: 'provider-secret', OPENAI_MODEL: 'test-model' } as any)[key] ?? fallback } as any,
    (_key, timeout) => {
      assert.equal(timeout, 20_000);
      return { chat: { completions: { create: async () => { throw new Error('timeout provider-secret payload'); } } } } as any;
    },
  );

  await assert.rejects(() => provider.complete({ messages: [{ role: 'user', content: 'secret prompt' }] }), (error: Error) => {
    assert.equal(error.message, 'AI provider request failed');
    assert.doesNotMatch(error.message, /provider-secret|payload|secret prompt/);
    return true;
  });
});

test('denies cross-tenant conversation and proposal access, including expired proposals', async () => {
  const { service } = setup({ conversation: null, proposal: null });
  await assert.rejects(() => service.getMessages({ tenantId: 'tenant-b', tenantUserId: 'user-b' }, 'conversation-1'), ForbiddenException);
  await assert.rejects(() => service.confirmProposal({ tenantId: 'tenant-b', tenantUserId: 'user-b' }, 'proposal-1'), ForbiddenException);

  const expired = setup({ proposal: { id: 'proposal-1', tenantId: actor.tenantId, createdByTenantUserId: actor.tenantUserId, status: 'PENDING', expiresAt: new Date(Date.now() - 1), toolName: 'demo', argumentsJson: '{}' } });
  await assert.rejects(() => expired.service.confirmProposal(actor, 'proposal-1'), GoneException);
});
