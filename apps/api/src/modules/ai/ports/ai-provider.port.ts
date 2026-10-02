export type AiMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AiMessage {
  role: AiMessageRole;
  content: string | null;
  toolCalls?: AiToolCall[];
  toolCallId?: string;
}

export interface AiResponsesFunctionCall {
  type: 'function_call';
  call_id: string;
  name: string;
  arguments: string;
}

export interface AiResponsesFunctionCallOutput {
  type: 'function_call_output';
  call_id: string;
  output: string;
}

export type AiProviderInputItem = AiMessage | AiResponsesFunctionCall | AiResponsesFunctionCallOutput;

export interface AiToolDefinition {
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
}

export interface AiCompletionInput {
  messages: AiProviderInputItem[];
  tools?: AiToolDefinition[];
  model?: string;
}

export interface AiToolCall {
  id?: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AiToolResultForCall {
  call: AiToolCall;
  result: unknown;
}

export interface AiCompletionResult {
  text: string;
  toolCalls: AiToolCall[];
}

export interface AiProviderAuth {
  type: 'oauth' | 'api-key';
  accessToken: string;
  connectionId?: string;
  connectionUpdatedAt?: string;
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
  | { type: 'tool_call.started'; id: string; name: string; callId?: string }
  | { type: 'tool_call.delta'; id: string; delta: string }
  | { type: 'tool_call.done'; id: string; arguments: string }
  | { type: 'completed' };

export interface AiStreamingProvider {
  stream(input: AiCompletionInput, auth?: AiProviderAuth): AsyncIterable<AiProviderStreamEvent>;
}

export interface AiProvider {
  complete(input: AiCompletionInput, auth?: AiProviderAuth): Promise<AiCompletionResult>;
  buildToolContinuation?(input: AiCompletionInput, completion: AiCompletionResult, results: AiToolResultForCall[]): AiCompletionInput;
}
