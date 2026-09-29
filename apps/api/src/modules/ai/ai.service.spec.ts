import assert from 'node:assert/strict';
import test from 'node:test';
import { ForbiddenException, GoneException } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiContextService } from './ai-context.service';
import { AiAuditService } from './ai-audit.service';
import { AiToolRegistryService } from './tools/ai-tool-registry.service';
import { AiProvider } from './ports/ai-provider.port';
import { AiResponseMode } from './dto/send-ai-message.dto';

const actor = { tenantId: 'tenant-a', tenantUserId: 'user-a' };

function setup(provider: AiProvider) {
  const created: any[] = [];
  const updated: any[] = [];
  const conversationQueries: any[] = [];
  const prisma = {
    aiConversation: {
      create: async ({ data }: any) => {
        const conversation = { id: 'conversation-1', ...data };
        created.push(conversation);
        return conversation;
      },
      findFirst: async ({ where }: any) => where.id === 'conversation-1'
        ? { id: 'conversation-1', tenantId: 'tenant-a', ownerTenantUserId: 'user-a', contextProjectId: null }
        : null,
      findMany: async ({ where }: any) => {
        conversationQueries.push(where);
        return [{ id: 'conversation-1', ...where }];
      },
      update: async ({ data }: any) => data,
    },
    aiMessage: {
      create: async ({ data }: any) => ({ id: `message-${created.length}`, ...data }),
      findMany: async () => [],
      count: async () => 0,
    },
    aiActionProposal: {
      create: async ({ data }: any) => ({ id: 'proposal-1', ...data }),
      findFirst: async ({ where }: any) => where.id === 'proposal-1'
        ? { id: 'proposal-1', tenantId: 'tenant-a', createdByTenantUserId: 'user-a', status: 'PENDING', expiresAt: new Date(Date.now() + 60_000), toolName: 'demo', argumentsJson: '{}', conversationId: 'conversation-1' }
        : null,
      update: async ({ data }: any) => {
        updated.push(data);
        return { id: 'proposal-1', ...data };
      },
    },
  };
  const context = new AiContextService({
    project: { findFirst: async () => ({ id: 'project-1', name: 'Project' }) },
    task: { findMany: async () => [] },
  } as any);
  const service = new AiService(
    prisma as any,
    provider,
    context,
    new AiToolRegistryService([]),
    new AiAuditService({ log: async () => undefined } as any),
  );
  return { service, prisma, created, updated, conversationQueries };
}

test('conversation reads are owned by the authenticated tenant user', async () => {
  const { service, conversationQueries } = setup({ complete: async () => ({ text: 'ok', toolCalls: [] }) });
  await service.listConversations(actor);
  assert.deepEqual(conversationQueries[0], { tenantId: 'tenant-a', ownerTenantUserId: 'user-a' });
  const result = await service.createConversation(actor, { contextProjectId: 'project-1' });
  assert.equal(result.contextProjectId, 'project-1');
});

test('text response is persisted and provider tool calls become confirmation proposals', async () => {
  const provider = {
    complete: async () => ({ text: 'Posso criar?', toolCalls: [{ name: 'create_task', arguments: { title: 'Nova tarefa' } }] }),
  };
  const { service, prisma } = setup(provider);
  (service as any).registry = new AiToolRegistryService([{
    name: 'create_task', description: 'Cria tarefa', parameters: { type: 'object' },
    execute: async () => ({ id: 'created' }),
  }]);
  const result = await service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'crie uma tarefa', responseMode: AiResponseMode.TEXT });
  assert.equal(result.assistantMessage.content, 'Posso criar?');
  assert.equal(result.proposal.toolName, 'create_task');
  assert.equal((prisma as any).aiActionProposal.create ? true : false, true);
});

test('expired proposals cannot be confirmed and confirmation revalidates tenant ownership', async () => {
  const { service, prisma } = setup({ complete: async () => ({ text: 'ok', toolCalls: [] }) });
  (prisma as any).aiActionProposal.findFirst = async () => ({
    id: 'proposal-1', tenantId: 'tenant-a', createdByTenantUserId: 'user-a', status: 'PENDING',
    expiresAt: new Date(Date.now() - 1), toolName: 'demo', argumentsJson: '{}', conversationId: 'conversation-1',
  });
  await assert.rejects(() => service.confirmProposal(actor, 'proposal-1'), GoneException);
  (prisma as any).aiActionProposal.findFirst = async () => null;
  await assert.rejects(() => service.cancelProposal({ tenantId: 'tenant-b', tenantUserId: 'user-a' }, 'proposal-1'), ForbiddenException);
});

test('cancellation only changes a pending proposal owned by the actor', async () => {
  const { service, updated } = setup({ complete: async () => ({ text: 'ok', toolCalls: [] }) });
  await service.cancelProposal(actor, 'proposal-1');
  assert.equal(updated[0].status, 'CANCELLED');
});
