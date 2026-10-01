import OpenAI from 'openai';
import {
  AiCompletionInput,
  AiCompletionResult,
  AiProvider,
  AiToolCall,
  AiToolResultForCall,
} from '../ports/ai-provider.port';
import { getAiRequestTimeout } from './openai.provider';

export const OLLAMA_BASE_URL = 'https://ollama.com/v1';

type OllamaClient = { chat: { completions: { create(input: any): Promise<any> } } };
export type OllamaClientFactory = (apiKey: string, timeout: number) => OllamaClient;

const defaultClientFactory: OllamaClientFactory = (apiKey, timeout) =>
  new OpenAI({ apiKey, baseURL: OLLAMA_BASE_URL, timeout }) as unknown as OllamaClient;

export class OllamaCompletionsProvider implements AiProvider {
  private readonly client: OllamaClient;

  constructor(apiKey: string, clientFactory: OllamaClientFactory = defaultClientFactory) {
    if (!apiKey) throw new Error('AI provider is not configured');
    this.client = clientFactory(apiKey, getAiRequestTimeout({ get: () => undefined } as any));
  }

  async complete(input: AiCompletionInput): Promise<AiCompletionResult> {
    try {
      const response = await this.client.chat.completions.create({
        model: input.model?.trim(),
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
          function: { name: tool.name, description: tool.description, parameters: tool.parameters },
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
      if (error instanceof Error && error.message === 'AI provider returned invalid tool arguments') throw error;
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