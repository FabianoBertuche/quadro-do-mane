import assert from 'node:assert/strict';
import test from 'node:test';
import { ProjectsService } from './projects.service';

type Mock = ((...args: any[]) => any) & { mock: { calls: any[][] } };

const mock = (impl: (...args: any[]) => any = () => undefined): Mock => {
  const calls: any[][] = [];
  const fn = ((...args: any[]) => {
    calls.push(args);
    return impl(...args);
  }) as Mock;
  fn.mock = { calls };
  return fn;
};

const project = (overrides: Record<string, any> = {}) => ({
  id: 'project-1',
  tenantId: 'tenant-1',
  name: 'Projeto',
  ownerTenantUserId: 'owner-1',
  teamId: null,
  members: [{ tenantUserId: 'member-1' }],
  updatedAt: new Date('2026-09-28T12:00:00.000Z'),
  ...overrides,
});

const doubles = (currentProject = project()) => {
  const prisma: any = {
    project: {
      findFirst: mock(async () => currentProject),
      update: mock(async ({ data }: any) => ({ ...currentProject, ...data, updatedAt: new Date('2026-09-28T13:00:00.000Z') })),
    },
    projectMember: {
      create: mock(async ({ data }: any) => ({ ...data, id: 'membership-1', createdAt: new Date('2026-09-28T14:00:00.000Z') })),
    },
    task: { groupBy: mock(async () => []) },
    taskStatus: { findMany: mock(async () => []) },
  };
  const dispatcher = { dispatch: mock(async () => undefined) };
  const service = new (ProjectsService as any)(prisma, dispatcher) as ProjectsService;
  return { service, prisma, dispatcher };
};

test('notifica o membro adicionado ao projeto', async () => {
  const { service, dispatcher } = doubles();

  await (service as any).addMember('tenant-1', 'project-1', 'member-2', 'actor-1');

  assert.equal(dispatcher.dispatch.mock.calls[0][0].tenantUserId, 'member-2');
  assert.equal(dispatcher.dispatch.mock.calls[0][0].type, 'project_member_added');
});

test('não notifica o actor ao torná-lo owner do projeto', async () => {
  const { service, dispatcher } = doubles();

  await (service as any).update('tenant-1', 'project-1', { ownerTenantUserId: 'actor-1' }, 'actor-1');

  assert.deepEqual(
    dispatcher.dispatch.mock.calls.map(([input]) => input.tenantUserId),
    ['member-1'],
  );
});
