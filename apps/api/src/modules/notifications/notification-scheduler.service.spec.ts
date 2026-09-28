import assert from 'node:assert/strict';
import test from 'node:test';
import { NotificationSchedulerService } from './notification-scheduler.service';

type Mock = ((...args: any[]) => any) & {
  mock: { calls: any[][] };
  mockImplementation(impl: (...args: any[]) => any): Mock;
  mockResolvedValue(value: any): Mock;
  mockRejectedValue(reason: any): Mock;
};

/** Mock manual no mesmo estilo dos demais specs de notificações (node 20 não tem `mockResolvedValue`). */
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

/** 08:00 de São Paulo em 28/09/2026 (UTC-3). */
const EIGHT_AM_SP = new Date('2026-09-28T11:00:00.000Z');

const doubles = () => {
  const events = { sendDailyReminderPushes: mock(async () => ({ sent: 0, checkedAt: '' })) };
  const tasks = { sendScheduledNotifications: mock(async () => undefined) };
  const routines = { sendScheduledNotifications: mock(async () => undefined) };
  const receipts = { processPending: mock(async () => ({ checked: 0, devicesRemoved: 0, failed: 0 })) };
  const service = new NotificationSchedulerService(
    events as any,
    tasks as any,
    routines as any,
    receipts as any,
  );
  const lines: string[] = [];
  (service as any).logger = {
    debug: (m: string) => lines.push(m),
    warn: (m: string) => lines.push(m),
    error: (m: string) => lines.push(m),
  };
  return { service, events, tasks, routines, receipts, lines };
};

test('roda as quatro unidades de notificação uma vez por tique', async () => {
  const { service, events, tasks, routines, receipts } = doubles();

  await service.run(EIGHT_AM_SP);

  assert.equal(events.sendDailyReminderPushes.mock.calls.length, 1);
  assert.equal(tasks.sendScheduledNotifications.mock.calls.length, 1);
  assert.equal(routines.sendScheduledNotifications.mock.calls.length, 1);
  assert.equal(receipts.processPending.mock.calls.length, 1);
});

test('repassa o mesmo instante para as unidades que recebem a data', async () => {
  const { service, events, tasks, routines } = doubles();

  await service.run(EIGHT_AM_SP);

  assert.deepEqual(events.sendDailyReminderPushes.mock.calls[0], [EIGHT_AM_SP]);
  assert.deepEqual(tasks.sendScheduledNotifications.mock.calls[0], [EIGHT_AM_SP]);
  assert.deepEqual(routines.sendScheduledNotifications.mock.calls[0], [EIGHT_AM_SP]);
});

test('uma categoria que falha não impede as demais unidades nem rejeita o tique', async () => {
  const { service, events, tasks, routines, receipts, lines } = doubles();
  tasks.sendScheduledNotifications.mockRejectedValue(
    Object.assign(new Error('tabela task_dates ausente'), { name: 'PrismaClientKnownRequestError' }),
  );

  await service.run(EIGHT_AM_SP);

  assert.equal(events.sendDailyReminderPushes.mock.calls.length, 1);
  assert.equal(routines.sendScheduledNotifications.mock.calls.length, 1);
  assert.equal(receipts.processPending.mock.calls.length, 1, 'os receipts não podem ficar para trás');
  const logged = lines.join(' | ');
  assert.ok(
    logged.includes('tasks') && logged.includes('PrismaClientKnownRequestError'),
    `a falha precisa ser logada com a unidade que falhou: ${logged}`,
  );
  assert.equal(
    logged.includes('tabela task_dates ausente'),
    false,
    'o log não pode ecoar a mensagem original do erro',
  );
});
