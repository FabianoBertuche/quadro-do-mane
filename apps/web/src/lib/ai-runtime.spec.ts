import assert from 'node:assert/strict';
import { test } from 'node:test';
import { api } from './api';
import {
  getAiRuntime,
  getAiRuntimeErrorMessage,
  selectAiRuntimeModel,
} from './ai-runtime';

test('parses only redacted runtime metadata and preserves server model order', async () => {
  const originalGet = api.get;
  api.get = (async (url: string) => {
    assert.equal(url, '/ai/runtime');
    return {
      data: {
        connectionStatus: 'connected',
        provider: 'chatgpt',
        selectedModel: { slug: 'gpt-4.1', displayName: 'GPT-4.1', accessToken: 'secret' },
        models: [
          { slug: 'gpt-4.1', displayName: 'GPT-4.1', token: 'secret' },
          { slug: 'gpt-4o', displayName: 'GPT-4o' },
        ],
        accessToken: 'secret',
      },
    };
  }) as typeof api.get;

  try {
    assert.deepEqual(await getAiRuntime(), {
      connectionStatus: 'connected',
      provider: 'chatgpt',
      selectedModel: { slug: 'gpt-4.1', displayName: 'GPT-4.1' },
      models: [
        { slug: 'gpt-4.1', displayName: 'GPT-4.1' },
        { slug: 'gpt-4o', displayName: 'GPT-4o' },
      ],
    });
  } finally {
    api.get = originalGet;
  }
});

test('selects a runtime model with only the slug and parses the redacted response', async () => {
  const originalPost = api.post;
  api.post = (async (url: string, payload?: unknown) => {
    assert.equal(url, '/ai/runtime/model');
    assert.deepEqual(payload, { slug: 'gpt-4o' });
    return {
      data: {
        connectionStatus: 'connected',
        provider: 'chatgpt',
        selectedModel: { slug: 'gpt-4o', displayName: 'GPT-4o' },
        models: [{ slug: 'gpt-4o', displayName: 'GPT-4o' }],
      },
    };
  }) as typeof api.post;

  try {
    assert.deepEqual(await selectAiRuntimeModel('gpt-4o'), {
      connectionStatus: 'connected',
      provider: 'chatgpt',
      selectedModel: { slug: 'gpt-4o', displayName: 'GPT-4o' },
      models: [{ slug: 'gpt-4o', displayName: 'GPT-4o' }],
    });
  } finally {
    api.post = originalPost;
  }
});

test('returns a useful disconnected runtime when the model catalog is unavailable', async () => {
  const originalGet = api.get;
  api.get = (async () => ({
    data: {
      connectionStatus: 'disconnected',
      provider: 'chatgpt',
      selectedModel: null,
      models: [],
    },
  })) as typeof api.get;

  try {
    assert.deepEqual(await getAiRuntime(), {
      connectionStatus: 'disconnected',
      provider: 'chatgpt',
      selectedModel: null,
      models: [],
    });
  } finally {
    api.get = originalGet;
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
