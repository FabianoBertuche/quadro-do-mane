import assert from 'node:assert/strict';
import test from 'node:test';
import { UsersService } from './users.service';

type Mock = ((...args: any[]) => any) & { mock: { calls: any[][] } };

const mock = (implementation: (...args: any[]) => any): Mock => {
  const calls: any[][] = [];
  const fn = ((...args: any[]) => {
    calls.push(args);
    return implementation(...args);
  }) as Mock;
  fn.mock = { calls };
  return fn;
};

const doubles = (actorUserId = 'admin-user') => {
  const updatedAt = new Date('2026-09-28T12:00:00.000Z');
  const prisma = {
    tenantUser: {
      findFirst: mock(async () => ({
        id: 'tenant-user-1',
        userId: 'user-1',
        roleId: 'member',
        status: 'SUSPENDED',
        isActive: false,
        role: { id: 'member', name: 'Member' },
      })),
      update: mock(async (args: any) => ({
        id: 'tenant-user-1',
        userId: 'user-1',
        roleId: args.data.roleId,
        role: { id: 'manager', name: 'Manager' },
        user: { id: 'user-1', name: 'User' },
        updatedAt,
      })),
    },
    role: {
      findFirst: mock(async () => ({ id: 'manager', name: 'Manager' })),
    },
    refreshToken: {
      updateMany: mock(async () => ({ count: 0 })),
    },
  };
  const audit = { log: mock(async () => undefined) };
  const dispatcher = { dispatch: mock(async () => undefined) };
  const service = new (UsersService as any)(
    prisma as any,
    { get: () => 12 } as any,
    audit as any,
    dispatcher as any,
  );

  return { service, dispatcher, actorUserId };
};

test('notifica o usuário afetado quando um administrador altera sua role', async () => {
  const { service, dispatcher, actorUserId } = doubles();

  await service.assignRole(
    'tenant-1',
    'tenant-user-1',
    { roleId: 'manager' } as any,
    { actorUserId, tenantId: 'tenant-1' },
  );

  assert.deepEqual(dispatcher.dispatch.mock.calls[0][0], {
    tenantId: 'tenant-1',
    tenantUserId: 'tenant-user-1',
    category: 'SECURITY',
    type: 'user_role_changed',
    title: 'Sua função foi alterada',
    message: 'Sua função no workspace foi alterada para Manager.',
    payload: { tenantUserId: 'tenant-user-1' },
    entityType: 'tenant-user',
    entityId: 'tenant-user-1',
    occurrenceKey: 'update:2026-09-28T12:00:00.000Z',
  });
});

test('não notifica quando o ator e o usuário afetado são a mesma pessoa', async () => {
  const { service, dispatcher } = doubles('user-1');

  await service.setStatus(
    'tenant-1',
    'tenant-user-1',
    { status: 'ACTIVE' } as any,
    { actorUserId: 'user-1', tenantId: 'tenant-1' },
  );

  assert.equal(dispatcher.dispatch.mock.calls.length, 0);
});
