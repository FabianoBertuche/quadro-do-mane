import assert from 'node:assert/strict';
import { test } from 'node:test';
import { api } from './api';
import { getAiRuntime, selectAiProviderModel, setAiPrimaryProvider, setAiFailoverProvider, getAiRuntimeErrorMessage } from './ai-runtime';

const redactedAssets = {
  primaryProvider: 'chatgpt' as const,
  failoverProvider: 'ollama' as const,
  providers: {
    chatgpt: {
      connectionStatus: 'connected' as const,
      selectedModel: { slug: 'gpt-4.1', displayName: 'GPT-4.1', accessToken: 'secret' },
      models: [{ slug: 'gpt-4.1', displayName: 'GPT-4.1', token: 'secret' }],
    },
    ollama: {
      connectionStatus: 'disconnected' as const,
      selectedModel: null,
      models: [{ slug: 'gpt-oss:20b', displayName: 'GPT-OSS 20B', apiKey: 'sk-x' }],
    },
  },
  accessToken: 'secret',
};

test('parses only redacted per-provider runtime metadata', async () => {
  const originalGet = api.get;
  api.get = (async (url: string) => {
    assert.equal(url, '/ai/runtime');
    return { data: redactedAssets };
  }) as typeof api.get;

  try {
    assert.deepEqual(await getAiRuntime(), {
      primaryProvider: 'chatgpt',
      failoverProvider: 'ollama',
      providers: {
        chatgpt: {
          connectionStatus: 'connected',
          selectedModel: { slug: 'gpt-4.1', displayName: 'GPT-4.1' },
          models: [{ slug: 'gpt-4.1', displayName: 'GPT-4.1' }],
        },
        ollama: {
          connectionStatus: 'disconnected',
          selectedModel: null,
          models: [{ slug: 'gpt-oss:20b', displayName: 'GPT-OSS 20B' }],
        },
      },
    });
  } finally {
    api.get = originalGet;
  }
});

test('selects a model per provider and calls the provider-driven primary/failover setters', async () => {
  const originalPost = api.post;
  const calls: Array<{ url: string; payload?: unknown }> = [];
  api.post = (async (url: string, payload?: unknown) => {
    calls.push({ url, payload });
    return { data: redactedAssets };
  }) as typeof api.post;

  try {
    await selectAiProviderModel('ollama', 'gpt-oss:20b');
    await setAiPrimaryProvider('ollama');
    await setAiFailoverProvider(null);
    assert.deepEqual(calls, [
      { url: '/ai/runtime/model', payload: { provider: 'ollama', slug: 'gpt-oss:20b' } },
      { url: '/ai/runtime/primary', payload: { provider: 'ollama' } },
      { url: '/ai/runtime/failover', payload: { provider: null } },
    ]);
  } finally {
    api.post = originalPost;
  }
});

test('maps runtime failures to safe user-facing messages', () => {
  assert.equal(
    getAiRuntimeErrorMessage({ response: { data: { code: 'AI_RUNTIME_CATALOG_UNAVAILABLE' } } }),
    'O catálogo de modelos está indisponível no momento. Você ainda pode consultar o histórico do chat.',
  );
  assert.equal(
    getAiRuntimeErrorMessage(new Error('network')),
    'Não foi possível carregar o runtime de IA. Você ainda pode consultar o histórico do chat.',
  );
});