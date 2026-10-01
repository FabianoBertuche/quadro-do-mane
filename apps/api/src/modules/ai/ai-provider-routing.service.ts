import { Inject, Injectable } from '@nestjs/common';
import { AiProvider, AiProviderAuth } from './ports/ai-provider.port';
import { AiProviderName, AiServerRuntimeService } from './ai-server-runtime.service';
import { AiOAuthService } from './ai-oauth.service';
import { OllamaCompletionsProvider } from './providers/ollama-completions.provider';

export const AI_OLLAMA_PROVIDER_FACTORY = 'AI_OLLAMA_PROVIDER_FACTORY';
export type OllamaProviderFactory = (apiKey: string) => AiProvider;

export interface AiProviderExecution {
  provider: AiProviderName;
  providerInstance: AiProvider;
  model?: string;
  auth?: AiProviderAuth;
}

/**
 * Resolve providers e models em ordem de uso: primary → failover, pulando
 * provedores não configurados (ChatGPT sem conexão OAuth, Ollama sem chave).
 *
 * Cada execution carrega sua própria instância (Ollama é construída com a chave
 * capturada no momento da resolução) e o `model` global do provedor, mas NÃO
 * decide a política de failover — quem decide é o fluxo do `AiService`.
 */
@Injectable()
export class AiProviderRoutingService {
  constructor(
    private readonly runtime: AiServerRuntimeService,
    private readonly oauth: AiOAuthService,
    @Inject('AI_PROVIDER') private readonly chatgptProvider: AiProvider,
    @Inject(AI_OLLAMA_PROVIDER_FACTORY) private readonly ollamaFactory: OllamaProviderFactory,
  ) {}

  async resolveExecutions(): Promise<AiProviderExecution[]> {
    const view = await this.runtime.getRuntime();
    const ordered: Array<AiProviderName | null> = [view.primaryProvider, view.failoverProvider];
    const executions: AiProviderExecution[] = [];
    for (const provider of ordered) {
      if (!provider || executions.some((execution) => execution.provider === provider)) continue;
      if (provider === 'chatgpt') {
        const auth = await this.oauth.resolveProviderAuth();
        if (!auth) continue;
        executions.push({ provider, providerInstance: this.chatgptProvider, model: view.providers.chatgpt.selectedModel?.slug, auth });
      } else {
        const apiKey = await this.runtime.getOllamaApiKey();
        if (!apiKey) continue;
        executions.push({ provider, providerInstance: this.ollamaFactory(apiKey), model: view.providers.ollama.selectedModel?.slug });
      }
    }
    return executions;
  }
}

export const defaultOllamaProviderFactory: OllamaProviderFactory = (apiKey) => new OllamaCompletionsProvider(apiKey);