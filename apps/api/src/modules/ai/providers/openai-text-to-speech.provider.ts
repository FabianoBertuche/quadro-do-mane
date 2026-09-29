import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';
import { TextToSpeechProvider } from '../ports/text-to-speech.port';
import { getAiRequestTimeout, OpenAiClientFactory } from './openai.provider';

export class OpenAiTextToSpeechProvider implements TextToSpeechProvider {
  private readonly client: Pick<OpenAI, 'audio'>;
  private readonly model: string;

  constructor(config: ConfigService, clientFactory: OpenAiClientFactory) {
    const apiKey = config.get<string>('OPENAI_API_KEY');
    if (!apiKey) throw new Error('OpenAI provider is not configured');
    this.client = clientFactory(apiKey, getAiRequestTimeout(config));
    this.model = config.get<string>('OPENAI_TTS_MODEL', 'gpt-4o-mini-tts');
  }

  async synthesize(input: { text: string; voice: string }): Promise<{ audio: Buffer; mimeType: string }> {
    try {
      const response = await this.client.audio.speech.create({
        model: this.model,
        voice: input.voice,
        input: input.text,
      });
      const contentType = response.headers.get('content-type')?.split(';')[0] || 'audio/mpeg';
      return { audio: Buffer.from(await response.arrayBuffer()), mimeType: contentType };
    } catch {
      throw new Error('Text-to-speech provider request failed');
    }
  }
}
