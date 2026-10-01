import assert from 'node:assert/strict';
import test from 'node:test';
import { AiContextService } from './ai-context.service';

test('buildContext scopes project and task reads to the tenant and actor visibility', async () => {
  const calls: Array<{ model: string; args: any }> = [];
  const prisma = {
    project: {
      findFirst: async (args: any) => {
        calls.push({ model: 'project', args });
        return { id: 'project-1', name: 'Visible project', description: 'Context' };
      },
    },
    task: {
      findMany: async (args: any) => {
        calls.push({ model: 'task', args });
        return [{ id: 'task-1', title: 'Visible task', projectId: 'project-1' }];
      },
    },
  };

  const context = await new AiContextService(prisma as any).buildContext({
    tenantId: 'tenant-a',
    actorTenantUserId: 'user-a',
    projectId: 'project-1',
    query: 'status da tarefa',
  });

  assert.equal(context.project?.id, 'project-1');
  assert.equal(context.items[0].id, 'task-1');
  assert.equal(calls[0].args.where.tenantId, 'tenant-a');
  assert.equal(calls[0].args.where.id, 'project-1');
  assert.equal(calls[0].args.where.OR[0].ownerTenantUserId, 'user-a');
  assert.equal(calls[1].args.where.tenantId, 'tenant-a');
  assert.equal(calls[1].args.where.projectId, undefined);
});

test('buildContext returns an explicit no-access result without leaking records', async () => {
  const prisma = {
    project: { findFirst: async () => null },
    task: { findMany: async () => [{ id: 'must-not-leak' }] },
  };

  const context = await new AiContextService(prisma as any).buildContext({
    tenantId: 'tenant-a',
    actorTenantUserId: 'user-a',
    projectId: 'foreign-project',
    query: 'anything',
  });

  assert.equal(context.project, null);
  assert.deepEqual(context.items, []);
  assert.match(context.summary, /acesso|resultado/i);
});

test('buildContext includes bounded essential task details for the provider', async () => {
  const prisma = {
    project: { findFirst: async () => ({ id: 'project-1', name: 'Projeto', description: 'Descrição' }) },
    task: { findMany: async () => [{
      id: 'task-1', title: 'Entrega', description: 'Detalhes', projectId: 'project-1', statusId: 'status-1', dueDate: new Date('2026-10-01'),
      status: { name: 'Em andamento' }, assignee: { user: { name: 'Maria' } }, project: { name: 'Projeto' },
    }] },
  };
  const context = await new AiContextService(prisma as any).buildContext({ tenantId: 'tenant-a', actorTenantUserId: 'user-a', projectId: 'project-1', query: '' });
  assert.match(context.summary, /Entrega/);
  assert.match(context.summary, /2026-10-01/);
  assert.match(context.summary, /Maria/);
  assert.match(context.summary, /Em andamento/);
});
