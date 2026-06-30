import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

/**
 * DTO para configurar o servidor IMAP/SMTP no nível do TENANT.
 *
 * O admin preenche UMA vez e todos os colaboradores usam estes hosts.
 * Cada colaborador cadastra individualmente apenas sua senha.
 *
 * detectionMode:
 *  - PRESET: o admin escolhe um preset conhecido (montemoria, gmail, etc.).
 *    Os campos host/port/secure são validados em cima do preset escolhido.
 *  - CUSTOM: o admin digita manualmente todos os campos.
 */
export class UpdateEmailTenantSettingsDto {
  @IsString()
  @Matches(/^[a-z0-9.-]+\.[a-z]{2,}$/i, { message: 'Domínio inválido (ex: montemoria.com.br)' })
  emailDomain: string;

  @IsEnum(['PRESET', 'CUSTOM'])
  detectionMode: 'PRESET' | 'CUSTOM';

  @IsOptional()
  @IsString()
  presetKey?: string;

  @IsString()
  imapHost: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  imapPort: number;

  @IsBoolean()
  imapSecure: boolean;

  @IsString()
  smtpHost: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  smtpPort: number;

  @IsBoolean()
  smtpSecure: boolean;
}