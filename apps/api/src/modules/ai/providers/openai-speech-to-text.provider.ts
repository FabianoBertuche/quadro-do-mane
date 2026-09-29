import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';
import { SpeechToTextProvider } from '../ports/speech-to-text.port';
import { OpenAiClientFactory } from './openai.provider';

export class OpenAiSpeechToTextProvider implements SpeechToTextProvider {
  private readonly client: Pick<OpenAI, 'audio'>;
  private readonly model: string;

  constructor(config: ConfigService, clientFactory: OpenAiClientFactory) {
    const apiKey = config.get<string>('OPENAI_API_KEY');
    if (!apiKey) throw new Error('OpenAI provider is not configured');
    this.client = clientFactory(apiKey, 20_000);
    this.model = config.get<string>('OPENAI_STT_MODEL', 'gpt-4o-mini-transcribe');
  }

  async transcribe(input: { buffer: Buffer; mimeType: string }): Promise<{ text: string }> {
    try {
      const file = new File([input.buffer as unknown as BlobPart], `audio.${input.mimeType.split('/')[1] ?? 'bin'}`, {
        type: input.mimeType,
      });
      const response = await this.client.audio.transcriptions.create({ file, model: this.model });
      return { text: response.text };
    } catch {
      throw new Error('Speech-to-text provider request failed');
    }
  }
}
