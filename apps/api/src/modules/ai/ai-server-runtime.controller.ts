import { BadRequestException, Body, Controller, Get, Logger, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';
import { RequestUser } from '../../common/interfaces/request-context.interface';
import { AiProviderName, AiServerModel, AiServerProviderView, AiServerRuntimeService, AiServerRuntimeView } from './ai-server-runtime.service';
import { SelectAiRuntimeModelDto } from './dto/select-ai-runtime-model.dto';
import { SetAiRuntimeFailoverDto, SetAiRuntimePrimaryDto } from './dto/ai-runtime-config.dto';

export interface AiRuntimeProviderResponse extends AiServerProviderView {
  models: AiServerModel[];
}

export interface AiRuntimeResponse {
  primaryProvider: AiProviderName;
  failoverProvider: AiProviderName | null;
  providers: Record<AiProviderName, AiRuntimeProviderResponse>;
}

/**
 * Porta administrativa do runtime global de IA.
 *
 * Por que existe: o modelo/provedor agora é configuração de administrador e
 * todo o controle mora na tela de configurações. Aqui só existe a moldura HTTP
 * e a allow-list de campos que saem da API — nenhuma credencial, token ou
 * `oauthConnectionId` passa por esta fronteira.
 *
 * A proteção é `settings.edit` porque o chat não manipula mais o runtime;
 * apenas o administrador configura provedores, modelos e failover.
 */
@UseGuards(AuthGuard('jwt'), TenantContextGuard, PermissionGuard)
@RequirePermissions('settings.edit')
@Controller('ai/runtime')
export class AiServerRuntimeController {
  private readonly logger = new Logger(AiServerRuntimeController.name);

  constructor(private readonly runtime: AiServerRuntimeService) {}

  @Get()
  async getRuntime(): Promise<AiRuntimeResponse> {
    return this.response(await this.runtime.getRuntime());
  }

  @Post('model')
  async selectModel(@CurrentUser() user: RequestUser, @Body() dto: SelectAiRuntimeModelDto): Promise<AiRuntimeResponse> {
    const runtime = await this.runtime.selectModel(dto.provider, dto.slug, this.actor(user));
    return this.response(runtime);
  }

  @Post('primary')
  async setPrimary(@CurrentUser() user: RequestUser, @Body() dto: SetAiRuntimePrimaryDto): Promise<AiRuntimeResponse> {
    return this.response(await this.runtime.setPrimaryProvider(dto.provider, this.actor(user)));
  }

  @Post('failover')
  async setFailover(@CurrentUser() user: RequestUser, @Body() dto: SetAiRuntimeFailoverDto): Promise<AiRuntimeResponse> {
    return this.response(await this.runtime.setFailoverProvider(dto.provider ?? null, this.actor(user)));
  }

  private async response(view: AiServerRuntimeView): Promise<AiRuntimeResponse> {
    return {
      primaryProvider: view.primaryProvider,
      failoverProvider: view.failoverProvider,
      providers: {
        chatgpt: await this.providerResponse('chatgpt', view),
        ollama: await this.providerResponse('ollama', view),
      },
    };
  }

  private async providerResponse(name: AiProviderName, view: AiServerRuntimeView): Promise<AiRuntimeProviderResponse> {
    const provider = view.providers[name];
    return {
      connectionStatus: provider.connectionStatus,
      selectedModel: provider.selectedModel
        ? { slug: provider.selectedModel.slug, displayName: provider.selectedModel.displayName }
        : null,
      models: await this.models(name),
    };
  }

  private async models(provider: AiProviderName): Promise<AiServerModel[]> {
    try {
      return await this.runtime.listModels(provider);
    } catch (error) {
      if (!(error instanceof BadRequestException)) throw error;
      this.logger.error(error.constructor.name);
      return [];
    }
  }

  private actor(user: RequestUser) {
    return { tenantId: user.tenantId, tenantUserId: user.tenantUserId, userId: user.userId };
  }
}