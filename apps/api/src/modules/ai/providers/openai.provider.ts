import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';
import {
  AiCompletionInput,
  AiCompletionResult,
  AiProvider,
  AiToolCall,
} from '../ports/ai-provider.port';

type OpenAiClient = Pick<OpenAI, 'chat'>;
export type OpenAiClientFactory = (apiKey: string, timeout: number) => OpenAI;

const REQUEST_TIMEOUT_MS = 20_000;

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
    this.client = clientFactory(apiKey, REQUEST_TIMEOUT_MS);
    this.model = config.get<string>('OPENAI_MODEL', 'gpt-4o-mini');
  }

  async complete(input: AiCompletionInput): Promise<AiCompletionResult> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: input.messages as any,
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
        return { name: call.function.name, arguments: parsed as Record<string, unknown> };
      });
      return { text: message?.content ?? '', toolCalls };
    } catch (error) {
      if (error instanceof Error && error.message === 'AI provider returned invalid tool arguments') {
        throw error;
      }
      throw new Error('AI provider request failed');
    }
  }
}
