import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProjectsModule } from '../projects/projects.module';
import { TasksModule } from '../tasks/tasks.module';
import { OpenAiResponsesProvider } from './providers/openai-responses.provider';
import { AI_OAUTH_SERVICE, AI_PROVIDER, AI_RATE_LIMITER, AI_SERVER_RUNTIME, AiService, DEFAULT_AI_SECURITY_LIMITS } from './ai.service';
import { AiRateLimitService } from './ai-rate-limit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiController } from './ai.controller';
import { AiServerRuntimeController } from './ai-server-runtime.controller';
import { AiContextService } from './ai-context.service';
import { AiIdentityContextService } from './ai-identity.service';
import { AiAuditService } from './ai-audit.service';
import { AiToolRegistryService } from './tools/ai-tool-registry.service';
import { UsersModule } from '../users/users.module';
import { UsersService } from '../users/users.service';
import { SearchTasksTool } from './tools/search-tasks.tool';
import { CreateTaskTool } from './tools/create-task.tool';
import { UpdateTaskTool } from './tools/update-task.tool';
import { MoveTaskTool } from './tools/move-task.tool';
import { AiAudioController } from './ai-audio.controller';
import { AiAudioService, SPEECH_TO_TEXT_PROVIDER, TEXT_TO_SPEECH_PROVIDER } from './ai-audio.service';
import { AiOAuthController } from './ai-oauth.controller';
import { AiOAuthService } from './ai-oauth.service';
import { AiServerRuntimeService } from './ai-server-runtime.service';
import { TemporaryAudioService } from './media/temporary-audio.service';
import { TemporaryAudioCleanupScheduler } from './media/temporary-audio-cleanup.scheduler';
import { OpenAiSpeechToTextProvider } from './providers/openai-speech-to-text.provider';
import { OpenAiTextToSpeechProvider } from './providers/openai-text-to-speech.provider';
import OpenAI from 'openai';

@Module({
  imports: [ProjectsModule, TasksModule, UsersModule],
  controllers: [AiController, AiAudioController, AiOAuthController, AiServerRuntimeController],
  providers: [
    AiService,
    AiContextService,
    AiIdentityContextService,
    AiAuditService,
    SearchTasksTool,
    CreateTaskTool,
    UpdateTaskTool,
    MoveTaskTool,
    AiAudioService,
    AiOAuthService,
    AiServerRuntimeService,
    { provide: AI_OAUTH_SERVICE, useExisting: AiOAuthService },
    { provide: AI_SERVER_RUNTIME, useExisting: AiServerRuntimeService },
    {
      provide: TemporaryAudioService,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => new TemporaryAudioService({
        s3: {
          endpoint: config.get('S3_ENDPOINT'), accessKey: config.get('S3_ACCESS_KEY'),
          secretKey: config.get('S3_SECRET_KEY'), bucket: config.get('S3_BUCKET'),
        },
        environment: config.get('NODE_ENV') ?? process.env.NODE_ENV,
      }),
    },
    TemporaryAudioCleanupScheduler,
    {
      provide: AI_RATE_LIMITER,
      inject: [PrismaService, ConfigService],
      useFactory: (prisma: PrismaService, config: ConfigService) => new AiRateLimitService(prisma, {
        userRequestsPerMinute: Number(config.get('AI_USER_REQUESTS_PER_MINUTE')) || DEFAULT_AI_SECURITY_LIMITS.userRequestsPerMinute,
        tenantRequestsPerMinute: Number(config.get('AI_TENANT_REQUESTS_PER_MINUTE')) || DEFAULT_AI_SECURITY_LIMITS.tenantRequestsPerMinute,
        costUnitsPerMinute: Number(config.get('AI_COST_UNITS_PER_MINUTE')) || DEFAULT_AI_SECURITY_LIMITS.costUnitsPerMinute,
      }),
    },
    {
      provide: SPEECH_TO_TEXT_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => config.get<boolean>('AI_ENABLED')
        ? new OpenAiSpeechToTextProvider(config, (key, timeout) => new OpenAI({ apiKey: key, timeout }))
        : { transcribe: async () => { throw new Error('Speech-to-text provider is disabled'); } },
    },
    {
      provide: TEXT_TO_SPEECH_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => config.get<boolean>('AI_ENABLED')
        ? new OpenAiTextToSpeechProvider(config, (key, timeout) => new OpenAI({ apiKey: key, timeout }))
        : { synthesize: async () => { throw new Error('Text-to-speech provider is disabled'); } },
    },
    {
      provide: AiToolRegistryService,
      inject: [SearchTasksTool, CreateTaskTool, UpdateTaskTool, MoveTaskTool],
      useFactory: (...tools: any[]) => new AiToolRegistryService(tools),
    },
    {
      provide: AI_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => new OpenAiResponsesProvider(config),
    },
  ],
  // `AiServerRuntimeService` é exportado para o painel administrativo ler o
  // estado global sem duplicar a resolução de conexão/credencial.
  exports: [AiService, AiServerRuntimeService],
})
export class AiModule {}
