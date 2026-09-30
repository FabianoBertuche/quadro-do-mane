import { api } from './api';

export type AiMessageRole = 'user' | 'assistant' | 'system';
export type AiProposalStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'EXECUTED' | 'FAILED';

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
  createdAt?: string;
  [key: string]: unknown;
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

export interface AiMessageResponse {
  message: AiMessage;
  assistantMessage?: AiMessage;
  proposals: AiActionProposal[];
  proposal?: AiActionProposal;
}

export type AiActionResult = AiActionProposal & {
  message?: AiMessage;
  resultJson?: string;
};

function unwrap<T>(value: unknown): T {
  if (value && typeof value === 'object' && 'data' in value && (value as { data?: unknown }).data !== undefined) {
    return (value as { data: T }).data;
  }
  return value as T;
}

export async function listConversations(): Promise<AiConversation[]> {
  const { data } = await api.get('/ai/conversations');
  return unwrap<AiConversation[]>(data) ?? [];
}

export async function createConversation(contextProjectId?: string): Promise<AiConversation> {
  const { data } = await api.post('/ai/conversations', contextProjectId ? { contextProjectId } : {});
  return unwrap<AiConversation>(data);
}

export async function listMessages(conversationId: string): Promise<AiMessagePage> {
  const { data } = await api.get(`/ai/conversations/${conversationId}/messages`);
  const page = unwrap<Partial<AiMessagePage>>(data) ?? {};
  return {
    messages: page.messages ?? [],
    pendingProposals: page.pendingProposals ?? [],
  };
}

export async function sendTextMessage(input: {
  conversationId: string;
  text: string;
  responseMode: 'TEXT';
}): Promise<AiMessageResponse> {
  const { conversationId, text, responseMode } = input;
  const { data } = await api.post(`/ai/conversations/${conversationId}/messages`, { text, responseMode });
  const response = unwrap<Partial<AiMessageResponse>>(data) ?? {};
  return {
    message: response.message as AiMessage,
    assistantMessage: response.assistantMessage,
    proposals: response.proposals ?? (response.proposal ? [response.proposal] : []),
    proposal: response.proposal,
  };
}

export async function confirmAction(proposalId: string): Promise<AiActionResult> {
  const { data } = await api.post(`/ai/action-proposals/${proposalId}/confirm`, {});
  return unwrap<AiActionResult>(data);
}

export async function cancelAction(proposalId: string): Promise<void> {
  await api.post(`/ai/action-proposals/${proposalId}/cancel`);
}
