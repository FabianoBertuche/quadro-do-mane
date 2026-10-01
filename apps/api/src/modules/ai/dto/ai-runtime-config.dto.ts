import { IsIn, IsOptional } from 'class-validator';
import type { AiProviderName } from '../ai-server-runtime.service';

export class SetAiRuntimePrimaryDto {
  @IsIn(['chatgpt', 'ollama'])
  provider!: AiProviderName;
}

export class SetAiRuntimeFailoverDto {
  @IsIn(['chatgpt', 'ollama'])
  @IsOptional()
  provider?: AiProviderName | null;
}