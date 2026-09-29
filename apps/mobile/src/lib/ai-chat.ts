import { api } from './api';
import type { AiResponseMode } from './ai-chat-state';

export {
  createProposalState,
  createRecordingMachine,
  getResponseMode,
  mergeHistoryPage,
  setResponseMode,
} from './ai-chat-state';
export type { AiResponseMode, RecordingState } from './ai-chat-state';

export interface AiConversation {
  id: string;
  contextProjectId?: string | null;
}

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant' | string;
  format: AiResponseMode;
  content?: string | null;
  audioObjectKey?: string | null;
  createdAt: string;
}

export interface AiActionProposal {
  id: string;
  summary: string;
  status: string;
  toolName?: string;
  expiresAt?: string;
}

export interface AiMessageResponse {
  message: AiMessage;
  assistantMessage: AiMessage;
  proposals: AiActionProposal[];
  proposal?: AiActionProposal;
  audioObjectKey?: string;
}

export interface AiActionResult extends AiActionProposal {
  resultJson?: string | null;
  message?: AiMessage;
}

export interface AiHistoryResponse {
  messages: AiMessage[];
  pendingProposals: AiActionProposal[];
}

export function createConversation(contextProjectId?: string): Promise<AiConversation> {
  return api.post('/ai/conversations', contextProjectId ? { contextProjectId } : {}).then((response) => response.data);
}

export function listConversations(): Promise<AiConversation[]> {
  return api.get('/ai/conversations', { params: { page: 1, take: 50 } }).then((response) => response.data);
}

export async function openConversation(contextProjectId?: string): Promise<AiConversation> {
  const conversations = await listConversations();
  const existing = contextProjectId
    ? conversations.find((conversation) => conversation.contextProjectId === contextProjectId)
    : conversations.find((conversation) => !conversation.contextProjectId) ?? conversations[0];
  return existing ?? createConversation(contextProjectId);
}

export function getConversationMessages(conversationId: string, page = 1): Promise<AiHistoryResponse> {
  return api.get(`/ai/conversations/${conversationId}/messages`, { params: { page, take: 50 } }).then((response) => response.data);
}

export function sendTextMessage(input: {
  conversationId: string;
  text: string;
  responseMode: AiResponseMode;
  contextProjectId?: string;
}): Promise<AiMessageResponse> {
  return api.post(`/ai/conversations/${input.conversationId}/messages`, {
    text: input.text,
    responseMode: input.responseMode,
    contextProjectId: input.contextProjectId,
  }).then((response) => response.data);
}

export function sendAudioMessage(input: {
  conversationId: string;
  uri: string;
  mimeType: string;
  responseMode: AiResponseMode;
}): Promise<AiMessageResponse> {
  const body = new FormData();
  body.append('responseMode', input.responseMode);
  body.append('audio', { uri: input.uri, type: input.mimeType, name: 'message.m4a' } as unknown as Blob);
  return api.post(`/ai/conversations/${input.conversationId}/audio`, body, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((response) => response.data);
}

export function confirmAction(proposalId: string): Promise<AiActionResult> {
  return api.post(`/ai/action-proposals/${proposalId}/confirm`, {}).then((response) => response.data);
}

export function cancelAction(proposalId: string): Promise<void> {
  return api.post(`/ai/action-proposals/${proposalId}/cancel`).then(() => undefined);
}
