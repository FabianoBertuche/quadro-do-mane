import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AddProjectMemberTool } from './add-project-member.tool';
import { AddTeamMemberTool } from './add-team-member.tool';
import { CreateCalendarEventTool } from './create-calendar-event.tool';
import { CreateRoutineTool } from './create-routine.tool';
import { DeleteRoutineTool } from './delete-routine.tool';

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

test('rejects malformed calendar scalar, collection, recurrence, and reminder arguments', () => {
  const tool = new CreateCalendarEventTool({} as any, users(), {} as any);
  const base = { title: 'Reunião', startAt: '2030-01-01T10:00:00-03:00', endAt: '2030-01-01T11:00:00-03:00', attendeeIds: ['user-1'] };

  for (const patch of [
    { allDay: 'false' }, { attendeeIds: [''] }, { recurrenceInterval: 0 },
    { recurrenceInterval: 1.5 }, { recurrenceUnit: 'fortnight' }, { remindDaysBefore: -1 },
    { remindDaysBefore: 1.5 },
  ]) assert.throws(() => tool.validate!({ ...base, ...patch }), BadRequestException);
});

test('rejects a calendar whose end is not after its start', () => {
  const tool = new CreateCalendarEventTool({} as any, users(), {} as any);
  assert.throws(() => tool.validate!({
    title: 'Reunião', startAt: '2030-01-01T11:00:00-03:00', endAt: '2030-01-01T10:00:00-03:00', attendeeIds: ['user-1'],
  }), BadRequestException);
});

test('rejects malformed calendar arguments before domain execution', () => {
  const tool = new CreateCalendarEventTool({} as any, users(), {} as any);
  assert.throws(() => tool.validate!({ title: 'Reunião', startAt: '2030-01-01T10:00:00', endAt: '2030-01-01T11:00:00-03:00', attendeeIds: ['user-1'] }), BadRequestException);
});

test('rejects empty calendar required strings and explicitly empty participant arrays', () => {
  const tool = new CreateCalendarEventTool({} as any, users(), {} as any);
  assert.equal((tool.parameters.properties as any).attendeeIds.minItems, 1);
  assert.equal((tool.parameters.properties as any).attendeeNames.minItems, 1);
  const base = { title: 'Reunião', startAt: '2030-01-01T10:00:00-03:00', endAt: '2030-01-01T11:00:00-03:00', attendeeIds: ['user-1'] };
  for (const field of ['title', 'startAt', 'endAt', 'description', 'type', 'relatedProjectId', 'relatedProjectName', 'relatedTaskId', 'assigneeTenantUserId', 'assigneeName', 'recurrenceRule', 'recurrenceUnit', 'recurrenceEndAt']) {
    assert.throws(() => tool.validate!({ ...base, [field]: ' ' }), BadRequestException, field);
  }
  assert.throws(() => tool.validate!({ ...base, attendeeIds: [] }), BadRequestException);
  assert.throws(() => tool.validate!({ ...base, attendeeNames: [] }), BadRequestException);
});

test('validates calendar recurrence end requirements and date values', () => {
  const tool = new CreateCalendarEventTool({} as any, users(), {} as any);
  const base = { title: 'Reunião', startAt: '2030-01-01T10:00:00-03:00', endAt: '2030-01-01T11:00:00-03:00', attendeeIds: ['user-1'] };
  assert.throws(() => tool.validate!({ ...base, recurrenceRule: 'WEEKLY' }), BadRequestException);
  assert.throws(() => tool.validate!({ ...base, recurrenceEndAt: 'not-a-date' }), BadRequestException);
  assert.throws(() => tool.validate!({ ...base, recurrenceInterval: 2 }), BadRequestException);
  assert.throws(() => tool.validate!({ ...base, recurrenceUnit: 'week' }), BadRequestException);
  assert.throws(() => tool.validate!({ ...base, recurrenceRule: 'WEEKLY', recurrenceEndAt: '2029-12-31' }), BadRequestException);
});

test('accepts only recurrence combinations supported by EventsService', () => {
  const tool = new CreateCalendarEventTool({} as any, users(), {} as any);
  const base = { title: 'Reunião', startAt: '2030-01-01T10:00:00-03:00', endAt: '2030-01-01T11:00:00-03:00', attendeeIds: ['user-1'], recurrenceEndAt: '2030-02-01T10:00:00-03:00' };
  assert.doesNotThrow(() => tool.validate!({ ...base, recurrenceRule: 'WEEKLY', recurrenceUnit: 'week' }));
  assert.doesNotThrow(() => tool.validate!({ ...base, recurrenceRule: 'CUSTOM', recurrenceInterval: 2, recurrenceUnit: 'week' }));
  assert.throws(() => tool.validate!({ ...base, recurrenceRule: 'DAILY', recurrenceUnit: 'week' }), BadRequestException);
  assert.throws(() => tool.validate!({ ...base, recurrenceRule: 'CUSTOM' }), BadRequestException);
});

test('uses the actor as the routine assignee when no responsible user is supplied', async () => {
  const tool = new CreateRoutineTool({} as any, users());

  assert.deepEqual(await tool.authorize(input({ title: 'Alongar', scheduledTime: '08:00' })), {});
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

test('clarifies a routine when its schedule is missing and allows the actor as the default assignee', async () => {
  let received: unknown;
  const tool = new CreateRoutineTool({ create: async (...args: unknown[]) => { received = args; return { id: 'routine-2' }; } } as any, users());

  assert.deepEqual(await tool.authorize(input({ title: 'Alongar' })), {
    needsClarification: true, field: 'scheduledTime', matches: [],
  });
  const args = { title: 'Alongar', scheduledTime: '08:00' };
  await tool.authorize(input(args));
  await tool.execute(input(args));
  assert.deepEqual(received, [{ ...args }, { tenantId, tenantUserId: actorId, actorTenantUserId: actorId }]);
});

test('denies routine deletion without daily_routine.manage', async () => {
  const tool = new DeleteRoutineTool({} as any, users([]));

  await assert.rejects(() => tool.authorize(input({ routineId: 'routine-1' })), ForbiddenException);
});

test('rejects routine deletion without a routine ID', () => {
  const tool = new DeleteRoutineTool({} as any, users());
  assert.throws(() => tool.validate!({}), BadRequestException);
});

test('delegates routine deletion with tenant identity preserved', async () => {
  let received: unknown;
  const domain = { remove: async (...args: unknown[]) => { received = args; return { id: 'routine-1' }; } };
  const tool = new DeleteRoutineTool(domain as any, users());

  await tool.authorize(input({ routineId: 'routine-1' }));
  assert.deepEqual(await tool.execute(input({ routineId: 'routine-1' })), { id: 'routine-1' });
  assert.deepEqual(received, ['routine-1', tenantId]);
});

test('rejects malformed routine schedules and ambiguous or cross-tenant assignees', async () => {
  const tool = new CreateRoutineTool({} as any, users());
  assert.throws(() => tool.validate!({ title: 'Alongar', scheduledTime: '8:00' }), BadRequestException);
  await assert.rejects(() => tool.authorize(input({ title: 'Alongar', scheduledTime: '08:00', assignedTenantUserId: 'other-tenant-user' })), ForbiddenException);

  const duplicateUsers = { ...users(), findAll: async () => [
    { id: 'user-1', user: { name: 'Maria' } }, { id: 'user-2', user: { name: 'Maria' } },
  ] };
  const duplicateTool = new CreateRoutineTool({} as any, duplicateUsers);
  assert.deepEqual(await duplicateTool.authorize(input({ title: 'Alongar', scheduledTime: '08:00', assignedUserName: 'Maria' })), {
    needsClarification: true, field: 'assignedUserName', matches: [{ id: 'user-1', name: 'Maria' }, { id: 'user-2', name: 'Maria' }],
  });
});

test('clarifies duplicate collaborator names before adding a team member', async () => {
  const tool = new AddTeamMemberTool({} as any, users());
  const duplicateUsers = { ...users(), findAll: async () => [
    { id: 'user-1', user: { name: 'Maria' } }, { id: 'user-2', user: { name: 'Maria' } },
  ] };
  const duplicateTool = new AddTeamMemberTool({ findOne: async () => ({ id: 'team-1' }) } as any, duplicateUsers);

  assert.deepEqual(await duplicateTool.authorize(input({ teamId: 'team-1', memberName: 'Maria' })), {
    needsClarification: true,
    field: 'memberName',
    matches: [{ id: 'user-1', name: 'Maria' }, { id: 'user-2', name: 'Maria' }],
  });
  assert.equal(tool.name, 'add_team_member');
});

test('team membership rejects unauthorized, malformed, cross-tenant, and invalid targets', async () => {
  const domain = { findOne: async () => null, addMember: async () => ({}) };
  const tool = new AddTeamMemberTool(domain as any, users([]));
  await assert.rejects(() => tool.authorize(input({ teamId: 'team-1', memberTenantUserId: 'user-1' })), ForbiddenException);
  assert.throws(() => tool.validate!({ teamId: 'team-1', memberTenantUserId: 3 }), BadRequestException);
  await assert.rejects(() => new AddTeamMemberTool({ findOne: async () => ({ id: 'team-1' }) } as any, users()).authorize(input({ teamId: 'team-1', memberTenantUserId: 'other-tenant-user' })), ForbiddenException);
  await assert.rejects(() => new AddTeamMemberTool(domain as any, users()).authorize(input({ teamId: 'missing', memberTenantUserId: 'user-1' })), /team/i);
});

test('team membership delegates name resolution with tenant and actor propagation', async () => {
  let received: unknown;
  const domain = { findOne: async () => ({ id: 'team-1' }), addMember: async (...args: unknown[]) => { received = args; return { id: 'membership-2' }; } };
  const tool = new AddTeamMemberTool(domain as any, users());
  await tool.authorize(input({ teamId: 'team-1', memberName: 'Maria' }));
  assert.deepEqual(await tool.execute(input({ teamId: 'team-1', memberName: 'Maria' })), { id: 'membership-2' });
  assert.deepEqual(received, [tenantId, 'team-1', 'user-1', actorId]);
});

test('delegates project membership with the actor identity preserved', async () => {
  let received: unknown;
  const domain = { addMember: async (...args: unknown[]) => { received = args; return { id: 'membership-1' }; } };
  const tool = new AddProjectMemberTool({ findOne: async () => ({ id: 'project-1' }), addMember: domain.addMember } as any, users());
  const args = { projectId: 'project-1', memberTenantUserId: 'user-1' };

  await tool.authorize(input(args));
  assert.deepEqual(await tool.execute(input(args)), { id: 'membership-1' });
  assert.deepEqual(received, [tenantId, 'project-1', 'user-1', undefined, actorId]);
});

test('project membership rejects unauthorized, malformed, cross-tenant, and invalid targets', async () => {
  const domain = { findOne: async () => null, addMember: async () => ({}) };
  const tool = new AddProjectMemberTool(domain as any, users([]));
  await assert.rejects(() => tool.authorize(input({ projectId: 'project-1', memberTenantUserId: 'user-1' })), ForbiddenException);
  assert.throws(() => tool.validate!({ projectId: 'project-1', memberTenantUserId: 3 }), BadRequestException);
  await assert.rejects(() => new AddProjectMemberTool({ findOne: async () => ({ id: 'project-1' }) } as any, users()).authorize(input({ projectId: 'project-1', memberTenantUserId: 'other-tenant-user' })), ForbiddenException);
  await assert.rejects(() => new AddProjectMemberTool(domain as any, users()).authorize(input({ projectId: 'missing', memberTenantUserId: 'user-1' })), /project/i);
});

test('project membership delegates name resolution with tenant and actor propagation', async () => {
  let received: unknown;
  const domain = { findOne: async () => ({ id: 'project-1' }), addMember: async (...args: unknown[]) => { received = args; return { id: 'membership-2' }; } };
  const tool = new AddProjectMemberTool(domain as any, users());
  await tool.authorize(input({ projectId: 'project-1', memberName: 'Maria', roleInProject: 'member' }));
  assert.deepEqual(await tool.execute(input({ projectId: 'project-1', memberName: 'Maria', roleInProject: 'member' })), { id: 'membership-2' });
  assert.deepEqual(received, [tenantId, 'project-1', 'user-1', 'member', actorId]);
});
