import assert from 'node:assert/strict';
import test from 'node:test';
import { TasksService } from './tasks.service';

type Mock = ((...args: any[]) => any) & {
  mock: { calls: any[][] };
  mockImplementation(impl: (...args: any[]) => any): Mock;
  mockResolvedValue(value: any): Mock;
  mockRejectedValue(reason: any): Mock;
};

/** Mock manual no mesmo estilo dos specs de notificações (node 20 não tem `mockResolvedValue`). */
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
  fn.mockRejectedValue = (reason) =>
    fn.mockImplementation(async () => {
      throw reason;
    });
  return fn;
};

/** 08:00 de São Paulo em 28/09/2026 (UTC-3) e 16:00 do mesmo dia. */
const EIGHT_AM_SP = new Date('2026-09-28T11:00:00.000Z');
const FOUR_PM_SP = new Date('2026-09-28T19:00:00.000Z');
const NEXT_DAY_EIGHT_AM_SP = new Date('2026-09-29T11:00:00.000Z');

const task = (overrides: Record<string, any> = {}) => ({
  id: 'task-1',
  tenantId: 'tenant-1',
  projectId: 'project-1',
  title: 'Revisar relatório',
  assigneeTenantUserId: 'user-2' as string | null,
  dueDate: new Date('2026-09-28T21:00:00.000Z') as Date | null,
  completedAt: null as Date | null,
  archivedAt: null as Date | null,
  updatedAt: new Date('2026-09-28T10:00:00.000Z'),
  ...overrides,
});

/**
 * `rows` é o conjunto real de tarefas em que as janelas de prazo são avaliadas.
 * O falso `findMany` honra o que o Prisma faria (arquivada, concluída e intervalo
 * de `dueDate`) para que um limite de janela errado apareça como falha do teste.
 */
const doubles = (rows: any[] = [], oldTask: any = task()) => {
  const prisma: any = {
    taskStatus: { findFirst: mock(async () => ({ id: 'status-1' })) },
    task: {
      create: mock(async (args: any) => ({
        ...task(),
        ...args.data,
        updatedAt: new Date('2026-09-28T10:00:00.000Z'),
        status: null,
        priority: null,
        project: null,
      })),
      update: mock(async (args: any) => ({
        ...oldTask,
        ...args.data,
        updatedAt: new Date('2026-09-28T12:00:00.000Z'),
        status: null,
        priority: null,
      })),
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
    tenantUser: { findUnique: mock(async () => ({ user: { name: 'Maria' } })) },
  };
  const activityLog = { log: mock(async () => undefined) };
  const dispatcher = { dispatch: mock(async () => ({ id: 'dispatch-1' })) };
  const service = new TasksService(prisma as any, activityLog as any, dispatcher as any);
  const lines: string[] = [];
  (service as any).logger = {
    debug: (m: string) => lines.push(m),
    warn: (m: string) => lines.push(m),
    error: (m: string) => lines.push(m),
  };
  return { service, prisma, activityLog, dispatcher, lines };
};

const dispatched = (dispatcher: { dispatch: Mock }) => dispatcher.dispatch.mock.calls.map(([input]) => input);

test('criar tarefa com responsável entrega um dispatch TASKS na chave da atribuição', async () => {
  const { service, dispatcher } = doubles();

  await service.create(
    'tenant-1',
    { title: 'Revisar relatório', projectId: 'project-1', assigneeTenantUserId: 'user-2' } as any,
    'user-1',
  );

  assert.deepEqual(dispatched(dispatcher)[0], {
    tenantId: 'tenant-1',
    tenantUserId: 'user-2',
    category: 'TASKS',
    type: 'task_assigned',
    title: 'Nova tarefa atribuída',
    message: 'Revisar relatório',
    payload: { taskId: 'task-1', projectId: 'project-1', route: '/task/task-1' },
    entityType: 'task',
    entityId: 'task-1',
    occurrenceKey: 'assignment:2026-09-28T10:00:00.000Z',
  });
});

test('reatribuir mantém o type e deriva a chave da versão nova da tarefa', async () => {
  const { service, dispatcher } = doubles([], task({ assigneeTenantUserId: 'user-1' }));

  await service.update('tenant-1', 'task-1', { assigneeTenantUserId: 'user-2' } as any, 'user-1');

  assert.deepEqual(dispatched(dispatcher)[0], {
    tenantId: 'tenant-1',
    tenantUserId: 'user-2',
    category: 'TASKS',
    type: 'task_assigned',
    title: 'Tarefa atribuída a você',
    message: 'Revisar relatório',
    payload: { taskId: 'task-1', projectId: 'project-1', route: '/task/task-1' },
    entityType: 'task',
    entityId: 'task-1',
    occurrenceKey: 'assignment:2026-09-28T12:00:00.000Z',
  });
});

test('atribuir a si mesmo não notifica o ator', async () => {
  const { service, dispatcher } = doubles();

  await service.create(
    'tenant-1',
    { title: 'Revisar relatório', projectId: 'project-1', assigneeTenantUserId: 'user-1' } as any,
    'user-1',
  );
  await service.update('tenant-1', 'task-1', { assigneeTenantUserId: 'user-1' } as any, 'user-1');

  assert.equal(dispatcher.dispatch.mock.calls.length, 0);
});

test('alerta a tarefa atrasada uma vez por dia de São Paulo', async () => {
  const { service, dispatcher } = doubles([
    task({ dueDate: new Date('2026-09-27T21:00:00.000Z') }),
    task({ dueDate: new Date('2026-09-28T12:00:00.000Z') }),
  ]);

  await service.sendScheduledNotifications(EIGHT_AM_SP);

  assert.deepEqual(dispatched(dispatcher)[0], {
    tenantId: 'tenant-1',
    tenantUserId: 'user-2',
    category: 'TASKS',
    type: 'task_overdue',
    title: 'Tarefa atrasada',
    message: '"Revisar relatório" venceu em 27/09/2026',
    payload: { taskId: 'task-1', route: '/task/task-1' },
    entityType: 'task',
    entityId: 'task-1',
    occurrenceKey: '2026-09-28',
  });
  assert.equal(dispatched(dispatcher).length, 1, 'a tarefa que vence hoje ainda não está atrasada');
});

test('a chave do atraso é o dia local, então o mesmo dia repete e o dia seguinte vira outra ocorrência', async () => {
  const { service, dispatcher } = doubles([task({ dueDate: new Date('2026-09-27T21:00:00.000Z') })]);

  await service.sendScheduledNotifications(EIGHT_AM_SP);
  await service.sendScheduledNotifications(FOUR_PM_SP);
  await service.sendScheduledNotifications(NEXT_DAY_EIGHT_AM_SP);

  assert.deepEqual(
    dispatched(dispatcher).map((input) => input.occurrenceKey),
    ['2026-09-28', '2026-09-28', '2026-09-29'],
  );
});

test('alerta a tarefa que vence no dia seguinte na janela das 08:00', async () => {
  const { service, dispatcher, prisma } = doubles([
    task({ dueDate: new Date('2026-09-29T12:00:00.000Z') }),
    task({ id: 'task-2', dueDate: new Date('2026-09-28T21:00:00.000Z') }),
  ]);

  await service.sendScheduledNotifications(EIGHT_AM_SP);

  const dueTomorrow = prisma.task.findMany.mock.calls[0][0].where.dueDate;
  assert.equal(dueTomorrow.gte.toISOString(), '2026-09-29T03:00:00.000Z', '00:00 de 29/09 em SP');
  assert.equal(dueTomorrow.lt.toISOString(), '2026-09-30T03:00:00.000Z', '00:00 de 30/09 em SP');
  const overdue = prisma.task.findMany.mock.calls[1][0].where.dueDate;
  assert.equal(overdue.lt.toISOString(), '2026-09-28T03:00:00.000Z', '00:00 de 28/09 em SP');
  assert.deepEqual(dispatched(dispatcher), [
    {
      tenantId: 'tenant-1',
      tenantUserId: 'user-2',
      category: 'TASKS',
      type: 'task_due_soon',
      title: 'Prazo próximo',
      message: '"Revisar relatório" vence amanhã',
      payload: { taskId: 'task-1', route: '/task/task-1' },
      entityType: 'task',
      entityId: 'task-1',
      occurrenceKey: '2026-09-29',
    },
  ]);
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
  const { service, dispatcher, lines } = doubles([
    task({ dueDate: new Date('2026-09-27T21:00:00.000Z') }),
    task({ id: 'task-2', title: 'Fechar fechamento', dueDate: new Date('2026-09-27T18:00:00.000Z') }),
  ]);
  let first = true;
  dispatcher.dispatch.mockImplementation(async () => {
    if (first) {
      first = false;
      throw new Error('ExponentPushToken[segredo] rejeitado');
    }
    return { id: 'dispatch-2' };
  });

  await service.sendScheduledNotifications(EIGHT_AM_SP);

  assert.equal(dispatcher.dispatch.mock.calls.length, 2);
  assert.deepEqual(
    dispatched(dispatcher).map((input) => input.entityId),
    ['task-1', 'task-2'],
  );
  const logged = lines.join(' | ');
  assert.ok(logged.includes('task=task-1') && logged.includes('Error'), `o erro precisa identificar o candidato que falhou: ${logged}`);
  assert.equal(logged.includes('segredo'), false, 'a mensagem do erro pode conter token e não pode ser logada');
});
