import assert from 'node:assert/strict';
import test from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { SearchProjectsTool } from './search-projects.tool';
import { SearchUsersTool } from './search-users.tool';
import { SearchTeamsTool } from './search-teams.tool';
import { SearchCalendarTool } from './search-calendar.tool';
import { SearchRoutinesTool } from './search-routines.tool';

const input = (args: unknown, actorTenantUserId = 'actor-1') => ({
  tenantId: 'tenant-1', actorTenantUserId, args,
});

const actor = (permissions: string[] = [
  'projects.view', 'users.view', 'teams.view', 'calendar.view', 'daily_routine.view',
]) => ({
  id: 'actor-1',
  role: { name: 'colaborador', rolePermissions: permissions.map((code) => ({ permission: { code } })) },
});

const services = () => ({
  users: {
    findOne: async (_tenant: string, id: string) => id === 'actor-1'
      ? actor()
      : { id, user: { name: id === 'user-1' ? 'Maria' : 'Outro', email: `${id}@example.com`, phone: '999' }, role: { name: 'colaborador', rolePermissions: [] } },
    findAll: async () => [
      { id: 'user-1', tenantId: 'tenant-1', user: { id: 'global-1', name: 'Maria', email: 'maria@example.com', phone: '999' }, role: { name: 'colaborador' } },
    ],
  },
  projects: {
    findAll: async () => [
      { id: 'project-1', tenantId: 'tenant-1', name: 'Projeto', status: 'ACTIVE', owner: { user: { name: 'Maria', email: 'maria@example.com' } }, _count: { tasks: 3, members: 1 }, progressPercent: 50 },
    ],
  },
  teams: {
    findAll: async () => [{ id: 'team-1', tenantId: 'tenant-1', name: 'Equipe', color: '#fff', manager: { user: { name: 'Maria', email: 'maria@example.com' } }, members: [{ tenantUser: { user: { name: 'Outro', email: 'outro@example.com' } } }], _count: { members: 1, projects: 2 } }],
  },
  events: {
    findAll: async () => [{ id: 'event-1', tenantId: 'tenant-1', title: 'Reunião', startAt: new Date('2026-10-01T10:00:00Z'), endAt: new Date('2026-10-01T11:00:00Z'), description: 'privado', assignee: { user: { name: 'Maria', email: 'maria@example.com' } }, attendees: [] }],
  },
  routines: {
    getRoutinesForUser: async () => [{ id: 'routine-1', tenantId: 'tenant-1', title: 'Revisar', description: 'privado', scheduledTime: '09:00', completedToday: false, log: null }],
  },
});

test('read tools implement the common AI tool contract', () => {
  const s = services();
  const tools = [
    new SearchProjectsTool(s.projects as any, s.users as any),
    new SearchUsersTool(s.users as any),
    new SearchTeamsTool(s.teams as any, s.users as any),
    new SearchCalendarTool(s.events as any, s.users as any),
    new SearchRoutinesTool(s.routines as any, s.users as any),
  ];
  assert.deepEqual(tools.map((tool) => tool.name), [
    'search_projects', 'search_users', 'search_teams', 'search_calendar', 'search_routines',
  ]);
  for (const tool of tools) {
    assert.equal(typeof tool.authorize, 'function');
    assert.equal(typeof tool.execute, 'function');
  }
});

test('project reads pass tenant, actor, and actor role to the domain service', async () => {
  const s = services();
  const calls: unknown[][] = [];
  s.projects.findAll = async (...args: any[]) => { calls.push(args); return []; };
  await new SearchProjectsTool(s.projects as any, s.users as any).execute(input({}));
  assert.deepEqual(calls, [['tenant-1', 'actor-1', 'colaborador']]);
});

test('read tools reject a missing permission before querying data', async () => {
  const s = services();
  s.users.findOne = async () => actor([]);
  const tools = [
    new SearchProjectsTool(s.projects as any, s.users as any),
    new SearchUsersTool(s.users as any),
    new SearchTeamsTool(s.teams as any, s.users as any),
    new SearchCalendarTool(s.events as any, s.users as any),
    new SearchRoutinesTool(s.routines as any, s.users as any),
  ];
  for (const tool of tools) await assert.rejects(() => tool.authorize(input({})), ForbiddenException);
});

test('read results are bounded and redact email, tokens, and private fields', async () => {
  const s = services();
  const many = Array.from({ length: 51 }, (_, index) => ({ id: `project-${index}`, name: `Projeto ${index}`, description: 'private', accessToken: 'secret', owner: { user: { name: 'Maria', email: 'maria@example.com' } } }));
  s.projects.findAll = (async () => many) as any;
  const result = await new SearchProjectsTool(s.projects as any, s.users as any).execute(input({}));
  assert.equal((result as any[]).length, 50);
  assert.deepEqual((result as any[])[0], { id: 'project-0', name: 'Projeto 0', status: undefined, owner: 'Maria', team: undefined, progressPercent: undefined, totalTasks: undefined });
  assert.equal(JSON.stringify(result).includes('email'), false);
  assert.equal(JSON.stringify(result).includes('secret'), false);
  assert.equal(JSON.stringify(result).includes('private'), false);
});

test('user, team, calendar, and routine summaries do not expose email or private fields', async () => {
  const s = services();
  const results = await Promise.all([
    new SearchUsersTool(s.users as any).execute(input({})),
    new SearchTeamsTool(s.teams as any, s.users as any).execute(input({})),
    new SearchCalendarTool(s.events as any, s.users as any).execute(input({})),
    new SearchRoutinesTool(s.routines as any, s.users as any).execute(input({})),
  ]);
  for (const result of results) {
    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes('email'), false);
    assert.equal(serialized.includes('privado'), false);
  }
  assert.equal((results[2] as any[])[0].startAt, '2026-10-01T10:00:00.000Z');
});

test('cross-tenant target IDs are rejected and ambiguous names return clarification', async () => {
  const s = services();
  s.users.findAll = (async () => [{ id: 'user-1', tenantId: 'tenant-1', user: { name: 'Maria' } }]) as any;
  const users = new SearchUsersTool(s.users as any);
  await assert.rejects(() => users.execute(input({ userId: 'other-tenant-user' })), ForbiddenException);

  s.projects.findAll = (async () => [
    { id: 'project-1', tenantId: 'tenant-1', name: 'Projeto' },
    { id: 'project-2', tenantId: 'tenant-1', name: 'Projeto' },
  ]) as any;
  const projects = new SearchProjectsTool(s.projects as any, s.users as any);
  assert.deepEqual(await projects.execute(input({ name: 'Projeto' })), {
    needsClarification: true, field: 'name', matches: ['project-1', 'project-2'],
  });
});

test('calendar and routine reads validate requested users inside the tenant', async () => {
  const s = services();
  const calls: unknown[][] = [];
  s.events.findAll = async (...args: any[]) => { calls.push(args); return []; };
  await new SearchCalendarTool(s.events as any, s.users as any).execute(input({ requestedTenantUserId: 'user-1', startDate: '2026-10-01', endDate: '2026-10-02' }));
  assert.deepEqual(calls[0], ['tenant-1', 'actor-1', 'colaborador', '2026-10-01', '2026-10-02', 'user-1']);
  s.users.findOne = async () => { throw new ForbiddenException('Colaborador não encontrado no tenant'); };
  await assert.rejects(() => new SearchRoutinesTool(s.routines as any, s.users as any).execute(input({ requestedTenantUserId: 'other-tenant-user' })), ForbiddenException);
});
