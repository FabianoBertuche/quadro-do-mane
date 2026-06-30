// DTO de reply usa class-validator; reexporta para imports agrupados
export { SendEmailDto } from './send-email.dto';
export { SetEmailPasswordDto } from './email-password.dto';
export { UpdateEmailTenantSettingsDto } from './email-tenant-settings.dto';
export { TestEmailConnectionDto } from './test-connection.dto';
export { ReplyEmailDto } from './reply-email.dto';

// Tipos auxiliares usados internamente pelo service
export type EmailProtocol = 'imap' | 'smtp';