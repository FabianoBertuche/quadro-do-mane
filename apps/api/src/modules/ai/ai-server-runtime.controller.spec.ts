import assert from 'node:assert/strict';
import test from 'node:test';
import 'reflect-metadata';
import { BadRequestException, RequestMethod, ValidationPipe } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS_KEY } from '../../common/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';
import { AiServerRuntimeController } from './ai-server-runtime.controller';
import { SelectAiRuntimeModelDto } from './dto/select-ai-runtime-model.dto';

const user = {
  userId: 'user-1', email: 'person@example.com', tenantId: 'tenant-a', tenantUserId: 'tenant-user-1',
  roleId: 'colaborador', roleName: 'colaborador', permissions: ['ai.use'],
};

const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });

function bodyMetadata(handler: string) {
  return (Reflect.getMetadata('design:paramtypes', AiServerRuntimeController.prototype, handler) as unknown[])[1];
}

test('runtime controller requires an authenticated user with the ai.use permission', () => {
  const guards = Reflect.getMetadata(GUARDS_METADATA, AiServerRuntimeController) as Function[];
  assert.equal(guards.length, 3);
  assert.equal(guards.includes(TenantContextGuard), true);
  assert.equal(guards.includes(PermissionGuard), true);
  assert.deepEqual(Reflect.getMetadata(PERMISSIONS_KEY, AiServerRuntimeController), ['ai.use']);
});

test('the runtime is read at GET /api/ai/runtime and the model is chosen at POST /api/ai/runtime/model', () => {
  const prototype = AiServerRuntimeController.prototype;
  assert.equal(Reflect.getMetadata(PATH_METADATA, AiServerRuntimeController), 'ai/runtime');
  assert.equal(Reflect.getMetadata(METHOD_METADATA, prototype.getRuntime), RequestMethod.GET);
  assert.equal(Reflect.getMetadata(PATH_METADATA, prototype.getRuntime), '/');
  assert.equal(Reflect.getMetadata(METHOD_METADATA, prototype.selectModel), RequestMethod.POST);
  assert.equal(Reflect.getMetadata(PATH_METADATA, prototype.selectModel), 'model');
});

test('runtime view returns global metadata with the model catalog and no credential fields', async () => {
  const controller = new AiServerRuntimeController({
    getRuntime: async () => ({
      connectionStatus: 'connected', provider: 'chatgpt',
      selectedModel: { slug: 'gpt-5', displayName: 'GPT-5' },
      oauthConnectionId: 'connection-1', accessToken: 'secret-token',
    }),
    listModels: async () => [{ slug: 'gpt-5', displayName: 'GPT-5' }, { slug: 'gpt-4.1', displayName: 'GPT 4.1' }],
  } as any);

  const result = await controller.getRuntime();

  assert.deepEqual(result, {
    connectionStatus: 'connected', provider: 'chatgpt',
    selectedModel: { slug: 'gpt-5', displayName: 'GPT-5' },
    models: [{ slug: 'gpt-5', displayName: 'GPT-5' }, { slug: 'gpt-4.1', displayName: 'GPT 4.1' }],
  });
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes('secret-token'), false);
  assert.equal('accessToken' in result, false);
  assert.equal('oauthConnectionId' in result, false);
});

test('runtime view reports no selected model and an empty catalog while disconnected', async () => {
  const controller = new AiServerRuntimeController({
    getRuntime: async () => ({ connectionStatus: 'disconnected', provider: 'chatgpt', selectedModel: null }),
    listModels: async () => { throw new Error('Catálogo de modelos indisponível'); },
  } as any);

  const result = await controller.getRuntime();

  assert.deepEqual(result, { connectionStatus: 'disconnected', provider: 'chatgpt', selectedModel: null, models: [] });
});

test('selecting a model returns the updated runtime view and audits the authenticated actor', async () => {
  let selection: unknown[] = [];
  const controller = new AiServerRuntimeController({
    selectModel: async (...args: unknown[]) => {
      selection = args;
      return { connectionStatus: 'connected', provider: 'chatgpt', selectedModel: { slug: 'gpt-5', displayName: 'GPT-5' }, accessToken: 'secret-token' };
    },
    listModels: async () => [{ slug: 'gpt-5', displayName: 'GPT-5' }],
  } as any);

  const result = await controller.selectModel(user as any, { slug: 'gpt-5' });

  assert.deepEqual(selection, ['gpt-5', { tenantId: 'tenant-a', tenantUserId: 'tenant-user-1', userId: 'user-1' }]);
  assert.deepEqual(result, {
    connectionStatus: 'connected', provider: 'chatgpt',
    selectedModel: { slug: 'gpt-5', displayName: 'GPT-5' },
    models: [{ slug: 'gpt-5', displayName: 'GPT-5' }],
  });
  assert.equal(JSON.stringify(result).includes('secret-token'), false);
});

test('model selection rejects missing, non-string, and unknown payload fields before the service runs', async () => {
  let serviceCalls = 0;
  const metatype = bodyMetadata('selectModel');
  assert.equal(metatype, SelectAiRuntimeModelDto);
  const controller = new AiServerRuntimeController({
    selectModel: async () => { serviceCalls += 1; return { connectionStatus: 'connected', provider: 'chatgpt', selectedModel: null }; },
    listModels: async () => [],
  } as any);

  for (const payload of [{}, { slug: 42 }, { slug: '' }, { slug: 'gpt-5', displayName: 'GPT-5' }]) {
    await assert.rejects(
      async () => controller.selectModel(user as any, await pipe.transform(payload, { type: 'body', metatype })),
      { status: 400 },
    );
  }

  assert.equal(serviceCalls, 0);
});

test('model selection surfaces the safe recoverable error from the runtime service', async () => {
  const controller = new AiServerRuntimeController({
    selectModel: async () => { throw new BadRequestException('A conexão do ChatGPT foi alterada. Atualize a lista de modelos e tente novamente.'); },
    listModels: async () => [],
  } as any);

  await assert.rejects(
    async () => controller.selectModel(user as any, { slug: 'gpt-5' }),
    /conexão do ChatGPT foi alterada/,
  );
});