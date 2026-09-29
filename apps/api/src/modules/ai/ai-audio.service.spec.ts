import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AiAudioService } from './ai-audio.service';
import { TemporaryAudioService } from './media/temporary-audio.service';
import { AiResponseMode } from './dto/send-ai-message.dto';

const actor = { tenantId: 'tenant-a', tenantUserId: 'user-a', userId: 'user-1' };

function wav(seconds = 1) {
  const sampleRate = 8_000;
  const dataSize = sampleRate * seconds * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(36 + dataSize, 4); buffer.write('WAVE', 8);
  buffer.write('fmt ', 12); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22); buffer.writeUInt32LE(sampleRate, 24); buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

function setup(overrides: {
  conversation?: unknown;
  transcribe?: (input: { buffer: Buffer; mimeType: string }) => Promise<{ text: string }>;
  synthesize?: (input: { text: string; voice: string }) => Promise<{ audio: Buffer; mimeType: string }>;
  limits?: { maxBytes?: number; maxDurationSeconds?: number };
} = {}) {
  const transcriptions: unknown[] = [];
  const synthesized: unknown[] = [];
  const sent: unknown[] = [];
  const updates: unknown[] = [];
  const auditLog: unknown[] = [];
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
    reserveRateLimit: async () => undefined,
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
  const audit = { record: async (entry: unknown) => auditLog.push(entry) };
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
  const service = new AiAudioService(prisma as any, ai as any, stt as any, tts as any, media, overrides.limits, audit as any);
  return { service, media, transcriptions, synthesized, sent, updates, auditLog };
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

test('rejects malformed audio without a verifiable duration before calling STT', async () => {
  const { service, transcriptions } = setup({ limits: { maxDurationSeconds: 30 } });

  await assert.rejects(
    () => service.handleMessage({ conversationId: 'conversation-1', actor, buffer: Buffer.from('audio'), mimeType: 'audio/wav', responseMode: AiResponseMode.TEXT }),
    BadRequestException,
  );
  assert.equal(transcriptions.length, 0);
});

test('reserves the shared rate limit before calling STT', async () => {
  const order: string[] = [];
  const { service, transcriptions } = setup();
  (service as any).ai.reserveRateLimit = async () => { order.push('rate'); };
  (service as any).speechToText.transcribe = async () => { order.push('stt'); return { text: 'safe' }; };

  await service.handleMessage({ conversationId: 'conversation-1', actor, buffer: wav(1), mimeType: 'audio/wav', responseMode: AiResponseMode.TEXT });
  assert.deepEqual(order, ['rate', 'stt']);
  assert.equal(transcriptions.length, 0);
});

test('uses server-inspected duration instead of trusting the client duration', async () => {
  const { service, transcriptions } = setup({ limits: { maxDurationSeconds: 2 } });

  await service.handleMessage({ conversationId: 'conversation-1', actor, buffer: wav(1), mimeType: 'audio/wav', durationSeconds: 999, responseMode: AiResponseMode.TEXT } as any);
  assert.equal(transcriptions.length, 1);
});

test('rejects server-inspected audio duration above the configured limit', async () => {
  const { service, transcriptions } = setup({ limits: { maxDurationSeconds: 1 } });

  await assert.rejects(
    () => service.handleMessage({ conversationId: 'conversation-1', actor, buffer: wav(2), mimeType: 'audio/wav', responseMode: AiResponseMode.TEXT }),
    BadRequestException,
  );
  assert.equal(transcriptions.length, 0);
});

test('accepts a server-parseable audio MIME emitted by recording', async () => {
  const { service, transcriptions } = setup();

  await service.handleMessage({ conversationId: 'conversation-1', actor, buffer: wav(1), mimeType: 'audio/wav', responseMode: AiResponseMode.TEXT });

  assert.equal(transcriptions.length, 1);
  assert.equal((transcriptions[0] as any).mimeType, 'audio/wav');
});

test('requires conversation ownership before sending audio to the provider', async () => {
  const { service, transcriptions } = setup({ conversation: null });

  await assert.rejects(
    () => service.handleMessage({ conversationId: 'conversation-1', actor: { ...actor, tenantId: 'tenant-b' }, buffer: wav(1), mimeType: 'audio/wav', responseMode: AiResponseMode.TEXT }),
    ForbiddenException,
  );
  assert.equal(transcriptions.length, 0);
});

test('transcribes audio and returns the existing text response envelope', async () => {
  const { service, sent } = setup();

  const result = await service.handleMessage({ conversationId: 'conversation-1', actor, buffer: wav(1), mimeType: 'audio/wav', responseMode: AiResponseMode.TEXT });

  assert.equal(result.assistantMessage.content, 'Resposta sintetizável');
  assert.deepEqual((sent[0] as any).dto, { text: 'transcrição segura', responseMode: AiResponseMode.TEXT });
});

test('creates temporary response audio and persists only its opaque object key', async () => {
  const { service, media, synthesized, updates } = setup();

  const result = await service.handleMessage({ conversationId: 'conversation-1', actor, buffer: wav(1), mimeType: 'audio/wav', responseMode: AiResponseMode.AUDIO });
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
  const { service, auditLog } = setup({ transcribe: async () => { throw new Error('provider token secret'); } });

  await assert.rejects(
    () => service.handleMessage({ conversationId: 'conversation-1', actor, buffer: wav(1), mimeType: 'audio/wav', responseMode: AiResponseMode.TEXT }),
    (error: Error) => error.message === 'Não foi possível transcrever o áudio',
  );
  assert.equal((auditLog[0] as any).action, 'stt.failed');
  assert.doesNotMatch(JSON.stringify(auditLog), /provider token secret/);
});

test('audits TTS failures without exposing response content or provider errors', async () => {
  const { service, auditLog } = setup({ synthesize: async () => { throw new Error('tts provider token'); } });

  await assert.rejects(() => service.attachResponseAudio(actor, { message: {}, assistantMessage: { id: 'assistant-message', content: 'private response' }, proposals: [] } as any));
  assert.equal((auditLog[0] as any).action, 'tts.failed');
  assert.doesNotMatch(JSON.stringify(auditLog), /private response|tts provider token/);
});
