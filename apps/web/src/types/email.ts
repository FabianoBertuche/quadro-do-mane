/**
 * Tipos do domínio de e-mail — espelham o backend NestJS.
 * Mantenha em sincronia com:
 *   - apps/api/src/modules/emails/emails.service.ts
 *   - apps/api/src/modules/emails/domain-presets.ts
 */

export type EmailProtocol = 'imap' | 'smtp';
export type EmailDetectionMode = 'PRESET' | 'CUSTOM';

/** Preset de domínio conhecido (montemoria, gmail, office365). */
export interface EmailServerPreset {
  key: string;
  domain: string;
  label: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
}

/** GET /email/domain-presets */
export interface DomainPresetsResponse {
  presets: EmailServerPreset[];
}

/** GET /email/tenant-settings */
export interface TenantEmailSettings {
  configured: boolean;
  emailDomain: string | null;
  detectionMode: EmailDetectionMode | null;
  presetKey?: string | null;
  imapHost?: string;
  imapPort?: number;
  imapSecure?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  updatedAt?: string;
}

/** PATCH /email/tenant-settings */
export interface UpdateTenantEmailSettingsPayload {
  emailDomain: string;
  detectionMode: EmailDetectionMode;
  presetKey?: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
}

/** GET /emails/settings — snapshot leve para o front decidir UI. */
export interface EmailSettingsSnapshot {
  tenantConfigured: boolean;
  userEmail: string;
  imapConfigured: boolean;
  smtpConfigured: boolean;
  server: {
    imapHost: string;
    imapPort: number;
    imapSecure: boolean;
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
  } | null;
}

/** PATCH /emails/password */
export interface SetEmailPasswordPayload {
  protocol: EmailProtocol;
  password: string;
}

/** POST /emails/test-connection */
export interface TestEmailConnectionPayload {
  password: string;
}

export interface TestEmailConnectionResult {
  imap: { ok: boolean; error?: string };
  smtp: { ok: boolean; error?: string };
}

/** GET /emails/messages */
export interface EmailMessageSummary {
  uid: string | number;
  subject: string;
  from: string;
  fromAddress: string | null;
  to: string | null;
  date: string | null;
  flags?: string[] | Set<string>;
  seen: boolean;
}

/** GET /emails/messages/:uid */
export interface EmailMessageDetail extends EmailMessageSummary {
  text: string | undefined;
  html: string | null;
  messageId: string | null;
  references: string[];
  attachmentsCount: number;
}

/** POST /emails/send */
export interface SendEmailPayload {
  to: string;
  subject: string;
  content: string;
}

/** POST /emails/reply */
export interface ReplyEmailPayload {
  uid: string;
  body: string;
}