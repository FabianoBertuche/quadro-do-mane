import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException, ForbiddenException, GoneException } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiContextService } from './ai-context.service';
import { AiAuditService } from './ai-audit.service';
import { AiToolRegistryService } from './tools/ai-tool-registry.service';
import { AiProvider, AiProviderError } from './ports/ai-provider.port';
import { AiResponseMode } from './dto/send-ai-message.dto';

const actor = { tenantId: 'tenant-a', tenantUserId: 'user-a' };

interface SetupOptions {
  limits?: { maxHistoryMessages?: number };
  failProposalWriteAt?: number;
}

function setup(provider: AiProvider, oauth?: any, runtime?: any, options: SetupOptions = {}) {
  const created: any[] = [];
  const updated: any[] = [];
  const conversationQueries: any[] = [];
  const messageQueries: any[] = [];
  const proposalQueries: any[] = [];
  const proposalUpdates: any[] = [];
  const auditLog: any[] = [];
  const transactions: { outcome: 'committed' | 'rolled_back' }[] = [];
  const txWrites: any[] = [];
  const outsideWrites: any[] = [];
  const txClients: any[] = [];
  const rows: { message: any[]; proposal: any[] } = { message: [], proposal: [] };
  let proposalWrites = 0;
  const createMessage = async ({ data }: any) => {
    const row = { id: `message-${rows.message.length + 1}`, ...data };
    rows.message.push(row);
    return row;
  };
  const createProposal = async ({ data }: any) => {
    proposalWrites += 1;
    if (options.failProposalWriteAt === proposalWrites) throw new Error('falha ao gravar a proposta');
    const row = { id: `proposal-${rows.proposal.length + 1}`, ...data };
    rows.proposal.push(row);
    return row;
  };
  const recording = (kind: string, log: any[], create: (args: any) => Promise<any>) => async (args: any) => {
    log.push({ kind, ...args.data });
    return create(args);
  };
  const prisma = {
    $transaction: async (callback: (tx: any) => Promise<any>) => {
      const snapshot = { message: rows.message.length, proposal: rows.proposal.length, txWrites: txWrites.length };
      const tx = {
        ...prisma,
        aiMessage: { ...prisma.aiMessage, create: recording('message', txWrites, createMessage) },
        aiActionProposal: { ...prisma.aiActionProposal, create: recording('proposal', txWrites, createProposal) },
      };
      txClients.push(tx);
      try {
        const result = await callback(tx);
        transactions.push({ outcome: 'committed' });
        return result;
      } catch (error) {
        rows.message.length = snapshot.message;
        rows.proposal.length = snapshot.proposal;
        txWrites.length = snapshot.txWrites;
        transactions.push({ outcome: 'rolled_back' });
        throw error;
      }
    },
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
      create: recording('message', outsideWrites, createMessage),
      findMany: async ({ where, take }: any) => {
        messageQueries.push({ ...where, take });
        return Array.from({ length: take ?? 0 }, (_unused, index) => ({
          id: `history-${index}`,
          role: index % 2 === 0 ? 'user' : 'assistant',
          content: `historico-${index}`,
        }));
      },
      count: async () => 0,
    },
    aiActionProposal: {
      create: recording('proposal', outsideWrites, createProposal),
      findFirst: async ({ where }: any) => where.id === 'proposal-1'
        ? { id: 'proposal-1', tenantId: 'tenant-a', createdByTenantUserId: 'user-a', status: 'PENDING', expiresAt: new Date(Date.now() + 60_000), toolName: 'demo', argumentsJson: '{}', conversationId: 'conversation-1' }
        : null,
      findMany: async ({ where }: any) => {
        proposalQueries.push(where);
        return [];
      },
      update: async ({ data }: any) => {
        updated.push(data);
        return { id: 'proposal-1', ...data };
      },
      updateMany: async ({ where, data }: any) => {
        proposalUpdates.push({ where, data });
        return { count: 1 };
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
    new AiAuditService({ log: async (entry: any) => { auditLog.push(entry); } } as any),
    options.limits ?? {},
    undefined,
    oauth,
    runtime,
  );
  return {
    service, prisma, created, updated, conversationQueries, messageQueries, proposalQueries, proposalUpdates,
    auditLog, transactions, txWrites, outsideWrites, txClients, rows,
    persistedRows: () => [...rows.message, ...rows.proposal],
  };
}

test('audits provider HTTP metadata while keeping the thrown error safe', async () => {
  const { service, auditLog } = setup({ complete: async () => {
    throw new AiProviderError('AI provider request failed', { status: 429, code: 'rate_limit_exceeded', requestId: 'req-audit' });
  } });

  await assert.rejects(() => service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'oi', responseMode: AiResponseMode.TEXT }), (error: Error) => {
    assert.equal(error.message, 'AI provider request failed');
    return true;
  });
  assert.deepEqual({
    provider: auditLog.at(-1).metadata.provider,
    status: auditLog.at(-1).metadata.status,
    providerStatus: auditLog.at(-1).metadata.providerStatus,
    providerCode: auditLog.at(-1).metadata.providerCode,
    providerRequestId: auditLog.at(-1).metadata.providerRequestId,
  }, {
    provider: 'AI_PROVIDER', status: 'failed', providerStatus: 429, providerCode: 'rate_limit_exceeded', providerRequestId: 'req-audit',
  });
});

test('resolves the global provider credential independently of the authenticated actor', async () => {
  let receivedAuth: any;
  let receivedActor: any = 'unset';
  const provider = { complete: async (_input: any, auth: any) => { receivedAuth = auth; return { text: 'ok', toolCalls: [] }; } };
  const { service } = setup(provider, { resolveProviderAuth: async (requestedActor: any) => {
    receivedActor = requestedActor;
    return { type: 'oauth', accessToken: 'global-token' };
  } });

  await service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'oi', responseMode: AiResponseMode.TEXT });

  assert.equal(receivedActor, undefined);
  assert.deepEqual(receivedAuth, { type: 'oauth', accessToken: 'global-token' });
});

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
  const { service, txWrites, outsideWrites } = setup(provider);
  (service as any).registry = new AiToolRegistryService([{
    name: 'create_task', description: 'Cria tarefa', parameters: { type: 'object' },
    authorize: async () => undefined,
    execute: async () => ({ id: 'created' }),
  }]);
  const result = await service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'crie uma tarefa', responseMode: AiResponseMode.TEXT });
  assert.equal(result.assistantMessage.content, 'Posso criar?');
  assert.equal(result.proposal.toolName, 'create_task');
  assert.deepEqual(txWrites.map((write) => write.kind), ['message', 'message', 'proposal']);
  assert.deepEqual(outsideWrites, []);
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
  const { service, proposalUpdates } = setup({ complete: async () => ({ text: 'ok', toolCalls: [] }) });
  await service.cancelProposal(actor, 'proposal-1');
  assert.equal(proposalUpdates[0].data.status, 'CANCELLED');
  assert.deepEqual(proposalUpdates[0].where, { id: 'proposal-1', tenantId: 'tenant-a', createdByTenantUserId: 'user-a', status: 'PENDING' });
});

test('messages and history include the conversation owner in their tenant predicates', async () => {
  const { service, messageQueries } = setup({ complete: async () => ({ text: 'ok', toolCalls: [] }) });
  await service.getMessages(actor, 'conversation-1');
  await service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'consulta', responseMode: AiResponseMode.TEXT });
  assert.ok(messageQueries.length >= 2);
  for (const where of messageQueries) {
    assert.equal(where.tenantId, 'tenant-a');
    assert.equal(where.conversationId, 'conversation-1');
    assert.deepEqual(where.conversation, { ownerTenantUserId: 'user-a' });
  }
});

test('sendMessage creates proposals for every tool call and never executes tools', async () => {
  let executions = 0;
  const provider = {
    complete: async () => ({ text: 'Vou propor duas ações.', toolCalls: [
      { name: 'first', arguments: { value: 1 } },
      { name: 'second', arguments: { value: 2 } },
    ] }),
  };
  const { service, rows, outsideWrites } = setup(provider);
  (service as any).registry = new AiToolRegistryService(['first', 'second'].map((name) => ({
    name, parameters: { type: 'object' }, authorize: async () => undefined, execute: async () => { executions += 1; },
  })));
  const result = await service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'faça duas coisas', responseMode: AiResponseMode.TEXT });
  assert.equal(executions, 0);
  assert.equal(rows.proposal.length, 2);
  assert.deepEqual(rows.proposal.map((proposal) => proposal.toolName), ['first', 'second']);
  assert.deepEqual(outsideWrites, []);
  assert.equal((result as any).proposals.length, 2);
});

test('confirmation reloads and reauthorizes current state immediately before execution', async () => {
  const order: string[] = [];
  const { service, prisma, proposalUpdates } = setup({ complete: async () => ({ text: 'ok', toolCalls: [] }) });
  (prisma as any).aiActionProposal.findFirst = async ({ where }: any) => {
    order.push(`reload:${where.status ?? 'pending'}`);
    return { id: 'proposal-1', tenantId: 'tenant-a', createdByTenantUserId: 'user-a', status: where.status ?? 'PENDING', expiresAt: new Date(Date.now() + 60_000), toolName: 'demo', argumentsJson: '{}', conversationId: 'conversation-1' };
  };
  (service as any).registry = new AiToolRegistryService([{
    name: 'demo', parameters: { type: 'object' },
    authorize: async () => { order.push('authorize'); },
    execute: async () => { order.push('execute'); return { ok: true }; },
  } as any]);
  await service.confirmProposal(actor, 'proposal-1');
  const reloadIndex = order.indexOf('reload:CONFIRMED');
  assert.deepEqual(order.slice(reloadIndex, reloadIndex + 3), ['reload:CONFIRMED', 'authorize', 'execute']);
   assert.deepEqual(proposalUpdates.map((entry) => entry.where), [
     { id: 'proposal-1', tenantId: 'tenant-a', createdByTenantUserId: 'user-a', status: 'PENDING', expiresAt: { gt: proposalUpdates[0].where.expiresAt.gt } },
     { id: 'proposal-1', tenantId: 'tenant-a', createdByTenantUserId: 'user-a', status: 'CONFIRMED' },
   ]);
});

test('confirmation keeps clarification proposals pending and persists a structured result message', async () => {
  const { service, prisma } = setup({ complete: async () => ({ text: 'ok', toolCalls: [] }) });
  const messages: any[] = [];
  (prisma as any).aiMessage.create = async ({ data }: any) => { messages.push(data); return { id: `message-${messages.length}`, ...data }; };
  (service as any).registry = new AiToolRegistryService([{
    name: 'demo', parameters: { type: 'object' }, authorize: async () => undefined,
    execute: async () => ({ needsClarification: true, field: 'projectName', matches: ['p1', 'p2'] }),
  }]);
  const result = await service.confirmProposal(actor, 'proposal-1');
  assert.equal(result.status, 'PENDING');
  assert.match(messages.at(-1).content, /needsClarification/);
  assert.equal(messages.at(-1).role, 'assistant');
});

test('text input is persisted as TEXT even when response mode is AUDIO', async () => {
  const { service, created } = setup({ complete: async () => ({ text: 'ok', toolCalls: [] }) });
  const result = await service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'oi', responseMode: AiResponseMode.AUDIO });
  assert.equal(result.message.format, 'TEXT');
  assert.equal(created.length, 0);
});

test('text endpoint ignores a client AUDIO input format claim', async () => {
  const { service } = setup({ complete: async () => ({ text: 'ok', toolCalls: [] }) });
  const result = await service.sendMessage({ ...actor, conversationId: 'conversation-1' }, {
    text: 'oi',
    responseMode: AiResponseMode.TEXT,
    inputFormat: AiResponseMode.AUDIO,
  });

  assert.equal(result.message.format, 'TEXT');
});

test('completes with the globally selected runtime model', async () => {
  let receivedInput: any;
  const { service } = setup({ complete: async (input: any) => { receivedInput = input; return { text: 'ok', toolCalls: [] }; } },
    undefined,
    { getRuntime: async () => ({ connectionStatus: 'connected', provider: 'chatgpt', selectedModel: { slug: 'gpt-5-codex', displayName: 'GPT-5 Codex' } }) });

  await service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'oi', responseMode: AiResponseMode.TEXT });

  assert.equal(receivedInput.model, 'gpt-5-codex');
  assert.ok(receivedInput.messages.some((message: any) => message.role === 'user' && message.content === 'oi'));
});

test('omits the model when the global runtime has no selected model', async () => {
  let receivedInput: any;
  const { service } = setup({ complete: async (input: any) => { receivedInput = input; return { text: 'ok', toolCalls: [] }; } },
    undefined,
    { getRuntime: async () => ({ connectionStatus: 'disconnected', provider: 'chatgpt', selectedModel: null }) });

  await service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'oi', responseMode: AiResponseMode.TEXT });

  assert.equal(receivedInput.model, undefined);
});

test('surfaces a global runtime read failure instead of silently using the default model', async () => {
  let providerCalls = 0;
  const { service, txWrites, outsideWrites, transactions, persistedRows } = setup({ complete: async () => {
    providerCalls += 1;
    return { text: 'ok', toolCalls: [] };
  } }, undefined, { getRuntime: async () => { throw new Error('runtime indisponível'); } });

  await assert.rejects(
    () => service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'oi', responseMode: AiResponseMode.TEXT }),
    /runtime indisponível/,
  );

  assert.equal(providerCalls, 0);
  assert.deepEqual(txWrites, []);
  assert.deepEqual(outsideWrites, []);
  assert.deepEqual(persistedRows(), []);
  assert.deepEqual(transactions, []);
});

test('keeps the completion history window within the configured maximum', async () => {
  let receivedInput: any;
  const { service, messageQueries } = setup({ complete: async (input: any) => { receivedInput = input; return { text: 'ok', toolCalls: [] }; } },
    undefined,
    undefined,
    { limits: { maxHistoryMessages: 4 } });

  await service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'oi', responseMode: AiResponseMode.TEXT });

  assert.equal(messageQueries.at(-1).take, 3);
  const turns = receivedInput.messages.filter((message: any) => message.role !== 'system');
  assert.equal(turns.length, 4);
  assert.equal(turns.at(-1).content, 'oi');
});

test('persists nothing when the provider fails', async () => {
  const { service, txWrites, outsideWrites, transactions, persistedRows } = setup({ complete: async () => { throw new AiProviderError('AI provider request failed', { status: 500 }); } });

  await assert.rejects(() => service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'oi', responseMode: AiResponseMode.TEXT }));

  assert.deepEqual(txWrites, []);
  assert.deepEqual(outsideWrites, []);
  assert.deepEqual(persistedRows(), []);
  assert.deepEqual(transactions, []);
});

test('persists nothing when the provider returns an unknown tool call', async () => {
  const { service, txWrites, outsideWrites, transactions, persistedRows } = setup({ complete: async () => ({ text: 'ok', toolCalls: [{ name: 'not_registered', arguments: {} }] }) });

  await assert.rejects(
    () => service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'oi', responseMode: AiResponseMode.TEXT }),
    /Ferramenta não disponível: not_registered/,
  );

  assert.deepEqual(txWrites, []);
  assert.deepEqual(outsideWrites, []);
  assert.deepEqual(persistedRows(), []);
  assert.deepEqual(transactions, []);
});

test('persists nothing when a normalized tool call fails argument validation', async () => {
  const { service, txWrites, outsideWrites, transactions, persistedRows } = setup({ complete: async () => ({ text: 'ok', toolCalls: [
    { name: 'first', arguments: { value: 1 } },
    { name: 'second', arguments: { value: 'invalid' } },
  ] }) });
  (service as any).registry = new AiToolRegistryService(['first', 'second'].map((name) => ({
    name,
    parameters: { type: 'object' },
    validate: (args: any) => { if (name === 'second' && typeof args.value !== 'number') throw new BadRequestException('Argumentos inválidos'); },
    authorize: async () => undefined,
    execute: async () => undefined,
  })));

  await assert.rejects(
    () => service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'oi', responseMode: AiResponseMode.TEXT }),
    BadRequestException,
  );

  assert.deepEqual(txWrites, []);
  assert.deepEqual(outsideWrites, []);
  assert.deepEqual(persistedRows(), []);
  assert.deepEqual(transactions, []);
});

test('persists nothing when a normalized tool call has malformed arguments', async () => {
  const { service, txWrites, outsideWrites, persistedRows } = setup({ complete: async () => ({ text: 'ok', toolCalls: [{ name: 'demo', arguments: [] as any }] }) });
  (service as any).registry = new AiToolRegistryService([{ name: 'demo', parameters: { type: 'object' }, authorize: async () => undefined, execute: async () => undefined }]);

  await assert.rejects(
    () => service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'oi', responseMode: AiResponseMode.TEXT }),
    BadRequestException,
  );

  assert.deepEqual(txWrites, []);
  assert.deepEqual(outsideWrites, []);
  assert.deepEqual(persistedRows(), []);
});

test('commits every chat write through the transaction client in a single transaction', async () => {
  const { service, prisma, txClients, txWrites, outsideWrites, transactions } = setup({ complete: async () => ({ text: 'Posso criar?', toolCalls: [
    { name: 'first', arguments: { value: 1 } },
    { name: 'second', arguments: { value: 2 } },
  ] }) });
  (service as any).registry = new AiToolRegistryService(['first', 'second'].map((name) => ({
    name, parameters: { type: 'object' }, authorize: async () => undefined, execute: async () => undefined,
  })));

  const result = await service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'faça duas coisas', responseMode: AiResponseMode.TEXT });

  assert.deepEqual(transactions, [{ outcome: 'committed' }]);
  assert.notEqual(txClients[0].aiMessage.create, (prisma as any).aiMessage.create);
  assert.notEqual(txClients[0].aiActionProposal.create, (prisma as any).aiActionProposal.create);
  assert.deepEqual(outsideWrites, []);
  assert.deepEqual(txWrites.map((write) => [write.kind, write.role ?? write.status]), [
    ['message', 'user'],
    ['message', 'assistant'],
    ['proposal', 'PENDING'],
    ['proposal', 'PENDING'],
  ]);
  assert.equal(txWrites[0].content, 'faça duas coisas');
  assert.equal(txWrites[1].content, 'Posso criar?');
  assert.deepEqual(JSON.parse(txWrites[1].providerMetaJson), { toolCallCount: 2 });
  assert.deepEqual(result.proposals.map((proposal: any) => proposal.toolName), ['first', 'second']);
});

test('restores the pre-write state when a write fails inside the transaction', async () => {
  const { service, prisma, txWrites, outsideWrites, transactions, persistedRows } = setup({ complete: async () => ({ text: 'Posso criar?', toolCalls: [
    { name: 'first', arguments: { value: 1 } },
    { name: 'second', arguments: { value: 2 } },
  ] }) }, undefined, undefined, { failProposalWriteAt: 2 });
  (service as any).registry = new AiToolRegistryService(['first', 'second'].map((name) => ({
    name, parameters: { type: 'object' }, authorize: async () => undefined, execute: async () => undefined,
  })));
  const previous = await (prisma as any).aiMessage.create({ data: { tenantId: 'tenant-a', conversationId: 'conversation-1', role: 'user', content: 'mensagem anterior' } });

  await assert.rejects(
    () => service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'faça duas coisas', responseMode: AiResponseMode.TEXT }),
    /falha ao gravar a proposta/,
  );

  assert.deepEqual(transactions, [{ outcome: 'rolled_back' }]);
  assert.deepEqual(txWrites, []);
  assert.deepEqual(persistedRows(), [previous]);
  assert.deepEqual(outsideWrites.map((write) => write.content), ['mensagem anterior']);
});
