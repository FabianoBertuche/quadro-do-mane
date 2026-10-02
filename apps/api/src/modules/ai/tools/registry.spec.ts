import assert from 'node:assert/strict';
import test from 'node:test';
import { AiToolRegistryService } from './ai-tool-registry.service';
import { PermissionCode } from './permission-codes';

const actor = { tenantId: 'tenant-1', tenantUserId: 'user-1' };

const tool = (name: string, permission: PermissionCode, readOnly = false) => ({
  name,
  permission,
  readOnly,
  parameters: { type: 'object' },
  authorize: async () => undefined,
  execute: async () => ({}),
}) as any;

const registryFor = (allowed: PermissionCode[], isAdmin = false) => {
  const permissions = {
    can: async (_input: typeof actor, permission: PermissionCode) => isAdmin || allowed.includes(permission),
    codesFor: async () => allowed,
  } as any;
  return new AiToolRegistryService([
    tool('search_tasks', 'tasks.view', true),
    tool('create_task', 'tasks.create'),
    tool('delete_task', 'tasks.delete'),
  ], permissions);
};

test('admin enxerga todas as tools', async () => {
  const visible = await registryFor([], true).listVisible(actor);
  assert.deepEqual(visible.map((entry) => entry.name).sort(), ['create_task', 'delete_task', 'search_tasks']);
});

test('colaborador não enxerga tool sem a permissão exigida', async () => {
  const visible = await registryFor(['tasks.view', 'tasks.create']).listVisible(actor);
  assert.deepEqual(visible.map((entry) => entry.name).sort(), ['create_task', 'search_tasks']);
});

test('convidado recebe apenas leitura', async () => {
  const visible = await registryFor(['tasks.view']).listVisible(actor);
  assert.deepEqual(visible.map((entry) => entry.name), ['search_tasks']);
});

test('tool sem permissão declarada fica sempre visível', async () => {
  const permissions = { can: async () => false, codesFor: async () => [] } as any;
  const registry = new AiToolRegistryService([{
    name: 'sem_permissao',
    parameters: { type: 'object' },
    authorize: async () => undefined,
    execute: async () => ({}),
  } as any], permissions);

  assert.deepEqual((await registry.listVisible(actor)).map((entry) => entry.name), ['sem_permissao']);
});
