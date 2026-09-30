import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';
import { RequestUser } from '../../common/interfaces/request-context.interface';
import { AiServerModel, AiServerRuntimeService, AiServerRuntimeView } from './ai-server-runtime.service';
import { SelectAiRuntimeModelDto } from './dto/select-ai-runtime-model.dto';

export interface AiRuntimeResponse extends AiServerRuntimeView {
  models: AiServerModel[];
}

/**
 * Visão do runtime global de IA durante a homologação.
 *
 * Por que existe: o chat precisa saber com qual conta e com qual modelo está
 * conversando sem nunca receber credencial. Toda a lógica de catálogo, corrida
 * de seleção e erro recuperável continua no `AiServerRuntimeService`; aqui só
 * existe a moldura HTTP e aallow-list de campos que saem da API.
 *
 * A proteção é `ai.use` (e não `settings.edit`) porque o controle de modelo
 * ainda vive no chat; a porta administrativa é
 * `settings/ai/providers` no módulo de configurações.
 */
@UseGuards(AuthGuard('jwt'), TenantContextGuard, PermissionGuard)
@RequirePermissions('ai.use')
@Controller('ai/runtime')
export class AiServerRuntimeController {
  constructor(private readonly runtime: AiServerRuntimeService) {}

  /**
   * Estado global + catálogo. Um catálogo indisponível (sem conexão ou falha do
   * provider) vira `models: []` em vez de erro: o chat precisa continuar
   * mostrando o estado da conta mesmo sem lista de modelos.
   */
  @Get()
  async getRuntime(): Promise<AiRuntimeResponse> {
    const runtime = await this.runtime.getRuntime();
    return { ...this.toRuntimeView(runtime), models: await this.models() };
  }

  /** Troca do modelo global; a validação do `slug` e a corrida ficam no serviço. */
  @Post('model')
  async selectModel(@CurrentUser() user: RequestUser, @Body() dto: SelectAiRuntimeModelDto): Promise<AiRuntimeResponse> {
    const runtime = await this.runtime.selectModel(dto.slug, {
      tenantId: user.tenantId,
      tenantUserId: user.tenantUserId,
      userId: user.userId,
    });
    return { ...this.toRuntimeView(runtime), models: await this.models() };
  }

  private async models(): Promise<AiServerModel[]> {
    try {
      return await this.runtime.listModels();
    } catch {
      return [];
    }
  }

  /** Allow-list explícita: nenhum campo de conexão ou token sai daqui. */
  private toRuntimeView(runtime: AiServerRuntimeView): AiServerRuntimeView {
    return {
      connectionStatus: runtime.connectionStatus,
      provider: runtime.provider,
      selectedModel: runtime.selectedModel
        ? { slug: runtime.selectedModel.slug, displayName: runtime.selectedModel.displayName }
        : null,
    };
  }
}