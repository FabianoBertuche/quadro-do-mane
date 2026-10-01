import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class UpdateOllamaApiKeyDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  apiKey!: string;
}