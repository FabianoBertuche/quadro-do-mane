import test from 'node:test';
import assert from 'node:assert/strict';
import { AiPermissionService } from './ai-permission.service';

const actor = { tenantId: 'tenant-1', tenantUserId: 'user-1' };

const prismaWith = (role: { name: string; permissions: string[] }) => {
  let calls = 0;
  return {
    calls: () => calls,
    tenantUser: {
      findFirst: async () => {
        calls += 1;
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
