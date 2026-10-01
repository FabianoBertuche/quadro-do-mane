import { api } from './api';

export interface AiRuntimeModel {
  slug: string;
  displayName: string;
}

export interface AiRuntime {
  connectionStatus: 'connected' | 'disconnected';
  provider: 'chatgpt';
  selectedModel: AiRuntimeModel | null;
  models: AiRuntimeModel[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function unwrapData(value: unknown): unknown {
  return isRecord(value) && value.data !== undefined ? value.data : value;
}

function parseModel(value: unknown): AiRuntimeModel {
  if (!isRecord(value) || typeof value.slug !== 'string' || typeof value.displayName !== 'string') {
    throw new Error('Resposta de modelo de IA inválida');
  }
  return { slug: value.slug, displayName: value.displayName };
}

function parseRuntime(value: unknown): AiRuntime {
  const payload = unwrapData(value);
  if (!isRecord(payload) || (payload.connectionStatus !== 'connected' && payload.connectionStatus !== 'disconnected') || payload.provider !== 'chatgpt') {
    throw new Error('Resposta do runtime de IA inválida');
  }
  const selectedModel = payload.selectedModel === null ? null : parseModel(payload.selectedModel);
  const models = Array.isArray(payload.models) ? payload.models.map(parseModel) : [];
  return {
    connectionStatus: payload.connectionStatus,
    provider: 'chatgpt',
    selectedModel,
    models,
  };
}

export async function getAiRuntime(): Promise<AiRuntime> {
  const { data } = await api.get('/ai/runtime');
  return parseRuntime(data);
}

export async function selectAiRuntimeModel(slug: string): Promise<AiRuntime> {
  const { data } = await api.post('/ai/runtime/model', { slug });
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
