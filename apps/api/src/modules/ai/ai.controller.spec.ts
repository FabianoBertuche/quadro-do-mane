import assert from 'node:assert/strict';
import test from 'node:test';
import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS_KEY } from '../../common/decorators/require-permissions.decorator';
import { AiController } from './ai.controller';
import { AiResponseMode } from './dto/send-ai-message.dto';

test('AI controller exposes required guards and ai.use metadata', () => {
  const controller = AiController as any;
  const guards = Reflect.getMetadata(GUARDS_METADATA, controller);
  assert.equal(Array.isArray(guards), true);
  assert.equal(guards.length, 3);
  assert.deepEqual(Reflect.getMetadata(PERMISSIONS_KEY, controller), ['ai.use']);
});

test('text messages in AUDIO mode are synthesized before returning the same envelope', async () => {
  const sent = { assistantMessage: { id: 'assistant-1', content: 'Resposta' }, message: { id: 'user-1' }, proposals: [] };
  let attached = 0;
  const controller = new AiController(
    { sendMessage: async () => sent } as any,
    { attachResponseAudio: async (_user: unknown, response: unknown) => { attached += 1; return { ...response as object, audioObjectKey: 'audio-key' }; } } as any,
  );

  const result = await controller.sendMessage({ tenantId: 'tenant-a' }, 'conversation-1', { responseMode: AiResponseMode.AUDIO, text: 'olá' });

  assert.equal(attached, 1);
  assert.equal((result as any).audioObjectKey, 'audio-key');
});
