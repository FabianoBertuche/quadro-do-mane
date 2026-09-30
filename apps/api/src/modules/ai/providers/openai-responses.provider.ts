import { ConfigService } from '@nestjs/config';
import {
  AiCompletionInput,
  AiCompletionResult,
  AiProvider,
  AiProviderAuth,
  AiProviderStreamEvent,
  AiStreamingProvider,
  AiToolCall,
} from '../ports/ai-provider.port';

export type ResponsesFetch = (url: string, init?: RequestInit) => Promise<Response>;

const RESPONSES_URL = 'https://api.openai.com/v1/responses';

export class OpenAiResponsesProvider implements AiProvider, AiStreamingProvider {
  private readonly model: string;
  private readonly apiKey?: string;
  private readonly enabled: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly fetcher: ResponsesFetch = (url, init) => fetch(url, init),
  ) {
    this.model = config.get<string>('OPENAI_MODEL', 'gpt-4o-mini');
    this.apiKey = config.get<string>('OPENAI_API_KEY');
    this.enabled = config.get<boolean>('AI_ENABLED') === true || config.get<string>('AI_ENABLED') === 'true';
  }

  async complete(input: AiCompletionInput, auth?: AiProviderAuth): Promise<AiCompletionResult> {
    const fallback = this.fallbackAuth();
    let resolvedAuth: AiProviderAuth | undefined = auth ?? fallback;
    if (!resolvedAuth) throw new Error('AI provider is not configured');

    for (let attempt = 0; attempt < 2; attempt += 1) {
      let response: Response;
      try {
        response = await this.request(input, resolvedAuth);
      } catch {
        throw new Error('AI provider request failed');
      }
      if (response.status === 401 && resolvedAuth.type === 'oauth' && resolvedAuth.refresh && attempt === 0) {
        try {
          resolvedAuth = await resolvedAuth.refresh();
        } catch {
          throw new Error('AI provider authentication failed');
        }
        continue;
      }
      if (!response.ok) throw this.providerError(response);
      try {
        const text = '';
        const toolCalls = new Map<string, { name: string; arguments: string }>();
        let outputText = text;
        for await (const event of this.readStream(response)) {
          if (event.type === 'text.delta') outputText += event.delta;
          if (event.type === 'tool_call.started') toolCalls.set(event.id, { name: event.name, arguments: toolCalls.get(event.id)?.arguments ?? '' });
          if (event.type === 'tool_call.delta') {
            const call = toolCalls.get(event.id);
            if (call) call.arguments += event.delta;
          }
          if (event.type === 'tool_call.done') {
            const call = toolCalls.get(event.id);
            if (call) call.arguments = event.arguments;
          }
        }
        return { text: outputText, toolCalls: this.parseToolCalls(toolCalls) };
      } catch (error) {
        if (error instanceof Error && (error.message.startsWith('AI provider') || error.message.startsWith('AI response'))) throw error;
        throw new Error('AI provider request failed');
      }
    }
    throw new Error('AI provider request failed');
  }

  async *stream(input: AiCompletionInput, auth?: AiProviderAuth): AsyncIterable<AiProviderStreamEvent> {
    let resolvedAuth = auth ?? this.fallbackAuth();
    if (!resolvedAuth) throw new Error('AI provider is not configured');
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await this.request(input, resolvedAuth).catch(() => { throw new Error('AI provider request failed'); });
      if (response.status === 401 && resolvedAuth.type === 'oauth' && resolvedAuth.refresh && attempt === 0) {
        try {
          resolvedAuth = await resolvedAuth.refresh();
        } catch {
          throw new Error('AI provider authentication failed');
        }
        continue;
      }
      if (!response.ok) throw this.providerError(response);
      yield* this.readStream(response);
      return;
    }
    throw new Error('AI provider request failed');
  }

  private fallbackAuth(): AiProviderAuth | undefined {
    return this.enabled && this.apiKey ? { type: 'api-key', accessToken: this.apiKey } : undefined;
  }

  private request(input: AiCompletionInput, auth: AiProviderAuth) {
    return this.fetcher(RESPONSES_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${auth.accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        input: input.messages,
        tools: input.tools?.map((tool) => ({ type: 'function', name: tool.name, description: tool.description, parameters: tool.parameters })),
        stream: true,
        store: false,
      }),
    });
  }

  private async *readStream(response: Response): AsyncGenerator<AiProviderStreamEvent> {
    if (!response.body) throw new Error('AI provider request failed');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let dataLines: string[] = [];
    let terminal = false;
    const requestId = response.headers.get('x-request-id');
    const processPayload = (payload: string): AiProviderStreamEvent[] => {
      if (!payload || payload === '[DONE]') return [];
      let event: any;
      try { event = JSON.parse(payload); } catch { throw this.safeStreamError('AI provider returned malformed stream', requestId); }
      if (event.type === 'response.output_text.delta') return [{ type: 'text.delta', delta: event.delta ?? '' }];
      if (event.type === 'response.output_item.added' && event.item?.type === 'function_call') return [{ type: 'tool_call.started', id: event.item.id ?? event.item.call_id, name: event.item.name }];
      if (event.type === 'response.function_call_arguments.delta') return [{ type: 'tool_call.delta', id: event.item_id, delta: event.delta ?? '' }];
      if (event.type === 'response.function_call_arguments.done') return [{ type: 'tool_call.done', id: event.item_id, arguments: event.arguments ?? '' }];
      if (event.type === 'response.output_item.done' && event.item?.type === 'function_call') return [{ type: 'tool_call.done', id: event.item.id ?? event.item.call_id, arguments: event.item.arguments ?? '' }];
      if (event.type === 'response.failed') throw this.safeStreamError('AI provider request failed', requestId);
      if (event.type === 'response.incomplete') throw this.safeStreamError('AI response incomplete', requestId);
      if (event.type === 'response.completed') {
        if (event.response?.status !== 'completed') throw this.safeStreamError('AI response incomplete', requestId);
        terminal = true;
        const output: AiProviderStreamEvent[] = [];
        for (const item of event.response.output ?? []) {
          if (item.type === 'function_call') {
            output.push({ type: 'tool_call.started', id: item.id ?? item.call_id, name: item.name });
            if (item.arguments !== undefined) output.push({ type: 'tool_call.done', id: item.id ?? item.call_id, arguments: item.arguments });
          }
        }
        output.push({ type: 'completed' });
        return output;
      }
      return [];
    };
    const flush = async function* (line: string): AsyncGenerator<AiProviderStreamEvent> {
      if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim());
        return;
      }
      if (line === '' && dataLines.length) {
        const pending = dataLines;
        dataLines = [];
        const payloads = pending.length > 1 ? pending : [pending.join('\n')];
        for (const payload of payloads) for (const event of processPayload(payload)) yield event;
      }
    };
    while (true) {
      const chunk = await reader.read();
      buffer += decoder.decode(chunk.value ?? new Uint8Array(), { stream: !chunk.done });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) yield* flush(line);
      if (chunk.done) break;
    }
    if (buffer) yield* flush(buffer);
    if (dataLines.length) {
      const pending = dataLines;
      dataLines = [];
      const payloads = pending.length > 1 ? pending : [pending.join('\n')];
      for (const payload of payloads) for (const event of processPayload(payload)) yield event;
    }
    if (!terminal) throw this.safeStreamError('AI response incomplete', requestId);
  }

  private parseToolCalls(calls: Map<string, { name: string; arguments: string }>): AiToolCall[] {
    const toolCalls: AiToolCall[] = [];
    for (const call of calls.values()) {
      let args: unknown;
      try { args = JSON.parse(call.arguments || '{}'); } catch { throw new Error('AI provider returned invalid tool arguments'); }
      if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('AI provider returned invalid tool arguments');
      toolCalls.push({ name: call.name, arguments: args as Record<string, unknown> });
    }
    return toolCalls;
  }

  private providerError(response: Response): Error {
    const requestId = response.headers.get('x-request-id');
    return new Error(`AI provider request failed${requestId ? ` (request ID: ${requestId})` : ''}`);
  }

  private safeStreamError(message: string, requestId: string | null): Error {
    return new Error(`${message}${requestId ? ` (request ID: ${requestId})` : ''}`);
  }
}
