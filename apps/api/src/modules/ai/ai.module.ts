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
import { UsersModule } from '../users/users.module';
import { UsersService } from '../users/users.service';
import { SearchTasksTool } from './tools/search-tasks.tool';
import { CreateTaskTool } from './tools/create-task.tool';
import { UpdateTaskTool } from './tools/update-task.tool';
import { MoveTaskTool } from './tools/move-task.tool';

@Module({
  imports: [ProjectsModule, TasksModule, UsersModule],
  controllers: [AiController],
  providers: [
    AiService,
    AiContextService,
    AiAuditService,
    SearchTasksTool,
    CreateTaskTool,
    UpdateTaskTool,
    MoveTaskTool,
    {
      provide: AiToolRegistryService,
      inject: [SearchTasksTool, CreateTaskTool, UpdateTaskTool, MoveTaskTool],
      useFactory: (...tools: any[]) => new AiToolRegistryService(tools),
    },
    {
      provide: AI_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => config.get<boolean>('AI_ENABLED') ? new OpenAiProvider(config) : new FakeAiProvider(),
    },
  ],
  exports: [AiService],
})
export class AiModule {}
