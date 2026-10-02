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
                id: 'call-chat',
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
    toolCalls: [{ id: 'call-chat', name: 'create_task', arguments: { title: 'Planejar' } }],
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

test('formats a multi-call Chat Completions continuation with assistant calls and tool_call_id results', async () => {
  let request: any;
  const provider = new OpenAiProvider(config as any, () => ({
    chat: { completions: { create: async (input: any) => {
      request = input;
      return { choices: [{ message: { content: 'final', tool_calls: [] } }] };
    } } },
  }) as any);
  const firstInput = { messages: [{ role: 'user' as const, content: 'consulte os projetos' }] };
  const completion = {
    text: '',
    toolCalls: [
      { id: 'call-projects', name: 'search_projects', arguments: { search: 'A' } },
      { id: 'call-users', name: 'search_users', arguments: { search: 'B' } },
    ],
  };
  const continuation = (provider as any).buildToolContinuation(firstInput, completion, [
    { call: completion.toolCalls[0], result: [{ id: 'project-1', name: 'Projeto A' }] },
    { call: completion.toolCalls[1], result: [{ id: 'user-1', name: 'Pessoa B' }] },
  ]);

  await provider.complete(continuation);
  assert.deepEqual(request.messages, [
    { role: 'user', content: 'consulte os projetos' },
    {
      role: 'assistant', content: null, tool_calls: [
        { id: 'call-projects', type: 'function', function: { name: 'search_projects', arguments: '{"search":"A"}' } },
        { id: 'call-users', type: 'function', function: { name: 'search_users', arguments: '{"search":"B"}' } },
      ],
    },
    { role: 'tool', tool_call_id: 'call-projects', content: '[{"id":"project-1","name":"Projeto A"}]' },
    { role: 'tool', tool_call_id: 'call-users', content: '[{"id":"user-1","name":"Pessoa B"}]' },
  ]);
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
