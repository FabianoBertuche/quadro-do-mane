import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { AiOAuthController } from './ai-oauth.controller';
import { AiOAuthService } from './ai-oauth.service';
import { codeChallenge } from './ai-oauth.protocol';
import { AiServerRuntimeService } from './ai-server-runtime.service';
import { AiService } from './ai.service';
import { AiContextService } from './ai-context.service';
import { AiAuditService } from './ai-audit.service';
import { AiToolRegistryService } from './tools/ai-tool-registry.service';
import { AiProviderError } from './ports/ai-provider.port';
import { OpenAiResponsesProvider } from './providers/openai-responses.provider';
import { AiTool } from './tools/ai-tool.port';
import { SearchProjectsTool } from './tools/search-projects.tool';

const actor = { tenantId: 'tenant-a', tenantUserId: 'user-a' };

test('uses the callback-issued dynamic client ID to complete ChatGPT OAuth and resolve an OpenAI token', async () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const attempts = new Map<string, any>();
  const connections = new Map<string, any>();
  const runtimeRow: any = { id: 'global', oauthConnectionId: null, selectedModelSlug: null, selectedModelDisplayName: null };
  const runtimeView = () => ({
    ...runtimeRow,
    oauthConnection: runtimeRow.oauthConnectionId ? connections.get(runtimeRow.oauthConnectionId) ?? null : null,
  });
  const calls: Array<{ url: string; authorization?: string }> = [];
  const tokenRequests: Array<{ url: string; body: URLSearchParams }> = [];
  const encryption = {
    encrypt: (value: string) => ({ ciphertext: `encrypted:${value}`, iv: 'iv', authTag: 'tag' }),
    decrypt: ({ ciphertext }: { ciphertext: string }) => ciphertext.slice('encrypted:'.length),
  };
  const prisma = {
    aiOAuthAttempt: {
      create: async ({ data }: any) => {
        const attempt = { ...data, id: `attempt-${attempts.size + 1}`, consumedAt: null };
        attempts.set(attempt.id, attempt);
        return attempt;
      },
      findFirst: async ({ where }: any) => [...attempts.values()].find((attempt) =>
        attempt.tenantId === where.tenantId && attempt.tenantUserId === where.tenantUserId &&
        attempt.stateHash === where.stateHash && attempt.consumedAt === null && attempt.expiresAt > where.expiresAt.gt),
      updateMany: async ({ where, data }: any) => {
        const attempt = attempts.get(where.id);
        if (!attempt || attempt.consumedAt !== null) return { count: 0 };
        Object.assign(attempt, data);
        return { count: 1 };
      },
    },
    aiServerRuntime: {
      upsert: async ({ create }: any) => { Object.assign(runtimeRow, create); return runtimeView(); },
      findUnique: async () => runtimeView(),
      update: async ({ data }: any) => { Object.assign(runtimeRow, data); return runtimeView(); },
    },
    aiOAuthConnection: {
      findFirst: async ({ where }: any) => {
        const connection = where.id === undefined ? undefined : connections.get(where.id);
        if (!connection) return null;
        if (where.isRevoked !== undefined && connection.isRevoked !== where.isRevoked) return null;
        if (where.refreshLeaseToken !== undefined && connection.refreshLeaseToken !== where.refreshLeaseToken) return null;
        return connection;
      },
      create: async ({ data }: any) => {
        const connection = { ...data, id: 'connection-1', isRevoked: false, lastUsedAt: null };
        connections.set(connection.id, connection);
        return connection;
      },
      update: async ({ where, data }: any) => {
        const connection = connections.get(where.id);
        if (!connection) throw new Error('OAuth connection not found');
        Object.assign(connection, data);
        return connection;
      },
      updateMany: async ({ where, data }: any) => {
        const connection = connections.get(where.id);
        if (!connection || (where.isRevoked !== undefined && connection.isRevoked !== where.isRevoked)) return { count: 0 };
        Object.assign(connection, data);
        return { count: 1 };
      },
    },
  };
  const config = {
    get: (key: string) => ({
      CHATGPT_OAUTH_ISSUER: 'https://auth.example',
      CHATGPT_OAUTH_AUTHORIZATION_ENDPOINT: 'https://auth.example/authorize',
      CHATGPT_OAUTH_CALLBACK_PORT: 1455,
      CHATGPT_OAUTH_HOST_ID: 'test-host',
      CHATGPT_OAUTH_AGENT_NAME: 'Monte Moria Test',
    } as Record<string, any>)[key],
  };
  const service = new AiOAuthService(prisma as any, encryption as any, config as any);
  const controller = new AiOAuthController(service, prisma as any);
  const originalFetch = globalThis.fetch;
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test-key' })).toString('base64url');

  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, authorization: new Headers(init?.headers).get('authorization') ?? undefined });
    if (url.endsWith('/.well-known/openid-configuration')) {
      return new Response(JSON.stringify({ token_endpoint: 'https://auth.example/token', jwks_uri: 'https://auth.example/jwks' }), { status: 200 });
    }
    if (url.endsWith('/jwks')) {
      return new Response(JSON.stringify({ keys: [{ kid: 'test-key', ...publicKey.export({ format: 'jwk' }) }] }), { status: 200 });
    }
    if (url !== 'https://auth.example/token') throw new Error(`unexpected mocked OAuth endpoint: ${url}`);
    const body = new URLSearchParams(String(init?.body));
    tokenRequests.push({ url, body });
    assert.equal(body.get('code'), 'auth-code');
    const nonceAttempt = [...attempts.values()].find((attempt) => attempt.pkceVerifierCiphertext === `encrypted:${body.get('code_verifier')}`);
    const nonce = nonceAttempt?.nonceCiphertext.slice('encrypted:'.length);
    const payload = Buffer.from(JSON.stringify({
      iss: 'https://auth.example', aud: 'oaiapp_callback-issued-client', sub: 'openai-subject', nonce,
      email: 'person@example.com', name: 'Person', exp: Math.floor(Date.now() / 1000) + 3600,
    })).toString('base64url');
    const signed = `${header}.${payload}`;
    const idToken = `${signed}.${crypto.sign('RSA-SHA256', Buffer.from(signed), privateKey).toString('base64url')}`;
    return new Response(JSON.stringify({ access_token: 'oauth-access', refresh_token: 'oauth-refresh', id_token: idToken, scope: 'openid offline_access chatgpt.tokens.use.direct', expires_in: 3600 }), { status: 200 });
  }) as typeof fetch;

  try {
    const started = await controller.start(actor as any);
    const authorization = new URL(started.authorizationUrl);
    const attempt = attempts.get(started.attemptId);
    const verifier = attempt.pkceVerifierCiphertext.slice('encrypted:'.length);
    assert.equal(authorization.searchParams.get('agent_name_hint'), 'Monte Moria Test');
    assert.equal(authorization.searchParams.get('resource'), 'https://api.openai.com/v1');
    assert.equal(authorization.searchParams.get('redirect_uri'), attempt.redirectUri);
    assert.deepEqual(authorization.searchParams.get('scope')?.split(' '), [
      'openid', 'profile', 'email', 'offline_access', 'resource.invoke', 'chatgpt.tokens.use.direct',
    ]);
    assert.equal(authorization.searchParams.get('code_challenge'), codeChallenge(verifier));
    assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256');

    const tokenCallsBeforeRejectedCallbacks = tokenRequests.length;
    await assert.rejects(() => controller.complete(actor as any, {
      callbackUrl: `http://localhost:1455/auth/callback?code=auth-code&state=${authorization.searchParams.get('state')}`,
    }), /redirect URI mismatch|Não foi possível concluir/);
    await assert.rejects(() => controller.complete(actor as any, {
      callbackUrl: `http://127.0.0.1:1455/auth/callback?state=${authorization.searchParams.get('state')}`,
    }), /callback did not contain|Não foi possível concluir/);
    assert.equal(tokenRequests.length, tokenCallsBeforeRejectedCallbacks);

    await assert.rejects(() => controller.complete(actor as any, {
      callbackUrl: `http://127.0.0.1:1455/auth/callback?code=auth-code&state=wrong`,
    }), /OAuth state mismatch|A autorização expirou|Não foi possível concluir/);

    const dynamicMissingStart = await controller.start(actor as any);
    await assert.rejects(() => controller.complete(actor as any, {
      callbackUrl: `http://127.0.0.1:1455/auth/callback?code=auth-code&state=${new URL(dynamicMissingStart.authorizationUrl).searchParams.get('state')}`,
    }), /client id missing|Não foi possível concluir/);
    assert.equal(connections.size, 0);
    assert.equal(tokenRequests.length, tokenCallsBeforeRejectedCallbacks);

    const dynamicMismatchStart = await controller.start(actor as any);
    await assert.rejects(() => controller.complete(actor as any, {
      callbackUrl: `http://127.0.0.1:1455/auth/callback?code=auth-code&state=${new URL(dynamicMismatchStart.authorizationUrl).searchParams.get('state')}&client_id=wrong-client`,
    }), /client id mismatch|Não foi possível concluir/);
    assert.equal(connections.size, 0);
    assert.equal(tokenRequests.length, tokenCallsBeforeRejectedCallbacks + 1);

    const completed = await controller.complete(actor as any, {
      callbackUrl: `http://127.0.0.1:1455/auth/callback?code=auth-code&state=${authorization.searchParams.get('state')}&client_id=oaiapp_callback-issued-client`,
    });
    assert.equal(tokenRequests.length, tokenCallsBeforeRejectedCallbacks + 2);
    assert.equal(tokenRequests[1].url, 'https://auth.example/token');
    assert.equal(tokenRequests[1].body.get('grant_type'), 'authorization_code');
    assert.equal(tokenRequests[1].body.get('code'), 'auth-code');
    assert.equal(tokenRequests[1].body.get('redirect_uri'), attempt.redirectUri);
    assert.equal(tokenRequests[1].body.get('client_id'), 'oaiapp_callback-issued-client');
    assert.equal(tokenRequests[1].body.get('code_verifier'), verifier);
    assert.equal(tokenRequests[1].body.get('resource'), 'https://api.openai.com/v1');
    assert.deepEqual(completed, {
      id: 'connection-1', provider: 'https://auth.example', email: 'person@example.com',
      scopes: ['openid', 'offline_access', 'chatgpt.tokens.use.direct'],
      expiresAt: completed.expiresAt, status: 'connected',
    });
    assert.equal(JSON.stringify(completed).includes('oauth-access'), false);

    await assert.rejects(() => controller.complete(actor as any, {
      callbackUrl: `http://127.0.0.1:1455/auth/callback?code=auth-code&state=${authorization.searchParams.get('state')}`,
    }), /attempt is invalid or expired|A autorização expirou/);

    const secondStarted = await controller.start(actor as any);
    const secondAuthorization = new URL(secondStarted.authorizationUrl);
    const returningCompleted = await controller.complete(actor as any, {
      callbackUrl: `http://127.0.0.1:1455/auth/callback?code=auth-code&state=${secondAuthorization.searchParams.get('state')}`,
    });
    assert.equal(returningCompleted.id, 'connection-1');
    assert.equal(tokenRequests.length, tokenCallsBeforeRejectedCallbacks + 3);
    assert.equal(tokenRequests[2].body.get('client_id'), 'oaiapp_callback-issued-client');
    const thirdAuthorization = new URL((await controller.start(actor as any)).authorizationUrl);
    await assert.rejects(() => controller.complete(actor as any, {
      callbackUrl: `http://127.0.0.1:1455/auth/callback?code=auth-code&state=${thirdAuthorization.searchParams.get('state')}&client_id=other-client`,
    }), /client id mismatch|Não foi possível concluir/);

    const listed = await controller.connections(actor as any);
    assert.equal(listed.length, 1);
    assert.equal(listed[0].id, 'connection-1');
    assert.equal(JSON.stringify(listed).includes('oauth-refresh'), false);

    const auth = await service.resolveProviderAuth(actor);
    assert.deepEqual(auth && { type: auth.type, accessToken: auth.accessToken }, { type: 'oauth', accessToken: 'oauth-access' });
    const provider = new OpenAiResponsesProvider({ get: (key: string, fallback?: string) => key === 'OPENAI_MODEL' ? 'test-model' : fallback } as any, async (_url, init) => {
      const authorizationHeader = new Headers(init?.headers).get('authorization') ?? '';
      calls.push({ url: 'https://api.openai.com/v1/responses', authorization: authorizationHeader });
      return new Response('data: {"type":"response.output_text.delta","delta":"ok"}\n\ndata: {"type":"response.completed","response":{"status":"completed"}}\n', { status: 200, headers: { 'content-type': 'text/event-stream' } });
    });
    const result = await provider.complete({ messages: [{ role: 'user', content: 'hello' }] }, auth);
    assert.deepEqual(result, { text: 'ok', toolCalls: [] });
    assert.equal(calls.at(-1)?.authorization, 'Bearer oauth-access');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('carries one global OAuth runtime through catalog selection and chat without partial rows', async () => {
  const connection = { id: 'global-connection', updatedAt: new Date('2030-01-01T00:00:00.000Z') };
  const runtimeRow: any = {
    id: 'global', oauthConnectionId: connection.id, selectedModelSlug: null,
    selectedModelDisplayName: null, oauthConnection: connection,
  };
  const messages: any[] = [];
  const proposals: any[] = [];
  const transactionWrites: any[] = [];
  let attemptedMessageWrites = 0;
  const prisma: any = {
    aiServerRuntime: {
      upsert: async () => runtimeRow,
      findUnique: async () => runtimeRow,
      update: async ({ data }: any) => Object.assign(runtimeRow, data),
    },
    $queryRawUnsafe: async () => undefined,
    $transaction: async (callback: (tx: any) => Promise<any>) => {
      const pending: any[] = [];
      const tx = {
        $queryRawUnsafe: async () => undefined,
        aiServerRuntime: {
          findUnique: async () => runtimeRow,
          update: async ({ data }: any) => Object.assign(runtimeRow, data),
        },
        aiMessage: {
          create: async ({ data }: any) => {
            attemptedMessageWrites += 1;
            pending.push({ table: 'message', data });
            if (pending.length === 2) throw new Error('message write failed');
            return { id: `message-${pending.length}`, ...data };
          },
        },
        aiActionProposal: { create: async ({ data }: any) => ({ id: 'proposal-1', ...data }) },
      };
      try {
        const result = await callback(tx);
        transactionWrites.push(...pending);
        return result;
      } catch (error) {
        return Promise.reject(error);
      }
    },
    aiConversation: { findFirst: async () => ({ id: 'conversation-1', contextProjectId: null }) },
    aiMessage: {
      findMany: async () => [],
      create: async ({ data }: any) => { const row = { id: `message-${messages.length + 1}`, ...data }; messages.push(row); return row; },
    },
    aiActionProposal: {
      create: async ({ data }: any) => { const row = { id: `proposal-${proposals.length + 1}`, ...data }; proposals.push(row); return row; },
    },
  };
  const oauth = {
    resolveProviderAuth: async () => ({ type: 'oauth', accessToken: 'global-oauth-token', connectionId: connection.id, connectionUpdatedAt: connection.updatedAt.toISOString() }),
  };
  const originalFetch = globalThis.fetch;
  let responsesRequest: any;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    assert.equal(init?.headers && new Headers(init.headers).get('authorization'), 'Bearer global-oauth-token');
    if (url === 'https://api.openai.com/v1/models') {
      return new Response(JSON.stringify({ data: [
        { slug: 'gpt-hidden', display_name: 'Hidden', visibility: 'hidden' },
        { slug: 'gpt-5-codex', display_name: 'GPT-5 Codex', visibility: 'list' },
        { slug: 'gpt-4.1', display_name: 'GPT 4.1', visibility: 'list' },
      ] }), { status: 200 });
    }
    assert.equal(url, 'https://api.openai.com/v1/responses');
    responsesRequest = JSON.parse(String(init?.body));
    return new Response('data: {"type":"response.output_text.delta","delta":"ok"}\n\ndata: {"type":"response.completed","response":{"status":"completed"}}\n', {
      status: 200, headers: { 'content-type': 'text/event-stream' },
    });
  }) as typeof fetch;

  try {
    const runtime = new AiServerRuntimeService(prisma, oauth as any);
    assert.deepEqual(await runtime.listModels(), [
      { slug: 'gpt-5-codex', displayName: 'GPT-5 Codex' },
      { slug: 'gpt-4.1', displayName: 'GPT 4.1' },
    ]);
    assert.deepEqual(await runtime.selectModel('gpt-5-codex'), {
      connectionStatus: 'connected', provider: 'chatgpt',
      selectedModel: { slug: 'gpt-5-codex', displayName: 'GPT-5 Codex' },
    });

    const actor = { tenantId: 'tenant-a', tenantUserId: 'user-a' };
    const context = new AiContextService({ project: { findFirst: async () => null }, task: { findMany: async () => [] } } as any);
    const audit = new AiAuditService({ log: async () => undefined } as any);
    const identity = { resolve: async () => ({ name: 'Maria', address: 'Maria' }) } as any;
    const completion = new AiService(prisma, {
      complete: async (input: any) => {
        responsesRequest = input;
        return { text: 'ok', toolCalls: [] };
      },
    }, context, new AiToolRegistryService([]), audit, identity, {}, undefined, oauth as any, runtime as any);
    await assert.rejects(() => completion.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'hello', responseMode: 'TEXT' as any }), /message write failed/);
    assert.equal(responsesRequest.model, 'gpt-5-codex');
    assert.equal(attemptedMessageWrites, 2);
    assert.deepEqual(transactionWrites, []);
    assert.deepEqual(messages, []);
    assert.deepEqual(proposals, []);

    const invalidTool = new AiService(prisma, { complete: async () => ({ text: 'bad', toolCalls: [{ name: 'unknown', arguments: {} }] }) }, context, new AiToolRegistryService([]), audit, identity, {}, undefined, undefined, runtime as any);
    await assert.rejects(() => invalidTool.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'hello', responseMode: 'TEXT' as any }), /Ferramenta não disponível/);
    assert.deepEqual(messages, []);
    assert.deepEqual(proposals, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('serializes the expanded authorized tool contract without identity or credential leakage', async () => {
  let requestBody: any;
  const provider = new OpenAiResponsesProvider(
    { get: (key: string, fallback?: string) => key === 'OPENAI_MODEL' ? 'test-model' : fallback } as any,
    async (_url, init) => {
      requestBody = JSON.parse(String(init?.body));
      return new Response('data: {"type":"response.output_text.delta","delta":"ok"}\n\ndata: {"type":"response.completed","response":{"status":"completed"}}\n', {
        status: 200, headers: { 'content-type': 'text/event-stream' },
      });
    },
  );
  const tools: AiTool[] = [
    'search_projects', 'search_tasks', 'search_users', 'search_teams', 'search_calendar', 'search_routines',
    'create_task', 'update_task', 'move_task', 'create_calendar_event', 'create_routine', 'add_team_member', 'add_project_member',
  ].map((name) => ({
    name,
    description: `${name} authorized tool`,
    parameters: { type: 'object', additionalProperties: false, properties: {} },
    authorize: async () => undefined,
    execute: async () => undefined,
  }));

  await provider.complete({
    messages: [{ role: 'system', content: 'Usuário autenticado: Emanuel Barsotini. Tratamento: pai.' }],
    tools,
  }, { type: 'api-key', accessToken: 'provider-secret' });

  assert.deepEqual(requestBody.tools.map((tool: any) => tool.name), tools.map((tool) => tool.name));
  assert.equal(JSON.stringify(requestBody).includes('person@example.com'), false);
  assert.equal(JSON.stringify(requestBody).includes('provider-secret'), false);
  assert.equal(JSON.stringify(requestBody).includes('accessToken'), false);
});

test('executes an authorized global read without a proposal and preserves the actor boundary', async () => {
  const actor = { tenantId: 'tenant-a', tenantUserId: 'user-a' };
  const writes: any[] = [];
  const providerInputs: any[] = [];
  const projects = {
    findAll: async (tenantId: string, tenantUserId: string) => {
      assert.equal(tenantId, actor.tenantId);
      assert.equal(tenantUserId, actor.tenantUserId);
      return [{ id: 'project-a', name: 'Visible project', status: 'ACTIVE' }];
    },
  };
  const users = {
    findOne: async (tenantId: string, tenantUserId: string) => tenantId === actor.tenantId && tenantUserId === actor.tenantUserId
      ? { role: { name: 'collaborator', rolePermissions: [{ permission: { code: 'projects.view' } }] } }
      : null,
  };
  const readTool = new SearchProjectsTool(projects as any, users as any);
  const prisma: any = {
    aiConversation: { findFirst: async () => ({ id: 'conversation-1', tenantId: actor.tenantId, ownerTenantUserId: actor.tenantUserId, contextProjectId: null }) },
    aiMessage: { findMany: async () => [] },
    $transaction: async (callback: (tx: any) => Promise<any>) => callback({
      aiMessage: { create: async ({ data }: any) => { const row = { id: `message-${writes.length + 1}`, ...data }; writes.push(row); return row; } },
      aiActionProposal: { create: async () => { throw new Error('read must not create a proposal'); } },
    }),
  };
  const service = new AiService(
    prisma,
    { complete: async (input: any) => {
      providerInputs.push(input);
      return providerInputs.length === 1
        ? { text: 'vou consultar', toolCalls: [{ name: 'search_projects', arguments: {} }] }
        : { text: 'Você pode ver o projeto Visible project.', toolCalls: [] };
    } },
    new AiContextService({ project: { findFirst: async () => null }, task: { findMany: async () => [] } } as any),
    new AiToolRegistryService([readTool]),
    new AiAuditService({ log: async () => undefined } as any),
    { resolve: async () => ({ name: 'Maria', address: 'Maria' }) } as any,
  );

  const result = await service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'quais projetos posso ver?', responseMode: 'TEXT' as any });
  assert.deepEqual((result as any).toolResults, [{ toolName: 'search_projects', result: [{ id: 'project-a', name: 'Visible project', status: 'ACTIVE', owner: undefined, team: undefined, progressPercent: undefined, totalTasks: undefined }] }]);
  assert.equal(providerInputs.length, 2);
  assert.equal(result.assistantMessage?.content, 'Você pode ver o projeto Visible project.');
  assert.match(providerInputs[1].messages.at(-1).content, /Visible project/);
  const serializedInputs = JSON.stringify(providerInputs);
  assert.match(serializedInputs, /Maria/);
  assert.equal(serializedInputs.includes('person@example.com'), false);
  assert.equal(serializedInputs.includes('tenant-a'), false);
  assert.equal(serializedInputs.includes('accessToken'), false);
  assert.deepEqual(result.proposals, []);
  assert.equal(writes.length, 2);
});
