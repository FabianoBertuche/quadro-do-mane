import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { fetchOpenAiModels } from './ai-oauth.protocol';
import { AiOAuthService } from './ai-oauth.service';
import { AiAuditService } from './ai-audit.service';
import { AiProviderAuth } from './ports/ai-provider.port';
import { OLLAMA_CLOUD_MODELS } from './providers/ollama-models';

export type AiProviderName = 'chatgpt' | 'ollama';
export const AI_PROVIDER_NAMES: readonly AiProviderName[] = ['chatgpt', 'ollama'];

export interface AiServerModel {
  slug: string;
  displayName: string;
}

export interface AiServerProviderView {
  connectionStatus: 'connected' | 'disconnected';
  selectedModel: AiServerModel | null;
}

export interface AiServerRuntimeView {
  primaryProvider: AiProviderName;
  failoverProvider: AiProviderName | null;
  providers: Record<AiProviderName, AiServerProviderView>;
}

@Injectable()
export class AiServerRuntimeService {
  private catalog?: { connectionKey: string; models: AiServerModel[] };

  constructor(
    private readonly prisma: PrismaService,
    private readonly oauth: AiOAuthService,
    private readonly audit?: AiAuditService,
    private readonly encryption?: EncryptionService,
  ) {}

  async getRuntime(): Promise<AiServerRuntimeView> {
    const runtime = await this.runtime();
    return {
      primaryProvider: runtime.primaryProvider === 'ollama' ? 'ollama' : 'chatgpt',
      failoverProvider: runtime.failoverProvider === 'ollama' ? 'ollama' : runtime.failoverProvider === 'chatgpt' ? 'chatgpt' : null,
      providers: {
        chatgpt: {
          connectionStatus: runtime.oauthConnectionId ? 'connected' : 'disconnected',
          selectedModel: runtime.chatgptModelSlug && runtime.chatgptModelDisplayName
            ? { slug: runtime.chatgptModelSlug, displayName: runtime.chatgptModelDisplayName }
            : null,
        },
        ollama: {
          connectionStatus: runtime.ollamaApiKeyCiphertext ? 'connected' : 'disconnected',
          selectedModel: runtime.ollamaModelSlug && runtime.ollamaModelDisplayName
            ? { slug: runtime.ollamaModelSlug, displayName: runtime.ollamaModelDisplayName }
            : null,
        },
      },
    };
  }

  async listModels(provider: AiProviderName): Promise<AiServerModel[]> {
    return (await this.catalogFor(provider)).models;
  }

  async selectModel(provider: AiProviderName, slug: string, actor?: { tenantId: string; tenantUserId: string; userId?: string }): Promise<AiServerRuntimeView> {
    const catalog = await this.catalogFor(provider);
    const model = catalog.models.find((candidate) => candidate.slug === slug);
    if (!model) throw new BadRequestException('Modelo selecionado não está disponível');
    const columns = provider === 'chatgpt'
      ? { chatgptModelSlug: model.slug, chatgptModelDisplayName: model.displayName }
      : { ollamaModelSlug: model.slug, ollamaModelDisplayName: model.displayName };
    await this.withLockedRuntime(async (tx, runtime) => {
      if (provider === 'chatgpt' && this.connectionKey(runtime) !== catalog.connectionKey) {
        throw new BadRequestException('A conexão do ChatGPT foi alterada. Atualize a lista de modelos e tente novamente.');
      }
      await tx.aiServerRuntime.update({ where: { id: 'global' }, data: columns });
    });
    if (actor) await this.audit?.record({ tenantId: actor.tenantId, actorTenantUserId: actor.tenantUserId, actorUserId: actor.userId, action: 'runtime.model_selected', targetId: 'global', metadata: { provider, modelSlug: model.slug } });
    return this.getRuntime();
  }

  async setPrimaryProvider(provider: AiProviderName, actor?: { tenantId: string; tenantUserId: string; userId?: string }): Promise<AiServerRuntimeView> {
    this.assertProvider(provider);
    const current = await this.runtime();
    if (current.failoverProvider === provider) throw new BadRequestException('O provedor principal e o substituto devem ser diferentes');
    await this.withLockedRuntime(async (tx) => {
      await tx.aiServerRuntime.update({ where: { id: 'global' }, data: { primaryProvider: provider } });
    });
    if (actor) await this.audit?.record({ tenantId: actor.tenantId, actorTenantUserId: actor.tenantUserId, actorUserId: actor.userId, action: 'runtime.primary_provider', targetId: 'global', metadata: { provider } });
    return this.getRuntime();
  }

  async setFailoverProvider(provider: AiProviderName | null, actor?: { tenantId: string; tenantUserId: string; userId?: string }): Promise<AiServerRuntimeView> {
    if (provider !== null) this.assertProvider(provider);
    const current = await this.runtime();
    if (provider && provider === current.primaryProvider) throw new BadRequestException('O provedor substituto deve ser diferente do principal');
    await this.withLockedRuntime(async (tx) => {
      await tx.aiServerRuntime.update({ where: { id: 'global' }, data: { failoverProvider: provider } });
    });
    if (actor) await this.audit?.record({ tenantId: actor.tenantId, actorTenantUserId: actor.tenantUserId, actorUserId: actor.userId, action: 'runtime.failover_provider', targetId: 'global', metadata: { provider: provider ?? null } });
    return this.getRuntime();
  }

  async saveOllamaKey(apiKey: string, actor?: { tenantId: string; tenantUserId: string; userId?: string }): Promise<void> {
    if (!this.encryption) throw new Error('EncryptionService is not configured');
    const { ciphertext, iv, authTag } = this.encryption.encrypt(apiKey);
    await this.withLockedRuntime(async (tx) => {
      await tx.aiServerRuntime.update({ where: { id: 'global' }, data: { ollamaApiKeyCiphertext: ciphertext, ollamaApiKeyIv: iv, ollamaApiKeyAuthTag: authTag } });
    });
    if (actor) await this.audit?.record({ tenantId: actor.tenantId, actorTenantUserId: actor.tenantUserId, actorUserId: actor.userId, action: 'runtime.ollama_key', targetId: 'global', metadata: { provider: 'ollama', status: 'saved' } });
  }

  async removeOllamaKey(actor?: { tenantId: string; tenantUserId: string; userId?: string }): Promise<void> {
    await this.withLockedRuntime(async (tx) => {
      await tx.aiServerRuntime.update({ where: { id: 'global' }, data: { ollamaApiKeyCiphertext: null, ollamaApiKeyIv: null, ollamaApiKeyAuthTag: null, ollamaModelSlug: null, ollamaModelDisplayName: null } });
    });
    if (actor) await this.audit?.record({ tenantId: actor.tenantId, actorTenantUserId: actor.tenantUserId, actorUserId: actor.userId, action: 'runtime.ollama_key', targetId: 'global', metadata: { provider: 'ollama', status: 'removed' } });
  }

  async getOllamaApiKey(): Promise<string | null> {
    const row = await this.runtime();
    if (!this.encryption) return null;
    if (!row.ollamaApiKeyCiphertext || !row.ollamaApiKeyIv || !row.ollamaApiKeyAuthTag) return null;
    return this.encryption.decrypt({ ciphertext: row.ollamaApiKeyCiphertext, iv: row.ollamaApiKeyIv, authTag: row.ollamaApiKeyAuthTag });
  }

  private async catalogFor(provider: AiProviderName): Promise<{ connectionKey: string; models: AiServerModel[] }> {
    if (provider === 'ollama') return { connectionKey: 'ollama', models: [...OLLAMA_CLOUD_MODELS] };
    try {
      return await this.catalogForCurrentRuntime();
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Catálogo de modelos indisponível');
    }
  }

  private assertProvider(provider: AiProviderName): void {
    if (provider !== 'chatgpt' && provider !== 'ollama') {
      throw new BadRequestException('Provedor não suportado');
    }
  }

  private async catalogForCurrentRuntime(): Promise<{ connectionKey: string; models: AiServerModel[] }> {
    let runtime = await this.runtime();
    if (!runtime.oauthConnectionId) {
      this.catalog = undefined;
      throw new BadRequestException('Catálogo de modelos indisponível');
    }
    if (this.catalog?.connectionKey === this.connectionKey(runtime)) return this.catalog;

    const auth = await this.oauth.resolveProviderAuth();
    if (!auth) throw new BadRequestException('Catálogo de modelos indisponível');
    runtime = await this.runtime();
    if (!runtime.oauthConnectionId) {
      this.catalog = undefined;
      throw new BadRequestException('Catálogo de modelos indisponível');
    }
    const connectionKey = this.connectionKey(runtime);
    if (this.connectionChanged(auth, runtime)) {
      throw new BadRequestException('A conexão do ChatGPT foi alterada. Atualize a lista de modelos e tente novamente.');
    }
    if (this.catalog?.connectionKey === connectionKey) return this.catalog;
    let models: AiServerModel[];
    try {
      models = await fetchOpenAiModels(auth.accessToken);
    } catch {
      throw new BadRequestException('Catálogo de modelos indisponível');
    }
    if (this.connectionChanged(auth, await this.runtime())) {
      throw new BadRequestException('A conexão do ChatGPT foi alterada. Atualize a lista de modelos e tente novamente.');
    }
    const catalog = { connectionKey, models };
    this.catalog = catalog;
    return catalog;
  }

  private runtime() {
    return this.prisma.aiServerRuntime.upsert({
      where: { id: 'global' },
      create: { id: 'global' },
      update: {},
      include: { oauthConnection: true },
    });
  }

  private connectionKey(runtime: any): string {
    return `${runtime.oauthConnectionId}:${runtime.oauthConnection?.updatedAt?.toISOString?.() ?? ''}`;
  }

  private connectionChanged(auth: AiProviderAuth, runtime: any): boolean {
    if (!auth.connectionId) return false;
    return auth.connectionId !== runtime.oauthConnectionId
      || (!!auth.connectionUpdatedAt && auth.connectionUpdatedAt !== runtime.oauthConnection?.updatedAt?.toISOString?.());
  }

  private async withLockedRuntime<T>(callback: (tx: any, runtime: any) => Promise<T>): Promise<T> {
    const execute = async (tx: any) => {
      await tx.$queryRawUnsafe('SELECT "id" FROM "ai_server_runtime" WHERE "id" = $1 FOR UPDATE', 'global');
      const runtime = await tx.aiServerRuntime.findUnique({ where: { id: 'global' }, include: { oauthConnection: true } });
      if (!runtime) throw new Error('AI server runtime not found');
      return callback(tx, runtime);
    };
    if (this.prisma.$transaction) return this.prisma.$transaction(execute);
    return execute({
      ...this.prisma,
      $queryRawUnsafe: async () => undefined,
      aiServerRuntime: { ...this.prisma.aiServerRuntime, findUnique: async () => this.runtime() },
    });
  }
}