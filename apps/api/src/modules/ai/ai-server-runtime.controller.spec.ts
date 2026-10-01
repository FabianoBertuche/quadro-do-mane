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
  roleId: 'colaborador', roleName: 'colaborador', permissions: ['settings.edit'],
};

// As opções são copiadas de `apps/api/src/main.ts` (o `useGlobalPipes` de
// produção). Divergir aqui faz o spec mentir: com `enableImplicitConversion`
// ligado, `{ provider: 'chatgpt', slug: 42 }` chega no serviço como `'42'`.
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

function bodyMetadata(handler: string): typeof SelectAiRuntimeModelDto {
  return (Reflect.getMetadata('design:paramtypes', AiServerRuntimeController.prototype, handler) as unknown[])[1] as typeof SelectAiRuntimeModelDto;
}

/** Troca o logger do controller por um gravador para provar o que foi registrado. */
function captureLogs(controller: AiServerRuntimeController): string[] {
  const lines: string[] = [];
  (controller as unknown as { logger: { error: (message: string) => void } }).logger = {
    error: (message: string) => { lines.push(message); },
  };
  return lines;
}

const emptyView = {
  primaryProvider: 'chatgpt', failoverProvider: null,
  providers: {
    chatgpt: { connectionStatus: 'disconnected', selectedModel: null },
    ollama: { connectionStatus: 'disconnected', selectedModel: null },
  },
};

test('runtime controller requires an authenticated user with the settings.edit permission', () => {
  const guards = Reflect.getMetadata(GUARDS_METADATA, AiServerRuntimeController) as Function[];
  assert.equal(guards.length, 3);
  assert.equal(guards.includes(TenantContextGuard), true);
  assert.equal(guards.includes(PermissionGuard), true);
  assert.deepEqual(Reflect.getMetadata(PERMISSIONS_KEY, AiServerRuntimeController), ['settings.edit']);
});

test('the runtime is read at GET /api/ai/runtime and routes exist for model, primary and failover', () => {
  const prototype = AiServerRuntimeController.prototype;
  assert.equal(Reflect.getMetadata(PATH_METADATA, AiServerRuntimeController), 'ai/runtime');
  assert.equal(Reflect.getMetadata(METHOD_METADATA, prototype.getRuntime), RequestMethod.GET);
  assert.equal(Reflect.getMetadata(PATH_METADATA, prototype.getRuntime), '/');
  assert.equal(Reflect.getMetadata(METHOD_METADATA, prototype.selectModel), RequestMethod.POST);
  assert.equal(Reflect.getMetadata(PATH_METADATA, prototype.selectModel), 'model');
  assert.equal(Reflect.getMetadata(METHOD_METADATA, prototype.setPrimary), RequestMethod.POST);
  assert.equal(Reflect.getMetadata(PATH_METADATA, prototype.setPrimary), 'primary');
  assert.equal(Reflect.getMetadata(METHOD_METADATA, prototype.setFailover), RequestMethod.POST);
  assert.equal(Reflect.getMetadata(PATH_METADATA, prototype.setFailover), 'failover');
});

test('runtime view returns per-provider state and catalogs without credential fields', async () => {
  const controller = new AiServerRuntimeController({
    getRuntime: async () => ({
      primaryProvider: 'chatgpt', failoverProvider: 'ollama',
      providers: {
        chatgpt: { connectionStatus: 'connected', selectedModel: { slug: 'gpt-5', displayName: 'GPT-5' }, accessToken: 'secret-token', oauthConnectionId: 'connection-1' },
        ollama: { connectionStatus: 'connected', selectedModel: { slug: 'gpt-oss:20b', displayName: 'GPT-OSS 20B' }, apiKey: 'sk-secret' },
      },
    }),
    listModels: async (provider: any) => provider === 'ollama'
      ? [{ slug: 'gpt-oss:20b', displayName: 'GPT-OSS 20B' }]
      : [{ slug: 'gpt-5', displayName: 'GPT-5' }],
  } as any);

  const result = await controller.getRuntime();

  assert.deepEqual(result, {
    primaryProvider: 'chatgpt', failoverProvider: 'ollama',
    providers: {
      chatgpt: { connectionStatus: 'connected', selectedModel: { slug: 'gpt-5', displayName: 'GPT-5' }, models: [{ slug: 'gpt-5', displayName: 'GPT-5' }] },
      ollama: { connectionStatus: 'connected', selectedModel: { slug: 'gpt-oss:20b', displayName: 'GPT-OSS 20B' }, models: [{ slug: 'gpt-oss:20b', displayName: 'GPT-OSS 20B' }] },
    },
  });
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes('secret-token'), false);
  assert.equal(serialized.includes('sk-secret'), false);
  assert.equal(serialized.includes('accessToken'), false);
  assert.equal(serialized.includes('apiKey'), false);
});

test('runtime view degrades to empty catalogs and logs the safe error name while the catalog is unavailable', async () => {
  const controller = new AiServerRuntimeController({
    getRuntime: async () => emptyView,
    listModels: async () => { throw new BadRequestException('Catálogo de modelos indisponível (accessToken=sk-live-123)'); },
  } as any);
  const logs = captureLogs(controller);

  const result = await controller.getRuntime();

  assert.deepEqual(result, {
    ...emptyView,
    providers: {
      chatgpt: { connectionStatus: 'disconnected', selectedModel: null, models: [] },
      ollama: { connectionStatus: 'disconnected', selectedModel: null, models: [] },
    },
  });
  assert.equal(logs.length, 2);
  for (const line of logs) {
    assert.equal(line.includes('BadRequestException'), true);
    assert.equal(line.includes('sk-live-123'), false);
  }
});

test('an unexpected catalog failure propagates for the 500 filter instead of degrading to an empty catalog', async () => {
  const outage = new TypeError('aiServerRuntime.upsert falhou: ENOTFOUND banco-interno');
  const controller = new AiServerRuntimeController({
    getRuntime: async () => emptyView,
    listModels: async () => { throw outage; },
  } as any);
  const logs = captureLogs(controller);

  await assert.rejects(async () => controller.getRuntime(), (error: unknown) => error === outage);
  assert.deepEqual(logs, []);
});

test('primary, failover, and model endpoints wire the runtime service with the authenticated actor', async () => {
  const calls: string[] = [];
  const controller = new AiServerRuntimeController({
    getRuntime: async () => emptyView,
    listModels: async () => [],
    setPrimaryProvider: async (...args: unknown[]) => { calls.push(`primary:${args[0]}`); return controller.getRuntime(); },
    setFailoverProvider: async (...args: unknown[]) => { calls.push(`failover:${args[0]}`); return controller.getRuntime(); },
    selectModel: async (...args: unknown[]) => { calls.push(`model:${args[0]}:${args[1]}`); return controller.getRuntime(); },
  } as any);

  await controller.setPrimary(user as any, { provider: 'ollama' });
  await controller.setFailover(user as any, { provider: 'chatgpt' });
  await controller.selectModel(user as any, { provider: 'ollama', slug: 'gpt-oss:20b' });

  assert.deepEqual(calls.sort(), ['failover:chatgpt', 'model:ollama:gpt-oss:20b', 'primary:ollama']);
});

test('selecting a model returns the updated runtime view and audits the authenticated actor', async () => {
  let selection: unknown[] = [];
  const controller = new AiServerRuntimeController({
    selectModel: async (...args: unknown[]) => {
      selection = args;
      return {
        primaryProvider: 'chatgpt', failoverProvider: null,
        providers: {
          chatgpt: { connectionStatus: 'connected', selectedModel: { slug: 'gpt-5', displayName: 'GPT-5' } },
          ollama: { connectionStatus: 'disconnected', selectedModel: null },
        },
      };
    },
    listModels: async () => [{ slug: 'gpt-5', displayName: 'GPT-5' }],
  } as any);

  const result = await controller.selectModel(user as any, { provider: 'chatgpt', slug: 'gpt-5' });

  assert.deepEqual(selection, ['chatgpt', 'gpt-5', { tenantId: 'tenant-a', tenantUserId: 'tenant-user-1', userId: 'user-1' }]);
  assert.deepEqual(result, {
    primaryProvider: 'chatgpt', failoverProvider: null,
    providers: {
      chatgpt: { connectionStatus: 'connected', selectedModel: { slug: 'gpt-5', displayName: 'GPT-5' }, models: [{ slug: 'gpt-5', displayName: 'GPT-5' }] },
      ollama: { connectionStatus: 'disconnected', selectedModel: null, models: [{ slug: 'gpt-5', displayName: 'GPT-5' }] },
    },
  });
  assert.equal(JSON.stringify(result).includes('secret-token'), false);
});

test('a catalog slug passes the production pipe unchanged', async () => {
  let selection: unknown[] = [];
  const metatype = bodyMetadata('selectModel');
  assert.equal(metatype, SelectAiRuntimeModelDto);
  const controller = new AiServerRuntimeController({
    selectModel: async (...args: unknown[]) => { selection = args; return emptyView; },
    listModels: async () => [],
  } as any);

  const dto = await pipe.transform({ provider: 'chatgpt', slug: 'gpt-4.1' }, { type: 'body', metatype });
  assert.ok(dto instanceof SelectAiRuntimeModelDto);
  await controller.selectModel(user as any, dto);

  assert.equal(selection[0], 'chatgpt');
  assert.equal(selection[1], 'gpt-4.1');
});

test('the production pipe coerces primitive model slugs before the service validates catalog membership', async () => {
  const serviceCalls: string[] = [];
  const metatype = bodyMetadata('selectModel');
  const controller = new AiServerRuntimeController({
     selectModel: async (provider: string, slug: string) => { serviceCalls.push(`${provider}-${slug}`); return emptyView; },
    listModels: async () => [],
  } as any);

  for (const payload of [{ provider: 'chatgpt', slug: 42 }, { provider: 'chatgpt', slug: true }]) {
    const dto = await pipe.transform(payload, { type: 'body', metatype });
    await controller.selectModel(user as any, dto);
  }

  assert.deepEqual(serviceCalls, ['chatgpt-42', 'chatgpt-true']);

  for (const payload of [{ slug: null }]) {
    await assert.rejects(
      async () => pipe.transform(payload, { type: 'body', metatype }),
      { status: 400 },
      `esperava 400 para ${JSON.stringify(payload)}`,
    );
  }
});

test('model selection rejects missing, blank, and unknown payload fields before the service runs', async () => {
  let serviceCalls = 0;
  const metatype = bodyMetadata('selectModel');
  const controller = new AiServerRuntimeController({
    selectModel: async () => { serviceCalls += 1; return emptyView; },
    listModels: async () => [],
  } as any);

  for (const payload of [{}, { provider: 'chatgpt' }, { provider: 'chatgpt', slug: '' }, { provider: 'chatgpt', slug: '   ' }, { slug: 'x' }, { provider: 'chatgpt', slug: 'gpt-5', displayName: 'GPT-5' }]) {
    await assert.rejects(
      async () => controller.selectModel(user as any, await pipe.transform(payload, { type: 'body', metatype })),
      { status: 400 },
      `esperava 400 para ${JSON.stringify(payload)}`,
    );
  }

  assert.equal(serviceCalls, 0);
});

test('model selection rejects a slug longer than 200 characters and accepts one at the limit', async () => {
  let serviceCalls = 0;
  const metatype = bodyMetadata('selectModel');
  const controller = new AiServerRuntimeController({
    selectModel: async () => { serviceCalls += 1; return emptyView; },
    listModels: async () => [],
  } as any);

  await assert.rejects(
    async () => controller.selectModel(user as any, await pipe.transform({ provider: 'chatgpt', slug: 'g'.repeat(201) }, { type: 'body', metatype })),
    { status: 400 },
  );
  assert.equal(serviceCalls, 0);

  const atLimit = 'g'.repeat(200);
  const dto = await pipe.transform({ provider: 'chatgpt', slug: atLimit }, { type: 'body', metatype });
  assert.equal((dto as SelectAiRuntimeModelDto).slug, atLimit);
});

test('model selection surfaces the safe recoverable error from the runtime service', async () => {
  const controller = new AiServerRuntimeController({
    selectModel: async () => { throw new BadRequestException('A conexão do ChatGPT foi alterada. Atualize a lista de modelos e tente novamente.'); },
    listModels: async () => [],
  } as any);

  await assert.rejects(
    async () => controller.selectModel(user as any, { provider: 'chatgpt', slug: 'gpt-5' }),
    /conexão do ChatGPT foi alterada/,
  );
});