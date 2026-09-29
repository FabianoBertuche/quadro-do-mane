import assert from 'node:assert/strict';
import test from 'node:test';
import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS_KEY } from '../../common/decorators/require-permissions.decorator';
import { AiController } from './ai.controller';

test('AI controller exposes required guards and ai.use metadata', () => {
  const controller = AiController as any;
  const guards = Reflect.getMetadata(GUARDS_METADATA, controller);
  assert.equal(Array.isArray(guards), true);
  assert.equal(guards.length, 3);
  assert.deepEqual(Reflect.getMetadata(PERMISSIONS_KEY, controller), ['ai.use']);
});
