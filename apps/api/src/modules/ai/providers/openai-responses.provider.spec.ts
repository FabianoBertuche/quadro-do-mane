import assert from 'node:assert/strict';
import test from 'node:test';
import { OpenAiResponsesProvider } from './openai-responses.provider';

const input = {
  messages: [{ role: 'user' as const, content: 'planeje' }],
  tools: [{ name: 'create_task', description: 'Create a task', parameters: { type: 'object' } }],
};

const config = {
  get: (key: string, fallback?: string) => ({
    OPENAI_MODEL: 'test-model',
    OPENAI_API_KEY: 'api-key',
    AI_ENABLED: true,
  } as Record<string, any>)[key] ?? fallback,
};

function response(body: string, headers: Record<string, string> = {}) {
  return {
    ok: true,
    status: 200,
    headers: new Headers(headers),
    body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(body)); controller.close(); } }),
    text: async () => body,
  } as any;
}

test('posts a private Responses request with OAuth bearer auth and normalizes streamed text', async () => {
  let request: any;
  const provider = new OpenAiResponsesProvider(config as any, async (_url, init) => {
    request = { ...init, headers: Object.fromEntries(new Headers(init?.headers).entries()), body: JSON.parse(String(init?.body)) };
    return response('data: {"type":"response.output_text.delta","delta":"Olá"}\ndata: {"type":"response.output_text.delta","delta":"!"}\ndata: {"type":"response.completed","response":{"status":"completed"}}\n\ndata: [DONE]\n');
  });

  const result = await provider.complete(input, { accessToken: 'oauth-token', type: 'oauth' });

  assert.equal(request.headers.authorization, 'Bearer oauth-token');
  assert.equal(request.body.store, false);
  assert.equal(request.body.stream, true);
  assert.equal(request.body.model, 'test-model');
  assert.equal(request.body.tools[0].type, 'function');
  assert.deepEqual(result, { text: 'Olá!', toolCalls: [] });
});

test('normalizes streamed function-call arguments and completed output', async () => {
  const provider = new OpenAiResponsesProvider(config as any, async () => response([
    'data: {"type":"response.output_item.added","item":{"type":"function_call","id":"call-1","name":"create_task"}}',
    'data: {"type":"response.function_call_arguments.delta","item_id":"call-1","delta":"{\\"title\\":\\"Planejar\\"}"}',
    'data: {"type":"response.completed","response":{"status":"completed","output":[{"type":"function_call","call_id":"call-1","name":"create_task","arguments":"{\\"title\\":\\"Planejar\\"}"}]}}',
    '',
  ].join('\n')));

  const result = await provider.complete(input, { accessToken: 'oauth-token', type: 'oauth' });

  assert.deepEqual(result.toolCalls, [{ name: 'create_task', arguments: { title: 'Planejar' } }]);
});

test('refreshes OAuth once after a 401 and retries with the refreshed bearer token', async () => {
  const calls: string[] = [];
  const provider = new OpenAiResponsesProvider(config as any, async (_url, init) => {
    calls.push(new Headers(init?.headers).get('authorization') ?? '');
    if (calls.length === 1) return { ok: false, status: 401, headers: new Headers({ 'x-request-id': 'req-1' }), text: async () => '' } as any;
    return response('data: {"type":"response.completed","response":{"status":"completed"}}\n');
  });

  const result = await provider.complete(input, {
    accessToken: 'old-token', type: 'oauth',
    refresh: async () => ({ accessToken: 'new-token', type: 'oauth' }),
  });

  assert.deepEqual(result, { text: '', toolCalls: [] });
  assert.deepEqual(calls, ['Bearer old-token', 'Bearer new-token']);
});

test('uses API-key fallback only when explicitly configured and includes request id in safe errors', async () => {
  let authorization = '';
  const provider = new OpenAiResponsesProvider(config as any, async (_url, init) => {
    authorization = new Headers(init?.headers).get('authorization') ?? '';
    return { ok: false, status: 500, headers: new Headers({ 'x-request-id': 'req-safe' }), text: async () => 'secret provider payload' } as any;
  });

  await assert.rejects(() => provider.complete(input), (error: Error) => {
    assert.equal(error.message, 'AI provider request failed (request ID: req-safe)');
    assert.equal(authorization, 'Bearer api-key');
    assert.doesNotMatch(error.message, /secret/);
    return true;
  });
});

test('returns a safe incomplete-response error rather than pretending it completed', async () => {
  const provider = new OpenAiResponsesProvider(config as any, async () => response('data: {"type":"response.incomplete","response":{"status":"incomplete"}}\n'));

  await assert.rejects(() => provider.complete(input, { accessToken: 'oauth-token', type: 'oauth' }), /AI response incomplete/);
});

test('sanitizes transport failures', async () => {
  const provider = new OpenAiResponsesProvider(config as any, async () => { throw new Error('socket secret'); });

  await assert.rejects(() => provider.complete(input, { accessToken: 'oauth-token', type: 'oauth' }), (error: Error) => {
    assert.equal(error.message, 'AI provider request failed');
    assert.doesNotMatch(error.message, /socket|secret/);
    return true;
  });
});
