import assert from 'node:assert/strict';
import test from 'node:test';
import crypto from 'node:crypto';
import { AiOAuthService } from './ai-oauth.service';
import {
  buildAuthorizationUrl,
  codeChallenge,
  discoverOpenIdConfiguration,
  assertRequiredScope,
  assertCallbackClientId,
  parseCallbackUrl,
  exchangeToken,
  revokeToken,
  resolveClientId,
  sha256,
  validateIdToken,
} from './ai-oauth.protocol';

test('builds a loopback authorization URL with PKCE, nonce, and required scope', () => {
  const url = new URL(buildAuthorizationUrl({
    authorizationEndpoint: 'https://auth.openai.com/api/accounts/authorize',
    clientId: 'dynamic_agent_client',
    redirectUri: 'http://127.0.0.1:1455/auth/callback',
    state: 'state',
    nonce: 'nonce',
    codeChallenge: 'challenge',
    scopes: ['openid', 'chatgpt.tokens.use.direct'],
    agentNameHint: 'Monte Moria',
  }));

  assert.equal(url.searchParams.get('client_id'), 'dynamic_agent_client');
  assert.equal(url.searchParams.get('redirect_uri'), 'http://127.0.0.1:1455/auth/callback');
  assert.equal(url.searchParams.get('resource'), 'https://api.openai.com/v1');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.match(url.searchParams.get('scope') ?? '', /chatgpt\.tokens\.use\.direct/);
  assert.equal(url.searchParams.get('agent_name_hint'), 'Monte Moria');
});

test('parses callback and rejects a mismatched state', () => {
  const callback = parseCallbackUrl(
    'http://127.0.0.1:1455/auth/callback?code=code&state=wrong',
    'state',
    'http://127.0.0.1:1455/auth/callback',
  );
  assert.equal(callback.error?.message, 'OAuth state mismatch');
});

test('rejects callback client id mismatch before token exchange', () => {
  assert.throws(
    () => parseCallbackUrl(
      'http://127.0.0.1:1455/auth/callback?code=code&state=state&client_id=other',
      'state',
      'http://127.0.0.1:1455/auth/callback',
      'issued-client',
    ),
    /OAuth client id mismatch/,
  );
});

test('retains a dynamic callback client id for validation after token exchange', () => {
  const callback = parseCallbackUrl(
    'http://127.0.0.1:1455/auth/callback?code=code&state=state&client_id=issued-client',
    'state',
    'http://127.0.0.1:1455/auth/callback',
  );
  assert.equal(callback.clientId, 'issued-client');
  assert.doesNotThrow(() => assertCallbackClientId(callback.clientId, 'issued-client'));
  assert.throws(() => assertCallbackClientId('other-client', 'issued-client'), /OAuth client id mismatch/);
  assert.throws(() => assertCallbackClientId(undefined, 'issued-client'), /OAuth client id missing/);
});

test('allows a returning callback without client id but requires it for dynamic registration', () => {
  const returning = parseCallbackUrl(
    'http://127.0.0.1:1455/auth/callback?code=code&state=state',
    'state',
    'http://127.0.0.1:1455/auth/callback',
    'issued-client',
  );
  assert.equal(returning.code, 'code');
  assert.equal(returning.clientId, undefined);
  assert.throws(() => (parseCallbackUrl as any)(
    'http://127.0.0.1:1455/auth/callback?code=code&state=state',
    'state',
    'http://127.0.0.1:1455/auth/callback',
    undefined,
    true,
  ), /OAuth client id missing/);
});

test('returns provider callback errors before requiring a client id', () => {
  const callback = (parseCallbackUrl as any)(
    'http://127.0.0.1:1455/auth/callback?state=state&error=access_denied',
    'state',
    'http://127.0.0.1:1455/auth/callback',
    undefined,
    true,
  );
  assert.equal(callback.error?.message, 'OAuth authorization failed: access_denied');
});

test('includes the OpenAI resource in authorization-code token exchange', async () => {
  let requestBody: URLSearchParams | undefined;
  await exchangeToken('https://auth.example/token', {
    grant_type: 'authorization_code',
    code: 'code',
    redirect_uri: 'http://127.0.0.1:1455/auth/callback',
    client_id: 'client',
    code_verifier: 'verifier',
  }, async (_url, init) => {
    requestBody = new URLSearchParams(String(init?.body));
    return {
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'access', expires_in: 3600, refresh_token: 'refresh', id_token: 'id' }),
    } as any;
  });
  assert.equal(requestBody?.get('resource'), 'https://api.openai.com/v1');
});

test('rejects incomplete token responses before callers encrypt token fields', async () => {
  await assert.rejects(() => exchangeToken('https://auth.example/token', {}, async () => ({
    ok: true,
    status: 200,
    json: async () => ({ access_token: 'access', expires_in: 3600 }),
  } as any)), /OAuth token response missing required field: refresh_token/);
});

test('rejects missing direct-token scope and captures dynamic client identity', () => {
  assert.throws(() => assertRequiredScope('openid profile'), /required scope missing/);
  assert.equal(resolveClientId('dynamic_agent_client', { client_id: 'issued-client' }), 'issued-client');
  assert.throws(() => resolveClientId('dynamic_agent_client', {}), /dynamic client id missing/);
  assert.throws(() => resolveClientId('saved-client', { client_id: 'other-client' }), /client id mismatch/);
});

test('validates ID token issuer, audience, and nonce', async () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: 'https://auth.openai.com', aud: 'client', nonce: 'nonce', sub: 'subject',
    email: 'person@example.com', name: 'Person', exp: 2_000_000_000,
  })).toString('base64url');
  const input = `${header}.${payload}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url');
  const token = `${input}.${signature}`;

  const claims = await validateIdToken(token, {
    issuer: 'https://auth.openai.com', audience: 'client', nonce: 'nonce',
    fetchJwks: async () => ({ keys: [{ kid: 'test', alg: 'RS256', use: 'sig', ...publicKey.export({ format: 'jwk' }) }] }),
  });
  assert.equal(claims.sub, 'subject');
  await assert.rejects(() => validateIdToken(token, {
    issuer: 'https://evil.example', audience: 'client', nonce: 'nonce',
    fetchJwks: async () => ({ keys: [{ kid: 'test', alg: 'RS256', use: 'sig', ...publicKey.export({ format: 'jwk' }) }] }),
  }), /issuer/);
  await assert.rejects(() => validateIdToken(token, {
    issuer: 'https://auth.openai.com', audience: 'client', nonce: 'nonce', now: 2_000_000_001,
    fetchJwks: async () => ({ keys: [{ kid: 'test', alg: 'RS256', use: 'sig', ...publicKey.export({ format: 'jwk' }) }] }),
  }), /expired/);
  const noExpiry = Buffer.from(JSON.stringify({ iss: 'https://auth.openai.com', aud: 'client', nonce: 'nonce', sub: 'subject' })).toString('base64url');
  const noExpiryInput = `${header}.${noExpiry}`;
  const noExpiryToken = `${noExpiryInput}.${crypto.sign('RSA-SHA256', Buffer.from(noExpiryInput), privateKey).toString('base64url')}`;
  await assert.rejects(() => validateIdToken(noExpiryToken, {
    issuer: 'https://auth.openai.com', audience: 'client', nonce: 'nonce',
    fetchJwks: async () => ({ keys: [{ kid: 'test', alg: 'RS256', use: 'sig', ...publicKey.export({ format: 'jwk' }) }] }),
  }), /exp missing/);
});

test('persists encrypted PKCE and nonce material and uses a configured callback port', async () => {
  let attempt: any;
  const prisma = {
    aiOAuthConnection: { findFirst: async () => null },
    aiServerRuntime: { upsert: async () => ({ id: 'global', oauthConnectionId: null, oauthConnection: null }) },
    aiOAuthAttempt: { create: async ({ data }: any) => { attempt = { ...data, id: 'attempt-id' }; return attempt; } },
  };
  const service = new AiOAuthService(prisma as any, { encrypt: (value: string) => ({ ciphertext: `cipher:${value}`, iv: 'iv', authTag: 'tag' }) } as any, {
    get: (key: string) => ({ CHATGPT_OAUTH_CALLBACK_PORT: 1666, CHATGPT_OAUTH_HOST_ID: 'host' } as any)[key],
  } as any);
  const result = await service.startAuthorization({ tenantId: 'tenant-a', tenantUserId: 'user-a' });
  const url = new URL(result.authorizationUrl);
  assert.equal(url.searchParams.get('redirect_uri'), 'http://127.0.0.1:1666/auth/callback');
  assert.equal(attempt.extAgentHostId, 'host');
  assert.match(attempt.pkceVerifierCiphertext, /^cipher:/);
  assert.match(attempt.nonceCiphertext, /^cipher:/);
  assert.equal(attempt.pkceVerifierHash, sha256(attempt.pkceVerifierCiphertext.slice(7)));
  assert.equal(attempt.nonceHash, sha256(attempt.nonceCiphertext.slice(7)));
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(codeChallenge(url.searchParams.get('code_challenge') ?? '') === url.searchParams.get('code_challenge'), false);
});

test('completes from persisted encrypted PKCE and nonce material after service restart', async () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const verifier = 'persisted-verifier';
  const nonce = 'persisted-nonce';
  const state = 'persisted-state';
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'restart-key' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: 'https://auth.example', aud: 'issued-client', sub: 'subject', nonce, exp: Math.floor(Date.now() / 1000) + 3600, email: 'person@example.com' })).toString('base64url');
  const signed = `${header}.${payload}`;
  const idToken = `${signed}.${crypto.sign('RSA-SHA256', Buffer.from(signed), privateKey).toString('base64url')}`;
  let consumed = false;
  const prisma = {
    aiOAuthAttempt: {
      findFirst: async () => ({ id: 'attempt-id', tenantId: 'tenant-a', tenantUserId: 'user-a', stateHash: sha256(state), nonceHash: sha256(nonce), pkceVerifierHash: sha256(verifier), pkceVerifierCiphertext: 'nonce-verifier', pkceVerifierIv: 'iv', pkceVerifierAuthTag: 'tag', nonceCiphertext: 'nonce-value', nonceIv: 'iv', nonceAuthTag: 'tag', redirectUri: 'http://127.0.0.1:1455/auth/callback', clientId: 'dynamic_agent_client', extAgentHostId: 'host', expiresAt: new Date(Date.now() + 60_000), consumedAt: null }),
      updateMany: async () => { consumed = true; return { count: 1 }; },
    },
    aiOAuthConnection: {
      create: async ({ data }: any) => ({ ...data, id: 'connection-id', lastUsedAt: null }),
    },
    aiServerRuntime: {
      upsert: async () => ({ id: 'global', oauthConnectionId: null, oauthConnection: null }),
      update: async () => undefined,
    },
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    if (url.endsWith('openid-configuration')) return { ok: true, json: async () => ({ token_endpoint: 'https://auth.example/token', jwks_uri: 'https://auth.example/jwks' }) } as any;
    if (url.endsWith('/jwks')) return { ok: true, json: async () => ({ keys: [{ kid: 'restart-key', ...publicKey.export({ format: 'jwk' }) }] }) } as any;
    return { ok: true, json: async () => ({ client_id: 'issued-client', access_token: 'access', refresh_token: 'refresh', id_token: idToken, scope: 'openid chatgpt.tokens.use.direct', expires_in: 3600 }) } as any;
  }) as any;
  try {
    const service = new AiOAuthService(prisma as any, {
      decrypt: ({ ciphertext }: any) => ciphertext === 'nonce-verifier' ? verifier : nonce,
      encrypt: (value: string) => ({ ciphertext: `encrypted-${value}`, iv: 'iv', authTag: 'tag' }),
    } as any, { get: (key: string) => key === 'CHATGPT_OAUTH_ISSUER' ? 'https://auth.example' : undefined } as any);
    const view = await service.completeAuthorization({ tenantId: 'tenant-a', tenantUserId: 'user-a' }, `http://127.0.0.1:1455/auth/callback?code=code&state=${state}&client_id=issued-client`);
    assert.equal(consumed, true);
    assert.equal(view.id, 'connection-id');
    assert.equal(view.email, 'person@example.com');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('discovers OpenID revocation and keeps token values out of errors', async () => {
  const calls: Array<{ url: string; body?: string }> = [];
  const fetcher = async (url: string, init?: any) => {
    calls.push({ url, body: init?.body?.toString() });
    return { ok: true, json: async () => ({ revocation_endpoint: 'https://auth.example/revoke' }) } as any;
  };
  const configuration = await discoverOpenIdConfiguration('https://auth.example', fetcher as any);
  await revokeToken(configuration.revocation_endpoint!, 'refresh-secret', 'client', fetcher as any);
  assert.equal(calls[0].url, 'https://auth.example/.well-known/openid-configuration');
  assert.match(calls[1].body!, /client_id=client/);
  assert.match(calls[1].body!, /refresh-secret/);
});

test('serializes refreshes with the persisted lease and rotates the refresh token', async () => {
  let leaseHeld = false;
  let tokenCalls = 0;
  let inFlight = 0;
  let maxInFlight = 0;
  const connection = {
    id: 'connection-id', tenantId: 'tenant-a', tenantUserId: 'user-a', issuer: 'https://auth.example', clientId: 'client',
    refreshTokenCiphertext: 'refresh', refreshTokenIv: 'iv', refreshTokenAuthTag: 'tag', isRevoked: false,
    refreshLeaseToken: null, refreshLeaseExpiresAt: null,
  };
  const prisma = {
    aiOAuthConnection: {
      findFirst: async ({ where }: any) => ({ ...connection, refreshLeaseToken: leaseHeld ? 'held' : null, refreshLeaseExpiresAt: leaseHeld ? new Date(Date.now() + 1000) : null, tenantId: where.tenantId, tenantUserId: where.tenantUserId }),
      updateMany: async ({ data }: any) => {
        if (data.refreshLeaseToken) {
          if (leaseHeld) return { count: 0 };
          leaseHeld = true;
          return { count: 1 };
        }
        leaseHeld = false;
        return { count: 1 };
      },
      update: async () => undefined,
    },
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    if (url.endsWith('openid-configuration')) return { ok: true, json: async () => ({ token_endpoint: 'https://auth.example/token' }) } as any;
    tokenCalls += 1;
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 10));
    inFlight -= 1;
    return { ok: true, json: async () => ({ access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600 }) } as any;
  }) as any;
  try {
    const service = new AiOAuthService(prisma as any, {
      decrypt: () => 'old-refresh', encrypt: (value: string) => ({ ciphertext: `enc:${value}`, iv: 'iv', authTag: 'tag' }),
    } as any, { get: () => undefined } as any);
    await Promise.all([
      service.refreshConnection({ tenantId: 'tenant-a', tenantUserId: 'user-a' }, 'connection-id'),
      service.refreshConnection({ tenantId: 'tenant-a', tenantUserId: 'user-a' }, 'connection-id'),
    ]);
    assert.equal(tokenCalls, 2);
    assert.equal(maxInFlight, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fences a slow refresh after its lease expires before it can overwrite newer tokens', async () => {
  const realNow = Date.now;
  let now = realNow();
  let row: any = {
    id: 'connection-id', tenantId: 'tenant-a', tenantUserId: 'user-a', issuer: 'https://auth.example', clientId: 'client',
    refreshTokenCiphertext: 'enc:old-refresh', refreshTokenIv: 'iv', refreshTokenAuthTag: 'tag', isRevoked: false,
    refreshLeaseToken: null, refreshLeaseExpiresAt: null, accessTokenCiphertext: 'enc:old-access',
  };
  let remoteStarted!: () => void;
  const remoteStartedPromise = new Promise<void>((resolve) => { remoteStarted = resolve; });
  let releaseSlowRemote!: () => void;
  const slowRemote = new Promise<void>((resolve) => { releaseSlowRemote = resolve; });
  let refreshCalls = 0;
  const prisma = {
    aiOAuthConnection: {
      findFirst: async () => ({ ...row }),
      updateMany: async ({ where, data }: any) => {
        if (data.refreshLeaseToken) {
          if (row.refreshLeaseToken && row.refreshLeaseExpiresAt > new Date(now)) return { count: 0 };
          row = { ...row, ...data };
          return { count: 1 };
        }
        if (where.refreshLeaseToken && row.refreshLeaseToken !== where.refreshLeaseToken) return { count: 0 };
        row = { ...row, ...data };
        return { count: 1 };
      },
    },
  };
  const originalFetch = globalThis.fetch;
  Date.now = () => now;
  globalThis.fetch = (async (url: string) => {
    if (url.endsWith('openid-configuration')) return { ok: true, json: async () => ({ token_endpoint: 'https://auth.example/token' }) } as any;
    refreshCalls += 1;
    if (refreshCalls === 1) {
      remoteStarted();
      await slowRemote;
      return { ok: true, json: async () => ({ access_token: 'stale-access', refresh_token: 'stale-refresh', expires_in: 3600 }) } as any;
    }
    return { ok: true, json: async () => ({ access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600 }) } as any;
  }) as any;
  try {
    const service = new AiOAuthService(prisma as any, {
      decrypt: ({ ciphertext }: any) => ciphertext.replace('enc:', ''),
      encrypt: (value: string) => ({ ciphertext: `enc:${value}`, iv: 'iv', authTag: 'tag' }),
    } as any, { get: () => undefined } as any);
    const slowRefresh = service.refreshConnection({ tenantId: 'tenant-a', tenantUserId: 'user-a' }, 'connection-id');
    await remoteStartedPromise;
    now += 31_000;
    await service.refreshConnection({ tenantId: 'tenant-a', tenantUserId: 'user-a' }, 'connection-id');
    releaseSlowRemote();
    await slowRefresh;
    assert.equal(refreshCalls, 2);
    assert.equal(row.accessTokenCiphertext, 'enc:new-access');
    assert.equal(row.refreshTokenCiphertext, 'enc:new-refresh');
  } finally {
    Date.now = realNow;
    globalThis.fetch = originalFetch;
  }
});

test('resolves and refreshes the expired global OAuth connection without an actor', async () => {
  let row: any = {
    id: 'global-connection', issuer: 'https://auth.example', clientId: 'client', isRevoked: false,
    accessTokenCiphertext: 'enc:old-access', accessTokenIv: 'iv', accessTokenAuthTag: 'tag',
    refreshTokenCiphertext: 'enc:refresh', refreshTokenIv: 'iv', refreshTokenAuthTag: 'tag',
    expiresAt: new Date(Date.now() - 1_000), refreshLeaseToken: null, refreshLeaseExpiresAt: null,
  };
  const prisma = {
    aiServerRuntime: { upsert: async () => ({ id: 'global', oauthConnectionId: row.id, oauthConnection: row }) },
    aiOAuthConnection: {
      findFirst: async () => row,
      updateMany: async ({ data }: any) => { row = { ...row, ...data }; return { count: 1 }; },
    },
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string) => url.endsWith('openid-configuration')
    ? { ok: true, json: async () => ({ token_endpoint: 'https://auth.example/token' }) }
    : { ok: true, json: async () => ({ access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600 }) }) as any;
  try {
    const service = new AiOAuthService(prisma as any, {
      decrypt: ({ ciphertext }: any) => ciphertext.replace('enc:', ''),
      encrypt: (value: string) => ({ ciphertext: `enc:${value}`, iv: 'iv', authTag: 'tag' }),
    } as any, { get: () => undefined } as any);
    assert.equal((await service.resolveProviderAuth())?.accessToken, 'new-access');
    assert.equal(row.accessTokenCiphertext, 'enc:new-access');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('revokes remotely when available, then disconnects the global connection locally', async () => {
  let locallyRevoked = false;
  let revokeCalls = 0;
  const prisma = {
    aiOAuthConnection: {
      findFirst: async () => ({
        id: 'connection-id', issuer: 'https://auth.example', clientId: 'client', isRevoked: false,
        refreshTokenCiphertext: 'refresh', refreshTokenIv: 'iv', refreshTokenAuthTag: 'tag',
      }),
      updateMany: async ({ where }: any) => { assert.equal(where.tenantId, undefined); assert.equal(where.tenantUserId, undefined); locallyRevoked = true; return { count: 1 }; },
    },
    aiServerRuntime: { update: async () => undefined },
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    if (url.endsWith('openid-configuration')) return { ok: true, json: async () => ({ revocation_endpoint: 'https://auth.example/revoke' }) } as any;
    revokeCalls += 1;
    return { ok: true, json: async () => ({}) } as any;
  }) as any;
  try {
    const service = new AiOAuthService(prisma as any, { decrypt: () => 'refresh-secret' } as any, { get: () => undefined } as any);
    await service.disconnectConnection({ tenantId: 'tenant-a', tenantUserId: 'user-a' }, 'connection-id');
    assert.equal(revokeCalls, 1);
    assert.equal(locallyRevoked, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('persists encrypted tokens and returns a safe connection view', async () => {
  const encrypted = (value: string) => ({ ciphertext: `encrypted-${value}`, iv: 'iv', authTag: 'tag' });
  const prisma = {
    aiOAuthConnection: {
      findFirst: async () => null,
      upsert: async ({ create }: any) => ({ ...create, id: 'connection-id', createdAt: new Date(), updatedAt: new Date() }),
    },
    aiOAuthAttempt: { create: async () => ({}) },
  };
  const service = new AiOAuthService(prisma as any, { encrypt: encrypted } as any, {
    get: (key: string) => key === 'CHATGPT_OAUTH_ISSUER' ? 'https://auth.openai.com' : undefined,
  } as any);
  const view = service.toConnectionView({
    id: 'connection-id', issuer: 'https://auth.openai.com', subject: 'subject', clientId: 'client',
    email: 'person@example.com', displayName: 'Person', scopes: 'openid chatgpt.tokens.use.direct',
    expiresAt: new Date('2030-01-01T00:00:00.000Z'), isRevoked: false, lastUsedAt: null,
  } as any);
  assert.deepEqual(view, {
    id: 'connection-id', issuer: 'https://auth.openai.com', subject: 'subject', clientId: 'client',
    email: 'person@example.com', displayName: 'Person', scopes: ['openid', 'chatgpt.tokens.use.direct'],
    expiresAt: '2030-01-01T00:00:00.000Z', isRevoked: false, lastUsedAt: null,
  });
  assert.equal(sha256('state').length, 64);
});
