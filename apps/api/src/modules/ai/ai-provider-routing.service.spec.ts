import assert from 'node:assert/strict';
import test from 'node:test';
import { AiProviderRoutingService } from './ai-provider-routing.service';

const chatgptInstance = { name: 'chatgpt-instance' } as any;

function runtimeView(primaryProvider: 'chatgpt' | 'ollama', failoverProvider: 'chatgpt' | 'ollama' | null) {
  return {
    primaryProvider, failoverProvider,
    providers: {
      chatgpt: { connectionStatus: 'connected', selectedModel: { slug: 'gpt-5', displayName: 'GPT-5' } },
      ollama: { connectionStatus: 'connected', selectedModel: { slug: 'gpt-oss:20b', displayName: 'GPT-OSS 20B' } },
    },
  };
}

function service(options: {
  primary?: 'chatgpt' | 'ollama'; failover?: 'chatgpt' | 'ollama' | null;
  ollamaKey?: string | null; oauthAuth?: any; oauthCalls?: number;
}) {
  const oauthCalls: number[] = [];
  return new AiProviderRoutingService(
    { getRuntime: async () => runtimeView(options.primary ?? 'chatgpt', options.failover ?? null), getOllamaApiKey: async () => options.ollamaKey ?? null } as any,
    { resolveProviderAuth: async () => { oauthCalls.push(1); return options.oauthAuth; } } as any,
    chatgptInstance,
    (apiKey: string) => ({ ollamaFactoryKey: apiKey }) as any,
  );
}

test('orders primary then failover executions', async () => {
  const routing = service({ primary: 'chatgpt', failover: 'ollama', ollamaKey: 'sk-ollama', oauthAuth: { type: 'oauth', accessToken: 'token' } });
  const executions = await routing.resolveExecutions();
  assert.deepEqual(executions.map((execution) => execution.provider), ['chatgpt', 'ollama']);
  assert.equal(executions[0].model, 'gpt-5');
  assert.equal(executions[1].model, 'gpt-oss:20b');
  assert.deepEqual((executions[1].providerInstance as any).ollamaFactoryKey, 'sk-ollama');
});

test('skips an unconfigured primary and keeps the configured failover', async () => {
  const routing = service({ primary: 'chatgpt', failover: 'ollama', ollamaKey: 'sk-ollama', oauthAuth: undefined });
  const executions = await routing.resolveExecutions();
  assert.deepEqual(executions.map((execution) => execution.provider), ['ollama']);
});

test('skips the ollama failover when no key is saved', async () => {
  const routing = service({ primary: 'chatgpt', failover: 'ollama', ollamaKey: null, oauthAuth: { type: 'oauth', accessToken: 'token' } });
  const executions = await routing.resolveExecutions();
  assert.deepEqual(executions.map((execution) => execution.provider), ['chatgpt']);
});

test('returns no executions when the only configured provider is unavailable', async () => {
  const routing = service({ primary: 'chatgpt', failover: null, ollamaKey: null, oauthAuth: undefined });
  assert.deepEqual(await routing.resolveExecutions(), []);
});