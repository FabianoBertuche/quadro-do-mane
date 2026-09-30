import assert from 'node:assert/strict';
import test from 'node:test';
import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS_KEY } from '../../common/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';
import { AiOAuthController } from './ai-oauth.controller';

const actor = { tenantId: 'tenant-a', tenantUserId: 'user-a' };

test('OAuth controller is protected by JWT, tenant, permission, and ai.use', () => {
  const guards = Reflect.getMetadata(GUARDS_METADATA, AiOAuthController) as Function[];
  assert.equal(guards.length, 3);
  assert.equal(guards.includes(TenantContextGuard), true);
  assert.equal(guards.includes(PermissionGuard), true);
  assert.deepEqual(Reflect.getMetadata(PERMISSIONS_KEY, AiOAuthController), ['ai.use']);
});

test('start delegates the authenticated tenant user and does not expose verifier material', async () => {
  const service = { startAuthorization: async (received: unknown) => { assert.deepEqual(received, actor); return { authorizationUrl: 'https://auth.example/authorize?state=state', attemptId: 'attempt-1', expiresAt: '2030-01-01T00:00:00.000Z', verifier: 'secret' }; } };
  const controller = new AiOAuthController(service as any, {} as any);

  const result = await controller.start(actor as any);

  assert.deepEqual(result, { authorizationUrl: 'https://auth.example/authorize?state=state', attemptId: 'attempt-1', expiresAt: '2030-01-01T00:00:00.000Z' });
  assert.equal('verifier' in result, false);
});

test('complete passes callback URL with the authenticated tenant user and redacts internal connection fields', async () => {
  const service = { completeAuthorization: async (received: unknown, callbackUrl: string) => { assert.deepEqual(received, actor); assert.equal(callbackUrl, 'http://127.0.0.1:1455/auth/callback?code=code'); return { id: 'connection-1', issuer: 'https://auth.example', subject: 'subject', clientId: 'client', email: 'person@example.com', displayName: 'Person', scopes: ['openid'], expiresAt: '2030-01-01T00:00:00.000Z', isRevoked: false, lastUsedAt: null, accessToken: 'secret' }; } };
  const controller = new AiOAuthController(service as any, {} as any);

  const result = await controller.complete(actor as any, { callbackUrl: 'http://127.0.0.1:1455/auth/callback?code=code' });

  assert.deepEqual(result, { id: 'connection-1', provider: 'https://auth.example', email: 'person@example.com', scopes: ['openid'], expiresAt: '2030-01-01T00:00:00.000Z', status: 'connected' });
  assert.equal('accessToken' in result, false);
  assert.equal('subject' in result, false);
  assert.equal('clientId' in result, false);
});

test('connections query is scoped to the current tenant user and returns only metadata', async () => {
  let query: any;
  const service = { toConnectionView: (connection: any) => ({ ...connection, scopes: ['openid'] }) };
  const prisma = { aiOAuthConnection: { findMany: async (args: any) => { query = args; return [{ id: 'connection-1', issuer: 'https://auth.example', email: 'person@example.com', scopes: 'openid', expiresAt: new Date('2030-01-01'), isRevoked: false }]; } } };
  const controller = new AiOAuthController(service as any, prisma as any);

  const result = await controller.connections(actor as any);

  assert.deepEqual(query.where, { tenantId: 'tenant-a', tenantUserId: 'user-a' });
  assert.deepEqual(result, [{ id: 'connection-1', provider: 'https://auth.example', email: 'person@example.com', scopes: ['openid'], expiresAt: '2030-01-01T00:00:00.000Z', status: 'connected' }]);
  assert.equal(JSON.stringify(result).includes('accessToken'), false);
  assert.equal(JSON.stringify(result).includes('verifier'), false);
});

test('refresh and disconnect pass the authenticated owner so cross-tenant ids cannot be operated', async () => {
  const calls: unknown[][] = [];
  const service = { refreshConnection: async (...args: unknown[]) => { calls.push(args); }, disconnectConnection: async (...args: unknown[]) => { calls.push(args); } };
  const controller = new AiOAuthController(service as any, {} as any);

  await controller.refresh(actor as any, 'connection-1');
  await controller.disconnect(actor as any, 'connection-2');

  assert.deepEqual(calls, [[actor, 'connection-1'], [actor, 'connection-2']]);
});
