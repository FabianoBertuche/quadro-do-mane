import assert from 'node:assert/strict';
import test from 'node:test';
import { TasksService } from './tasks.service';

type Mock = ((...args: any[]) => any) & {
  mock: { calls: any[][] };
  mockImplementation(impl: (...args: any[]) => any): Mock;
  mockResolvedValue(value: any): Mock;
  mockRejectedValue(reason: any): Mock;
};

const mock = (impl: (...args: any[]) => any = () => undefined): Mock => {
  const calls: any[][] = [];
  let current = impl;
  const fn = ((...args: any[]) => {
    calls.push(args);
    return current(...args);
  }) as Mock;
  fn.mock = { calls };
  fn.mockImplementation = (next) => {
    current = next;
    return fn;
  };
  fn.mockResolvedValue = (value) => fn.mockImplementation(async () => value);
  fn.mockRejectedValue = (reason) => fn.mockImplementation(async () => { throw reason; });
  return fn;
};

const EIGHT_AM_SP = new Date('2026-09-28T11:00:00.000Z');
const FOUR_PM_SP = new Date('2026-09-28T19:00:00.000Z');
const NEXT_DAY_EIGHT_AM_SP = new Date('2026-09-29T11:00:00.000Z');

const task = (overrides: Record<string, any> = {}) => ({
  id: 'task-1',
  tenantId: 'tenant-1',
  projectId: 'project-1',
  title: 'Revisar relatório',
  reporterTenantUserId: 'creator-1',
  assigneeTenantUserId: 'user-2' as string | null,
  dueDate: new Date('2026-09-28T21:00:00.000Z') as Date | null,
  completedAt: null as Date | null,
  archivedAt: null as Date | null,
  updatedAt: new Date('2026-09-28T10:00:00.000Z'),
  ...overrides,
});

const doubles = (rows: any[] = [], oldTask: any = task()) => {
  const prisma: any = {
    taskStatus: {
      findFirst: mock(async () => ({ id: 'status-1' })),
      findUnique: mock(async () => ({ category: 'active', name: 'Em andamento' })),
    },
    task: {
      create: mock(async (args: any) => ({ ...task(), ...args.data, updatedAt: new Date('2026-09-28T10:00:00.000Z'), status: null, priority: null, project: null })),
      update: mock(async (args: any) => ({ ...oldTask, ...args.data, updatedAt: new Date('2026-09-28T12:00:00.000Z'), status: null, priority: null })),
      findFirst: mock(async () => oldTask),
      findMany: mock(async (args: any) => {
        const range = args.where.dueDate;
        return rows.filter((row) => {
          if (row.archivedAt || row.completedAt || !row.dueDate) return false;
          if (range.lt && row.dueDate.getTime() >= range.lt.getTime()) return false;
          if (range.gte && row.dueDate.getTime() < range.gte.getTime()) return false;
          return true;
        });
      }),
    },
    taskComment: {
      create: mock(async (args: any) => ({ id: 'comment-1', ...args.data, createdAt: new Date('2026-09-28T13:00:00.000Z'), author: { user: { name: 'Author' } } })),
    },
    tenantUser: { findUnique: mock(async () => ({ user: { name: 'Maria' } })) },
  };
  const activityLog = { log: mock(async () => undefined) };
  const dispatcher = { dispatch: mock(async () => ({ id: 'dispatch-1' })) };
  const service = new TasksService(prisma as any, activityLog as any, dispatcher as any);
  const lines: string[] = [];
  (service as any).logger = { debug: (m: string) => lines.push(m), warn: (m: string) => lines.push(m), error: (m: string) => lines.push(m) };
  return { service, prisma, activityLog, dispatcher, lines };
};

const dispatched = (dispatcher: { dispatch: Mock }) => dispatcher.dispatch.mock.calls.map(([input]) => input);

test('criar tarefa com responsável entrega um dispatch TASKS na chave da atribuição', async () => {
  const { service, dispatcher } = doubles();
  await service.create('tenant-1', { title: 'Revisar relatório', projectId: 'project-1', assigneeTenantUserId: 'user-2' } as any, 'user-1');
  assert.deepEqual(dispatched(dispatcher)[0], {
    tenantId: 'tenant-1', tenantUserId: 'user-2', category: 'TASKS', type: 'task_assigned', title: 'Nova tarefa atribuída', message: 'Revisar relatório',
    payload: { taskId: 'task-1', projectId: 'project-1', route: '/task/task-1' }, entityType: 'task', entityId: 'task-1', occurrenceKey: 'assignment:2026-09-28T10:00:00.000Z',
  });
});

test('reatribuir mantém o type e deriva a chave da versão nova da tarefa', async () => {
  const { service, dispatcher } = doubles([], task({ assigneeTenantUserId: 'user-1' }));
  await service.update('tenant-1', 'task-1', { assigneeTenantUserId: 'user-2' } as any, 'user-1');
  assert.deepEqual(dispatched(dispatcher)[0], {
    tenantId: 'tenant-1', tenantUserId: 'user-2', category: 'TASKS', type: 'task_assigned', title: 'Tarefa atribuída a você', message: 'Revisar relatório',
    payload: { taskId: 'task-1', projectId: 'project-1', route: '/task/task-1' }, entityType: 'task', entityId: 'task-1', occurrenceKey: 'assignment:2026-09-28T12:00:00.000Z',
  });
});

test('atribuir a si mesmo não notifica o ator', async () => {
  const { service, dispatcher } = doubles();
  await service.create('tenant-1', { title: 'Revisar relatório', projectId: 'project-1', assigneeTenantUserId: 'user-1' } as any, 'user-1');
  await service.update('tenant-1', 'task-1', { assigneeTenantUserId: 'user-1' } as any, 'user-1');
  assert.equal(dispatcher.dispatch.mock.calls.length, 0);
});

test('alerta a tarefa atrasada uma vez por dia de São Paulo', async () => {
  const { service, dispatcher } = doubles([task({ dueDate: new Date('2026-09-27T21:00:00.000Z') }), task({ dueDate: new Date('2026-09-28T12:00:00.000Z') })]);
  await service.sendScheduledNotifications(EIGHT_AM_SP);
  assert.deepEqual(dispatched(dispatcher)[0], {
    tenantId: 'tenant-1', tenantUserId: 'user-2', category: 'TASKS', type: 'task_overdue', title: 'Tarefa atrasada', message: '"Revisar relatório" venceu em 27/09/2026',
    payload: { taskId: 'task-1', route: '/task/task-1' }, entityType: 'task', entityId: 'task-1', occurrenceKey: '2026-09-28',
  });
  assert.equal(dispatched(dispatcher).length, 1);
});

test('a chave do atraso é o dia local', async () => {
  const { service, dispatcher } = doubles([task({ dueDate: new Date('2026-09-27T21:00:00.000Z') })]);
  await service.sendScheduledNotifications(EIGHT_AM_SP);
  await service.sendScheduledNotifications(FOUR_PM_SP);
  await service.sendScheduledNotifications(NEXT_DAY_EIGHT_AM_SP);
  assert.deepEqual(dispatched(dispatcher).map((input) => input.occurrenceKey), ['2026-09-28', '2026-09-28', '2026-09-29']);
});

test('alerta a tarefa que vence no dia seguinte na janela das 08:00', async () => {
  const { service, dispatcher, prisma } = doubles([task({ dueDate: new Date('2026-09-29T12:00:00.000Z') }), task({ id: 'task-2', dueDate: new Date('2026-09-28T21:00:00.000Z') })]);
  await service.sendScheduledNotifications(EIGHT_AM_SP);
  const dueTomorrow = prisma.task.findMany.mock.calls[0][0].where.dueDate;
  assert.equal(dueTomorrow.gte.toISOString(), '2026-09-29T03:00:00.000Z');
  assert.equal(dueTomorrow.lt.toISOString(), '2026-09-30T03:00:00.000Z');
  assert.deepEqual(dispatched(dispatcher), [{
    tenantId: 'tenant-1', tenantUserId: 'user-2', category: 'TASKS', type: 'task_due_soon', title: 'Prazo próximo', message: '"Revisar relatório" vence amanhã',
    payload: { taskId: 'task-1', route: '/task/task-1' }, entityType: 'task', entityId: 'task-1', occurrenceKey: '2026-09-29',
  }]);
});

test('as duas janelas só olham tarefa aberta com responsável', async () => {
  const { service, prisma } = doubles();
  await service.sendScheduledNotifications(EIGHT_AM_SP);
  assert.equal(prisma.task.findMany.mock.calls.length, 2);
  for (const [args] of prisma.task.findMany.mock.calls) {
    assert.equal(args.where.archivedAt, null);
    assert.equal(args.where.completedAt, null);
    assert.deepEqual(args.where.status, { category: { not: 'done' } });
    assert.deepEqual(args.where.assigneeTenantUserId, { not: null });
  }
});

test('ignora candidato sem responsável devolvido pela consulta', async () => {
  const { service, dispatcher } = doubles([task({ assigneeTenantUserId: null })]);
  await service.sendScheduledNotifications(EIGHT_AM_SP);
  assert.equal(dispatcher.dispatch.mock.calls.length, 0);
});

test('não procura candidatos antes das 08:00 de São Paulo', async () => {
  const { service, prisma, dispatcher } = doubles([task({ dueDate: new Date('2026-09-27T21:00:00.000Z') })]);
  await service.sendScheduledNotifications(new Date('2026-09-28T10:59:00.000Z'));
  assert.equal(prisma.task.findMany.mock.calls.length, 0);
  assert.equal(dispatcher.dispatch.mock.calls.length, 0);
});

test('uma entrega que falha não rouba o alerta dos demais candidatos e não ecoa o erro', async () => {
  const { service, dispatcher, lines } = doubles([task({ dueDate: new Date('2026-09-27T21:00:00.000Z') }), task({ id: 'task-2', title: 'Fechar fechamento', dueDate: new Date('2026-09-27T18:00:00.000Z') })]);
  let first = true;
  dispatcher.dispatch.mockImplementation(async () => {
    if (first) { first = false; throw new Error('ExponentPushToken[segredo] rejeitado'); }
    return { id: 'dispatch-2' };
  });
  await service.sendScheduledNotifications(EIGHT_AM_SP);
  assert.equal(dispatcher.dispatch.mock.calls.length, 2);
  assert.deepEqual(dispatched(dispatcher).map((input) => input.entityId), ['task-1', 'task-2']);
  const logged = lines.join(' | ');
  assert.ok(logged.includes('task=task-1') && logged.includes('Error'));
  assert.equal(logged.includes('segredo'), false);
});

test('notifica creator e responsáveis de um comentário, sem notificar seu autor nem duplicar destinatários', async () => {
  const { service, dispatcher } = doubles([], task({
    reporterTenantUserId: 'creator-1',
    assigneeTenantUserId: 'assignee-1',
    assignees: [{ tenantUserId: 'assignee-1' }, { tenantUserId: 'author-1' }, { tenantUserId: 'creator-1' }],
  }));

  await service.addComment('tenant-1', 'task-1', 'author-1', 'Atualização');

  assert.deepEqual(dispatched(dispatcher).map((input) => input.tenantUserId).sort(), ['assignee-1', 'creator-1']);
  assert.deepEqual(dispatched(dispatcher).map((input) => input.type), ['task_comment_created', 'task_comment_created']);
  assert.equal(dispatched(dispatcher)[0].category, 'COLLABORATION');
  assert.deepEqual(dispatched(dispatcher)[0].payload, { taskId: 'task-1', projectId: 'project-1', route: '/task/task-1' });
  assert.equal(dispatched(dispatcher)[0].occurrenceKey, 'comment:comment-1');
});

test('notifica conclusão e usa a versão persistida da tarefa como occurrence key', async () => {
  const oldTask = task({ assigneeTenantUserId: 'assignee-1', statusId: 'status-open', status: { category: 'active', name: 'Em andamento' } });
  const { service, dispatcher, prisma } = doubles([], oldTask);
  prisma.task.update.mockImplementation(async (args: any) => ({
    ...oldTask,
    ...args.data,
    updatedAt: new Date('2026-09-28T12:00:00.000Z'),
    status: { category: 'done', name: 'Concluída' },
    priority: null,
  }));

  await service.update('tenant-1', 'task-1', { statusId: 'status-done' } as any, 'actor-1');

  const input = dispatched(dispatcher).find((item) => item.category === 'COLLABORATION');
  assert.equal(input.type, 'task_completed');
  assert.equal(input.occurrenceKey, 'update:2026-09-28T12:00:00.000Z');
  assert.deepEqual(dispatched(dispatcher).map((item) => item.tenantUserId).sort(), ['assignee-1', 'creator-1']);
});

test('mapeia retorno ao status não concluído para reabertura e outros status para mudança', async () => {
  const oldTask = task({ statusId: 'status-done', status: { category: 'done', name: 'Concluída' } });
  const { service, dispatcher, prisma } = doubles([], oldTask);
  prisma.task.update.mockImplementation(async (args: any) => ({
    ...oldTask,
    ...args.data,
    updatedAt: new Date('2026-09-28T12:00:00.000Z'),
    status: { category: 'active', name: 'Em andamento' },
    priority: null,
  }));

  await service.changeStatus('tenant-1', 'task-1', 'status-open', 'actor-1');

  assert.equal(dispatched(dispatcher).find((item) => item.category === 'COLLABORATION').type, 'task_reopened');
});

test('notifica somente quando o dueDate persistido muda', async () => {
  const oldTask = task({ dueDate: new Date('2026-09-28T21:00:00.000Z') });
  const { service, dispatcher } = doubles([], oldTask);

  await service.update('tenant-1', 'task-1', { dueDate: '2026-09-29T21:00:00.000Z' } as any, 'actor-1');

  const input = dispatched(dispatcher).find((item) => item.category === 'COLLABORATION');
  assert.equal(input.type, 'task_due_date_changed');
  assert.deepEqual(input.payload, { taskId: 'task-1', projectId: 'project-1', route: '/task/task-1' });
});

test('a categoria de status vira a condição do status na consulta', async () => {
  const { service, prisma } = doubles();
  prisma.task.findMany.mockImplementation(async () => []);

  await service.findByFilters('tenant-1', { statusCategory: 'active' });

  assert.deepEqual(prisma.task.findMany.mock.calls[0][0].where.status, { category: 'active' });
});

test('categoria e atraso combinam numa condição só, sem o atraso apagar a categoria', async () => {
  const { service, prisma } = doubles();
  prisma.task.findMany.mockImplementation(async () => []);

  await service.findByFilters('tenant-1', { statusCategory: 'active', overdue: true });

  assert.deepEqual(prisma.task.findMany.mock.calls[0][0].where.status, {
    category: { equals: 'active', not: 'done' },
  });
});

test('atraso sem categoria mantém a forma antiga do filtro de status', async () => {
  const { service, prisma } = doubles();
  prisma.task.findMany.mockImplementation(async () => []);

  await service.findByFilters('tenant-1', { overdue: true });

  assert.deepEqual(prisma.task.findMany.mock.calls[0][0].where.status, {
    category: { not: 'done' },
  });
});

test('categoria com concluídas resolve para a categoria concluída', async () => {
  const { service, prisma } = doubles();
  prisma.task.findMany.mockImplementation(async () => []);

  await service.findByFilters('tenant-1', { statusCategory: 'active', completed: true });

  assert.deepEqual(prisma.task.findMany.mock.calls[0][0].where.status, { category: 'done' });
});

test('concluídas sem categoria mantém a forma antiga do filtro de status', async () => {
  const { service, prisma } = doubles();
  prisma.task.findMany.mockImplementation(async () => []);

  await service.findByFilters('tenant-1', { completed: true });

  assert.deepEqual(prisma.task.findMany.mock.calls[0][0].where.status, { category: 'done' });
});
