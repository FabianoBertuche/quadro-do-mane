import assert from 'node:assert/strict';
import test from 'node:test';
import { OpenAiResponsesProvider } from './openai-responses.provider';

const input = {
  messages: [{ role: 'user' as const, content: 'planeje' }],
  tools: [{ name: 'create_task', description: 'Create a task', parameters: { type: 'object' } }],
};

const runtimeInput = { ...input, model: 'gpt-5-codex' };

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
    return response('data: {"type":"response.output_text.delta","delta":"Olá"}\n\ndata: {"type":"response.output_text.delta","delta":"!"}\n\ndata: {"type":"response.completed","response":{"status":"completed"}}\n\ndata: [DONE]\n');
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
  ].join('\n\n')));

  const result = await provider.complete(input, { accessToken: 'oauth-token', type: 'oauth' });

  assert.deepEqual(result.toolCalls, [{ id: 'call-1', name: 'create_task', arguments: { title: 'Planejar' } }]);
});

test('formats a multi-call Responses continuation with preserved call ids and function outputs', async () => {
  let request: any;
  const provider = new OpenAiResponsesProvider(config as any, async (_url, init) => {
    request = JSON.parse(String(init?.body));
    return response('data: {"type":"response.completed","response":{"status":"completed"}}\n');
  });
  const firstInput = { ...input, messages: [{ role: 'user' as const, content: 'consulte os projetos' }] };
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

  await provider.complete(continuation, { accessToken: 'oauth-token', type: 'oauth' });
  assert.deepEqual(request.input, [
    { role: 'user', content: 'consulte os projetos' },
    { type: 'function_call', call_id: 'call-projects', name: 'search_projects', arguments: '{"search":"A"}' },
    { type: 'function_call', call_id: 'call-users', name: 'search_users', arguments: '{"search":"B"}' },
    { type: 'function_call_output', call_id: 'call-projects', output: '[{"id":"project-1","name":"Projeto A"}]' },
    { type: 'function_call_output', call_id: 'call-users', output: '[{"id":"user-1","name":"Pessoa B"}]' },
  ]);
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

test('preserves provider status, error code, and request id as non-user-facing metadata', async () => {
  const provider = new OpenAiResponsesProvider(config as any, async () => ({
    ok: false,
    status: 429,
    headers: new Headers({ 'x-request-id': 'req-audit' }),
    text: async () => JSON.stringify({ error: { code: 'rate_limit_exceeded', message: 'secret payload' } }),
  } as any));

  await assert.rejects(() => provider.complete(input, { accessToken: 'oauth-token', type: 'oauth' }), (error: any) => {
    assert.equal(error.message, 'AI provider request failed (request ID: req-audit)');
    assert.deepEqual(error.metadata, { status: 429, code: 'rate_limit_exceeded', requestId: 'req-audit' });
    assert.doesNotMatch(error.message, /secret|rate_limit/);
    return true;
  });
});

test('joins multiline SSE data fields into one event payload', async () => {
  const provider = new OpenAiResponsesProvider(config as any, async () => response([
    'data: {"type":"response.output_text.delta",',
    'data: "delta":"joined"}',
    '',
    'data: {"type":"response.completed","response":{"status":"completed"}}',
    '',
  ].join('\n')));

  const result = await provider.complete(input, { accessToken: 'oauth-token', type: 'oauth' });
  assert.equal(result.text, 'joined');
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

test('exposes normalized events through an async-iterable streaming path', async () => {
  const provider = new OpenAiResponsesProvider(config as any, async () => response([
    'data: {"type":"response.output_text.delta","delta":"Olá"}',
    'data: {"type":"response.completed","response":{"status":"completed"}}',
    '',
  ].join('\n\n')));
  const events: any[] = [];

  for await (const event of provider.stream(input, { accessToken: 'oauth-token', type: 'oauth' })) events.push(event);

  assert.deepEqual(events, [
    { type: 'text.delta', delta: 'Olá' },
    { type: 'completed' },
  ]);
});

test('rejects an interrupted stream without a terminal response event', async () => {
  const provider = new OpenAiResponsesProvider(config as any, async () => response('data: {"type":"response.output_text.delta","delta":"partial"}\n'));

  await assert.rejects(() => provider.complete(input, { accessToken: 'oauth-token', type: 'oauth' }), /AI response incomplete/);
});

test('merges function-call argument deltas with the arguments.done event', async () => {
  const provider = new OpenAiResponsesProvider(config as any, async () => response([
    'data: {"type":"response.output_item.added","item":{"type":"function_call","id":"call-2","name":"create_task"}}',
    'data: {"type":"response.function_call_arguments.delta","item_id":"call-2","delta":"{\\"title\\":"}',
    'data: {"type":"response.function_call_arguments.done","item_id":"call-2","arguments":"{\\"title\\":\\"Done\\"}"}',
    'data: {"type":"response.completed","response":{"status":"completed"}}',
    '',
  ].join('\n\n')));

  const result = await provider.complete(input, { accessToken: 'oauth-token', type: 'oauth' });

  assert.deepEqual(result.toolCalls, [{ id: 'call-2', name: 'create_task', arguments: { title: 'Done' } }]);
});

test('does not retry a second OAuth 401', async () => {
  let calls = 0;
  const provider = new OpenAiResponsesProvider(config as any, async () => {
    calls += 1;
    return { ok: false, status: 401, headers: new Headers({ 'x-request-id': 'second-401' }), text: async () => '' } as any;
  });

  await assert.rejects(() => provider.complete(input, {
    accessToken: 'old-token', type: 'oauth', refresh: async () => ({ accessToken: 'new-token', type: 'oauth' }),
  }), /request ID: second-401/);
  assert.equal(calls, 2);
});

test('refreshes OAuth once before yielding streaming events after a 401', async () => {
  const authorizations: string[] = [];
  const provider = new OpenAiResponsesProvider(config as any, async (_url, init) => {
    authorizations.push(new Headers(init?.headers).get('authorization') ?? '');
    if (authorizations.length === 1) return { ok: false, status: 401, headers: new Headers({ 'x-request-id': 'stream-401' }), text: async () => '' } as any;
    return response('data: {"type":"response.output_text.delta","delta":"retried"}\n\ndata: {"type":"response.completed","response":{"status":"completed"}}\n');
  });

  const events: any[] = [];
  for await (const event of provider.stream(input, {
    accessToken: 'old-token', type: 'oauth',
    refresh: async () => ({ accessToken: 'new-token', type: 'oauth' }),
  })) events.push(event);

  assert.deepEqual(authorizations, ['Bearer old-token', 'Bearer new-token']);
  assert.deepEqual(events, [{ type: 'text.delta', delta: 'retried' }, { type: 'completed' }]);
});

test('does not retry streaming requests for non-401 statuses', async () => {
  let calls = 0;
  const provider = new OpenAiResponsesProvider(config as any, async () => {
    calls += 1;
    return { ok: false, status: 500, headers: new Headers({ 'x-request-id': 'stream-500' }), text: async () => '' } as any;
  });

  await assert.rejects(() => (async () => {
    for await (const _event of provider.stream(input, {
      accessToken: 'old-token', type: 'oauth', refresh: async () => ({ accessToken: 'new-token', type: 'oauth' }),
    })) { /* expected to fail before yielding */ }
  })(), /request ID: stream-500/);
  assert.equal(calls, 1);
});

test('does not use an API-key fallback when AI is disabled', async () => {
  const disabledConfig = { get: (key: string, fallback?: string) => ({
    OPENAI_MODEL: 'test-model', OPENAI_API_KEY: 'api-key', AI_ENABLED: false,
  } as Record<string, any>)[key] ?? fallback };
  const provider = new OpenAiResponsesProvider(disabledConfig as any, async () => response(''));

  await assert.rejects(() => provider.complete(input), /AI provider is not configured/);
});

test('sends the globally selected runtime model instead of the configured default model', async () => {
  let request: any;
  const provider = new OpenAiResponsesProvider(config as any, async (_url, init) => {
    request = JSON.parse(String(init?.body));
    return response('data: {"type":"response.completed","response":{"status":"completed"}}\n');
  });

  await provider.complete(runtimeInput, { accessToken: 'oauth-token', type: 'oauth' });

  assert.equal(request.model, 'gpt-5-codex');
  assert.doesNotMatch(JSON.stringify(request), /test-model/);
});

test('sends the globally selected runtime model for streaming requests too', async () => {
  let request: any;
  const provider = new OpenAiResponsesProvider(config as any, async (_url, init) => {
    request = JSON.parse(String(init?.body));
    return response('data: {"type":"response.output_text.delta","delta":"ok"}\n\ndata: {"type":"response.completed","response":{"status":"completed"}}\n');
  });

  const events: any[] = [];
  for await (const event of provider.stream(runtimeInput, { accessToken: 'oauth-token', type: 'oauth' })) events.push(event);

  assert.equal(request.model, 'gpt-5-codex');
  assert.equal(request.store, false);
  assert.deepEqual(events, [{ type: 'text.delta', delta: 'ok' }, { type: 'completed' }]);
});

test('falls back to the configured model when no runtime model is supplied', async () => {
  let request: any;
  const provider = new OpenAiResponsesProvider(config as any, async (_url, init) => {
    request = JSON.parse(String(init?.body));
    return response('data: {"type":"response.completed","response":{"status":"completed"}}\n');
  });

  await provider.complete({ ...input, model: '   ' }, { accessToken: 'oauth-token', type: 'oauth' });

  assert.equal(request.model, 'test-model');
});

test('serves OAuth completions while the API-key fallback is disabled', async () => {
  let authorization = '';
  const disabledConfig = { get: (key: string, fallback?: string) => ({
    OPENAI_MODEL: 'test-model', OPENAI_API_KEY: 'api-key', AI_ENABLED: false,
  } as Record<string, any>)[key] ?? fallback };
  const provider = new OpenAiResponsesProvider(disabledConfig as any, async (_url, init) => {
    authorization = new Headers(init?.headers).get('authorization') ?? '';
    return response('data: {"type":"response.output_text.delta","delta":"oauth"}\n\ndata: {"type":"response.completed","response":{"status":"completed"}}\n');
  });

  const result = await provider.complete(runtimeInput, { accessToken: 'oauth-token', type: 'oauth' });

  assert.equal(authorization, 'Bearer oauth-token');
  assert.equal(result.text, 'oauth');
});

test('returns a recoverable error when no OAuth connection and no API key are configured', async () => {
  const unconfigured = { get: (key: string, fallback?: string) => ({
    OPENAI_MODEL: 'test-model', AI_ENABLED: true,
  } as Record<string, any>)[key] ?? fallback };
  let requests = 0;
  const provider = new OpenAiResponsesProvider(unconfigured as any, async () => { requests += 1; return response(''); });

  await assert.rejects(() => provider.complete(input), (error: any) => {
    assert.equal(error.message, 'AI provider is not configured');
    assert.equal(error.getStatus(), 503);
    return true;
  });
  assert.equal(requests, 0);
});

test('returns a recoverable error when AI is disabled and no OAuth connection exists', async () => {
  const disabledConfig = { get: (key: string, fallback?: string) => ({
    OPENAI_MODEL: 'test-model', OPENAI_API_KEY: 'api-key', AI_ENABLED: false,
  } as Record<string, any>)[key] ?? fallback };
  let requests = 0;
  const provider = new OpenAiResponsesProvider(disabledConfig as any, async () => { requests += 1; return response(''); });

  await assert.rejects(() => provider.complete(input), (error: any) => {
    assert.equal(error.getStatus(), 503);
    return true;
  });
  assert.equal(requests, 0);
});
