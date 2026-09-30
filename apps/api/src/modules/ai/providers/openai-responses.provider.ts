import { ConfigService } from '@nestjs/config';
import {
  AiCompletionInput,
  AiCompletionResult,
  AiProvider,
  AiProviderAuth,
  AiToolCall,
} from '../ports/ai-provider.port';

export type ResponsesFetch = (url: string, init?: RequestInit) => Promise<Response>;

const RESPONSES_URL = 'https://api.openai.com/v1/responses';

export class OpenAiResponsesProvider implements AiProvider {
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
    const fallback = this.enabled && this.apiKey ? { type: 'api-key' as const, accessToken: this.apiKey } : undefined;
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
        return await this.parseStream(response);
      } catch (error) {
        if (error instanceof Error && (error.message.startsWith('AI provider') || error.message.startsWith('AI response'))) throw error;
        throw new Error('AI provider request failed');
      }
    }
    throw new Error('AI provider request failed');
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

  private async parseStream(response: Response): Promise<AiCompletionResult> {
    const text = await response.text();
    const requestId = response.headers.get('x-request-id');
    let outputText = '';
    const calls = new Map<string, { name: string; arguments: string }>();
    let status: string | undefined;
    for (const line of text.split(/\r?\n/)) {
      if (!line.startsWith('data:')) continue;
      const value = line.slice(5).trim();
      if (!value || value === '[DONE]') continue;
      let event: any;
      try { event = JSON.parse(value); } catch { continue; }
      if (event.type === 'response.output_text.delta') outputText += event.delta ?? '';
      if ((event.type === 'response.output_item.added' || event.type === 'response.output_item.done') && event.item?.type === 'function_call') {
        calls.set(event.item.id ?? event.item.call_id, { name: event.item.name, arguments: event.item.arguments ?? '' });
      }
      if (event.type === 'response.function_call_arguments.delta') {
        const call = calls.get(event.item_id);
        if (call) call.arguments += event.delta ?? '';
      }
      if (event.type === 'response.completed') {
        status = event.response?.status;
        for (const item of event.response?.output ?? []) {
          if (item.type !== 'function_call') continue;
          calls.set(item.id ?? item.call_id, { name: item.name, arguments: item.arguments ?? '' });
        }
      }
      if (event.type === 'response.failed') throw this.safeStreamError('AI provider request failed', requestId);
      if (event.type === 'response.incomplete') throw this.safeStreamError('AI response incomplete', requestId);
    }
    if (status && status !== 'completed') throw this.safeStreamError('AI response incomplete', requestId);
    const toolCalls: AiToolCall[] = [];
    for (const call of calls.values()) {
      let args: unknown;
      try { args = JSON.parse(call.arguments || '{}'); } catch { throw new Error('AI provider returned invalid tool arguments'); }
      if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('AI provider returned invalid tool arguments');
      toolCalls.push({ name: call.name, arguments: args as Record<string, unknown> });
    }
    return { text: outputText, toolCalls };
  }

  private providerError(response: Response): Error {
    const requestId = response.headers.get('x-request-id');
    return new Error(`AI provider request failed${requestId ? ` (request ID: ${requestId})` : ''}`);
  }

  private safeStreamError(message: string, requestId: string | null): Error {
    return new Error(`${message}${requestId ? ` (request ID: ${requestId})` : ''}`);
  }
}
