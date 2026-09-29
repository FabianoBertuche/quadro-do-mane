import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { DebugExceptionFilter } from './debug-exception.filter';

function host() {
  const result: { statusCode?: number; body?: unknown } = {};
  const response = {
    status: (statusCode: number) => {
      result.statusCode = statusCode;
      return { json: (body: unknown) => { result.body = body; } };
    },
  };
  return {
    result,
    http: { getResponse: () => response, getRequest: () => ({ method: 'POST', url: '/api/ai/audio' }) },
  };
}

test('sanitizes non-HTTP exception response and logs without sensitive details', () => {
  const filter = new DebugExceptionFilter();
  const boundary = host();
  const secret = 'token=provider-secret prompt=private prompt audio=private-audio';
  const logs: unknown[][] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => { logs.push(args); };

  try {
    filter.catch(new Error(secret), { switchToHttp: () => boundary.http } as any);
  } finally {
    console.error = originalError;
  }

  assert.equal(boundary.result.statusCode, 500);
  assert.deepEqual(boundary.result.body, {
    statusCode: 500,
    message: 'Internal server error',
    error: 'Internal server error',
    path: '/api/ai/audio',
  });
  assert.equal(JSON.stringify(logs).includes(secret), false);
  assert.equal(JSON.stringify(logs).includes('provider-secret'), false);
  assert.equal(JSON.stringify(logs).includes('private-audio'), false);
});

test('preserves existing HTTP exception response format', () => {
  const filter = new DebugExceptionFilter();
  const boundary = host();
  filter.catch(new BadRequestException('Formato inválido'), { switchToHttp: () => boundary.http } as any);

  assert.equal(boundary.result.statusCode, 400);
  assert.deepEqual(boundary.result.body, { statusCode: 400, message: 'Formato inválido', error: 'Bad Request' });
});
