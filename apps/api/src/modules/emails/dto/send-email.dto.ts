import { IsString, MinLength } from 'class-validator';

/**
 * POST /emails/send — composição de e-mail novo.
 * O e-mail do remetente vem de User.email; o servidor SMTP vem do tenant.
 */
export class SendEmailDto {
  @IsString()
  to: string;

  @IsString()
  subject: string;

  @IsString()
  @MinLength(1)
  content: string;
}