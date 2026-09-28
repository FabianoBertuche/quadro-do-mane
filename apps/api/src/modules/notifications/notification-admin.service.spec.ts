import assert from 'node:assert/strict';
import test from 'node:test';
import { NotificationAdminService } from './notification-admin.service';

type Spy = ((...args: any[]) => any) & { mock: { calls: any[][] } };

/** Mock manual no mesmo estilo de `push.service.spec.ts` (node 20 não tem `mockResolvedValue`). */
const mock = (impl: (...args: any[]) => any = async () => undefined): Spy => {
  const calls: any[][] = [];
  const fn = ((...args: any[]) => {
    calls.push(args);
    return impl(...args);
  }) as Spy;
  fn.mock = { calls };
  return fn;
};

const doubles = (payload: { users?: any[]; audits?: any[]; dispatches?: any[] } = {}) => {
  const prisma: any = {
    tenantUser: { findMany: mock(async () => payload.users ?? []) },
    notificationPreferenceAudit: { findMany: mock(async () => payload.audits ?? []) },
    notificationDispatch: { findMany: mock(async () => payload.dispatches ?? []) },
  };
  return { admin: new NotificationAdminService(prisma as any), prisma };
};

const MARIA = { name: 'Maria Souza', email: 'maria@acme.com', avatarUrl: null };
const JOAO = { name: 'João Lima', email: 'joao@acme.com', avatarUrl: 'https://cdn.acme.com/joao.png' };

test('a listagem administrativa entrega as seis categorias de cada pessoa, com o default no que não foi gravado', async () => {
  const { admin, prisma } = doubles({
    users: [
      {
        id: 'user-1',
        user: MARIA,
        notificationPreferences: [{ category: 'TASKS', pushEnabled: false, lockedByAdmin: true }],
      },
      { id: 'user-2', user: JOAO, notificationPreferences: [] },
    ],
  });

  const listed = await admin.listPreferences('tenant-1');

  assert.deepEqual(prisma.tenantUser.findMany.mock.calls[0][0].where, { tenantId: 'tenant-1' });
  assert.equal(listed.length, 12);
  assert.deepEqual(listed.slice(0, 2), [
    {
      tenantUserId: 'user-1',
      tenantUser: MARIA,
      category: 'TASKS',
      pushEnabled: false,
      lockedByAdmin: true,
    },
    {
      tenantUserId: 'user-1',
      tenantUser: MARIA,
      category: 'CALENDAR',
      pushEnabled: true,
      lockedByAdmin: false,
    },
  ]);
  assert.deepEqual(listed[6], {
    tenantUserId: 'user-2',
    tenantUser: JOAO,
    category: 'TASKS',
    pushEnabled: true,
    lockedByAdmin: false,
  });
});

test('o histórico devolve a categoria de cada registro, a origem e quem agiu, do mais recente ao mais antigo', async () => {
  const createdAt = new Date('2026-09-28T12:00:00.000Z');
  const { admin, prisma } = doubles({
    audits: [
      {
        source: 'ADMIN',
        previousValueJson: '{"pushEnabled":true,"lockedByAdmin":false}',
        nextValueJson: '{"pushEnabled":false,"lockedByAdmin":true}',
        actorTenantUserId: 'admin-1',
        createdAt,
        preference: { category: 'TASKS' },
        actor: { user: { name: 'Gestora Rita' } },
      },
      {
        source: 'USER',
        previousValueJson: null,
        nextValueJson: '{"pushEnabled":true,"lockedByAdmin":false}',
        actorTenantUserId: 'user-1',
        createdAt,
        preference: { category: 'SECURITY' },
        actor: null,
      },
    ],
  });

  const history = await admin.history('tenant-1', 'user-1');

  const query = prisma.notificationPreferenceAudit.findMany.mock.calls[0][0];
  assert.deepEqual(query.where, { preference: { tenantId: 'tenant-1', tenantUserId: 'user-1' } });
  assert.equal(query.orderBy.createdAt, 'desc');
  assert.deepEqual(history, [
    {
      category: 'TASKS',
      source: 'ADMIN',
      previousValueJson: '{"pushEnabled":true,"lockedByAdmin":false}',
      nextValueJson: '{"pushEnabled":false,"lockedByAdmin":true}',
      actorTenantUserId: 'admin-1',
      createdAt,
      actor: { name: 'Gestora Rita' },
    },
    {
      category: 'SECURITY',
      source: 'USER',
      previousValueJson: null,
      nextValueJson: '{"pushEnabled":true,"lockedByAdmin":false}',
      actorTenantUserId: 'user-1',
      createdAt,
      actor: null,
    },
  ]);
});

test('as entregas aceitam categoria, status de push e destinatário, sempre presas ao tenant do admin', async () => {
  const dispatch = { id: 'dispatch-1', pushStatus: 'FAILED' };
  const { admin, prisma } = doubles({ dispatches: [dispatch] });

  const listed = await admin.listDispatches('tenant-1', {
    category: 'CALENDAR',
    pushStatus: 'FAILED',
    tenantUserId: 'user-2',
  });

  const query = prisma.notificationDispatch.findMany.mock.calls[0][0];
  assert.deepEqual(query.where, {
    tenantId: 'tenant-1',
    category: 'CALENDAR',
    pushStatus: 'FAILED',
    tenantUserId: 'user-2',
  });
  assert.deepEqual(listed, [dispatch]);
});

test('a listagem de entregas mostra o conteúdo da Central e o recibo de push, nunca o device que carrega o token', async () => {
  const { admin, prisma } = doubles({ dispatches: [] });

  await admin.listDispatches('tenant-1');

  const query = prisma.notificationDispatch.findMany.mock.calls[0][0];
  assert.deepEqual(query.where, { tenantId: 'tenant-1' });
  assert.deepEqual(query.include.notification.select, { title: true, message: true });
  assert.deepEqual(query.include.pushReceipts.select, {
    id: true,
    status: true,
    errorCode: true,
    checkedAt: true,
    createdAt: true,
  });
});
