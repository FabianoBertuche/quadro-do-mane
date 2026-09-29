import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProjectsModule } from '../projects/projects.module';
import { TasksModule } from '../tasks/tasks.module';
import { FakeAiProvider } from './providers/fake-ai.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { AI_PROVIDER, AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AiContextService } from './ai-context.service';
import { AiAuditService } from './ai-audit.service';
import { AiToolRegistryService } from './tools/ai-tool-registry.service';

@Module({
  imports: [ProjectsModule, TasksModule],
  controllers: [AiController],
  providers: [
    AiService,
    AiContextService,
    AiAuditService,
    AiToolRegistryService,
    {
      provide: AI_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => config.get<boolean>('AI_ENABLED') ? new OpenAiProvider(config) : new FakeAiProvider(),
    },
  ],
  exports: [AiService],
})
export class AiModule {}
