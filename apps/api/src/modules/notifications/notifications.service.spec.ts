import assert from 'node:assert/strict';
import test from 'node:test';
import { NotificationsService } from './notifications.service';

type Mock = ((...args: any[]) => any) & {
  mock: { calls: any[][] };
  mockImplementation(impl: (...args: any[]) => any): Mock;
  mockResolvedValue(value: any): Mock;
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
  return fn;
};

const doubles = (found: any = { id: 'notification-1' }) => {
  const prisma: any = {
    notification: {
      findFirst: mock(async () => found),
      update: mock(async (args: any) => ({ ...found, ...args.data })),
      updateMany: mock(async () => ({ count: 1 })),
      findMany: mock(async () => []),
      count: mock(async () => 0),
      create: mock(async (args: any) => ({ id: 'notification-1', ...args.data })),
    },
  };
  const service = new NotificationsService(prisma as any);
  return { service, prisma };
};

test('marca como lida apenas a notificação do próprio usuário, com filtro de tenant', async () => {
  const { service, prisma } = doubles();

  await service.markAsRead('tenant-1', 'user-1', 'notification-1');

  assert.deepEqual(prisma.notification.findFirst.mock.calls[0][0].where, {
    id: 'notification-1',
    tenantId: 'tenant-1',
    tenantUserId: 'user-1',
  });
  const [update] = prisma.notification.update.mock.calls[0];
  assert.deepEqual(update.where, { id: 'notification-1' });
  assert.equal(update.data.isRead, true);
  assert.ok(update.data.readAt instanceof Date);
});

test('recusa marcar como lida uma notificação de outro usuário ou de outro tenant', async () => {
  const { service, prisma } = doubles(null);

  await assert.rejects(
    () => service.markAsRead('tenant-1', 'user-1', 'notification-alheia'),
    { status: 404 },
  );

  assert.equal(prisma.notification.update.mock.calls.length, 0);
});
