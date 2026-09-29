import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AiAudioService } from './ai-audio.service';
import { TemporaryAudioService } from './media/temporary-audio.service';
import { AiResponseMode } from './dto/send-ai-message.dto';

const actor = { tenantId: 'tenant-a', tenantUserId: 'user-a', userId: 'user-1' };

function setup(overrides: {
  conversation?: unknown;
  transcribe?: (input: { buffer: Buffer; mimeType: string }) => Promise<{ text: string }>;
  synthesize?: (input: { text: string; voice: string }) => Promise<{ audio: Buffer; mimeType: string }>;
} = {}) {
  const transcriptions: unknown[] = [];
  const synthesized: unknown[] = [];
  const sent: unknown[] = [];
  const updates: unknown[] = [];
  const prisma = {
    aiConversation: {
      findFirst: async ({ where }: any) => overrides.conversation === undefined
        ? where.id === 'conversation-1' && where.tenantId === actor.tenantId && where.ownerTenantUserId === actor.tenantUserId
          ? { id: 'conversation-1', tenantId: actor.tenantId, ownerTenantUserId: actor.tenantUserId }
          : null
        : overrides.conversation,
    },
    aiMessage: {
      findFirst: async ({ where }: any) => where.audioObjectKey === 'audio-key' && where.tenantId === actor.tenantId && where.conversation?.ownerTenantUserId === actor.tenantUserId
        ? { id: 'assistant-message', audioObjectKey: 'audio-key' }
        : null,
      update: async ({ where, data }: any) => {
        updates.push({ where, data });
        return { id: where.id, ...data };
      },
    },
  };
  const ai = {
    sendMessage: async (input: any, dto: any) => {
      sent.push({ input, dto });
      return {
        message: { id: 'user-message', content: dto.text },
        assistantMessage: { id: 'assistant-message', content: 'Resposta sintetizável' },
        proposals: [],
        proposal: undefined,
      };
    },
  };
  const stt = {
    transcribe: async (input: { buffer: Buffer; mimeType: string }) => {
      transcriptions.push(input);
      return overrides.transcribe ? overrides.transcribe(input) : { text: 'transcrição segura' };
    },
  };
  const tts = {
    synthesize: async (input: { text: string; voice: string }) => {
      synthesized.push(input);
      return overrides.synthesize ? overrides.synthesize(input) : { audio: Buffer.from('audio'), mimeType: 'audio/mpeg' };
    },
  };
  const media = new TemporaryAudioService({ retentionMs: 60_000 } as any);
  const service = new AiAudioService(prisma as any, ai as any, stt as any, tts as any, media);
  return { service, media, transcriptions, synthesized, sent, updates };
}

test('rejects unsupported MIME types and oversized audio before calling STT', async () => {
  const { service, transcriptions } = setup();

  await assert.rejects(
    () => service.handleMessage({ conversationId: 'conversation-1', actor, buffer: Buffer.from('x'), mimeType: 'text/plain', responseMode: AiResponseMode.TEXT }),
    BadRequestException,
  );
  await assert.rejects(
    () => service.handleMessage({ conversationId: 'conversation-1', actor, buffer: Buffer.alloc(10 * 1024 * 1024 + 1), mimeType: 'audio/mpeg', responseMode: AiResponseMode.TEXT }),
    BadRequestException,
  );
  assert.equal(transcriptions.length, 0);
});

test('requires conversation ownership before sending audio to the provider', async () => {
  const { service, transcriptions } = setup({ conversation: null });

  await assert.rejects(
    () => service.handleMessage({ conversationId: 'conversation-1', actor: { ...actor, tenantId: 'tenant-b' }, buffer: Buffer.from('x'), mimeType: 'audio/mpeg', responseMode: AiResponseMode.TEXT }),
    ForbiddenException,
  );
  assert.equal(transcriptions.length, 0);
});

test('transcribes audio and returns the existing text response envelope', async () => {
  const { service, sent } = setup();

  const result = await service.handleMessage({ conversationId: 'conversation-1', actor, buffer: Buffer.from('audio'), mimeType: 'audio/mpeg', responseMode: AiResponseMode.TEXT });

  assert.equal(result.assistantMessage.content, 'Resposta sintetizável');
  assert.deepEqual((sent[0] as any).dto, { text: 'transcrição segura', responseMode: AiResponseMode.TEXT });
});

test('creates temporary response audio and persists only its opaque object key', async () => {
  const { service, media, synthesized, updates } = setup();

  const result = await service.handleMessage({ conversationId: 'conversation-1', actor, buffer: Buffer.from('audio'), mimeType: 'audio/wav', responseMode: AiResponseMode.AUDIO });
  const audioObjectKey = result.audioObjectKey;

  assert.equal((synthesized[0] as any).voice, 'alloy');
  assert.ok(audioObjectKey);
  assert.match(audioObjectKey, /^[a-zA-Z0-9_-]+$/);
  assert.deepEqual(updates, [{ where: { id: 'assistant-message' }, data: { audioObjectKey } }]);
  assert.deepEqual(media.get(audioObjectKey), { audio: Buffer.from('audio'), mimeType: 'audio/mpeg' });
});

test('temporary audio is removed after its retention window', () => {
  const media = new TemporaryAudioService({ retentionMs: 1 } as any);
  const key = media.put(Buffer.from('secret audio'), 'audio/mpeg');

  assert.deepEqual(media.get(key), { audio: Buffer.from('secret audio'), mimeType: 'audio/mpeg' });
  media.cleanup(Date.now() + 2);
  assert.equal(media.get(key), undefined);
});

test('download lookup requires the owning tenant user', async () => {
  const { service, media } = setup();
  const key = media.put(Buffer.from('audio'), 'audio/mpeg');
  await assert.rejects(() => service.getAudio({ ...actor, tenantId: 'tenant-b' }, key), ForbiddenException);
  await assert.rejects(() => service.getAudio(actor, 'missing-key'), ForbiddenException);
});

test('provider failures are propagated without exposing provider details', async () => {
  const { service } = setup({ transcribe: async () => { throw new Error('provider token secret'); } });

  await assert.rejects(
    () => service.handleMessage({ conversationId: 'conversation-1', actor, buffer: Buffer.from('audio'), mimeType: 'audio/mpeg', responseMode: AiResponseMode.TEXT }),
    (error: Error) => error.message === 'Não foi possível transcrever o áudio',
  );
});
