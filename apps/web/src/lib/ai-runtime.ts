import { api } from './api';

export type AiProviderName = 'chatgpt' | 'ollama';

export interface AiRuntimeModel {
  slug: string;
  displayName: string;
}

export interface AiRuntimeProvider {
  connectionStatus: 'connected' | 'disconnected';
  selectedModel: AiRuntimeModel | null;
  models: AiRuntimeModel[];
}

export interface AiRuntime {
  primaryProvider: AiProviderName;
  failoverProvider: AiProviderName | null;
  providers: Record<AiProviderName, AiRuntimeProvider>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseModel(value: unknown): AiRuntimeModel {
  if (!isRecord(value) || typeof value.slug !== 'string' || typeof value.displayName !== 'string') {
    throw new Error('Resposta de modelo de IA inválida');
  }
  return { slug: value.slug, displayName: value.displayName };
}

function parseProvider(value: unknown): AiRuntimeProvider {
  if (!isRecord(value) || (value.connectionStatus !== 'connected' && value.connectionStatus !== 'disconnected')) {
    throw new Error('Resposta do runtime de IA inválida');
  }
  return {
    connectionStatus: value.connectionStatus,
    selectedModel: value.selectedModel === null ? null : parseModel(value.selectedModel),
    models: Array.isArray(value.models) ? value.models.map(parseModel) : [],
  };
}

function parseProviderName(value: unknown): AiProviderName {
  if (value !== 'chatgpt' && value !== 'ollama') throw new Error('Resposta do runtime de IA inválida');
  return value;
}

function parseRuntime(value: unknown): AiRuntime {
  if (!isRecord(value) || !isRecord(value.providers)) throw new Error('Resposta do runtime de IA inválida');
  return {
    primaryProvider: parseProviderName(value.primaryProvider),
    failoverProvider: value.failoverProvider === null ? null
      : value.failoverProvider === undefined ? null
      : parseProviderName(value.failoverProvider),
    providers: {
      chatgpt: parseProvider(value.providers.chatgpt),
      ollama: parseProvider(value.providers.ollama),
    },
  };
}

export async function getAiRuntime(): Promise<AiRuntime> {
  const { data } = await api.get('/ai/runtime');
  return parseRuntime(data);
}

export async function selectAiProviderModel(provider: AiProviderName, slug: string): Promise<AiRuntime> {
  const { data } = await api.post('/ai/runtime/model', { provider, slug });
  return parseRuntime(data);
}

export async function setAiPrimaryProvider(provider: AiProviderName): Promise<AiRuntime> {
  const { data } = await api.post('/ai/runtime/primary', { provider });
  return parseRuntime(data);
}

export async function setAiFailoverProvider(provider: AiProviderName | null): Promise<AiRuntime> {
  const { data } = await api.post('/ai/runtime/failover', { provider });
  return parseRuntime(data);
}

export function getAiRuntimeErrorMessage(error: unknown): string {
  const directCode = isRecord(error) && typeof error.code === 'string' ? error.code : undefined;
  const response = isRecord(error) && isRecord(error.response) ? error.response : undefined;
  const data = response && isRecord(response.data) ? response.data : undefined;
  const code = directCode ?? (typeof data?.code === 'string' ? data.code : undefined);
  if (code === 'AI_RUNTIME_CATALOG_UNAVAILABLE' || code === 'AI_RUNTIME_DISCONNECTED') {
    return 'O catálogo de modelos está indisponível no momento. Você ainda pode consultar o histórico do chat.';
  }
  return 'Não foi possível carregar o runtime de IA. Você ainda pode consultar o histórico do chat.';
}