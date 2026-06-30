import { api } from '@/lib/api';
import type {
  DomainPresetsResponse,
  EmailMessageDetail,
  EmailMessageSummary,
  EmailSettingsSnapshot,
  ReplyEmailPayload,
  SendEmailPayload,
  SetEmailPasswordPayload,
  TenantEmailSettings,
  TestEmailConnectionPayload,
  TestEmailConnectionResult,
  UpdateTenantEmailSettingsPayload,
} from '@/types/email';

/**
 * Helpers tipados para a API de e-mail.
 *
 * Mantém URLs e payloads centralizados para evitar strings espalhadas
 * pelos componentes e propaga o tipo de retorno correto para React Query.
 */
export const emailsApi = {
  getDomainPresets: () =>
    api.get<DomainPresetsResponse>('/email/domain-presets').then((r) => r.data),

  getTenantSettings: () =>
    api.get<TenantEmailSettings>('/email/tenant-settings').then((r) => r.data),

  updateTenantSettings: (payload: UpdateTenantEmailSettingsPayload) =>
    api.patch<TenantEmailSettings>('/email/tenant-settings', payload).then((r) => r.data),

  getMySettings: () =>
    api.get<EmailSettingsSnapshot>('/emails/settings').then((r) => r.data),

  setPassword: (payload: SetEmailPasswordPayload) =>
    api.patch('/emails/password', payload).then((r) => r.data),

  testConnection: (payload: TestEmailConnectionPayload) =>
    api.post<TestEmailConnectionResult>('/emails/test-connection', payload).then((r) => r.data),

  listMessages: () =>
    api.get<EmailMessageSummary[]>('/emails/messages').then((r) => r.data),

  getMessage: (uid: string) =>
    api.get<EmailMessageDetail>(`/emails/messages/${uid}`).then((r) => r.data),

  send: (payload: SendEmailPayload) =>
    api.post('/emails/send', payload).then((r) => r.data),

  reply: (payload: ReplyEmailPayload) =>
    api.post('/emails/reply', payload).then((r) => r.data),
};