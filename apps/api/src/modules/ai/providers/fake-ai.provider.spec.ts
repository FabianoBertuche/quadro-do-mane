import assert from 'node:assert/strict';
import test from 'node:test';
import { FakeAiProvider } from './fake-ai.provider';

test('fake provider returns deterministic text and tool calls', async () => {
  const provider = new FakeAiProvider();

  const result = await provider.complete({
    messages: [{ role: 'user', content: 'crie uma tarefa' }],
    tools: [{ name: 'create_task', description: 'Create a task', parameters: {} }],
  });

  assert.deepEqual(result, {
    text: 'Resposta simulada do assistente.',
    toolCalls: [
      {
        name: 'create_task',
        arguments: { title: 'Tarefa simulada' },
      },
    ],
  });
});
