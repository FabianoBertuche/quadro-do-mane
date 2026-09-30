import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AiProviderSettingsController } from './ai-provider-settings.controller';

/**
 * Configurações da empresa. O controller de provedores de IA consome apenas a
 * visão global do runtime — nenhuma credencial sai de `AiModule`.
 */
@Module({
  imports: [AiModule],
  controllers: [AiProviderSettingsController],
})
export class SettingsModule {}