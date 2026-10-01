import { Body, Controller, Delete, Get, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';
import { RequestUser } from '../../common/interfaces/request-context.interface';
import { AiServerRuntimeService } from '../ai/ai-server-runtime.service';
import { UpdateOllamaApiKeyDto } from '../ai/dto/update-ollama-api-key.dto';

export interface AiProviderDescriptor {
  id: string;
  name: string;
  status: 'active' | 'coming_soon';
  connectable: false;
}

export interface ComingSoonAiProvider extends AiProviderDescriptor {
  status: 'coming_soon';
}

export interface ActiveAiProvider extends AiProviderDescriptor {
  status: 'active';
  connectionStatus: 'connected' | 'disconnected';
}

/**
 * Provedores futuros: descritores fixos, sem credencial, sem ação de conexão.
 * Existe para a área de Configurações mostrar o que virá; implementar qualquer
 * um deles é trabalho de release próprio.
 */
export const COMING_SOON_AI_PROVIDERS: readonly ComingSoonAiProvider[] = Object.freeze([
  Object.freeze({ id: 'anthropic', name: 'Anthropic (Claude)', status: 'coming_soon', connectable: false }),
  Object.freeze({ id: 'google', name: 'Google (Gemini)', status: 'coming_soon', connectable: false }),
  Object.freeze({ id: 'azure', name: 'Azure OpenAI', status: 'coming_soon', connectable: false }),
]);

/**
 * Configuração dos provedores de IA para a área administrativa.
 *
 * Por que `settings.edit` e não `ai.use`: este é o painel da empresa, separado
 * do uso do assistente no chat. `settings.edit` é concedida apenas ao admin no
 * seed de permissões e o `PermissionGuard` já dá passe direto para
 * `roleName === 'admin'`, então a porta é de administrador sem inventar um guard
 * novo.
 *
 * O controlador cobre duas responsabilidades sob o mesmo guard: o status
 * somente-leitura dos provedores (`GET /settings/ai/providers`) e a gestão da
 * chave Ollama Cloud (`PUT`/`DELETE /settings/ai/ollama/key`). Nenhuma rota
 * devolve token, chave, e-mail ou escopos.
 */
@UseGuards(AuthGuard('jwt'), TenantContextGuard, PermissionGuard)
@RequirePermissions('settings.edit')
@Controller('settings/ai')
export class AiProviderSettingsController {
  constructor(private readonly runtime: AiServerRuntimeService) {}

  @Get('providers')
  async providers(): Promise<{ providers: Array<ActiveAiProvider | ComingSoonAiProvider> }> {
    const runtime = await this.runtime.getRuntime();
    const chatgpt: ActiveAiProvider = {
      id: 'chatgpt',
      name: 'ChatGPT',
      status: 'active',
      connectionStatus: runtime.providers.chatgpt.connectionStatus,
      connectable: false,
    };
    return { providers: [chatgpt, ...COMING_SOON_AI_PROVIDERS] };
  }

  @Put('ollama/key')
  async saveOllamaKey(@CurrentUser() user: RequestUser, @Body() dto: UpdateOllamaApiKeyDto) {
    await this.runtime.saveOllamaKey(dto.apiKey, { tenantId: user.tenantId, tenantUserId: user.tenantUserId, userId: user.userId });
    return { status: 'saved' };
  }

  @Delete('ollama/key')
  async removeOllamaKey(@CurrentUser() user: RequestUser) {
    await this.runtime.removeOllamaKey({ tenantId: user.tenantId, tenantUserId: user.tenantUserId, userId: user.userId });
    return { status: 'removed' };
  }
}