import { api } from './api';

export type AiMessageRole = 'user' | 'assistant' | 'system';
export type AiProposalStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'EXECUTED' | 'FAILED';
export type AiResponseMode = 'TEXT' | 'AUDIO';

export interface AiConversation {
  id: string;
  contextProjectId: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AiMessage {
  id: string;
  role: AiMessageRole;
  content: string | null;
  format?: string;
  audioObjectKey?: string;
  localStatus?: 'sending' | 'failed';
  createdAt?: string;
  [key: string]: unknown;
}

export function createOptimisticAiMessage(content: string, id: string): AiMessage {
  return {
    id,
    role: 'user',
    content: content.trim(),
    format: 'TEXT',
    localStatus: 'sending',
  };
}

export interface AiActionProposal {
  id: string;
  status: AiProposalStatus;
  summary?: string | null;
  toolName?: string;
  expiresAt?: string;
  [key: string]: unknown;
}

export interface AiMessagePage {
  messages: AiMessage[];
  pendingProposals: AiActionProposal[];
}

export function mergeAiMessageResponse(page: AiMessagePage, response: AiMessageResponse): AiMessagePage {
  const incomingMessages = [response.message, response.assistantMessage].filter(
    (message): message is AiMessage => message !== undefined,
  );
  const messages = [...page.messages];
  for (const message of incomingMessages) {
    if (!messages.some((current) => current.id === message.id)) messages.push(message);
  }
  const pendingProposals = [...page.pendingProposals];
  for (const proposal of response.proposals) {
    if (!pendingProposals.some((current) => current.id === proposal.id)) pendingProposals.push(proposal);
  }
  return { messages, pendingProposals };
}

export interface AiMessageResponse {
  message: AiMessage;
  assistantMessage?: AiMessage;
  proposals: AiActionProposal[];
  proposal?: AiActionProposal;
  toolResults: AiToolResult[];
}

export interface AiToolResult {
  toolName: string;
  result: unknown;
}

export type AiActionResult = AiActionProposal & {
  message?: AiMessage;
  resultJson?: string;
};

export interface AiClarificationOption {
  id: string;
  name: string;
}

export interface AiClarificationDetails {
  field?: string;
  options: AiClarificationOption[];
  message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function unwrapData(value: unknown): unknown {
  if (isRecord(value) && value.data !== undefined) {
    return value.data;
  }
  return value;
}

function isMessageRole(value: unknown): value is AiMessageRole {
  return value === 'user' || value === 'assistant' || value === 'system';
}

function isProposalStatus(value: unknown): value is AiProposalStatus {
  return value === 'PENDING' || value === 'CONFIRMED' || value === 'CANCELLED' || value === 'EXECUTED' || value === 'FAILED';
}

function parseClarificationOption(value: unknown): AiClarificationOption | null {
  if (typeof value === 'string') return { id: value, name: value };
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') return null;
  return { id: value.id, name: value.name };
}

function parseConversation(value: unknown): AiConversation {
  if (!isRecord(value) || typeof value.id !== 'string') throw new Error('Resposta de conversa inválida');
  const conversation: AiConversation = {
    id: value.id,
    contextProjectId: typeof value.contextProjectId === 'string' ? value.contextProjectId : null,
  };
  if (typeof value.createdAt === 'string') conversation.createdAt = value.createdAt;
  if (typeof value.updatedAt === 'string') conversation.updatedAt = value.updatedAt;
  return conversation;
}

function parseMessage(value: unknown): AiMessage {
  if (!isRecord(value) || typeof value.id !== 'string' || !isMessageRole(value.role)) {
    throw new Error('Resposta de mensagem inválida');
  }
  const message: AiMessage = {
    id: value.id,
    content: typeof value.content === 'string' || value.content === null ? value.content : null,
    role: value.role,
  };
  if (typeof value.format === 'string') message.format = value.format;
  if (typeof value.audioObjectKey === 'string') message.audioObjectKey = value.audioObjectKey;
  if (typeof value.createdAt === 'string') message.createdAt = value.createdAt;
  return { ...value, ...message };
}

function parseProposal(value: unknown): AiActionProposal {
  if (!isRecord(value) || typeof value.id !== 'string' || !isProposalStatus(value.status)) {
    throw new Error('Resposta de proposta inválida');
  }
  const proposal: AiActionProposal = {
    id: value.id,
    status: value.status,
  };
  if (typeof value.summary === 'string' || value.summary === null) proposal.summary = value.summary;
  if (typeof value.toolName === 'string') proposal.toolName = value.toolName;
  if (typeof value.expiresAt === 'string') proposal.expiresAt = value.expiresAt;
  return { ...value, ...proposal };
}

function parseToolResult(value: unknown): AiToolResult {
  if (!isRecord(value) || typeof value.toolName !== 'string' || value.toolName.trim() === '') {
    throw new Error('Resultado de ferramenta inválido');
  }
  return { toolName: value.toolName, result: value.result };
}

export function getClarificationDetails(content: string): AiClarificationDetails | null {
  try {
    const parsed: unknown = JSON.parse(content);
    if (!isRecord(parsed) || parsed.status !== 'needsClarification' || !isRecord(parsed.result)) return null;
    const result = parsed.result;
    const field = typeof result.field === 'string' ? result.field : undefined;
    const rawOptions = Array.isArray(result.matches) ? result.matches : Array.isArray(result.options) ? result.options : [];
    const options = rawOptions.map(parseClarificationOption).filter((option): option is AiClarificationOption => option !== null);
    const message = typeof result.message === 'string'
      ? result.message
      : field
        ? `Escolha um valor para ${field}.`
        : 'Preciso de mais informações para concluir esta ação.';
    return field ? { field, options, message } : { options, message };
  } catch {
    return null;
  }
}

export async function listConversations(page = 1, take = 20): Promise<AiConversation[]> {
  const { data } = await api.get('/ai/conversations', { params: { page, take } });
  const payload = unwrapData(data);
  if (!Array.isArray(payload)) throw new Error('Resposta de conversas inválida');
  return payload.map(parseConversation);
}

export async function createConversation(contextProjectId?: string): Promise<AiConversation> {
  const { data } = await api.post('/ai/conversations', contextProjectId ? { contextProjectId } : {});
  return parseConversation(unwrapData(data));
}

export async function listMessages(conversationId: string): Promise<AiMessagePage> {
  const { data } = await api.get(`/ai/conversations/${conversationId}/messages`);
  const payload = unwrapData(data);
  if (!isRecord(payload)) throw new Error('Resposta de mensagens inválida');
  const rawMessages = Array.isArray(payload.messages) ? payload.messages : [];
  const rawProposals = Array.isArray(payload.pendingProposals) ? payload.pendingProposals : [];
  return {
    messages: rawMessages.map(parseMessage),
    pendingProposals: rawProposals.map(parseProposal),
  };
}

export async function sendTextMessage(input: {
  conversationId: string;
  text: string;
  responseMode: AiResponseMode;
}): Promise<AiMessageResponse> {
  const { conversationId, text, responseMode } = input;
  const { data } = await api.post(`/ai/conversations/${conversationId}/messages`, { text, responseMode });
  return parseMessageResponse(data);
}

export async function sendAudioMessage(input: {
  conversationId: string;
  audio: Blob;
  filename?: string;
  responseMode: AiResponseMode;
}): Promise<AiMessageResponse> {
  const { conversationId, audio, filename, responseMode } = input;
  const form = new FormData();
  form.append('audio', audio, filename ?? 'comando.webm');
  form.append('responseMode', responseMode);
  const { data } = await api.post(`/ai/conversations/${conversationId}/audio`, form);
  return parseMessageResponse(data);
}

function parseMessageResponse(data: unknown): AiMessageResponse {
  const payload = unwrapData(data);
  if (!isRecord(payload) || payload.message === undefined) throw new Error('Resposta de mensagem enviada inválida');
  const rawProposals = Array.isArray(payload.proposals) ? payload.proposals : payload.proposal ? [payload.proposal] : [];
  const rawToolResults = Array.isArray(payload.toolResults) ? payload.toolResults : [];
  return {
    message: parseMessage(payload.message),
    assistantMessage: payload.assistantMessage === undefined ? undefined : parseMessage(payload.assistantMessage),
    proposals: rawProposals.map(parseProposal),
    proposal: payload.proposal === undefined ? undefined : parseProposal(payload.proposal),
    toolResults: rawToolResults.map(parseToolResult),
  };
}

export async function confirmAction(proposalId: string): Promise<AiActionResult> {
  const { data } = await api.post(`/ai/action-proposals/${proposalId}/confirm`, {});
  const payload = unwrapData(data);
  if (!isRecord(payload)) throw new Error('Resposta de confirmação inválida');
  const proposal = parseProposal(payload);
  const result: AiActionResult = { ...proposal };
  if (payload.message !== undefined) result.message = parseMessage(payload.message);
  if (typeof payload.resultJson === 'string') result.resultJson = payload.resultJson;
  return result;
}

export async function cancelAction(proposalId: string): Promise<void> {
  await api.post(`/ai/action-proposals/${proposalId}/cancel`);
}
