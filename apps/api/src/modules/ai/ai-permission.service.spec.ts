import test from 'node:test';
import assert from 'node:assert/strict';
import { AiPermissionService } from './ai-permission.service';

const actor = { tenantId: 'tenant-1', tenantUserId: 'user-1' };

const prismaWith = (role: { name: string; permissions: string[]; tenantId?: string | null }) => {
  let calls = 0;
  let lastWhere: any;
  return {
    calls: () => calls,
    where: () => lastWhere,
    tenantUser: {
      findFirst: async ({ where }: any) => {
        calls += 1;
        lastWhere = where;
        const roleTenantId = role.tenantId === undefined ? 'tenant-1' : role.tenantId;
        const acceptsRole = where.role?.is?.OR?.some(({ tenantId }: { tenantId: string | null }) =>
          tenantId === roleTenantId);
        if (where.role && !acceptsRole) return null;
        return {
          role: {
            name: role.name,
            rolePermissions: role.permissions.map((code) => ({ permission: { code } })),
          },
        };
      },
    },
  } as any;
};

test('admin passa em qualquer código, mesmo sem a permissão listada', async () => {
  const service = new AiPermissionService(prismaWith({ name: 'admin', permissions: [] }));
  assert.equal(await service.can(actor, 'tasks.delete'), true);
});

test('papel com o código passa; papel sem o código é negado', async () => {
  const service = new AiPermissionService(prismaWith({ name: 'gestor', permissions: ['tasks.edit'] }));
  assert.equal(await service.can(actor, 'tasks.edit'), true);
  assert.equal(await service.can(actor, 'tasks.delete'), false);
});

test('gestor não tem mais bypass: o seed não lhe dá tasks.delete', async () => {
  const service = new AiPermissionService(prismaWith({ name: 'gestor', permissions: ['tasks.view'] }));
  assert.equal(await service.can(actor, 'tasks.delete'), false);
});

test('resolve os códigos uma vez por usuário e reutiliza', async () => {
  const prisma = prismaWith({ name: 'colaborador', permissions: ['tasks.view', 'tasks.comment'] });
  const service = new AiPermissionService(prisma);
  assert.deepEqual([...(await service.codesFor(actor))].sort(), ['tasks.comment', 'tasks.view']);
  await service.codesFor(actor);
  assert.equal(prisma.calls(), 1);
});

test('invalidate força nova consulta', async () => {
  const prisma = prismaWith({ name: 'colaborador', permissions: ['tasks.view'] });
  const service = new AiPermissionService(prisma);
  await service.codesFor(actor);
  service.invalidate(actor.tenantId, actor.tenantUserId);
  await service.codesFor(actor);
  assert.equal(prisma.calls(), 2);
});

test('restringe o papel ao tenant do ator e não concede código de outro tenant', async () => {
  const prisma = prismaWith({ name: 'gestor', permissions: ['tasks.delete'], tenantId: 'tenant-2' });
  const service = new AiPermissionService(prisma);

  assert.equal(await service.can(actor, 'tasks.delete'), false);
  assert.deepEqual(prisma.where().role, {
    is: { OR: [{ tenantId: actor.tenantId }, { tenantId: null }] },
  });
});

test('reutiliza uma única consulta pendente para chamadas frias simultâneas', async () => {
  let calls = 0;
  let resolveQuery!: (value: unknown) => void;
  const prisma = {
    tenantUser: {
      findFirst: async () => {
        calls += 1;
        return new Promise((resolve) => { resolveQuery = resolve; });
      },
    },
  } as any;
  const service = new AiPermissionService(prisma);

  const codes = Promise.all([service.codesFor(actor), service.codesFor(actor)]);
  assert.equal(calls, 1);
  resolveQuery({
    role: {
      name: 'colaborador',
      rolePermissions: [{ permission: { code: 'tasks.view' } }],
    },
  });
  await codes;
});
