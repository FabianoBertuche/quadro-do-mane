import assert from 'node:assert/strict';
import test from 'node:test';
import { AiServerRuntimeService } from './ai-server-runtime.service';

function runtime(connection: any = null, selectedModelSlug: string | null = null, selectedModelDisplayName: string | null = null) {
  return {
    id: 'global', oauthConnectionId: connection?.id ?? null, selectedModelSlug, selectedModelDisplayName,
    oauthConnection: connection,
  };
}

function createPrisma(initial: any) {
  let row = initial;
  return {
    aiServerRuntime: {
      upsert: async ({ create, update }: any) => {
        row = { ...row ?? create, ...update };
        return row;
      },
      update: async ({ data }: any) => {
        row = { ...row, ...data };
        return row;
      },
    },
  };
}

test('lists only displayable models in OpenAI order using the global OAuth bearer token', async () => {
  const prisma = createPrisma(runtime({ id: 'global-connection' }));
  let authorization = '';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: any) => {
    assert.equal(url, 'https://api.openai.com/v1/models');
    authorization = init.headers.authorization;
    return { ok: true, json: async () => ({ data: [
      { slug: 'gpt-hidden', display_name: 'Hidden', visibility: 'hidden' },
      { slug: 'gpt-5', display_name: 'GPT-5', visibility: 'list' },
      { slug: 'gpt-4.1', display_name: 'GPT 4.1', visibility: 'list' },
    ] }) } as any;
  }) as any;
  try {
    const service = new AiServerRuntimeService(prisma as any, {
      resolveProviderAuth: async () => ({ type: 'oauth', accessToken: 'secret-token' }),
    } as any);
    assert.deepEqual(await service.listModels(), [
      { slug: 'gpt-5', displayName: 'GPT-5' },
      { slug: 'gpt-4.1', displayName: 'GPT 4.1' },
    ]);
    assert.equal(authorization, 'Bearer secret-token');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('invalidates a catalog cache when the global connection changes', async () => {
  const prisma = createPrisma(runtime({ id: 'first' }));
  let calls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => ({ ok: true, json: async () => ({ data: [{ slug: `gpt-${++calls}`, display_name: `GPT ${calls}`, visibility: 'list' }] }) }) as any) as any;
  try {
    const service = new AiServerRuntimeService(prisma as any, {
      resolveProviderAuth: async () => ({ type: 'oauth', accessToken: 'secret-token' }),
    } as any);
    await service.listModels();
    await service.listModels();
    await prisma.aiServerRuntime.update({ data: { oauthConnectionId: 'second', oauthConnection: { id: 'second' } } });
    assert.deepEqual(await service.listModels(), [{ slug: 'gpt-2', displayName: 'GPT 2' }]);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('invalidates a catalog cache when the same global connection is updated', async () => {
  const connection = { id: 'global-connection', updatedAt: new Date('2030-01-01T00:00:00.000Z') };
  const prisma = createPrisma(runtime(connection));
  let calls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => ({ ok: true, json: async () => ({ data: [{ slug: `gpt-${++calls}`, display_name: `GPT ${calls}`, visibility: 'list' }] }) }) as any) as any;
  try {
    const service = new AiServerRuntimeService(prisma as any, {
      resolveProviderAuth: async () => ({ type: 'oauth', accessToken: 'secret-token' }),
    } as any);
    await service.listModels();
    connection.updatedAt = new Date('2030-01-02T00:00:00.000Z');
    assert.deepEqual(await service.listModels(), [{ slug: 'gpt-2', displayName: 'GPT 2' }]);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejects selection when the global catalog is unavailable or does not contain the submitted slug', async () => {
  const prisma = createPrisma(runtime({ id: 'global-connection' }));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => ({ ok: true, json: async () => ({ data: [{ slug: 'gpt-5', display_name: 'GPT-5', visibility: 'list' }] }) }) as any) as any;
  try {
    const service = new AiServerRuntimeService(prisma as any, {
      resolveProviderAuth: async () => ({ type: 'oauth', accessToken: 'secret-token' }),
    } as any);
    await assert.rejects(() => service.selectModel('unknown'), /Modelo selecionado não está disponível/);
    const unavailable = new AiServerRuntimeService(createPrisma(runtime()) as any, {
      resolveProviderAuth: async () => undefined,
    } as any);
    await assert.rejects(() => unavailable.selectModel('gpt-5'), /Catálogo de modelos indisponível/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejects model selection when the global connection changes after catalog fetch', async () => {
  const prisma = createPrisma(runtime({ id: 'connection-a', updatedAt: new Date('2030-01-01T00:00:00.000Z') }));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    await prisma.aiServerRuntime.update({ data: {
      oauthConnectionId: 'connection-b',
      oauthConnection: { id: 'connection-b', updatedAt: new Date('2030-01-02T00:00:00.000Z') },
    } });
    return { ok: true, json: async () => ({ data: [{ slug: 'model-from-a', display_name: 'Model from A', visibility: 'list' }] }) } as any;
  }) as any;
  try {
    const service = new AiServerRuntimeService(prisma as any, {
      resolveProviderAuth: async () => ({ type: 'oauth', accessToken: 'secret-token' }),
    } as any);
    await assert.rejects(() => service.selectModel('model-from-a'), /conexão.*alterada/i);
    assert.deepEqual(await service.getRuntime(), {
      connectionStatus: 'connected', provider: 'chatgpt', selectedModel: null,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('returns redacted global runtime metadata', async () => {
  const prisma = createPrisma(runtime({ id: 'global-connection' }, 'gpt-5', 'GPT-5'));
  let resolveCalls = 0;
  const service = new AiServerRuntimeService(prisma as any, {
    resolveProviderAuth: async () => {
      resolveCalls += 1;
      return { type: 'oauth', accessToken: 'secret-token', refresh: async () => ({ type: 'oauth', accessToken: 'new-secret' }) };
    },
  } as any);

  assert.deepEqual(await service.getRuntime(), {
    connectionStatus: 'connected', provider: 'chatgpt', selectedModel: { slug: 'gpt-5', displayName: 'GPT-5' },
  });
  assert.equal(resolveCalls, 0);
  assert.doesNotMatch(JSON.stringify(await service.getRuntime()), /secret-token/);
});
