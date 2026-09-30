import { api } from './api';

export interface ChatGptAuthorizationStart {
  authorizationUrl: string;
  expiresAt: string;
}

export type AiOAuthConnectionStatus = 'connected' | 'revoked';

export interface ChatGptConnection {
  id: string;
  provider: string;
  email: string | null;
  scopes: string[];
  expiresAt: string;
  status: AiOAuthConnectionStatus;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function unwrapData(value: unknown): unknown {
  return isRecord(value) && value.data !== undefined ? value.data : value;
}

function parseStart(value: unknown): ChatGptAuthorizationStart {
  if (!isRecord(value) || typeof value.authorizationUrl !== 'string' || typeof value.expiresAt !== 'string') {
    throw new Error('Resposta de autorização inválida');
  }
  return { authorizationUrl: value.authorizationUrl, expiresAt: value.expiresAt };
}

function parseConnection(value: unknown): ChatGptConnection {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.provider !== 'string' || typeof value.expiresAt !== 'string') {
    throw new Error('Resposta de conexão inválida');
  }
  const scopes = Array.isArray(value.scopes)
    ? value.scopes.filter((scope): scope is string => typeof scope === 'string')
    : typeof value.scopes === 'string' ? value.scopes.split(/\s+/).filter(Boolean) : [];
  const status = value.status === 'revoked' ? 'revoked' : value.status === 'connected' ? 'connected' : null;
  if (!status) throw new Error('Status de conexão inválido');
  return {
    id: value.id,
    provider: value.provider,
    email: typeof value.email === 'string' ? value.email : null,
    scopes,
    expiresAt: value.expiresAt,
    status,
  };
}

export async function startChatGptAuthorization(): Promise<ChatGptAuthorizationStart> {
  const { data } = await api.post('/ai/oauth/start');
  return parseStart(unwrapData(data));
}

export async function completeChatGptAuthorization(callbackUrl: string): Promise<ChatGptConnection> {
  const { data } = await api.post('/ai/oauth/complete', { callbackUrl });
  return parseConnection(unwrapData(data));
}

export async function listChatGptConnections(): Promise<ChatGptConnection[]> {
  const { data } = await api.get('/ai/oauth/connections');
  const payload = unwrapData(data);
  if (!Array.isArray(payload)) throw new Error('Resposta de conexões inválida');
  return payload.map(parseConnection);
}

export async function reconnectChatGptConnection(connectionId: string): Promise<void> {
  await api.post(`/ai/oauth/${connectionId}/refresh`);
}

export async function disconnectChatGptConnection(connectionId: string): Promise<void> {
  await api.post(`/ai/oauth/${connectionId}/disconnect`);
}

export function getAiOAuthErrorMessage(error: unknown): string {
  const response = isRecord(error) && isRecord(error.response) ? error.response : undefined;
  const data = response && isRecord(response.data) ? response.data : undefined;
  const code = data?.code;
  if (code === 'oauth_denied') return 'A autorização foi cancelada. Você pode tentar novamente.';
  if (code === 'oauth_expired') return 'A autorização expirou. Inicie a conexão novamente.';
  if (code === 'oauth_scope_insufficient') return 'A autorização não incluiu as permissões necessárias. Tente novamente e aceite todas as permissões.';
  return 'Não foi possível concluir a conexão com o ChatGPT. Tente novamente.';
}
