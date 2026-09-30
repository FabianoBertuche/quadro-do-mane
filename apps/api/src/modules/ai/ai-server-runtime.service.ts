import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { fetchOpenAiModels } from './ai-oauth.protocol';
import { AiOAuthService } from './ai-oauth.service';

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
    const runtime = await this.runtime();
    if (!runtime.oauthConnectionId) {
      this.catalog = undefined;
      throw new BadRequestException('Catálogo de modelos indisponível');
    }
    const connectionKey = `${runtime.oauthConnectionId}:${runtime.oauthConnection?.updatedAt?.toISOString?.() ?? ''}`;
    if (this.catalog?.connectionKey === connectionKey) return this.catalog.models;

    const auth = await this.oauth.resolveProviderAuth();
    if (!auth) throw new BadRequestException('Catálogo de modelos indisponível');
    try {
      const models = await fetchOpenAiModels(auth.accessToken);
      this.catalog = { connectionKey, models };
      return models;
    } catch {
      throw new BadRequestException('Catálogo de modelos indisponível');
    }
  }

  async selectModel(slug: string): Promise<AiServerRuntimeView> {
    const models = await this.listModels();
    const model = models.find((candidate) => candidate.slug === slug);
    if (!model) throw new BadRequestException('Modelo selecionado não está disponível');
    await this.prisma.aiServerRuntime.update({
      where: { id: 'global' },
      data: { selectedModelSlug: model.slug, selectedModelDisplayName: model.displayName },
    });
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
}
