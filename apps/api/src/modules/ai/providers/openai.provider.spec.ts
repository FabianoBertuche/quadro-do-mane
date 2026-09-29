import assert from 'node:assert/strict';
import test from 'node:test';
import { OpenAiProvider } from './openai.provider';

const config = {
  get: (key: string, fallback?: string) =>
    ({ OPENAI_MODEL: 'test-model', OPENAI_API_KEY: 'test-key' } as Record<string, string>)[key] ?? fallback,
};

test('OpenAI adapter maps text and valid tool calls to the stable result', async () => {
  const client = {
    chat: {
      completions: {
        create: async () => ({
          choices: [{
            message: {
              content: 'Resposta do modelo',
              tool_calls: [{
                type: 'function',
                function: { name: 'create_task', arguments: '{"title":"Planejar"}' },
              }],
            },
          }],
        }),
      },
    },
  };
  const provider = new OpenAiProvider(config as any, () => client as any);

  const result = await provider.complete({
    messages: [{ role: 'user', content: 'planeje' }],
    tools: [{ name: 'create_task', description: 'Create a task', parameters: {} }],
  });

  assert.deepEqual(result, {
    text: 'Resposta do modelo',
    toolCalls: [{ name: 'create_task', arguments: { title: 'Planejar' } }],
  });
});

test('OpenAI adapter rejects malformed tool arguments without exposing provider details', async () => {
  const provider = new OpenAiProvider(config as any, () => ({
    chat: { completions: { create: async () => ({
      choices: [{ message: { content: null, tool_calls: [{ function: { name: 'danger', arguments: 'not-json' } }] } }],
    }) } },
  }) as any);

  await assert.rejects(
    () => provider.complete({ messages: [{ role: 'user', content: 'x' }] }),
    (error: Error) => {
      assert.equal(error.message, 'AI provider returned invalid tool arguments');
      assert.doesNotMatch(error.message, /test-key|not-json/);
      return true;
    },
  );
});

test('OpenAI adapter sanitizes provider failures', async () => {
  const provider = new OpenAiProvider(config as any, () => ({
    chat: { completions: { create: async () => { throw new Error('test-key raw provider failure'); } } },
  }) as any);

  await assert.rejects(
    () => provider.complete({ messages: [{ role: 'user', content: 'x' }] }),
    (error: Error) => {
      assert.equal(error.message, 'AI provider request failed');
      assert.doesNotMatch(error.message, /test-key|raw provider/);
      return true;
    },
  );
});
