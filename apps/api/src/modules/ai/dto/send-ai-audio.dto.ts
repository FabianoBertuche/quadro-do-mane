import { IsEnum } from 'class-validator';
import { AiResponseMode } from './send-ai-message.dto';

export class SendAiAudioDto {
  @IsEnum(AiResponseMode)
  responseMode!: AiResponseMode;
}
