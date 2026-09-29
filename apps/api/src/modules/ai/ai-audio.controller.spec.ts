import assert from 'node:assert/strict';
import test from 'node:test';
import 'reflect-metadata';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA, INTERCEPTORS_METADATA, PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { AiAudioController, AI_AUDIO_UPLOAD_OPTIONS } from './ai-audio.controller';
import { PERMISSIONS_KEY } from '../../common/decorators/require-permissions.decorator';
import { TemporaryAudioService } from './media/temporary-audio.service';
import { MAX_AI_AUDIO_BYTES } from './ai-audio.service';

const actor = { userId: 'user-1', tenantId: 'tenant-a', tenantUserId: 'tenant-user-a' } as any;

test('audio controller has JWT, tenant, permission guards and ai.use metadata', () => {
  const guards = Reflect.getMetadata(GUARDS_METADATA, AiAudioController);
  assert.equal(guards.length, 3);
  assert.deepEqual(Reflect.getMetadata(PERMISSIONS_KEY, AiAudioController), ['ai.use']);
});

test('audio endpoint is multipart with the fixed field, MIME filter and size limit', () => {
  const prototype = AiAudioController.prototype;
  assert.equal(Reflect.getMetadata(PATH_METADATA, prototype.handleMessage), 'conversations/:id/audio');
  assert.equal(Reflect.getMetadata(METHOD_METADATA, prototype.handleMessage), RequestMethod.POST);
  assert.ok(Reflect.getMetadata(INTERCEPTORS_METADATA, prototype.handleMessage)?.length);
  assert.equal(AI_AUDIO_UPLOAD_OPTIONS.fieldName, 'audio');
  assert.equal(AI_AUDIO_UPLOAD_OPTIONS.limits.fileSize, MAX_AI_AUDIO_BYTES);

  let rejected: unknown;
  AI_AUDIO_UPLOAD_OPTIONS.fileFilter({}, { mimetype: 'text/plain' } as any, (error: Error | null) => { rejected = error; });
  assert.ok(rejected instanceof BadRequestException);
  let accepted = false;
  AI_AUDIO_UPLOAD_OPTIONS.fileFilter({}, { mimetype: 'audio/mpeg' } as any, (error: Error | null) => { accepted = !error; });
  assert.equal(accepted, true);
});

test('download verifies ownership through the service and sends the audio content type', async () => {
  const service = { getAudio: async (user: any, key: string) => {
    assert.equal(user, actor);
    assert.equal(key, 'opaque-key');
    return { audio: Buffer.from('response'), mimeType: 'audio/mpeg' };
  } };
  const controller = new AiAudioController(service as any);
  const response = { type: (mime: string) => { response.contentType = mime; return response; }, send: (body: Buffer) => { response.body = body; return response; } } as any;

  await controller.download(actor, 'opaque-key', response);

  assert.equal(response.contentType, 'audio/mpeg');
  assert.deepEqual(response.body, Buffer.from('response'));
});

test('controller does not expose provider tokens, audio bytes or unexpected media errors', async () => {
  const secret = 'token=provider-secret audio=private-bytes';
  const controller = new AiAudioController({
    handleMessage: async () => { throw new Error(secret); },
    getAudio: async () => { throw new Error(secret); },
  } as any);
  const file = { buffer: Buffer.from('private-bytes'), mimetype: 'audio/mpeg' } as any;

  await assert.rejects(() => controller.handleMessage(actor, 'conversation-1', { responseMode: 'TEXT' } as any, file), (error: Error) => {
    assert.equal(error.message, 'Não foi possível processar o áudio');
    assert.equal(error.message.includes('provider-secret'), false);
    return true;
  });
  await assert.rejects(() => controller.download(actor, 'opaque-key', {} as any), (error: Error) => error.message === 'Não foi possível obter o áudio');
});

test('service ownership boundary rejects a different tenant conversation', async () => {
  const media = new TemporaryAudioService();
  const service = {
    getAudio: async () => { throw new ForbiddenException('Áudio não encontrado'); },
  };
  const controller = new AiAudioController(service as any);
  await assert.rejects(() => controller.download({ ...actor, tenantId: 'tenant-b' }, 'opaque-key', {} as any), ForbiddenException);
  assert.equal(await media.get('opaque-key'), undefined);
});
