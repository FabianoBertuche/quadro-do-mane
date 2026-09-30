export type AiMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AiMessage {
  role: AiMessageRole;
  content: string;
}

export interface AiToolDefinition {
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
}

export interface AiCompletionInput {
  messages: AiMessage[];
  tools?: AiToolDefinition[];
}

export interface AiToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface AiCompletionResult {
  text: string;
  toolCalls: AiToolCall[];
}

export interface AiProviderAuth {
  type: 'oauth' | 'api-key';
  accessToken: string;
  refresh?: () => Promise<AiProviderAuth>;
}

export interface AiProvider {
  complete(input: AiCompletionInput, auth?: AiProviderAuth): Promise<AiCompletionResult>;
}
