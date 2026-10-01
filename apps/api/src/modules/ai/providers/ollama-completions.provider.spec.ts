import assert from 'node:assert/strict';
import test from 'node:test';
import { OllamaCompletionsProvider, OLLAMA_BASE_URL } from './ollama-completions.provider';
import { OLLAMA_CLOUD_MODELS } from './ollama-models';

test('catalog exports the fixed 6 cloud models in spec order', () => {
  assert.deepEqual(OLLAMA_CLOUD_MODELS.map((model) => model.slug), [
    'gemma4:31b', 'gpt-oss:120b', 'gpt-oss:20b', 'nemotron-3-nano:30b', 'nemotron-3-super', 'nemotron-3-ultra',
  ]);
  assert.equal(OLLAMA_BASE_URL, 'https://ollama.com/v1');
});

test('builds a chat-completions request with the input model, tools, and message roles', async () => {
  let body: any;
  const client = { chat: { completions: { create: async (input: any) => {
    body = input;
    return { choices: [{ message: { content: 'ok', tool_calls: [] } }] };
  } } } };
  const provider = new OllamaCompletionsProvider('sk-ollama', () => client as any);

  const result = await provider.complete({
    model: 'gpt-oss:20b',
    messages: [
      { role: 'system', content: 'you are helpful' },
      { role: 'user', content: 'hi' },
    ],
    tools: [{ name: 'search', description: 'searches', parameters: { type: 'object' } }],
  });

  assert.equal(body.model, 'gpt-oss:20b');
  assert.deepEqual(body.messages, [
    { role: 'system', content: 'you are helpful' },
    { role: 'user', content: 'hi' },
  ]);
  assert.deepEqual(body.tools, [{ type: 'function', function: { name: 'search', description: 'searches', parameters: { type: 'object' } } }]);
  assert.deepEqual(result, { text: 'ok', toolCalls: [] });
});

test('parses tool calls and builds the chat-completions continuation', async () => {
  const client = { chat: { completions: { create: async () => ({ choices: [{ message: {
    content: '', tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'search', arguments: '{"q":"x"}' } }],
  } }] }) } } };
  const provider = new OllamaCompletionsProvider('sk-ollama', () => client as any);

  const completion = await provider.complete({ messages: [{ role: 'user', content: 'hi' }] });
  assert.deepEqual(completion.toolCalls, [{ id: 'call-1', name: 'search', arguments: { q: 'x' } }]);

  const continuation = provider.buildToolContinuation!({ messages: [{ role: 'user', content: 'hi' }] }, completion, [
    { call: completion.toolCalls[0], result: { count: 1 } },
  ]);
  assert.deepEqual(continuation.messages, [
    { role: 'user', content: 'hi' },
    { role: 'assistant', content: null, toolCalls: completion.toolCalls },
    { role: 'tool', toolCallId: 'call-1', content: JSON.stringify({ count: 1 }) },
  ]);
});

test('surfaces only the safe message when the provider request fails', async () => {
  const client = { chat: { completions: { create: async () => { throw new Error('upstream exploded'); } } } };
  const provider = new OllamaCompletionsProvider('sk-ollama', () => client as any);
  await assert.rejects(
    () => provider.complete({ messages: [{ role: 'user', content: 'hi' }] }),
    /AI provider request failed/,
  );
});