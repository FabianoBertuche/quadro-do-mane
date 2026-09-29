import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { AiResponseMode } from './send-ai-message.dto';

export class SendAiAudioDto {
  @IsEnum(AiResponseMode)
  responseMode!: AiResponseMode;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(300)
  durationSeconds?: number;
}
