import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';
import {
  AiCompletionInput,
  AiCompletionResult,
  AiProvider,
  AiToolCall,
  AiToolResultForCall,
} from '../ports/ai-provider.port';

type OpenAiClient = Pick<OpenAI, 'chat'>;
export type OpenAiClientFactory = (apiKey: string, timeout: number) => OpenAI;

export const getAiRequestTimeout = (config: ConfigService) => {
  const configured = Number(config.get<string>('AI_REQUEST_TIMEOUT_MS'));
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : 20_000;
};

const defaultClientFactory: OpenAiClientFactory = (apiKey, timeout) =>
  new OpenAI({ apiKey, timeout });

export class OpenAiProvider implements AiProvider {
  private readonly client: OpenAiClient;
  private readonly model: string;

  constructor(
    config: ConfigService,
    clientFactory: OpenAiClientFactory = defaultClientFactory,
  ) {
    const apiKey = config.get<string>('OPENAI_API_KEY');
    if (!apiKey) throw new Error('OpenAI provider is not configured');
    this.client = clientFactory(apiKey, getAiRequestTimeout(config));
    this.model = config.get<string>('OPENAI_MODEL', 'gpt-4o-mini');
  }

  async complete(input: AiCompletionInput): Promise<AiCompletionResult> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: input.messages.map((message: any) => {
          if (message.role === 'assistant' && message.toolCalls) {
            return {
              role: 'assistant',
              content: message.content,
              tool_calls: message.toolCalls.map((call: AiToolCall) => ({
                id: this.requireCallId(call),
                type: 'function',
                function: { name: call.name, arguments: JSON.stringify(call.arguments) },
              })),
            };
          }
          if (message.role === 'tool') return { role: 'tool', tool_call_id: message.toolCallId, content: message.content };
          return message;
        }) as any,
        tools: input.tools?.map((tool) => ({
          type: 'function' as const,
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        })),
      });
      const message = response.choices[0]?.message;
      const toolCalls: AiToolCall[] = (message?.tool_calls ?? []).map((call: any) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(call.function.arguments);
        } catch {
          throw new Error('AI provider returned invalid tool arguments');
        }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('AI provider returned invalid tool arguments');
        }
        return { ...(call.id ? { id: call.id } : {}), name: call.function.name, arguments: parsed as Record<string, unknown> };
      });
      return { text: message?.content ?? '', toolCalls };
    } catch (error) {
      if (error instanceof Error && error.message === 'AI provider returned invalid tool arguments') {
        throw error;
      }
      throw new Error('AI provider request failed');
    }
  }

  buildToolContinuation(input: AiCompletionInput, completion: AiCompletionResult, results: AiToolResultForCall[]): AiCompletionInput {
    return {
      ...input,
      messages: [
        ...input.messages,
        { role: 'assistant', content: completion.text || null, toolCalls: completion.toolCalls },
        ...results.map(({ call, result }) => ({
          role: 'tool' as const,
          toolCallId: this.requireCallId(call),
          content: this.serializeToolResult(result),
        })),
      ],
    };
  }

  private requireCallId(call: AiToolCall): string {
    if (!call.id) throw new Error('AI provider returned a tool call without an id');
    return call.id;
  }

  private serializeToolResult(result: unknown): string {
    return typeof result === 'string' ? result : JSON.stringify(result ?? null);
  }
}
