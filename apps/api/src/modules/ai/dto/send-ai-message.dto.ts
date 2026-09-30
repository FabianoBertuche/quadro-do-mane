import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export enum AiResponseMode {
  TEXT = 'TEXT',
  AUDIO = 'AUDIO',
}

export class SendAiMessageDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  text?: string;

  @IsEnum(AiResponseMode)
  responseMode!: AiResponseMode;

  @IsOptional()
  @IsUUID()
  contextProjectId?: string;

  /** Internal transport marker; multipart audio sets this to AUDIO. */
  @IsOptional()
  @IsEnum(AiResponseMode)
  inputFormat?: AiResponseMode;
}
