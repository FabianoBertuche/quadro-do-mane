import { BadRequestException, ForbiddenException, GoneException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestUser } from '../../common/interfaces/request-context.interface';
import { AiService, AiActor } from './ai.service';
import { AiResponseMode } from './dto/send-ai-message.dto';
import { SpeechToTextProvider } from './ports/speech-to-text.port';
import { TextToSpeechProvider } from './ports/text-to-speech.port';
import { TemporaryAudioService } from './media/temporary-audio.service';
import { parseBuffer } from 'music-metadata';

export const SPEECH_TO_TEXT_PROVIDER = 'SPEECH_TO_TEXT_PROVIDER';
export const TEXT_TO_SPEECH_PROVIDER = 'TEXT_TO_SPEECH_PROVIDER';
const positiveEnv = (key: string, fallback: number) => {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
};
export const MAX_AI_AUDIO_BYTES = positiveEnv('AI_AUDIO_MAX_BYTES', 10 * 1024 * 1024);
export const MAX_AI_AUDIO_DURATION_SECONDS = positiveEnv('AI_AUDIO_MAX_DURATION_SECONDS', 5 * 60);
export const AI_AUDIO_MIME_TYPES = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/m4a'] as const;

export interface AiAudioLimits {
  maxBytes: number;
  maxDurationSeconds: number;
}

export interface AiMessageResponse {
  message: any;
  assistantMessage: any;
  proposals: any[];
  proposal?: any;
  audioObjectKey?: string;
}

@Injectable()
export class AiAudioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    @Inject(SPEECH_TO_TEXT_PROVIDER) private readonly speechToText: SpeechToTextProvider,
    @Inject(TEXT_TO_SPEECH_PROVIDER) private readonly textToSpeech: TextToSpeechProvider,
    private readonly temporaryAudio: TemporaryAudioService,
    limits: Partial<AiAudioLimits> = {},
    private readonly audit?: { record(input: { tenantId: string; actorTenantUserId: string; actorUserId?: string; action: string; targetId?: string; metadata?: Record<string, unknown> }): Promise<void> },
  ) {
    this.limits = { maxBytes: MAX_AI_AUDIO_BYTES, maxDurationSeconds: MAX_AI_AUDIO_DURATION_SECONDS, ...limits };
  }

  private readonly limits: AiAudioLimits;

  async handleMessage(input: {
    conversationId: string;
    actor: RequestUser | AiActor;
    buffer: Buffer;
    mimeType: string;
    responseMode: AiResponseMode;
  }): Promise<AiMessageResponse> {
    await this.validateAudio(input.buffer, input.mimeType);
    await this.requireConversation(input.actor, input.conversationId);
    try {
      await this.ai.reserveRateLimit(input.actor, 1);
    } catch (error) {
      await this.audit?.record({ tenantId: input.actor.tenantId, actorTenantUserId: input.actor.tenantUserId, actorUserId: input.actor.userId, action: 'rate_limit.failed', targetId: input.conversationId, metadata: { status: 'failed' } });
      throw error;
    }

    let transcription: { text: string };
    try {
      transcription = await this.speechToText.transcribe({ buffer: input.buffer, mimeType: input.mimeType });
    } catch {
      await this.audit?.record({ tenantId: input.actor.tenantId, actorTenantUserId: input.actor.tenantUserId, actorUserId: input.actor.userId, action: 'stt.failed', targetId: input.conversationId, metadata: { provider: 'SPEECH_TO_TEXT', status: 'failed' } });
      throw new BadRequestException('Não foi possível transcrever o áudio');
    }
    if (!transcription.text?.trim()) throw new BadRequestException('O áudio não contém uma mensagem');

    const response = await this.ai.sendMessage(
      { ...input.actor, conversationId: input.conversationId, rateLimitReserved: true },
      { text: transcription.text.trim(), responseMode: input.responseMode, inputFormat: AiResponseMode.AUDIO },
    );
    if (input.responseMode !== AiResponseMode.AUDIO) return response;

    return this.attachResponseAudio(input.actor, response);
  }

  async attachResponseAudio(actor: RequestUser | AiActor, response: AiMessageResponse): Promise<AiMessageResponse> {
    let synthesized: { audio: Buffer; mimeType: string };
    try {
      synthesized = await this.textToSpeech.synthesize({ text: response.assistantMessage.content ?? '', voice: 'alloy' });
    } catch {
      await this.audit?.record({ tenantId: actor.tenantId, actorTenantUserId: actor.tenantUserId, actorUserId: actor.userId, action: 'tts.failed', targetId: response.assistantMessage.id, metadata: { provider: 'TEXT_TO_SPEECH', status: 'failed' } });
      throw new BadRequestException('Não foi possível sintetizar a resposta');
    }
    const audioObjectKey = await this.temporaryAudio.put(synthesized.audio, synthesized.mimeType);
    await this.prisma.aiMessage.update({
      where: { id: response.assistantMessage.id },
      data: { audioObjectKey },
    });
    return { ...response, audioObjectKey };
  }

  async getAudio(actor: RequestUser | AiActor, audioObjectKey: string) {
    const message = await this.prisma.aiMessage.findFirst({
      where: {
        audioObjectKey,
        tenantId: actor.tenantId,
        conversation: { ownerTenantUserId: actor.tenantUserId },
      },
    });
    if (!message) throw new ForbiddenException('Áudio não encontrado');
    const audio = await this.temporaryAudio.get(audioObjectKey);
    if (!audio) throw new GoneException('O áudio expirou');
    return audio;
  }

  private async requireConversation(actor: RequestUser | AiActor, conversationId: string) {
    const conversation = await this.prisma.aiConversation.findFirst({
      where: { id: conversationId, tenantId: actor.tenantId, ownerTenantUserId: actor.tenantUserId },
    });
    if (!conversation) throw new ForbiddenException('Conversa não encontrada');
    return conversation;
  }

  private async validateAudio(buffer: Buffer, mimeType: string) {
    if (!AI_AUDIO_MIME_TYPES.includes(mimeType as (typeof AI_AUDIO_MIME_TYPES)[number])) {
      throw new BadRequestException('Tipo de áudio não permitido');
    }
    if (!buffer?.length || buffer.length > this.limits.maxBytes) {
      throw new BadRequestException('O áudio excede o limite permitido');
    }
    let durationSeconds: number | undefined;
    try {
      durationSeconds = (await parseBuffer(buffer, mimeType)).format.duration;
    } catch {
      durationSeconds = undefined;
    }
    if (!durationSeconds || !Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > this.limits.maxDurationSeconds) {
      throw new BadRequestException('A duração do áudio excede o limite permitido');
    }
  }
}
