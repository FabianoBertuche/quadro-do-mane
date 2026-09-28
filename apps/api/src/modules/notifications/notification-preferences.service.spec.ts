import assert from 'node:assert/strict';
import test from 'node:test';
import { NotificationPreferencesService, NOTIFICATION_CATEGORIES } from './notification-preferences.service';

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

const doubles = (stored: any[] = []) => {
  const prisma: any = {
    notificationPreference: {
      findMany: mock(async () => stored),
      findUnique: mock(async () => null),
      upsert: mock(async () => ({ id: 'pref-1' })),
    },
    notificationPreferenceAudit: { create: mock(async () => ({ id: 'audit-1' })) },
  };
  const preferences = new NotificationPreferencesService(prisma as any);
  return { preferences, prisma };
};

test('returns enabled defaults for every category when no row exists', async () => {
  const { preferences } = doubles();

  assert.deepEqual(await preferences.listForUser('tenant-1', 'user-1'), [
    { category: 'TASKS', pushEnabled: true, lockedByAdmin: false },
    { category: 'CALENDAR', pushEnabled: true, lockedByAdmin: false },
    { category: 'ROUTINE', pushEnabled: true, lockedByAdmin: false },
    { category: 'COLLABORATION', pushEnabled: true, lockedByAdmin: false },
    { category: 'PROJECTS_TEAMS', pushEnabled: true, lockedByAdmin: false },
    { category: 'SECURITY', pushEnabled: true, lockedByAdmin: false },
  ]);
});

test('expõe exatamente as seis categorias do contrato, nesta ordem', () => {
  assert.deepEqual([...NOTIFICATION_CATEGORIES], [
    'TASKS',
    'CALENDAR',
    'ROUTINE',
    'COLLABORATION',
    'PROJECTS_TEAMS',
    'SECURITY',
  ]);
});

test('mescla as linhas gravadas sobre os defaults e lê apenas o usuário informado', async () => {
  const { preferences, prisma } = doubles([
    { category: 'ROUTINE', pushEnabled: false, lockedByAdmin: true },
    { category: 'CALENDAR', pushEnabled: false, lockedByAdmin: false },
  ]);

  const listed = await preferences.listForUser('tenant-1', 'user-1');

  assert.deepEqual(prisma.notificationPreference.findMany.mock.calls[0][0].where, {
    tenantId: 'tenant-1',
    tenantUserId: 'user-1',
  });
  assert.deepEqual(listed, [
    { category: 'TASKS', pushEnabled: true, lockedByAdmin: false },
    { category: 'CALENDAR', pushEnabled: false, lockedByAdmin: false },
    { category: 'ROUTINE', pushEnabled: false, lockedByAdmin: true },
    { category: 'COLLABORATION', pushEnabled: true, lockedByAdmin: false },
    { category: 'PROJECTS_TEAMS', pushEnabled: true, lockedByAdmin: false },
    { category: 'SECURITY', pushEnabled: true, lockedByAdmin: false },
  ]);
});

test('rejects a self-service update when the category is locked', async () => {
  const { preferences, prisma } = doubles();
  prisma.notificationPreference.findUnique.mockResolvedValue({
    id: 'pref-1',
    pushEnabled: true,
    lockedByAdmin: true,
  });

  await assert.rejects(
    () => preferences.updateByUser('tenant-1', 'user-1', 'TASKS', false),
    { status: 409 },
  );

  assert.equal(prisma.notificationPreference.upsert.mock.calls.length, 0);
  assert.equal(prisma.notificationPreferenceAudit.create.mock.calls.length, 0);
});

test('grava a auditoria com origem USER e o valor anterior ao salvar a escolha do usuário', async () => {
  const { preferences, prisma } = doubles();
  prisma.notificationPreference.findUnique.mockResolvedValue({
    id: 'pref-1',
    pushEnabled: true,
    lockedByAdmin: false,
  });

  await preferences.updateByUser('tenant-1', 'user-1', 'TASKS', false);

  assert.deepEqual(prisma.notificationPreference.upsert.mock.calls[0][0], {
    where: { tenantUserId_category: { tenantUserId: 'user-1', category: 'TASKS' } },
    create: {
      tenantId: 'tenant-1',
      tenantUserId: 'user-1',
      category: 'TASKS',
      pushEnabled: false,
      updatedByTenantUserId: 'user-1',
    },
    update: { pushEnabled: false, updatedByTenantUserId: 'user-1' },
  });
  assert.deepEqual(prisma.notificationPreferenceAudit.create.mock.calls[0][0].data, {
    notificationPreferenceId: 'pref-1',
    actorTenantUserId: 'user-1',
    source: 'USER',
    previousValueJson: JSON.stringify({ pushEnabled: true, lockedByAdmin: false }),
    nextValueJson: JSON.stringify({ pushEnabled: false, lockedByAdmin: false }),
  });
});

test('cria a preferência do zero com o valor escolhido pelo usuário quando ainda não existe linha', async () => {
  const { preferences, prisma } = doubles();
  prisma.notificationPreference.findUnique.mockResolvedValue(null);

  await preferences.updateByUser('tenant-1', 'user-1', 'SECURITY', true);

  const created = prisma.notificationPreference.upsert.mock.calls[0][0].create;
  assert.equal(created.pushEnabled, true);
  assert.equal('lockedByAdmin' in created, false);
  assert.equal(
    prisma.notificationPreferenceAudit.create.mock.calls[0][0].data.previousValueJson,
    JSON.stringify({ pushEnabled: true, lockedByAdmin: false }),
  );
});

test('uma alteração do usuário nunca destrava uma categoria gerenciada pela empresa', async () => {
  const { preferences, prisma } = doubles();
  prisma.notificationPreference.findUnique.mockResolvedValue({
    id: 'pref-1',
    pushEnabled: false,
    lockedByAdmin: false,
  });

  await preferences.updateByUser('tenant-1', 'user-1', 'TASKS', true);

  const update = prisma.notificationPreference.upsert.mock.calls[0][0].update;
  assert.equal('lockedByAdmin' in update, false);
});

test('o admin define estado e lock juntos e a auditoria registra a origem ADMIN', async () => {
  const { preferences, prisma } = doubles();
  prisma.notificationPreference.findUnique.mockResolvedValue({
    id: 'pref-1',
    pushEnabled: true,
    lockedByAdmin: false,
  });

  await preferences.updateByAdmin('tenant-1', 'user-1', 'TASKS', false, true, 'admin-1');

  assert.deepEqual(prisma.notificationPreference.upsert.mock.calls[0][0].update, {
    pushEnabled: false,
    lockedByAdmin: true,
    updatedByTenantUserId: 'admin-1',
  });
  assert.deepEqual(prisma.notificationPreferenceAudit.create.mock.calls[0][0].data, {
    notificationPreferenceId: 'pref-1',
    actorTenantUserId: 'admin-1',
    source: 'ADMIN',
    previousValueJson: JSON.stringify({ pushEnabled: true, lockedByAdmin: false }),
    nextValueJson: JSON.stringify({ pushEnabled: false, lockedByAdmin: true }),
  });
});

test('ao destravar, o valor definido pelo admin continua como estado atual e o usuário volta a poder alterar', async () => {
  const { preferences, prisma } = doubles();
  prisma.notificationPreference.findUnique.mockResolvedValue({
    id: 'pref-1',
    pushEnabled: false,
    lockedByAdmin: true,
  });

  await preferences.updateByAdmin('tenant-1', 'user-1', 'TASKS', false, false, 'admin-1');

  assert.deepEqual(prisma.notificationPreference.upsert.mock.calls[0][0].update, {
    pushEnabled: false,
    lockedByAdmin: false,
    updatedByTenantUserId: 'admin-1',
  });

  prisma.notificationPreference.findUnique.mockResolvedValue({
    id: 'pref-1',
    pushEnabled: false,
    lockedByAdmin: false,
  });
  await preferences.updateByUser('tenant-1', 'user-1', 'TASKS', true);
  assert.equal(prisma.notificationPreference.upsert.mock.calls[1][0].update.pushEnabled, true);
});

test('trata a ausência de preferência como push habilitado', async () => {
  const { preferences, prisma } = doubles();
  prisma.notificationPreference.findUnique.mockResolvedValue(null);

  assert.equal(await preferences.isPushEnabled('tenant-1', 'user-1', 'TASKS'), true);
  assert.deepEqual(prisma.notificationPreference.findUnique.mock.calls[0][0].where, {
    tenantUserId_category: { tenantUserId: 'user-1', category: 'TASKS' },
  });
});

test('resolve push como desabilitado quando a categoria está desligada', async () => {
  const { preferences, prisma } = doubles();
  prisma.notificationPreference.findUnique.mockResolvedValue({
    id: 'pref-1',
    pushEnabled: false,
    lockedByAdmin: true,
  });

  assert.equal(await preferences.isPushEnabled('tenant-1', 'user-1', 'SECURITY'), false);
});
