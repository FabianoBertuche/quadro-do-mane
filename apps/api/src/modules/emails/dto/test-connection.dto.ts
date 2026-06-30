import { IsString, MinLength } from 'class-validator';

/**
 * Body de POST /emails/test-connection.
 *
 * Usa a senha informada para tentar autenticar IMAP e SMTP com o servidor
 * configurado no tenant. Não persiste nada — serve apenas para diagnóstico.
 */
export class TestEmailConnectionDto {
  @IsString()
  @MinLength(1)
  password: string;
}