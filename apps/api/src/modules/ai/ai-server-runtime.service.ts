import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { fetchOpenAiModels } from './ai-oauth.protocol';
import { AiOAuthService } from './ai-oauth.service';
import { AiAuditService } from './ai-audit.service';

export interface AiServerRuntimeView {
  connectionStatus: 'connected' | 'disconnected';
  provider: 'chatgpt';
  selectedModel: { slug: string; displayName: string } | null;
}

export interface AiServerModel {
  slug: string;
  displayName: string;
}

@Injectable()
export class AiServerRuntimeService {
  private catalog?: { connectionKey: string; models: AiServerModel[] };

  constructor(
    private readonly prisma: PrismaService,
    private readonly oauth: AiOAuthService,
    private readonly audit?: AiAuditService,
  ) {}

  async getRuntime(): Promise<AiServerRuntimeView> {
    const runtime = await this.runtime();
    return {
      connectionStatus: runtime.oauthConnectionId ? 'connected' : 'disconnected',
      provider: 'chatgpt',
      selectedModel: runtime.selectedModelSlug && runtime.selectedModelDisplayName
        ? { slug: runtime.selectedModelSlug, displayName: runtime.selectedModelDisplayName }
        : null,
    };
  }

  async listModels(): Promise<AiServerModel[]> {
    return (await this.catalogForCurrentRuntime()).models;
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
    if (auth.connectionId && (auth.connectionId !== runtime.oauthConnectionId
      || (auth.connectionUpdatedAt && auth.connectionUpdatedAt !== runtime.oauthConnection?.updatedAt?.toISOString?.()))) {
      throw new BadRequestException('A conexão do ChatGPT foi alterada. Atualize a lista de modelos e tente novamente.');
    }
    if (this.catalog?.connectionKey === connectionKey) return this.catalog;
    try {
      const models = await fetchOpenAiModels(auth.accessToken);
      this.catalog = { connectionKey, models };
      return this.catalog;
    } catch {
      throw new BadRequestException('Catálogo de modelos indisponível');
    }
  }

  async selectModel(slug: string, actor?: { tenantId: string; tenantUserId: string; userId?: string }): Promise<AiServerRuntimeView> {
    const catalog = await this.catalogForCurrentRuntime();
    const model = catalog.models.find((candidate) => candidate.slug === slug);
    if (!model) throw new BadRequestException('Modelo selecionado não está disponível');
    await this.withLockedRuntime(async (tx, runtime) => {
      if (this.connectionKey(runtime) !== catalog.connectionKey) {
        throw new BadRequestException('A conexão do ChatGPT foi alterada. Atualize a lista de modelos e tente novamente.');
      }
      await tx.aiServerRuntime.update({
        where: { id: 'global' },
        data: { selectedModelSlug: model.slug, selectedModelDisplayName: model.displayName },
      });
    });
    if (actor) await this.audit?.record({ tenantId: actor.tenantId, actorTenantUserId: actor.tenantUserId, actorUserId: actor.userId, action: 'runtime.model_selected', targetId: 'global', metadata: { provider: 'chatgpt', modelSlug: model.slug } });
    return this.getRuntime();
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
