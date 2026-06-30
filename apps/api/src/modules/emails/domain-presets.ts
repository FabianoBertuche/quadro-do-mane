/**
 * Presets conhecidos de servidor IMAP/SMTP por domínio de e-mail.
 *
 * Estes são hosts PÚBLICOS e CURADOS — não devem conter credenciais ou
 * endereços internos. Servidores de provedores genéricos (gmail, outlook)
 * aparecem aqui para acelerar a configuração quando o domínio do usuário
 * bate com um provedor conhecido.
 *
 * Para servidores corporativos (montemoria.com.br etc.) o admin pode
 * optar pelo modo "Personalizado" e digitar os hosts manualmente.
 */
export interface EmailServerPreset {
  /** chave estável usada para persistência */
  key: string;
  /** domínio que dispara o preset (lowercase) */
  domain: string;
  /** rótulo amigável para o front */
  label: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
}

export const EMAIL_DOMAIN_PRESETS: EmailServerPreset[] = [
  {
    key: 'montemoria',
    domain: 'montemoria.com.br',
    label: 'Montemoria (mail.montemoria.com.br)',
    imapHost: 'mail.montemoria.com.br',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'mail.montemoria.com.br',
    smtpPort: 465,
    smtpSecure: true,
  },
  {
    key: 'gmail',
    domain: 'gmail.com',
    label: 'Gmail (Google)',
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.gmail.com',
    smtpPort: 465,
    smtpSecure: true,
  },
  {
    key: 'office365',
    domain: 'outlook.com',
    label: 'Microsoft 365 / Outlook',
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.office365.com',
    smtpPort: 587,
    smtpSecure: false,
  },
];

/**
 * Procura um preset cujo domínio bate exatamente (case-insensitive).
 * Retorna `null` se nenhum preset corresponde ao domínio.
 */
export function findPresetByDomain(domain: string): EmailServerPreset | null {
  if (!domain) return null;
  const normalized = domain.trim().toLowerCase();
  return EMAIL_DOMAIN_PRESETS.find((p) => p.domain === normalized) ?? null;
}