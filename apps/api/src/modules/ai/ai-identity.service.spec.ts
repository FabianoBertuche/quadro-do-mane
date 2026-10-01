import assert from 'node:assert/strict';
import test from 'node:test';
import { NotFoundException } from '@nestjs/common';
import { AiIdentityContextService } from './ai-identity.service';

function serviceFor(user: { name: string; email?: string } | null) {
  const calls: any[] = [];
  const service = new AiIdentityContextService({
    tenantUser: {
      findFirst: async (args: any) => {
        calls.push(args);
        return user ? { user } : null;
      },
    },
  } as any);
  return { service, calls };
}

test('resolves the registered name without exposing email', async () => {
  const { service, calls } = serviceFor({ name: 'Maria da Silva', email: 'maria@example.com' });

  const result = await service.resolve({ tenantId: 'tenant-a', tenantUserId: 'tenant-user-a' });

  assert.deepEqual(result, { name: 'Maria da Silva', address: 'Maria da Silva' });
  assert.equal('email' in result, false);
  assert.deepEqual(calls[0].where, { id: 'tenant-user-a', tenantId: 'tenant-a' });
  assert.deepEqual(calls[0].select, { user: { select: { name: true } } });
});

test('assigns pai only to the normalized Emanuel Barsotini account name', async () => {
  const { service } = serviceFor({ name: '  Emanuel   Barsotini ' });

  await assert.doesNotReject(async () => {
    assert.deepEqual(await service.resolve({ tenantId: 'tenant-a', tenantUserId: 'user-a' }), {
      name: '  Emanuel   Barsotini ',
      address: 'pai',
    });
  });
});

test('assigns Coronel only to the normalized Alexandre Bergamasco account name', async () => {
  const { service } = serviceFor({ name: 'Alexandre Bergamasco' });

  assert.deepEqual(await service.resolve({ tenantId: 'tenant-a', tenantUserId: 'user-a' }), {
    name: 'Alexandre Bergamasco',
    address: 'Coronel',
  });
});

test('fails when the tenant user is missing', async () => {
  const { service } = serviceFor(null);

  await assert.rejects(
    () => service.resolve({ tenantId: 'tenant-a', tenantUserId: 'missing' }),
    NotFoundException,
  );
});
