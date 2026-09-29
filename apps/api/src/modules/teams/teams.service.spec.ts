import assert from 'node:assert/strict';
import test from 'node:test';
import { TeamsService } from './teams.service';

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

const team = {
  id: 'team-1',
  tenantId: 'tenant-1',
  name: 'Equipe',
  managerTenantUserId: 'manager-1',
  members: [{ tenantUserId: 'member-1' }],
  updatedAt: new Date('2026-09-28T12:00:00.000Z'),
};

const doubles = () => {
  const prisma: any = {
    team: {
      findFirst: mock(async () => team),
      update: mock(async ({ data }: any) => ({ ...team, ...data, updatedAt: new Date('2026-09-28T13:00:00.000Z') })),
    },
    teamMember: {
      create: mock(async ({ data }: any) => ({ ...data, id: 'membership-1', createdAt: new Date('2026-09-28T14:00:00.000Z') })),
    },
  };
  const dispatcher = { dispatch: mock(async () => undefined) };
  const service = new (TeamsService as any)(prisma, dispatcher) as TeamsService;
  return { service, dispatcher };
};

test('notifica o membro adicionado à equipe', async () => {
  const { service, dispatcher } = doubles();

  await service.addMember('tenant-1', 'team-1', 'member-2', 'actor-1');

  assert.equal(dispatcher.dispatch.mock.calls[0][0].tenantUserId, 'member-2');
  assert.equal(dispatcher.dispatch.mock.calls[0][0].type, 'team_member_added');
});

test('não notifica o actor ao torná-lo manager da equipe', async () => {
  const { service, dispatcher } = doubles();

  await (service as any).update('tenant-1', 'team-1', { managerTenantUserId: 'actor-1' }, 'actor-1');

  assert.deepEqual(
    dispatcher.dispatch.mock.calls.map(([input]) => input.tenantUserId),
    ['member-1'],
  );
});
