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

function setup(overrides: { limits?: Partial<AiSecurityLimits>; conversation?: unknown; proposal?: unknown; provider?: any; rateLimiter?: any; proposalUpdateCount?: number } = {}) {
  const provider = overrides.provider ?? { complete: async () => ({ text: 'ok', toolCalls: [] }) };
  const calls: any[] = [];
  const history: any[] = [];
  const auditLog: any[] = [];
  const proposalUpdates: any[] = [];
  const rateCalls = new Map<string, number>();
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
        return Array.from({ length: take ?? 0 }, (_unused, index) => ({
          id: `history-${index}`,
          role: index % 2 === 0 ? 'user' : 'assistant',
          content: `historico-${index}`,
        }));
      },
    },
    aiActionProposal: {
      findFirst: async ({ where }: any) => overrides.proposal === undefined
        ? where.id === 'proposal-1' ? { id: 'proposal-1', tenantId: actor.tenantId, createdByTenantUserId: actor.tenantUserId, status: 'PENDING', expiresAt: new Date(Date.now() + 60_000), toolName: 'demo', argumentsJson: '{}' } : null
        : overrides.proposal,
      findMany: async () => [],
      create: async ({ data }: any) => ({ id: 'proposal-1', ...data }),
      updateMany: async ({ where, data }: any) => { proposalUpdates.push({ where, data }); return { count: overrides.proposalUpdateCount ?? 1 }; },
    },
  };
  const context = new AiContextService({ project: { findFirst: async () => null }, task: { findMany: async () => [] } } as any);
  const rateLimiter = {
    consume: async (rateActor: any, cost: number) => {
      const key = `${rateActor.tenantId}:${rateActor.tenantUserId}`;
      const count = (rateCalls.get(key) ?? 0) + 1;
      const limits = { ...({ userRequestsPerMinute: 60, tenantRequestsPerMinute: 300, costUnitsPerMinute: 120 }), ...overrides.limits };
      if (count > limits.userRequestsPerMinute || cost > limits.costUnitsPerMinute) throw new HttpException('rate limited', 429);
      rateCalls.set(key, count);
    },
  };
  const service = new AiService(
    prisma as any,
    provider,
    context,
    new AiToolRegistryService([]),
    new AiAuditService({ log: async (entry: any) => auditLog.push(entry) } as any),
    { resolve: async () => ({ name: 'Maria', address: 'Maria' }) } as any,
    overrides.limits,
    (overrides.rateLimiter ?? rateLimiter) as any,
  );
  return { service, calls, history, auditLog, proposalUpdates };
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
  let receivedInput: any;
  const { service, history } = setup({
    limits: { maxHistoryMessages: 3 },
    provider: { complete: async (input: any) => { receivedInput = input; return { text: 'ok', toolCalls: [] }; } },
  });

  await service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'question', responseMode: AiResponseMode.TEXT });

  assert.equal(history.at(-1), 2);
  const turns = receivedInput.messages.filter((message: any) => message.role !== 'system');
  assert.equal(turns.length, 3);
  assert.equal(turns.at(-1).content, 'question');
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

test('redacts secrets nested inside audit arrays and objects', async () => {
  const auditLog: any[] = [];
  const audit = new AiAuditService({ log: async (entry: any) => auditLog.push(entry) } as any);

  await audit.record({ tenantId: 'tenant-a', actorTenantUserId: 'user-a', action: 'provider.failed', metadata: {
    details: [{ authorization: 'Bearer nested-secret' }, { safeStatus: 'failed' }],
  } });

  assert.equal(auditLog[0].metadata.details[0].authorization, '[REDACTED]');
  assert.equal(auditLog[0].metadata.details[1].safeStatus, 'failed');
  assert.doesNotMatch(JSON.stringify(auditLog[0]), /nested-secret/);
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

test('claims proposals only while they are unexpired', async () => {
  const { service, proposalUpdates } = setup();
  (service as any).registry = new AiToolRegistryService([{ name: 'demo', parameters: { type: 'object' }, authorize: async () => undefined, execute: async () => ({ ok: true }) }]);
  await service.confirmProposal(actor, 'proposal-1');

  assert.deepEqual(proposalUpdates[0].where.expiresAt, { gt: proposalUpdates[0].where.expiresAt.gt });
  assert.ok(proposalUpdates[0].where.expiresAt.gt instanceof Date);
});

test('audits denied proposal confirmation without sensitive details', async () => {
  const { service, auditLog } = setup({ proposal: null });
  await assert.rejects(() => service.confirmProposal({ tenantId: 'tenant-b', tenantUserId: 'user-b' }, 'proposal-1'), ForbiddenException);

  assert.equal(auditLog.at(-1).action, 'ai.proposal.confirmation_denied');
  assert.deepEqual(auditLog.at(-1).metadata, { actorTenantUserId: 'user-b', reason: 'proposal_not_found' });
});

test('audits provider failures without recording the prompt or provider error', async () => {
  const { service, auditLog } = setup({ provider: { complete: async () => { throw new Error('AI provider request failed: provider-secret raw payload'); } } });
  await assert.rejects(() => service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'secret prompt', responseMode: AiResponseMode.TEXT }));

  assert.equal(auditLog.at(-1).action, 'ai.provider.failed');
  assert.deepEqual(auditLog.at(-1).metadata, { actorTenantUserId: 'user-a', provider: 'chatgpt', status: 'failed' });
  assert.doesNotMatch(JSON.stringify(auditLog), /secret prompt|provider-secret|raw payload/);
});

test('fails closed before the provider when the shared limiter is unavailable', async () => {
  let providerCalls = 0;
  const { service } = setup({
    provider: { complete: async () => { providerCalls += 1; return { text: 'unexpected', toolCalls: [] }; } },
    rateLimiter: { consume: async () => { throw new Error('database unavailable'); } },
  });

  await assert.rejects(() => service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'question', responseMode: AiResponseMode.TEXT }));
  assert.equal(providerCalls, 0);
});

test('does not execute a proposal when the expiring claim updates zero rows', async () => {
  let executions = 0;
  const { service, auditLog } = setup({ proposalUpdateCount: 0 });
  (service as any).registry = new AiToolRegistryService([{ name: 'demo', parameters: { type: 'object' }, authorize: async () => undefined, execute: async () => { executions += 1; } }]);

  await assert.rejects(() => service.confirmProposal(actor, 'proposal-1'), ForbiddenException);
  assert.equal(executions, 0);
  assert.equal(auditLog.at(-1).action, 'ai.proposal.confirmation_denied');
});

test('audits authorization denial during confirmation without proposal arguments', async () => {
  const { service, auditLog } = setup();
  (service as any).registry = new AiToolRegistryService([{ name: 'demo', parameters: { type: 'object' }, authorize: async () => { throw new ForbiddenException('not allowed'); }, execute: async () => ({}) }]);

  await assert.rejects(() => service.confirmProposal(actor, 'proposal-1'), ForbiddenException);
  assert.equal(auditLog.at(-1).action, 'ai.proposal.confirmation_denied');
  assert.equal(auditLog.at(-1).metadata.status, 'denied');
});
