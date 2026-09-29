import {
  AiCompletionInput,
  AiCompletionResult,
  AiProvider,
} from '../ports/ai-provider.port';

export class FakeAiProvider implements AiProvider {
  async complete(input: AiCompletionInput): Promise<AiCompletionResult> {
    const tool = input.tools?.[0];
    return {
      text: 'Resposta simulada do assistente.',
      toolCalls: tool
        ? [{ name: tool.name, arguments: { title: 'Tarefa simulada' } }]
        : [],
    };
  }
}
