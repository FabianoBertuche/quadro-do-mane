import { IsEnum, IsOptional, IsString } from 'class-validator';

/**
 * Define apenas a senha do usuário para um protocolo (imap/smtp).
 *
 * O host/porta/secure vêm do EmailTenantSetting (config do tenant) e o
 * e-mail (user) vem de User.email. Esse DTO só carrega o segredo do
 * colaborador, que será criptografado antes de persistir.
 */
export class SetEmailPasswordDto {
  @IsEnum(['imap', 'smtp'])
  protocol: 'imap' | 'smtp';

  @IsString()
  password: string;
}