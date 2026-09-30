import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { AiOAuthController } from './ai-oauth.controller';
import { AiOAuthService } from './ai-oauth.service';
import { codeChallenge } from './ai-oauth.protocol';
import { OpenAiResponsesProvider } from './providers/openai-responses.provider';

const actor = { tenantId: 'tenant-a', tenantUserId: 'user-a' };

test('completes ChatGPT OAuth and resolves the stored token for an OpenAI request', async () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const attempts = new Map<string, any>();
  const connections = new Map<string, any>();
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
    aiOAuthConnection: {
      findFirst: async ({ where }: any) => [...connections.values()].find((connection) =>
        connection.tenantId === where.tenantId && connection.tenantUserId === where.tenantUserId &&
        (where.isRevoked === undefined || connection.isRevoked === where.isRevoked) &&
        (where.id === undefined || connection.id === where.id)),
      findMany: async ({ where }: any) => [...connections.values()].filter((connection) =>
        connection.tenantId === where.tenantId && connection.tenantUserId === where.tenantUserId),
      upsert: async ({ create }: any) => {
        const connection = { ...create, id: 'connection-1', isRevoked: false, lastUsedAt: null };
        connections.set(connection.id, connection);
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
      iss: 'https://auth.example', aud: 'issued-client', sub: 'openai-subject', nonce,
      email: 'person@example.com', name: 'Person', exp: Math.floor(Date.now() / 1000) + 3600,
    })).toString('base64url');
    const signed = `${header}.${payload}`;
    const idToken = `${signed}.${crypto.sign('RSA-SHA256', Buffer.from(signed), privateKey).toString('base64url')}`;
    return new Response(JSON.stringify({ client_id: 'issued-client', access_token: 'oauth-access', refresh_token: 'oauth-refresh', id_token: idToken, scope: 'openid offline_access chatgpt.tokens.use.direct', expires_in: 3600 }), { status: 200 });
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
      callbackUrl: `http://127.0.0.1:1455/auth/callback?code=auth-code&state=${authorization.searchParams.get('state')}&client_id=issued-client`,
    });
    assert.equal(tokenRequests.length, tokenCallsBeforeRejectedCallbacks + 2);
    assert.equal(tokenRequests[1].url, 'https://auth.example/token');
    assert.equal(tokenRequests[1].body.get('grant_type'), 'authorization_code');
    assert.equal(tokenRequests[1].body.get('code'), 'auth-code');
    assert.equal(tokenRequests[1].body.get('redirect_uri'), attempt.redirectUri);
    assert.equal(tokenRequests[1].body.get('client_id'), 'dynamic_agent_client');
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
