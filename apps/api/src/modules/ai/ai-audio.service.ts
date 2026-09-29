import { BadRequestException, ForbiddenException, GoneException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestUser } from '../../common/interfaces/request-context.interface';
import { AiService, AiActor } from './ai.service';
import { AiResponseMode } from './dto/send-ai-message.dto';
import { SpeechToTextProvider } from './ports/speech-to-text.port';
import { TextToSpeechProvider } from './ports/text-to-speech.port';
import { TemporaryAudioService } from './media/temporary-audio.service';

export const SPEECH_TO_TEXT_PROVIDER = 'SPEECH_TO_TEXT_PROVIDER';
export const TEXT_TO_SPEECH_PROVIDER = 'TEXT_TO_SPEECH_PROVIDER';
export const MAX_AI_AUDIO_BYTES = 10 * 1024 * 1024;
export const AI_AUDIO_MIME_TYPES = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/m4a'] as const;

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
  ) {}

  async handleMessage(input: {
    conversationId: string;
    actor: RequestUser | AiActor;
    buffer: Buffer;
    mimeType: string;
    responseMode: AiResponseMode;
  }): Promise<AiMessageResponse> {
    this.validateAudio(input.buffer, input.mimeType);
    await this.requireConversation(input.actor, input.conversationId);

    let transcription: { text: string };
    try {
      transcription = await this.speechToText.transcribe({ buffer: input.buffer, mimeType: input.mimeType });
    } catch {
      throw new BadRequestException('Não foi possível transcrever o áudio');
    }
    if (!transcription.text?.trim()) throw new BadRequestException('O áudio não contém uma mensagem');

    const response = await this.ai.sendMessage(
      { ...input.actor, conversationId: input.conversationId },
      { text: transcription.text.trim(), responseMode: input.responseMode },
    );
    if (input.responseMode !== AiResponseMode.AUDIO) return response;

    return this.attachResponseAudio(input.actor, response);
  }

  async attachResponseAudio(actor: RequestUser | AiActor, response: AiMessageResponse): Promise<AiMessageResponse> {
    let synthesized: { audio: Buffer; mimeType: string };
    try {
      synthesized = await this.textToSpeech.synthesize({ text: response.assistantMessage.content ?? '', voice: 'alloy' });
    } catch {
      throw new BadRequestException('Não foi possível sintetizar a resposta');
    }
    const audioObjectKey = this.temporaryAudio.put(synthesized.audio, synthesized.mimeType);
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
    const audio = this.temporaryAudio.get(audioObjectKey);
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

  private validateAudio(buffer: Buffer, mimeType: string) {
    if (!AI_AUDIO_MIME_TYPES.includes(mimeType as (typeof AI_AUDIO_MIME_TYPES)[number])) {
      throw new BadRequestException('Tipo de áudio não permitido');
    }
    if (!buffer?.length || buffer.length > MAX_AI_AUDIO_BYTES) {
      throw new BadRequestException('O áudio excede o limite permitido');
    }
  }
}
