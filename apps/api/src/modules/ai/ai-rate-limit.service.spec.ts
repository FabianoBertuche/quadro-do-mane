import assert from 'node:assert/strict';
import test from 'node:test';
import { ServiceUnavailableException, HttpException } from '@nestjs/common';
import { AiRateLimitService } from './ai-rate-limit.service';

const limits = { userRequestsPerMinute: 1, tenantRequestsPerMinute: 1, costUnitsPerMinute: 10 };
const actor = { tenantId: 'tenant-a', tenantUserId: 'user-a' };

test('atomically allows only one concurrent claim for a shared window', async () => {
  let claims = 0;
  const prisma = {
    $transaction: async (callback: (tx: any) => Promise<unknown>) => callback({
      $queryRaw: async () => claims++ === 0 ? [{ scopeKey: 'user' }, { scopeKey: 'tenant' }] : [],
    }),
  };
  const service = new AiRateLimitService(prisma as any, limits);

  const results = await Promise.allSettled([service.consume(actor, 1), service.consume(actor, 1)]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected' && (result.reason as HttpException).getStatus() === 429).length, 1);
});

test('fails closed before a provider when the bucket database is unavailable', async () => {
  const service = new AiRateLimitService({ $transaction: async () => { throw new Error('database unavailable'); } } as any, limits);

  await assert.rejects(() => service.consume(actor, 1), ServiceUnavailableException);
});
