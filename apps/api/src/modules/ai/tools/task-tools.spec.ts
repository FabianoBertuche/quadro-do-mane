import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CreateTaskTool } from './create-task.tool';
import { MoveTaskTool } from './move-task.tool';
import { SearchTasksTool } from './search-tasks.tool';
import { UpdateTaskTool } from './update-task.tool';
import { AiToolRegistryService } from './ai-tool-registry.service';
import { AiToolClarification } from './ai-tool.port';
import { clarification, resolveReadOne } from './task-tool.schemas';

const input = (args: unknown, actorTenantUserId = 'actor-1') => ({
  tenantId: 'tenant-1', actorTenantUserId, args,
});

const user = (permissions = ['tasks.view', 'tasks.create', 'tasks.edit', 'tasks.change_status']) => ({
  id: 'actor-1', tenantId: 'tenant-1', role: { rolePermissions: permissions.map((code) => ({ permission: { code } })) },
});

const services = () => ({
  tasks: {
    findByFilters: async () => [{ id: 'task-1', title: 'Tarefa', tenantId: 'tenant-1', description: 'segredo interno' }],
    findOne: async () => ({ id: 'task-1', tenantId: 'tenant-1' }),
    create: async (...args: any[]) => ({ id: 'created-1', args }),
    update: async (...args: any[]) => ({ id: 'task-1', args }),
    changeStatus: (async (...args: any[]) => ({ id: 'task-1', args })) as any,
    getStatuses: async () => [{ id: 'status-1', tenantId: 'tenant-1', name: 'Em andamento' }],
    getPriorities: async () => [{ id: 'priority-1', tenantId: 'tenant-1', name: 'Alta' }],
  },
  projects: { findAll: async () => [{ id: 'project-1', tenantId: 'tenant-1', name: 'Projeto' }] },
  users: { findAll: async () => [{ id: 'user-1', tenantId: 'tenant-1', user: { name: 'Maria' } }], findOne: async () => user() },
});

test('registry exposes exactly the four task tools', () => {
  const s = services();
  const registry = new AiToolRegistryService([
    new SearchTasksTool(s.tasks as any, s.users as any, s.projects as any),
    new CreateTaskTool(s.tasks as any, s.projects as any, s.users as any),
    new UpdateTaskTool(s.tasks as any, s.users as any),
    new MoveTaskTool(s.tasks as any, s.users as any),
  ]);
  assert.deepEqual(registry.list().map((tool) => tool.name), ['search_tasks', 'create_task', 'update_task', 'move_task']);
  assert.equal(registry.get('search_tasks')?.readOnly, true);
});

test('search_tasks publishes name filters and passes actor role to project visibility lookup', async () => {
  const s = services();
  const projectCalls: any[] = [];
  s.projects.findAll = (async (...args: any[]) => { projectCalls.push(args); return [{ id: 'project-1', name: 'Projeto' }]; }) as any;
  s.users.findOne = async () => ({ ...user(), role: { name: 'admin', rolePermissions: [] } });
  const tool = new SearchTasksTool(s.tasks as any, s.users as any, s.projects as any);
  assert.ok((tool.parameters.properties as any).projectName);
  assert.ok((tool.parameters.properties as any).statusName);
  assert.ok((tool.parameters.properties as any).priorityName);
  assert.deepEqual((tool.parameters.properties as any).myTasks, { type: 'boolean' });
  assert.deepEqual((tool.parameters.properties as any).overdue, { type: 'boolean' });
  await tool.execute(input({ projectName: 'Projeto' }));
  assert.deepEqual(projectCalls[0], ['tenant-1', 'actor-1', 'admin']);
});

test('search_tasks resolves a unique collaborator by partial name', async () => {
  const s = services();
  let filters: any;
  s.users.findAll = async () => [
    { id: 'fabiano-1', tenantId: 'tenant-1', user: { name: 'Fabiano Bertuche' } },
    { id: 'maria-1', tenantId: 'tenant-1', user: { name: 'Maria Souza' } },
  ];
  s.tasks.findByFilters = (async (_tenantId: string, received: any) => { filters = received; return []; }) as any;

  const result = await new SearchTasksTool(s.tasks as any, s.users as any, s.projects as any)
    .execute(input({ assigneeName: 'Fabiano', overdue: true }));

  assert.deepEqual(result, []);
  assert.equal(filters.assigneeTenantUserId, 'fabiano-1');
  assert.equal(filters.overdue, true);
});

test('search_tasks resolves myTasks to the authenticated tenant user', async () => {
  const s = services();
  let filters: any;
  s.tasks.findByFilters = (async (_tenantId: string, received: any) => { filters = received; return []; }) as any;

  await new SearchTasksTool(s.tasks as any, s.users as any, s.projects as any)
    .execute(input({ myTasks: true, overdue: true }));

  assert.equal(filters.assigneeTenantUserId, 'actor-1');
  assert.equal(filters.overdue, true);
  assert.equal('myTasks' in filters, false);
});

test('search_tasks asks for clarification when a partial collaborator name is ambiguous', async () => {
  const s = services();
  s.users.findAll = async () => [
    { id: 'carlos-1', tenantId: 'tenant-1', user: { name: 'Carlos Andrade' } },
    { id: 'carlos-2', tenantId: 'tenant-1', user: { name: 'Carlos Silva' } },
  ];

  const result = await new SearchTasksTool(s.tasks as any, s.users as any, s.projects as any)
    .execute(input({ assigneeName: 'Carlos' }));

  assert.equal(clarification(result), true);
  assert.deepEqual((result as AiToolClarification).matches, [
    { id: 'carlos-1', name: 'Carlos Andrade' },
    { id: 'carlos-2', name: 'Carlos Silva' },
  ]);
});

test('create_task resolves exact tenant names and passes actor to TasksService.create', async () => {
  const s = services();
  const calls: any[] = [];
  s.tasks.create = (async (...args: any[]) => { calls.push(args); return { id: 'created-1' }; }) as any;
  const tool = new CreateTaskTool(s.tasks as any, s.projects as any, s.users as any);
  await tool.authorize(input({ title: 'Nova', projectName: 'Projeto', assigneeName: 'Maria' }));
  await tool.execute(input({ title: 'Nova', projectName: 'Projeto', assigneeName: 'Maria' }));
  assert.equal(calls[0][0], 'tenant-1');
  assert.equal(calls[0][2], 'actor-1');
  assert.equal(calls[0][1].projectId, 'project-1');
  assert.equal(calls[0][1].assigneeTenantUserId, 'user-1');
});

test('update_task passes actor tenant-user ID to the domain service', async () => {
  const s = services();
  const calls: any[] = [];
  s.tasks.update = (async (...args: any[]) => { calls.push(args); return { id: 'task-1' }; }) as any;
  const tool = new UpdateTaskTool(s.tasks as any, s.users as any);
  await tool.authorize(input({ taskId: 'task-1', title: 'Atualizada' }));
  await tool.execute(input({ taskId: 'task-1', title: 'Atualizada' }));
  assert.equal(calls[0][3], 'actor-1');
});

test('create/update/move preserve actor for domain activity and notification side effects', async () => {
  const s = services();
  const effects: any[] = [];
  s.tasks.create = (async (...args: any[]) => { effects.push(['activity', args[2]]); effects.push(['notification', args[2]]); return {}; }) as any;
  s.tasks.update = (async (...args: any[]) => { effects.push(['activity', args[3]]); effects.push(['notification', args[3]]); return {}; }) as any;
  s.tasks.changeStatus = (async (...args: any[]) => { effects.push(['activity', args[3]]); effects.push(['notification', args[3]]); return {}; }) as any;
  const create = new CreateTaskTool(s.tasks as any, s.projects as any, s.users as any);
  const update = new UpdateTaskTool(s.tasks as any, s.users as any);
  const move = new MoveTaskTool(s.tasks as any, s.users as any);
  await create.execute(input({ title: 'Nova', projectName: 'Projeto' }));
  await update.execute(input({ taskId: 'task-1', title: 'Atualizada' }));
  await move.execute(input({ taskId: 'task-1', statusName: 'Em andamento' }));
  assert.deepEqual(effects, [
    ['activity', 'actor-1'], ['notification', 'actor-1'],
    ['activity', 'actor-1'], ['notification', 'actor-1'],
    ['activity', 'actor-1'], ['notification', 'actor-1'],
  ]);
});

test('ambiguous project names return clarification instead of guessing', async () => {
  const s = services();
  s.projects.findAll = async () => [
    { id: 'project-1', tenantId: 'tenant-1', name: 'Projeto' },
    { id: 'project-2', tenantId: 'tenant-1', name: 'Projeto' },
  ];
  const tool = new CreateTaskTool(s.tasks as any, s.projects as any, s.users as any);
  const result = await tool.execute(input({ title: 'Nova', projectName: 'Projeto' }));
  assert.deepEqual(result, {
    needsClarification: true,
    field: 'projectName',
    matches: [
      { id: 'project-1', name: 'Projeto' },
      { id: 'project-2', name: 'Projeto' },
    ],
  });
});

test('cross-tenant IDs are rejected during authorization', async () => {
  const s = services();
  s.tasks.findOne = async () => { throw new ForbiddenException('Tarefa não encontrada'); };
  const tool = new UpdateTaskTool(s.tasks as any, s.users as any);
  await assert.rejects(() => tool.authorize(input({ taskId: 'other-task', title: 'Novo' })), ForbiddenException);
});

test('update_task rejects an empty patch', () => {
  const s = services();
  const tool = new UpdateTaskTool(s.tasks as any, s.users as any);
  assert.throws(() => tool.validate?.({ taskId: 'task-1' }), BadRequestException);
});

test('move_task delegates status changes with tenant and actor', async () => {
  const s = services();
  const calls: any[] = [];
  s.tasks.changeStatus = async (...args: any[]) => { calls.push(args); return { ok: true }; };
  const tool = new MoveTaskTool(s.tasks as any, s.users as any);
  await tool.authorize(input({ taskId: 'task-1', statusName: 'Em andamento' }));
  await tool.execute(input({ taskId: 'task-1', statusName: 'Em andamento' }));
  assert.deepEqual(calls[0], ['tenant-1', 'task-1', 'status-1', 'actor-1']);
});

test('search_tasks returns bounded summaries without unrestricted user data', async () => {
  const s = services();
  const tool = new SearchTasksTool(s.tasks as any, s.users as any, s.projects as any);
  const result = await tool.execute(input({ search: 'Tarefa' }));
  assert.deepEqual(result, [{ id: 'task-1', title: 'Tarefa', projectName: null, status: undefined, priority: undefined, assignee: undefined }]);
});

test('search_tasks exposes the project name so overdue summaries stay human-friendly', async () => {
  const s = services();
  s.tasks.findByFilters = (async () => [{
    id: 'task-1', title: 'Tarefa atrasada', tenantId: 'tenant-1',
    project: { id: 'project-1', name: 'Projeto Alpha', code: 'PA' },
    status: { name: 'Em andamento' }, priority: { name: 'Alta' }, assignee: { user: { name: 'Maria' } },
  }]) as any;
  const tool = new SearchTasksTool(s.tasks as any, s.users as any, s.projects as any);
  const result = await tool.execute(input({ overdue: true }));
  assert.deepEqual(result, [{
    id: 'task-1', title: 'Tarefa atrasada', projectName: 'Projeto Alpha',
    status: 'Em andamento', priority: 'Alta', assignee: 'Maria',
  }]);
});

test('search_tasks rejects an invalid tenant-scoped project ID before querying tasks', async () => {
  const s = services();
  let queried = false;
  s.tasks.findByFilters = async () => { queried = true; return []; };
  const tool = new SearchTasksTool(s.tasks as any, s.users as any, s.projects as any);
  await assert.rejects(() => tool.execute(input({ projectId: 'other-project' })), ForbiddenException);
  assert.equal(queried, false);
});

test('create_task rejects a project outside the actor visibility scope', async () => {
  const s = services();
  s.projects.findAll = (async () => [{ id: 'visible-project', name: 'Visível' }]) as any;
  const tool = new CreateTaskTool(s.tasks as any, s.projects as any, s.users as any);
  await assert.rejects(() => tool.execute(input({ title: 'Nova', projectId: 'hidden-project' })), ForbiddenException);
});

test('update_task and move_task reject tasks whose projects are outside actor visibility', async () => {
  const s = services();
  s.tasks.findOne = (async () => ({ id: 'task-1', projectId: 'hidden-project' })) as any;
  s.projects.findAll = (async () => [{ id: 'visible-project', name: 'Visível' }]) as any;
  const update = new UpdateTaskTool(s.tasks as any, s.users as any, s.projects as any);
  const move = new MoveTaskTool(s.tasks as any, s.users as any, s.projects as any);
  await assert.rejects(() => update.authorize(input({ taskId: 'task-1', title: 'Novo' })), ForbiddenException);
  await assert.rejects(() => move.authorize(input({ taskId: 'task-1', statusName: 'Em andamento' })), ForbiddenException);
});

test('update_task and move_task reject unknown task IDs safely', async () => {
  const s = services();
  s.tasks.findOne = (async () => null) as any;
  const update = new UpdateTaskTool(s.tasks as any, s.users as any);
  const move = new MoveTaskTool(s.tasks as any, s.users as any);

  await assert.rejects(() => update.authorize(input({ taskId: 'missing-task', title: 'Novo' })), ForbiddenException);
  await assert.rejects(() => move.authorize(input({ taskId: 'missing-task', statusName: 'Em andamento' })), ForbiddenException);
});

test('search_tasks applies actor project visibility to global searches', async () => {
  const s = services();
  s.projects.findAll = (async () => [{ id: 'visible-project', name: 'Visível' }]) as any;
  let filters: any;
  s.tasks.findByFilters = (async (_tenant: string, value: any) => { filters = value; return []; }) as any;
  const tool = new SearchTasksTool(s.tasks as any, s.users as any, s.projects as any);
  await tool.execute(input({ search: 'privado' }));
  assert.deepEqual(filters.projectIds, ['visible-project']);
});

test('search_tasks rejects an unknown assignee ID after tenant-scoped lookup and before querying tasks', async () => {
  const s = services();
  const userLookups: any[] = [];
  let queried = false;
  s.users.findOne = (async (tenantId: string, tenantUserId: string) => {
    userLookups.push([tenantId, tenantUserId]);
    return tenantUserId === 'actor-1' ? user() : null;
  }) as any;
  s.tasks.findByFilters = (async () => { queried = true; return []; }) as any;
  const tool = new SearchTasksTool(s.tasks as any, s.users as any, s.projects as any);

  await assert.rejects(() => tool.execute(input({ assigneeTenantUserId: 'missing-user' })), ForbiddenException);
  assert.deepEqual(userLookups.at(-1), ['tenant-1', 'missing-user']);
  assert.equal(queried, false);
});

test('create_task returns clarification when the required project is missing', async () => {
  const s = services();
  let writes = 0;
  s.tasks.create = (async () => { writes += 1; return {}; }) as any;
  const tool = new CreateTaskTool(s.tasks as any, s.projects as any, s.users as any);

  const result = await tool.execute(input({ title: 'Sem projeto' }));

  assert.deepEqual(result, { needsClarification: true, field: 'projectName', matches: [] });
  assert.equal(writes, 0);
});

test('create_task clarifies duplicate assignee and status before writing', async () => {
  const s = services();
  let writes = 0;
  s.tasks.create = (async () => { writes += 1; return {}; }) as any;
  s.users.findAll = (async () => [
    { id: 'user-1', user: { name: 'Maria' } },
    { id: 'user-2', user: { name: 'Maria' } },
  ]) as any;
  s.tasks.getStatuses = (async () => [
    { id: 'status-1', name: 'Em andamento' },
    { id: 'status-2', name: 'Em andamento' },
  ]) as any;
  const tool = new CreateTaskTool(s.tasks as any, s.projects as any, s.users as any);

  const assigneeResult = await tool.execute(input({ title: 'Nova', projectId: 'project-1', assigneeName: 'Maria' }));
  assert.deepEqual(assigneeResult, {
    needsClarification: true,
    field: 'assigneeName',
    matches: [
      { id: 'user-1', name: 'Maria' },
      { id: 'user-2', name: 'Maria' },
    ],
  });
  assert.equal(writes, 0);

  const statusResult = await tool.execute(input({ title: 'Nova', projectId: 'project-1', statusName: 'Em andamento' }));
  assert.deepEqual(statusResult, {
    needsClarification: true,
    field: 'statusName',
    matches: [
      { id: 'status-1', name: 'Em andamento' },
      { id: 'status-2', name: 'Em andamento' },
    ],
  });
  assert.equal(writes, 0);
});

test('create_task rejects an unresolved collaborator instead of retaining an unknown ID', async () => {
  const s = services();
  s.users.findOne = (async () => null) as any;
  const tool = new CreateTaskTool(s.tasks as any, s.projects as any, s.users as any);

  await assert.rejects(() => tool.execute(input({ title: 'Nova', projectId: 'project-1', assigneeTenantUserId: 'missing-user' })), ForbiddenException);
});

test('task clarification matches carry shared ID and name descriptors', () => {
  const result = resolveReadOne([
    { id: 'project-1', name: 'Projeto' },
    { id: 'project-2', name: 'Projeto' },
  ], 'Projeto', 'projectName');
  assert.ok(clarification(result));
  const typedResult: AiToolClarification = result;

  assert.deepEqual(typedResult.matches, [
    { id: 'project-1', name: 'Projeto' },
    { id: 'project-2', name: 'Projeto' },
  ]);
});
