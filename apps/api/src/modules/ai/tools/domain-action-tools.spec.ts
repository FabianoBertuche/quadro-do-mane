import assert from 'node:assert/strict';
import test from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { AddProjectMemberTool } from './add-project-member.tool';
import { AddTeamMemberTool } from './add-team-member.tool';
import { CreateCalendarEventTool } from './create-calendar-event.tool';
import { CreateRoutineTool } from './create-routine.tool';

const tenantId = 'tenant-1';
const actorId = 'actor-1';
const input = (args: unknown) => ({ tenantId, actorTenantUserId: actorId, args });

const users = (permissions: string[] = [
  'calendar.create', 'calendar.edit', 'daily_routine.manage',
  'teams.manage_members', 'projects.manage_members',
]): any => ({
  findOne: async (requestedTenantId: string, id: string) => requestedTenantId === tenantId && id === actorId
    ? { id, role: { name: 'colaborador', rolePermissions: permissions.map((code) => ({ permission: { code } })) } }
    : requestedTenantId === tenantId && ['user-1', 'user-2'].includes(id) ? { id, user: { name: id === 'user-1' ? 'Maria' : 'Joao' } } : null,
  findAll: async (requestedTenantId: string) => requestedTenantId === tenantId
    ? [{ id: 'user-1', user: { name: 'Maria' } }, { id: 'user-2', user: { name: 'Joao' } }]
    : [],
});

test('denies calendar action without the existing permission', async () => {
  const tool = new CreateCalendarEventTool({} as any, users([]), {} as any);

  await assert.rejects(() => tool.authorize(input({
    title: 'Reunião', startAt: '2030-01-01T10:00:00-03:00', endAt: '2030-01-01T11:00:00-03:00',
  })), ForbiddenException);
});

test('clarifies a calendar event when its date or participant is incomplete', async () => {
  const tool = new CreateCalendarEventTool({} as any, users(), {} as any);

  assert.deepEqual(await tool.authorize(input({ title: 'Reunião' })), {
    needsClarification: true, field: 'startAt', matches: [],
  });
});

test('rejects a calendar participant that is outside the actor tenant', async () => {
  const domain = { create: async () => ({ id: 'event-1' }) };
  const tool = new CreateCalendarEventTool(domain as any, users(), {
    findAll: async () => [{ id: 'other-tenant-user', user: { name: 'Maria' } }],
  } as any);

  await assert.rejects(() => tool.authorize(input({
    title: 'Reunião', startAt: '2030-01-01T10:00:00-03:00', endAt: '2030-01-01T11:00:00-03:00',
    attendeeIds: ['other-tenant-user'],
  })), ForbiddenException);
  assert.equal(domain.create, domain.create);
});

test('delegates calendar creation with tenant and actor identity preserved', async () => {
  let received: unknown;
  const domain = { create: async (...args: unknown[]) => { received = args; return { id: 'event-1' }; } };
  const tool = new CreateCalendarEventTool(domain as any, users(), { findAll: async () => [] } as any);
  const args = { title: 'Reunião', startAt: '2030-01-01T10:00:00-03:00', endAt: '2030-01-01T11:00:00-03:00', attendeeIds: ['user-1'] };

  await tool.authorize(input(args));
  assert.deepEqual(await tool.execute(input(args)), { id: 'event-1' });
  assert.deepEqual(received, [tenantId, actorId, args]);
});

test('clarifies routine creation when the responsible user is missing', async () => {
  const tool = new CreateRoutineTool({} as any, users());

  assert.deepEqual(await tool.authorize(input({ title: 'Alongar', scheduledTime: '08:00' })), {
    needsClarification: true, field: 'assignedTenantUserId', matches: [],
  });
});

test('delegates routine creation with tenant and actor identity preserved', async () => {
  let received: unknown;
  const domain = { create: async (...args: unknown[]) => { received = args; return { id: 'routine-1' }; } };
  const tool = new CreateRoutineTool(domain as any, users());
  const args = { title: 'Alongar', scheduledTime: '08:00', assignedTenantUserId: 'user-1' };

  await tool.authorize(input(args));
  assert.deepEqual(await tool.execute(input(args)), { id: 'routine-1' });
  assert.deepEqual(received, [{ ...args }, { tenantId, tenantUserId: actorId, actorTenantUserId: actorId }]);
});

test('clarifies duplicate collaborator names before adding a team member', async () => {
  const tool = new AddTeamMemberTool({} as any, users(), {
    findOne: async () => ({ id: 'team-1' }),
  } as any);
  const duplicateUsers = { ...users(), findAll: async () => [
    { id: 'user-1', user: { name: 'Maria' } }, { id: 'user-2', user: { name: 'Maria' } },
  ] };
  const duplicateTool = new AddTeamMemberTool({} as any, duplicateUsers, { findOne: async () => ({ id: 'team-1' }) } as any);

  assert.deepEqual(await duplicateTool.authorize(input({ teamId: 'team-1', memberName: 'Maria' })), {
    needsClarification: true,
    field: 'memberName',
    matches: [{ id: 'user-1', name: 'Maria' }, { id: 'user-2', name: 'Maria' }],
  });
  assert.equal(tool.name, 'add_team_member');
});

test('delegates project membership with the actor identity preserved', async () => {
  let received: unknown;
  const domain = { addMember: async (...args: unknown[]) => { received = args; return { id: 'membership-1' }; } };
  const projects = { findOne: async () => ({ id: 'project-1' }) };
  const tool = new AddProjectMemberTool(domain as any, users(), projects as any);
  const args = { projectId: 'project-1', memberTenantUserId: 'user-1' };

  await tool.authorize(input(args));
  assert.deepEqual(await tool.execute(input(args)), { id: 'membership-1' });
  assert.deepEqual(received, [tenantId, 'project-1', 'user-1', undefined, actorId]);
});
