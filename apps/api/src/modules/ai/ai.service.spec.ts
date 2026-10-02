import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException, ForbiddenException, GoneException, ServiceUnavailableException } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiContextService } from './ai-context.service';
import { AiAuditService } from './ai-audit.service';
import { AiToolRegistryService } from './tools/ai-tool-registry.service';
import { AiProvider, AiProviderError } from './ports/ai-provider.port';
import { AiResponseMode } from './dto/send-ai-message.dto';
import { DailyRoutineService } from '../daily-routine/daily-routine.service';
import { CreateRoutineTool } from './tools/create-routine.tool';

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
    { resolve: async () => ({ name: 'Maria', address: 'Maria' }) } as any,
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
    provider: 'chatgpt', status: 'failed', providerStatus: 429, providerCode: 'rate_limit_exceeded', providerRequestId: 'req-audit',
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

test('adds authenticated identity treatment to the system prompt without email or tenant ids', async () => {
  let receivedInput: any;
  const { service } = setup({ complete: async (input: any) => {
    receivedInput = input;
    return { text: 'ok', toolCalls: [] };
  } });

  await service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'oi', responseMode: AiResponseMode.TEXT });

  const systemMessage = receivedInput.messages.find((message: any) => message.role === 'system');
  assert.match(systemMessage.content, /Usuário autenticado: Maria/);
  assert.match(systemMessage.content, /Tratamento: Maria/);
  assert.doesNotMatch(systemMessage.content, /email|tenant-a|user-a|@/i);
});

test('envia ao modelo apenas as tools que o ator pode executar', async () => {
  const received: any[] = [];
  const { service } = setup({ complete: async (input: any) => {
    received.push(input);
    return { text: 'ok', toolCalls: [] };
  } });
  (service as any).registry = new AiToolRegistryService(
    [
      { name: 'search_tasks', permission: 'tasks.view', readOnly: true, description: 'buscar', parameters: { type: 'object' }, authorize: async () => undefined, execute: async () => ({}) },
      { name: 'delete_task', permission: 'tasks.delete', description: 'apagar', parameters: { type: 'object' }, authorize: async () => undefined, execute: async () => ({}) },
    ],
    { can: async (_input: any, permission: string) => permission === 'tasks.view', codesFor: async () => ['tasks.view'] } as any,
  );

  await service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'oi', responseMode: AiResponseMode.TEXT });

  assert.deepEqual(received[0].tools.map((entry: any) => entry.name), ['search_tasks']);
});

test('tool fora do perfil vira recusa no resultado, sem autorizar ou executar', async () => {
  let authorized = false;
  let executed = false;
  let completions = 0;
  let continuationResults: any[] | undefined;
  const provider = {
    complete: async () => {
      completions += 1;
      return completions === 1
        ? { text: 'Apagando.', toolCalls: [{ id: 'c1', name: 'delete_task', arguments: {} }] }
        : { text: 'Não posso apagar tarefas.', toolCalls: [] };
    },
    buildToolContinuation: (input: any, _completion: any, currentResults: any[]) => {
      continuationResults = currentResults;
      return input;
    },
  };
  const { service } = setup(provider);
  (service as any).registry = new AiToolRegistryService([{
    name: 'delete_task', permission: 'tasks.delete', parameters: { type: 'object' },
    authorize: async () => { authorized = true; },
    execute: async () => { executed = true; return {}; },
  }], { can: async () => false, codesFor: async () => [] } as any);

  const result = await service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'apaga a tarefa', responseMode: AiResponseMode.TEXT });

  assert.equal(authorized, false);
  assert.equal(executed, false);
  assert.equal(completions, 2);
  assert.deepEqual(continuationResults, [{
    call: { id: 'c1', name: 'delete_task', arguments: {} },
    result: { error: 'Esta ferramenta está indisponível para o seu perfil.' },
  }]);
  assert.equal(result.assistantMessage.content, 'Não posso apagar tarefas.');
  assert.deepEqual(result.toolResults, [{ toolName: 'delete_task', result: { error: 'Esta ferramenta está indisponível para o seu perfil.' } }]);
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

test('sendMessage persists clarification messages without creating an actionable proposal', async () => {
  const provider = {
    complete: async () => ({ text: 'Preciso do projeto.', toolCalls: [{ name: 'create_task', arguments: { title: 'Nova' } }] }),
  };
  const { service, rows, txWrites } = setup(provider);
  (service as any).registry = new AiToolRegistryService([{
    name: 'create_task', parameters: { type: 'object' },
    validate: () => undefined,
    authorize: (async () => ({ needsClarification: true, field: 'projectName', matches: [] })) as any,
    execute: async () => { throw new Error('execute must not run during preflight'); },
  }]);

  const result = await service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'crie uma tarefa', responseMode: AiResponseMode.TEXT });

  assert.deepEqual(result.proposals, []);
  assert.equal(rows.proposal.length, 0);
  assert.match(rows.message.at(-1).content, /needsClarification/);
  assert.deepEqual(txWrites.map((write) => write.kind), ['message', 'message', 'message']);
});

test('provider-loop read denial leaves no persisted message, proposal, or mutation', async () => {
  const { service, rows, outsideWrites } = setup({
    complete: async () => ({ text: 'não autorizado', toolCalls: [{ name: 'search_projects', arguments: { projectId: 'tenant-b-project' } }] }),
  });
  let executions = 0;
  (service as any).registry = new AiToolRegistryService([{
    name: 'search_projects', readOnly: true, parameters: { type: 'object' },
    authorize: async () => { throw new ForbiddenException('sem acesso'); },
    execute: async () => { executions += 1; return []; },
  }]);

  await assert.rejects(() => service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'veja o outro tenant', responseMode: AiResponseMode.TEXT }), ForbiddenException);
  assert.equal(executions, 0);
  assert.deepEqual(rows.proposal, []);
  assert.deepEqual(outsideWrites, []);
});

test('provider metadata counts tool calls across every read continuation', async () => {
  let calls = 0;
  const { service, txWrites } = setup({
    complete: async () => {
      calls += 1;
      if (calls === 1) return { text: 'consultando projetos', toolCalls: [{ id: 'call-1', name: 'read-one', arguments: {} }] };
      if (calls === 2) return { text: 'consultando usuários', toolCalls: [{ id: 'call-2', name: 'read-two', arguments: {} }] };
      return { text: 'resultado final', toolCalls: [] };
    },
    buildToolContinuation: (input: any, completion: any, results: any[]) => ({
      ...input,
      messages: [...input.messages, { role: 'assistant', content: completion.text }, ...results.map(({ call, result }) => ({ role: 'tool', toolCallId: call.id, content: JSON.stringify(result) }))],
    }),
  });
  (service as any).registry = new AiToolRegistryService(['read-one', 'read-two'].map((name) => ({
    name, readOnly: true, parameters: { type: 'object' }, authorize: async () => undefined, execute: async () => [{ name }],
  })));

  await service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'consulte tudo', responseMode: AiResponseMode.TEXT });
  assert.deepEqual(JSON.parse(txWrites[1].providerMetaJson), { toolCallCount: 2 });
});

test('provider-loop ambiguity persists structured clarification without a proposal or mutation', async () => {
  const { service, rows, txWrites } = setup({
    complete: async () => ({ text: 'vou resolver o projeto', toolCalls: [{ name: 'create_task', arguments: { title: 'Nova tarefa' } }] }),
  });
  let executions = 0;
  (service as any).registry = new AiToolRegistryService([{
    name: 'create_task', parameters: { type: 'object' }, validate: () => undefined,
    authorize: async () => ({ needsClarification: true, field: 'projectName', matches: [{ id: 'p1', name: 'Alpha' }, { id: 'p2', name: 'Alpha' }] }),
    execute: async () => { executions += 1; return { id: 'must-not-write' }; },
  }]);

  const result = await service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'crie uma tarefa no Alpha', responseMode: AiResponseMode.TEXT });
  assert.deepEqual(result.proposals, []);
  assert.equal(rows.proposal.length, 0);
  assert.equal(executions, 0);
  assert.match(rows.message.at(-1).content, /Alpha/);
  assert.deepEqual(txWrites.map((write) => write.kind), ['message', 'message', 'message']);
});

test('confirmed provider action uses the real routine tool and domain activity path', async () => {
  const activityLog: any[] = [];
  const routinePrisma = {
    dailyRoutineItem: {
      create: async ({ data }: any) => ({ id: 'routine-1', ...data }),
    },
  };
  const routineService = new DailyRoutineService(
    routinePrisma as any,
    { log: async (entry: any) => { activityLog.push(entry); } } as any,
    {} as any,
  );
  const users = {
    findOne: async (tenantId: string, tenantUserId: string) => tenantId === actor.tenantId && tenantUserId === actor.tenantUserId
      ? { role: { name: 'collaborator', rolePermissions: [{ permission: { code: 'daily_routine.manage' } }] } }
      : null,
  };
  const routineTool = new CreateRoutineTool(routineService, users as any);
  const { service, prisma, auditLog, proposalUpdates } = setup({
    complete: async () => ({ text: 'vou propor a rotina', toolCalls: [{ name: 'create_routine', arguments: { title: 'Nova rotina', scheduledTime: '09:00' } }] }),
  });
  let currentStatus = 'PENDING';
  (prisma as any).aiActionProposal.findFirst = async ({ where }: any) => ({
    id: 'proposal-1', tenantId: actor.tenantId, createdByTenantUserId: actor.tenantUserId,
    status: where.status ?? currentStatus, expiresAt: new Date(Date.now() + 60_000), toolName: 'create_routine',
    argumentsJson: JSON.stringify({ title: 'Nova rotina', scheduledTime: '09:00' }), conversationId: 'conversation-1',
  });
  (prisma as any).aiActionProposal.updateMany = async ({ where, data }: any) => {
    proposalUpdates.push({ where, data });
    currentStatus = data.status;
    return { count: 1 };
  };
  (service as any).registry = new AiToolRegistryService([routineTool]);

  const proposed = await service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'crie uma tarefa', responseMode: AiResponseMode.TEXT });
  const executed = await service.confirmProposal(actor, proposed.proposal.id);
  assert.equal(activityLog[0].tenantId, actor.tenantId);
  assert.equal(activityLog[0].actorTenantUserId, actor.tenantUserId);
  assert.equal(activityLog[0].action, 'ROUTINE_CREATED');
  assert.equal(activityLog[0].entityId, 'routine-1');
  assert.equal(executed.status, 'EXECUTED');
  assert.deepEqual(proposalUpdates.map((entry) => entry.data.status), ['CONFIRMED', 'EXECUTED']);
  assert.ok(auditLog.some((entry) => entry.action === 'ai.proposal.executed'));
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

test('message page one loads the newest messages and returns them chronologically', async () => {
  const { service, prisma } = setup({ complete: async () => ({ text: 'ok', toolCalls: [] }) });
  let query: any;
  (prisma as any).aiMessage.findMany = async (args: any) => {
    query = args;
    return [
      { id: 'newest', createdAt: new Date('2026-10-01T12:02:00Z') },
      { id: 'older', createdAt: new Date('2026-10-01T12:01:00Z') },
    ];
  };

  const result = await service.getMessages(actor, 'conversation-1', 1, 20);

  assert.deepEqual(query.orderBy, { createdAt: 'desc' });
  assert.equal(query.skip, 0);
  assert.equal(query.take, 20);
  assert.deepEqual(result.messages.map((message: any) => message.id), ['older', 'newest']);
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
     execute: async () => ({ needsClarification: true, field: 'projectName', matches: [{ id: 'p1', name: 'Projeto 1' }, { id: 'p2', name: 'Projeto 2' }] }),
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
    { getRuntime: async () => ({
      primaryProvider: 'chatgpt', failoverProvider: null,
      providers: {
        chatgpt: { connectionStatus: 'connected', selectedModel: { slug: 'gpt-5-codex', displayName: 'GPT-5 Codex' } },
        ollama: { connectionStatus: 'disconnected', selectedModel: null },
      },
    }) });

  await service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'oi', responseMode: AiResponseMode.TEXT });

  assert.equal(receivedInput.model, 'gpt-5-codex');
  assert.ok(receivedInput.messages.some((message: any) => message.role === 'user' && message.content === 'oi'));
});

test('omits the model when the global runtime has no selected model', async () => {
  let receivedInput: any;
  const { service } = setup({ complete: async (input: any) => { receivedInput = input; return { text: 'ok', toolCalls: [] }; } },
    undefined,
    { getRuntime: async () => ({
      primaryProvider: 'chatgpt', failoverProvider: null,
      providers: {
        chatgpt: { connectionStatus: 'disconnected', selectedModel: null },
        ollama: { connectionStatus: 'disconnected', selectedModel: null },
      },
    }) });

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

test('drops blank optional tool arguments before validation and execution', async () => {
  let providerCalls = 0;
  let receivedArgs: unknown;
  const { service } = setup({
    complete: async () => {
      providerCalls += 1;
      return providerCalls === 1
        ? { text: '', toolCalls: [{ id: 'call-1', name: 'read-one', arguments: { projectId: '', projectName: 'Projeto A' } }] }
        : { text: 'resultado', toolCalls: [] };
    },
    buildToolContinuation: (input, _completion, _results) => input,
  });
  (service as any).registry = new AiToolRegistryService([{
    name: 'read-one',
    readOnly: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: { projectId: { type: 'string' }, projectName: { type: 'string' } },
    },
    validate: (args: any) => {
      if (args.projectId === '') throw new BadRequestException('projectId inválido');
      return args;
    },
    authorize: async ({ args }: any) => { receivedArgs = args; },
    execute: async ({ args }: any) => { receivedArgs = args; return []; },
  }]);

  await service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'consulte', responseMode: AiResponseMode.TEXT });

  assert.deepEqual(receivedArgs, { projectName: 'Projeto A' });
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

const executionRuntime = (provider: 'chatgpt' | 'ollama' = 'chatgpt') => ({
  getRuntime: async () => ({
    primaryProvider: provider, failoverProvider: null,
    providers: {
      chatgpt: { connectionStatus: 'connected', selectedModel: { slug: 'gpt-5', displayName: 'GPT-5' } },
      ollama: { connectionStatus: 'disconnected', selectedModel: { slug: 'gpt-oss:20b', displayName: 'GPT-OSS 20B' } },
    },
  }),
});

test('replays the whole flow on the failover provider when the primary errors', async () => {
  const calls: string[] = [];
  const primary = {
    complete: async () => { calls.push('primary'); throw new AiProviderError('AI provider request failed', { status: 429, code: 'subscription_sharing_usage_limit_exceeded' }); },
  };
  const failover = { complete: async () => { calls.push('failover'); return { text: 'resolvi do fallback', toolCalls: [] }; } };
  const routing = { resolveExecutions: async () => [
    { provider: 'chatgpt' as const, providerInstance: primary, model: 'gpt-5', auth: { type: 'oauth' as const, accessToken: 'x' } },
    { provider: 'ollama' as const, providerInstance: failover, model: 'gpt-oss:20b' },
  ] };
  const { service, txWrites, auditLog } = setup({ complete: async () => { throw new Error('must not be used'); } }, undefined, executionRuntime());
  (service as any).routing = routing;

  const result = await service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'oi', responseMode: AiResponseMode.TEXT });

  assert.deepEqual(calls, ['primary', 'failover']);
  assert.equal(result.assistantMessage.content, 'resolvi do fallback');
  assert.deepEqual(JSON.parse(txWrites[1].providerMetaJson), { toolCallCount: 0 });
  assert.equal(auditLog.at(-1).metadata.provider, 'ollama');
  assert.equal(auditLog.filter((entry) => entry.action === 'ai.provider.failed').at(-1).metadata.provider, 'chatgpt');
  const completed = auditLog.filter((entry) => entry.action === 'ai.message.completed').at(-1);
  assert.equal(completed.metadata.provider, 'ollama');
});

test('a business error never triggers failover', async () => {
  const primary = { complete: async () => ({ text: 'x', toolCalls: [{ name: 'read', arguments: {} }] }) };
  const failover = { complete: async () => { throw new Error('failover must not run'); } };
  const routing = { resolveExecutions: async () => [
    { provider: 'chatgpt' as const, providerInstance: primary, model: 'gpt-5' },
    { provider: 'ollama' as const, providerInstance: failover, model: 'gpt-oss:20b' },
  ] };
  const { service } = setup({ complete: async () => { throw new Error('must not be used'); } }, undefined, executionRuntime());
  (service as any).registry = new AiToolRegistryService([{
    name: 'read', readOnly: true, parameters: { type: 'object' },
    authorize: async () => { throw new ForbiddenException('sem acesso'); },
    execute: async () => { throw new Error('must not run'); },
  }]);
  (service as any).routing = routing;

  await assert.rejects(() => service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'oi', responseMode: AiResponseMode.TEXT }), ForbiddenException);
});

test('raises the last provider error when both providers fail', async () => {
  const primary = { complete: async () => { throw new AiProviderError('AI provider request failed', { status: 500 }); } };
  const failover = { complete: async () => { throw new Error('AI provider request failed'); } };
  const routing = { resolveExecutions: async () => [
    { provider: 'chatgpt' as const, providerInstance: primary, model: 'gpt-5' },
    { provider: 'ollama' as const, providerInstance: failover, model: 'gpt-oss:20b' },
  ] };
  const { service, txWrites, outsideWrites, persistedRows, transactions } = setup({ complete: async () => { throw new Error('must not be used'); } }, undefined, executionRuntime());
  (service as any).routing = routing;

  await assert.rejects(() => service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'oi', responseMode: AiResponseMode.TEXT }), /AI provider request failed/);

  assert.deepEqual(txWrites, []);
  assert.deepEqual(outsideWrites, []);
  assert.deepEqual(persistedRows(), []);
  assert.deepEqual(transactions, []);
});

test('sendMessage fails fast with the routing error when no provider is configured', async () => {
  const { service } = setup({ complete: async () => ({ text: 'ok', toolCalls: [] }) }, undefined, executionRuntime());
  (service as any).routing = { resolveExecutions: async () => [] };
  await assert.rejects(
    () => service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'oi', responseMode: AiResponseMode.TEXT }),
    ServiceUnavailableException,
  );
});
