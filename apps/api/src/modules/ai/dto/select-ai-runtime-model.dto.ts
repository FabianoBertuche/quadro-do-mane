import { IsIn, IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import type { AiProviderName } from '../ai-server-runtime.service';

/** Seleção global de modelo: provedor + `slug` do catálogo, nada mais. */
export class SelectAiRuntimeModelDto {
  @IsIn(['chatgpt', 'ollama'])
  provider!: AiProviderName;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(200)
  slug!: string;
}