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

export interface AiProviderErrorMetadata {
  status?: number;
  code?: string;
  requestId?: string;
}

export class AiProviderError extends Error {
  constructor(message: string, readonly metadata: AiProviderErrorMetadata) {
    super(message);
    this.name = 'AiProviderError';
  }
}

export type AiProviderStreamEvent =
  | { type: 'text.delta'; delta: string }
  | { type: 'tool_call.started'; id: string; name: string }
  | { type: 'tool_call.delta'; id: string; delta: string }
  | { type: 'tool_call.done'; id: string; arguments: string }
  | { type: 'completed' };

export interface AiStreamingProvider {
  stream(input: AiCompletionInput, auth?: AiProviderAuth): AsyncIterable<AiProviderStreamEvent>;
}

export interface AiProvider {
  complete(input: AiCompletionInput, auth?: AiProviderAuth): Promise<AiCompletionResult>;
}
