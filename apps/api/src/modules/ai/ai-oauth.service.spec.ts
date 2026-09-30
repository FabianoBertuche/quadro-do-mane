import assert from 'node:assert/strict';
import test from 'node:test';
import crypto from 'node:crypto';
import { AiOAuthService } from './ai-oauth.service';
import {
  buildAuthorizationUrl,
  parseCallbackUrl,
  sha256,
  validateIdToken,
} from './ai-oauth.protocol';

test('builds a loopback authorization URL with PKCE, nonce, and required scope', () => {
  const url = new URL(buildAuthorizationUrl({
    authorizationEndpoint: 'https://auth.openai.com/api/accounts/authorize',
    clientId: 'dynamic_agent_client',
    redirectUri: 'http://127.0.0.1/callback',
    state: 'state',
    nonce: 'nonce',
    codeChallenge: 'challenge',
    scopes: ['openid', 'chatgpt.tokens.use.direct'],
    agentNameHint: 'Monte Moria',
  }));

  assert.equal(url.searchParams.get('client_id'), 'dynamic_agent_client');
  assert.equal(url.searchParams.get('redirect_uri'), 'http://127.0.0.1/callback');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.match(url.searchParams.get('scope') ?? '', /chatgpt\.tokens\.use\.direct/);
  assert.equal(url.searchParams.get('agent_name_hint'), 'Monte Moria');
});

test('parses callback and rejects a mismatched state', () => {
  const callback = parseCallbackUrl(
    'http://127.0.0.1/callback?code=code&state=wrong',
    'state',
    'http://127.0.0.1/callback',
  );
  assert.equal(callback.error?.message, 'OAuth state mismatch');
});

test('rejects callback client id mismatch before token exchange', () => {
  assert.throws(
    () => parseCallbackUrl(
      'http://127.0.0.1/callback?code=code&state=state&client_id=other',
      'state',
      'http://127.0.0.1/callback',
      'issued-client',
    ),
    /OAuth client id mismatch/,
  );
});

test('validates ID token issuer, audience, and nonce', async () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: 'https://auth.openai.com', aud: 'client', nonce: 'nonce', sub: 'subject',
    email: 'person@example.com', name: 'Person',
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
