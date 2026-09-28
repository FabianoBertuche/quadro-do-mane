import assert from 'node:assert/strict';
import test from 'node:test';
import { DispatchInput, NotificationDispatcherService } from './notification-dispatcher.service';

type Mock = ((...args: any[]) => any) & {
  mock: { calls: any[][] };
  mockImplementation(impl: (...args: any[]) => any): Mock;
  mockResolvedValue(value: any): Mock;
  mockRejectedValue(reason: any): Mock;
};

/** Mock manual no mesmo estilo de `push.service.spec.ts` (node 20 não tem `mockResolvedValue`). */
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

const input = (overrides: Partial<DispatchInput> = {}): DispatchInput => ({
  tenantId: 'tenant-1',
  tenantUserId: 'user-1',
  category: 'CALENDAR',
  type: 'event_reminder',
  title: 'Lembrete de reunião',
  message: 'A reunião começa amanhã',
  payload: { eventId: 'event-1', route: '/calendar' },
  entityType: 'event',
  entityId: 'event-1',
  occurrenceKey: '2026-09-28',
  ...overrides,
});

const doubles = () => {
  /** Ordem real das escritas e do push, para verificar o invariante central. */
  const trace: string[] = [];
  const note = (source: string, name: string, args?: any) =>
    trace.push(`${source}:${name}${args?.data?.pushStatus ? `:${args.data.pushStatus}` : ''}`);

  const dispatchOps = (source: string) => ({
    create: mock(async () => {
      note(source, 'dispatch.create');
      return { id: 'dispatch-1', notificationId: null, pushStatus: 'PENDING' };
    }),
    update: mock(async (args: any) => {
      note(source, 'dispatch.update', args);
      return { id: 'dispatch-1', notificationId: null, pushStatus: 'PENDING', ...args.data };
    }),
    findUnique: mock(async () => null),
  });
  const centralOps = (source: string) => ({
    create: mock(async () => {
      note(source, 'central.create');
      return { id: 'notification-1' };
    }),
  });

  /**
   * `tx` é o cliente entregue à transação. Mantê-lo distinto do cliente base é o
   * que prova que ledger, Central e vínculo são gravados dentro da transação.
   */
  const tx: any = { notificationDispatch: dispatchOps('tx'), notification: centralOps('tx') };
  const prisma: any = {
    notificationDispatch: dispatchOps('prisma'),
    notification: centralOps('prisma'),
    notificationPreference: { findUnique: mock(async () => null) },
    notificationPushReceipt: { createMany: mock(async () => ({ count: 0 })) },
  };
  prisma.$transaction = mock(async (arg: any) => {
    trace.push('transaction.begin');
    const result = typeof arg === 'function' ? await arg(tx) : await Promise.all(arg);
    trace.push('transaction.commit');
    return result;
  });
  const push = {
    sendToUser: mock(async () => {
      trace.push('push.sendToUser');
      return [];
    }),
  };
  const preferences = { isPushEnabled: mock(async () => true) };
  const service = new NotificationDispatcherService(prisma as any, preferences as any, push as any);
  const lines: string[] = [];
  (service as any).logger = {
    debug: (m: string) => lines.push(m),
    warn: (m: string) => lines.push(m),
    error: (m: string) => lines.push(m),
  };
  return { service, prisma, tx, push, preferences, lines, trace };
};

test('creates the ledger entry and the Central notification inside one transaction', async () => {
  const { service, prisma, tx } = doubles();

  await service.dispatch(input());

  const [txArg] = prisma.$transaction.mock.calls[0];
  assert.equal(typeof txArg, 'function', 'o ledger e a Central devem ser gravados numa transação');
  assert.deepEqual(tx.notificationDispatch.create.mock.calls[0][0].data, {
    tenantId: 'tenant-1',
    tenantUserId: 'user-1',
    category: 'CALENDAR',
    type: 'event_reminder',
    entityType: 'event',
    entityId: 'event-1',
    occurrenceKey: '2026-09-28',
  });
  assert.deepEqual(tx.notification.create.mock.calls[0][0].data, {
    tenantId: 'tenant-1',
    tenantUserId: 'user-1',
    type: 'event_reminder',
    title: 'Lembrete de reunião',
    message: 'A reunião começa amanhã',
    payloadJson: JSON.stringify({ eventId: 'event-1', route: '/calendar' }),
  });
  assert.deepEqual(tx.notificationDispatch.update.mock.calls[0][0], {
    where: { id: 'dispatch-1' },
    data: { notificationId: 'notification-1' },
  });
  assert.equal(prisma.notificationDispatch.create.mock.calls.length, 0);
  assert.equal(prisma.notification.create.mock.calls.length, 0);
});

test('persiste ledger e Central antes de tentar o push', async () => {
  const { service, trace } = doubles();

  await service.dispatch(input());

  assert.deepEqual(trace, [
    'transaction.begin',
    'tx:dispatch.create',
    'tx:central.create',
    'tx:dispatch.update',
    'transaction.commit',
    'push.sendToUser',
    'prisma:dispatch.update:SENT',
  ]);
});

test('grava a Central com payload vazio quando a entrada não traz payload', async () => {
  const { service, tx } = doubles();
  const { payload, ...withoutPayload } = input();

  await service.dispatch(withoutPayload as DispatchInput);

  assert.equal(tx.notification.create.mock.calls[0][0].data.payloadJson, JSON.stringify({}));
});

test('returns the existing delivery without creating a second Central entry', async () => {
  const { service, prisma, tx, push } = doubles();
  prisma.$transaction.mockRejectedValue({ code: 'P2002' });
  prisma.notificationDispatch.findUnique.mockResolvedValue({ id: 'dispatch-1' });

  assert.equal((await service.dispatch(input())).id, 'dispatch-1');
  assert.equal(push.sendToUser.mock.calls.length, 0);

  assert.equal(tx.notification.create.mock.calls.length, 0);
  assert.equal(prisma.notification.create.mock.calls.length, 0);
  assert.equal(prisma.notificationPushReceipt.createMany.mock.calls.length, 0);
  assert.equal(prisma.notificationDispatch.update.mock.calls.length, 0);
  assert.deepEqual(prisma.notificationDispatch.findUnique.mock.calls[0][0].where, {
    tenantUserId_type_entityId_occurrenceKey: {
      tenantUserId: 'user-1',
      type: 'event_reminder',
      entityId: 'event-1',
      occurrenceKey: '2026-09-28',
    },
  });
});

test('propaga falha de banco que não seja violação de unicidade', async () => {
  const { service, prisma } = doubles();
  prisma.$transaction.mockRejectedValue(new Error('conexão perdida'));

  await assert.rejects(() => service.dispatch(input()), /conexão perdida/);
  assert.equal(prisma.notificationDispatch.findUnique.mock.calls.length, 0);
});

test('marca o dispatch como SENT e grava um receipt por ticket aceito pelo Expo', async () => {
  const { service, prisma, push, preferences } = doubles();
  push.sendToUser.mockResolvedValue([
    { pushDeviceId: 'device-1', expoTicketId: 'ticket-1' },
    { pushDeviceId: 'device-2', expoTicketId: 'ticket-2' },
  ]);

  const dispatch = await service.dispatch(input());

  assert.deepEqual(preferences.isPushEnabled.mock.calls[0], ['tenant-1', 'user-1', 'CALENDAR']);
  assert.deepEqual(push.sendToUser.mock.calls[0], [
    'user-1',
    {
      title: 'Lembrete de reunião',
      body: 'A reunião começa amanhã',
      data: { eventId: 'event-1', route: '/calendar' },
    },
  ]);
  assert.deepEqual(prisma.notificationPushReceipt.createMany.mock.calls[0][0], {
    data: [
      { dispatchId: 'dispatch-1', pushDeviceId: 'device-1', expoTicketId: 'ticket-1' },
      { dispatchId: 'dispatch-1', pushDeviceId: 'device-2', expoTicketId: 'ticket-2' },
    ],
  });
  const [update] = prisma.notificationDispatch.update.mock.calls.at(-1)!;
  assert.equal(update.where.id, 'dispatch-1');
  assert.equal(update.data.pushStatus, 'SENT');
  assert.ok(update.data.sentAt instanceof Date);
  assert.equal(dispatch.pushStatus, 'SENT');
});

test('marca o dispatch como SKIPPED e ainda cria a Central quando a categoria está com push desabilitado', async () => {
  const { service, prisma, tx, push, preferences } = doubles();
  preferences.isPushEnabled.mockResolvedValue(false);

  const dispatch = await service.dispatch(input());

  assert.equal(tx.notification.create.mock.calls.length, 1);
  assert.equal(push.sendToUser.mock.calls.length, 0);
  assert.equal(prisma.notificationPushReceipt.createMany.mock.calls.length, 0);
  const [update] = prisma.notificationDispatch.update.mock.calls.at(-1)!;
  assert.equal(update.data.pushStatus, 'SKIPPED');
  assert.equal('sentAt' in update.data, false);
  assert.equal(dispatch.pushStatus, 'SKIPPED');
});

test('marca o dispatch como FAILED e preserva a Central quando o envio de push estoura', async () => {
  const { service, prisma, tx, push, lines } = doubles();
  push.sendToUser.mockRejectedValue(
    Object.assign(new Error('Expo recusou ExponentPushToken[segredo]'), { name: 'ExpoPushError' }),
  );

  const dispatch = await service.dispatch(input());

  assert.equal(tx.notification.create.mock.calls.length, 1);
  assert.equal(prisma.notification.create.mock.calls.length, 0);
  assert.equal(prisma.notificationPushReceipt.createMany.mock.calls.length, 0);
  const [update] = prisma.notificationDispatch.update.mock.calls.at(-1)!;
  assert.equal(update.data.pushStatus, 'FAILED');
  assert.equal(update.data.failureReason, 'PUSH_SEND_FAILED');
  assert.equal(dispatch.pushStatus, 'FAILED');
  assert.equal(lines.join('\n').includes('segredo'), false, 'o erro de push não pode vazar para o log');
});

test('marca o dispatch como FAILED quando os receipts não podem ser gravados', async () => {
  const { service, prisma, push } = doubles();
  push.sendToUser.mockResolvedValue([{ pushDeviceId: 'device-1', expoTicketId: 'ticket-1' }]);
  prisma.notificationPushReceipt.createMany.mockRejectedValue(new Error('deadlock detectado'));

  const dispatch = await service.dispatch(input());

  const [update] = prisma.notificationDispatch.update.mock.calls.at(-1)!;
  assert.equal(update.data.pushStatus, 'FAILED');
  assert.equal(update.data.failureReason, 'PUSH_RECEIPT_PERSIST_FAILED');
  assert.equal(dispatch.pushStatus, 'FAILED');
});

test('bookkeeping pós-commit que falha não rejeita uma entrega já persistida', async () => {
  const { service, prisma, tx, lines } = doubles();
  prisma.notificationDispatch.update.mockRejectedValue(
    Object.assign(new Error('conexão perdida com a senha do banco'), {
      name: 'PrismaClientKnownRequestError',
    }),
  );

  const dispatch = await service.dispatch(input());

  assert.equal(dispatch.id, 'dispatch-1');
  assert.equal(dispatch.notificationId, 'notification-1');
  assert.equal(dispatch.pushStatus, 'PENDING', 'o status continua PENDING para o reaper');
  assert.equal(tx.notification.create.mock.calls.length, 1, 'a Central já commitada permanece');
  const logged = lines.join(' | ');
  assert.ok(
    logged.includes('dispatch=dispatch-1') && logged.includes('PrismaClientKnownRequestError'),
    `o erro de bookkeeping deve ser logado com o dispatch: ${logged}`,
  );
  assert.equal(
    logged.includes('senha do banco'),
    false,
    'o log do bookkeeping não pode ecoar a mensagem original do erro',
  );
});

test('falha ao rebaixar o dispatch não mascara a falha original do push nem rejeita', async () => {
  const { service, prisma, tx, push, lines } = doubles();
  push.sendToUser.mockRejectedValue(
    Object.assign(new Error('expo fora do ar'), { name: 'ExpoPushError' }),
  );
  prisma.notificationDispatch.update.mockRejectedValue(
    Object.assign(new Error('deadlock detectado'), { name: 'PrismaClientKnownRequestError' }),
  );

  const dispatch = await service.dispatch(input());

  assert.equal(dispatch.id, 'dispatch-1');
  assert.equal(tx.notification.create.mock.calls.length, 1);
  const logged = lines.join(' | ');
  assert.ok(
    logged.includes('Falha ao enviar push') && logged.includes('ExpoPushError'),
    `a falha original do push precisa continuar no log: ${logged}`,
  );
  assert.ok(
    logged.includes('dispatch=dispatch-1') && logged.includes('PrismaClientKnownRequestError'),
    `a falha do bookkeeping também precisa ser logada: ${logged}`,
  );
});

test('marca o dispatch como SENT sem receipts quando o usuário não tem dispositivos', async () => {
  const { service, prisma, push } = doubles();
  push.sendToUser.mockResolvedValue([]);

  const dispatch = await service.dispatch(input());

  assert.equal(prisma.notificationPushReceipt.createMany.mock.calls.length, 0);
  assert.equal(dispatch.pushStatus, 'SENT');
});
