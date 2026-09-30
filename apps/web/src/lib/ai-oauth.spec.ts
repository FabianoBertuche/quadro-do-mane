import assert from 'node:assert/strict';
import { test } from 'node:test';
import { api } from './api';
import {
  completeChatGptAuthorization,
  getAiOAuthErrorMessage,
  listChatGptConnections,
  startChatGptAuthorization,
} from './ai-oauth';

test('starts ChatGPT authorization and returns only the client-safe fields', async () => {
  const originalPost = api.post;
  let request: { url: string; data?: unknown } | undefined;
  api.post = (async (url: string, data?: unknown) => {
    request = { url, data };
    return { data: { authorizationUrl: 'https://auth.example/authorize', attemptId: 'attempt-1', expiresAt: '2030-01-01T00:00:00.000Z', verifier: 'secret' } };
  }) as typeof api.post;

  try {
    assert.deepEqual(await startChatGptAuthorization(), {
      authorizationUrl: 'https://auth.example/authorize',
      expiresAt: '2030-01-01T00:00:00.000Z',
    });
    assert.deepEqual(request, { url: '/ai/oauth/start', data: undefined });
  } finally {
    api.post = originalPost;
  }
});

test('submits the complete callback URL and normalizes redacted connection metadata', async () => {
  const originalPost = api.post;
  api.post = (async (url: string, data?: unknown) => {
    assert.equal(url, '/ai/oauth/complete');
    assert.deepEqual(data, { callbackUrl: 'http://127.0.0.1:1455/auth/callback?code=abc' });
    return { data: { id: 'connection-1', provider: 'https://auth.openai.com', email: 'person@example.com', scopes: ['openid'], expiresAt: '2030-01-01T00:00:00.000Z', status: 'connected' } };
  }) as typeof api.post;

  try {
    assert.deepEqual(await completeChatGptAuthorization('http://127.0.0.1:1455/auth/callback?code=abc'), {
      id: 'connection-1', provider: 'https://auth.openai.com', email: 'person@example.com', scopes: ['openid'], expiresAt: '2030-01-01T00:00:00.000Z', status: 'connected',
    });
  } finally {
    api.post = originalPost;
  }
});

test('lists only redacted ChatGPT connection views', async () => {
  const originalGet = api.get;
  api.get = (async (url: string) => {
    assert.equal(url, '/ai/oauth/connections');
    return { data: [{ id: 'connection-1', provider: 'https://auth.openai.com', email: null, scopes: 'openid chatgpt.tokens.use.direct', expiresAt: '2030-01-01T00:00:00.000Z', status: 'revoked', accessToken: 'secret' }] };
  }) as typeof api.get;

  try {
    assert.deepEqual(await listChatGptConnections(), [{
      id: 'connection-1', provider: 'https://auth.openai.com', email: null, scopes: ['openid', 'chatgpt.tokens.use.direct'], expiresAt: '2030-01-01T00:00:00.000Z', status: 'revoked',
    }]);
  } finally {
    api.get = originalGet;
  }
});

test('maps recoverable OAuth failures without exposing provider details', () => {
  assert.equal(getAiOAuthErrorMessage({ response: { data: { code: 'oauth_denied' } } }), 'A autorização foi cancelada. Você pode tentar novamente.');
  assert.equal(getAiOAuthErrorMessage({ response: { data: { code: 'oauth_expired' } } }), 'A autorização expirou. Inicie a conexão novamente.');
  assert.equal(getAiOAuthErrorMessage({ response: { data: { code: 'oauth_scope_insufficient' } } }), 'A autorização não incluiu as permissões necessárias. Tente novamente e aceite todas as permissões.');
  assert.equal(getAiOAuthErrorMessage(new Error('network')), 'Não foi possível concluir a conexão com o ChatGPT. Tente novamente.');
});
