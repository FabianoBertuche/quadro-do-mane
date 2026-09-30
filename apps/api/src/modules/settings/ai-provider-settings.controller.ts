import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';
import { AiServerRuntimeService } from '../ai/ai-server-runtime.service';

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
 * Status dos provedores de IA para a área administrativa.
 *
 * Por que `settings.edit` e não `ai.use`: este é o painel da empresa, separado
 * do uso do assistente no chat. `settings.edit` é concedida apenas ao admin no
 * seed de permissões e o `PermissionGuard` já dá passe direto para
 * `roleName === 'admin'`, então a porta é de administrador sem inventar um guard
 * novo.
 *
 * Por que o ChatGPT aparece sem `connectable`: a conexão é global e o fluxo de
 * OAuth vive em `ai/oauth` durante a homologação. Esta rota é somente leitura
 * de estado — não devolve token, e-mail, escopos nem link de conectar.
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
      id: runtime.provider,
      name: 'ChatGPT',
      status: 'active',
      connectionStatus: runtime.connectionStatus,
      connectable: false,
    };
    return { providers: [chatgpt, ...COMING_SOON_AI_PROVIDERS] };
  }
}