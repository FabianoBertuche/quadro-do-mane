import { IsString, IsUUID, MinLength } from 'class-validator';

/**
 * POST /emails/reply — responde uma mensagem existente.
 *
 * O backend abre o IMAP para buscar os headers Message-ID e References
 * da mensagem original (uid), monta o reply com In-Reply-To/References
 * e envia via SMTP. Mantém o thread coerente do lado do destinatário.
 */
export class ReplyEmailDto {
  @IsString()
  uid: string;

  @IsString()
  @MinLength(1)
  body: string;
}