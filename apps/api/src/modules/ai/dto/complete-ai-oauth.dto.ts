import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class CompleteAiOAuthDto {
  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_protocol: true })
  callbackUrl!: string;
}
