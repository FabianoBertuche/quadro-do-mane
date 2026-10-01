import assert from 'node:assert/strict';
import test from 'node:test';
import { AiServerRuntimeService } from './ai-server-runtime.service';

function runtime(connection: any = null, chatgptModelSlug: string | null = null, chatgptModelDisplayName: string | null = null) {
  return {
    id: 'global', oauthConnectionId: connection?.id ?? null, chatgptModelSlug, chatgptModelDisplayName,
    primaryProvider: 'chatgpt', failoverProvider: null,
    ollamaModelSlug: null, ollamaModelDisplayName: null,
    ollamaApiKeyCiphertext: null, ollamaApiKeyIv: null, ollamaApiKeyAuthTag: null,
    oauthConnection: connection,
  };
}

function providerRuntime(overrides: Record<string, unknown> = {}) {
  return {
    id: 'global',
    oauthConnectionId: null,
    oauthConnection: null,
    primaryProvider: 'chatgpt',
    failoverProvider: null,
    chatgptModelSlug: null,
    chatgptModelDisplayName: null,
    ollamaModelSlug: null,
    ollamaModelDisplayName: null,
    ollamaApiKeyCiphertext: null,
    ollamaApiKeyIv: null,
    ollamaApiKeyAuthTag: null,
    ...overrides,
  };
}

function createPrisma(initial: any) {
  let row = initial;
  return {
    get row() { return row; },
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
    assert.deepEqual(await service.listModels('chatgpt'), [
      { slug: 'gpt-5', displayName: 'GPT-5' },
      { slug: 'gpt-4.1', displayName: 'GPT 4.1' },
    ]);
    assert.equal(authorization, 'Bearer secret-token');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('parses the live ChatGPT model catalog envelope', async () => {
  const previousFetch = globalThis.fetch;
  const oauthConnection = { id: 'connection-1', updatedAt: new Date('2026-01-01T00:00:00.000Z') };
  globalThis.fetch = (async () => ({
    ok: true,
    json: async () => ({ models: [
      { slug: 'gpt-6-astra', display_name: 'GPT-6-Astra', visibility: 'list' },
      { slug: 'gpt-hidden', display_name: 'Hidden', visibility: 'hidden' },
    ] }),
  }) as any) as any;

  try {
    const service = new AiServerRuntimeService(createPrisma(runtime(oauthConnection)) as any, {
      resolveProviderAuth: async () => ({ accessToken: 'oauth-token', connectionId: 'connection-1', connectionUpdatedAt: oauthConnection.updatedAt.toISOString() }),
    } as any);

    assert.deepEqual(await service.listModels('chatgpt'), [{ slug: 'gpt-6-astra', displayName: 'GPT-6-Astra' }]);
  } finally {
    globalThis.fetch = previousFetch;
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
    await service.listModels('chatgpt');
    await service.listModels('chatgpt');
    await prisma.aiServerRuntime.update({ data: { oauthConnectionId: 'second', oauthConnection: { id: 'second' } } });
    assert.deepEqual(await service.listModels('chatgpt'), [{ slug: 'gpt-2', displayName: 'GPT 2' }]);
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
    await service.listModels('chatgpt');
    connection.updatedAt = new Date('2030-01-02T00:00:00.000Z');
    assert.deepEqual(await service.listModels('chatgpt'), [{ slug: 'gpt-2', displayName: 'GPT 2' }]);
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
    await assert.rejects(() => service.selectModel('chatgpt', 'unknown'), /Modelo selecionado não está disponível/);
    const unavailable = new AiServerRuntimeService(createPrisma(runtime()) as any, {
      resolveProviderAuth: async () => undefined,
    } as any);
    await assert.rejects(() => unavailable.selectModel('chatgpt', 'gpt-5'), /Catálogo de modelos indisponível/);
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
    await assert.rejects(() => service.selectModel('chatgpt', 'model-from-a'), /conexão.*alterada/i);
    assert.deepEqual(await service.getRuntime(), {
      primaryProvider: 'chatgpt',
      failoverProvider: null,
      providers: {
        chatgpt: { connectionStatus: 'connected', selectedModel: null },
        ollama: { connectionStatus: 'disconnected', selectedModel: null },
      },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('selects a model after provider auth updates last-used metadata for the same connection', async () => {
  const connection = { id: 'connection-a', updatedAt: new Date('2030-01-01T00:00:00.000Z') };
  const prisma = createPrisma(runtime(connection));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => ({ ok: true, json: async () => ({ data: [{ slug: 'model-a', display_name: 'Model A', visibility: 'list' }] }) }) as any) as any;
  try {
    const service = new AiServerRuntimeService(prisma as any, {
      resolveProviderAuth: async () => {
        connection.updatedAt = new Date('2030-01-01T00:01:00.000Z');
        return { type: 'oauth', accessToken: 'secret-token' };
      },
    } as any);
    assert.deepEqual(await service.selectModel('chatgpt', 'model-a'), {
      primaryProvider: 'chatgpt',
      failoverProvider: null,
      providers: {
        chatgpt: { connectionStatus: 'connected', selectedModel: { slug: 'model-a', displayName: 'Model A' } },
        ollama: { connectionStatus: 'disconnected', selectedModel: null },
      },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejects catalog selection when the runtime switches after auth resolves but before reload', async () => {
  const prisma = createPrisma(runtime({ id: 'connection-a', updatedAt: new Date('2030-01-01T00:01:00.000Z') }));
  const originalFetch = globalThis.fetch;
  let catalogRequests = 0;
  globalThis.fetch = (async () => { catalogRequests += 1; return { ok: true, json: async () => ({ data: [] }) } as any; }) as any;
  try {
    const service = new AiServerRuntimeService(prisma as any, {
      resolveProviderAuth: async () => {
        await prisma.aiServerRuntime.update({ data: {
          oauthConnectionId: 'connection-b',
          oauthConnection: { id: 'connection-b', updatedAt: new Date('2030-01-01T00:02:00.000Z') },
        } });
        return { type: 'oauth', accessToken: 'token-a', connectionId: 'connection-a', connectionUpdatedAt: '2030-01-01T00:01:00.000Z' };
      },
    } as any);
    await assert.rejects(() => service.selectModel('chatgpt', 'model-a'), /conexão.*alterada/i);
    assert.equal(catalogRequests, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejects and discards a catalog when the runtime connection switches while the catalog request is in flight', async () => {
  const prisma = createPrisma(runtime({ id: 'connection-a', updatedAt: new Date('2030-01-01T00:00:00.000Z') }));
  let resolved = { id: 'connection-a', updatedAt: '2030-01-01T00:00:00.000Z' };
  let catalogRequests = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    catalogRequests += 1;
    if (catalogRequests === 1) {
      resolved = { id: 'connection-b', updatedAt: '2030-01-02T00:00:00.000Z' };
      await prisma.aiServerRuntime.update({ data: {
        oauthConnectionId: 'connection-b',
        oauthConnection: { id: 'connection-b', updatedAt: new Date('2030-01-02T00:00:00.000Z') },
      } });
      return { ok: true, json: async () => ({ data: [{ slug: 'model-from-a', display_name: 'Model from A', visibility: 'list' }] }) } as any;
    }
    return { ok: true, json: async () => ({ data: [{ slug: 'model-from-b', display_name: 'Model from B', visibility: 'list' }] }) } as any;
  }) as any;
  try {
    const service = new AiServerRuntimeService(prisma as any, {
      resolveProviderAuth: async () => ({
        type: 'oauth', accessToken: `token-${resolved.id}`, connectionId: resolved.id, connectionUpdatedAt: resolved.updatedAt,
      }),
    } as any);
    await assert.rejects(() => service.listModels('chatgpt'), /conexão.*alterada/i);
    assert.equal(catalogRequests, 1);
    assert.deepEqual(await service.listModels('chatgpt'), [{ slug: 'model-from-b', displayName: 'Model from B' }]);
    assert.deepEqual(await service.listModels('chatgpt'), [{ slug: 'model-from-b', displayName: 'Model from B' }]);
    assert.equal(catalogRequests, 2);
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
    primaryProvider: 'chatgpt',
    failoverProvider: null,
    providers: {
      chatgpt: { connectionStatus: 'connected', selectedModel: { slug: 'gpt-5', displayName: 'GPT-5' } },
      ollama: { connectionStatus: 'disconnected', selectedModel: null },
    },
  });
  assert.equal(resolveCalls, 0);
  assert.doesNotMatch(JSON.stringify(await service.getRuntime()), /secret-token/);
});

test('getRuntime returns primary/failover and per-provider connection and model state', async () => {
  const service = new AiServerRuntimeService(createPrisma(providerRuntime({
    oauthConnectionId: 'conn-1', oauthConnection: { id: 'conn-1' },
    chatgptModelSlug: 'gpt-5', chatgptModelDisplayName: 'GPT-5',
    primaryProvider: 'chatgpt', failoverProvider: 'ollama',
    ollamaApiKeyCiphertext: 'deadbeef',
    ollamaModelSlug: 'gpt-oss:20b', ollamaModelDisplayName: 'GPT-OSS 20B',
  })) as any, { resolveProviderAuth: async () => undefined } as any);

  assert.deepEqual(await service.getRuntime(), {
    primaryProvider: 'chatgpt',
    failoverProvider: 'ollama',
    providers: {
      chatgpt: { connectionStatus: 'connected', selectedModel: { slug: 'gpt-5', displayName: 'GPT-5' } },
      ollama: { connectionStatus: 'connected', selectedModel: { slug: 'gpt-oss:20b', displayName: 'GPT-OSS 20B' } },
    },
  });
});

test('listModels returns the fixed cloud catalog for ollama without any fetch', async () => {
  let fetched = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => { fetched += 1; throw new Error('unexpected'); }) as any;
  try {
    const service = new AiServerRuntimeService(createPrisma(providerRuntime()) as any, {} as any);
    const models = await service.listModels('ollama');
    assert.deepEqual(models.map((model) => model.slug), ['gemma4:31b', 'gpt-oss:120b', 'gpt-oss:20b', 'nemotron-3-nano:30b', 'nemotron-3-super', 'nemotron-3-ultra']);
    assert.equal(fetched, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('selecting an ollama model persists to the ollama columns', async () => {
  const prisma = createPrisma(providerRuntime());
  const service = new AiServerRuntimeService(prisma as any, {} as any);
  const view = await service.selectModel('ollama', 'gpt-oss:120b');
  assert.equal(view.providers.ollama.selectedModel?.slug, 'gpt-oss:120b');
  assert.equal((prisma as any).row.ollamaModelSlug, 'gpt-oss:120b');
  assert.equal((prisma as any).row.chatgptModelSlug, null);
});

test('setting the primary provider validates membership and writes the column', async () => {
  const prisma = createPrisma(providerRuntime());
  const service = new AiServerRuntimeService(prisma as any, {} as any);
  await assert.rejects(() => service.setPrimaryProvider('anthropic' as any), /ChatGPT|Ollama|Provedor/);
  await service.setPrimaryProvider('ollama');
  assert.equal((prisma as any).row.primaryProvider, 'ollama');
});

test('setFailoverProvider rejects the same provider as primary and accepts null', async () => {
  const prisma = createPrisma(providerRuntime({ primaryProvider: 'chatgpt', failoverProvider: 'ollama' }));
  const service = new AiServerRuntimeService(prisma as any, {} as any);
  await assert.rejects(() => service.setFailoverProvider('chatgpt'), /substituto/);
  await service.setFailoverProvider(null);
  assert.equal((prisma as any).row.failoverProvider, null);
});

test('saveOllamaKey encrypts and persists the tripled key without leaking plaintext', async () => {
  let encrypted: any;
  const prisma = createPrisma(providerRuntime());
  const service = new AiServerRuntimeService(prisma as any, {} as any, undefined, {
    encrypt: (plaintext: string) => { encrypted = plaintext; return { ciphertext: 'aabb', iv: 'cc', authTag: 'dd' }; },
  } as any);
  await service.saveOllamaKey('sk-secret-ollama');
  assert.equal(encrypted, 'sk-secret-ollama');
  const row = (prisma as any).row;
  assert.equal(row.ollamaApiKeyCiphertext, 'aabb');
  assert.equal(row.ollamaApiKeyIv, 'cc');
  assert.equal(row.ollamaApiKeyAuthTag, 'dd');
});

test('getOllamaApiKey decrypts the stored key and returns null when absent', async () => {
  const prisma = createPrisma(providerRuntime({ ollamaApiKeyCiphertext: 'aabb', ollamaApiKeyIv: 'cc', ollamaApiKeyAuthTag: 'dd' }));
  const service = new AiServerRuntimeService(prisma as any, {} as any, undefined, {
    decrypt: ({ ciphertext, iv, authTag }: any) => `plain-${ciphertext}-${iv}-${authTag}`,
  } as any);
  assert.equal(await service.getOllamaApiKey(), 'plain-aabb-cc-dd');
  const empty = new AiServerRuntimeService(createPrisma(providerRuntime()) as any, {} as any);
  assert.equal(await empty.getOllamaApiKey(), null);
});

test('removeOllamaKey clears the three key columns', async () => {
  const prisma = createPrisma(providerRuntime({ ollamaApiKeyCiphertext: 'aabb', ollamaApiKeyIv: 'cc', ollamaApiKeyAuthTag: 'dd' }));
  const service = new AiServerRuntimeService(prisma as any, {} as any);
  await service.removeOllamaKey();
  assert.equal((prisma as any).row.ollamaApiKeyCiphertext, null);
  assert.equal((prisma as any).row.ollamaApiKeyAuthTag, null);
});
