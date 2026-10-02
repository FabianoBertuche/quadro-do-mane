import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProjectsModule } from '../projects/projects.module';
import { TasksModule } from '../tasks/tasks.module';
import { OpenAiResponsesProvider } from './providers/openai-responses.provider';
import { AI_OAUTH_SERVICE, AI_PROVIDER, AI_PROVIDER_ROUTING, AI_RATE_LIMITER, AI_SERVER_RUNTIME, AiService, DEFAULT_AI_SECURITY_LIMITS } from './ai.service';
import { AiProviderRoutingService, AI_OLLAMA_PROVIDER_FACTORY, defaultOllamaProviderFactory } from './ai-provider-routing.service';
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
import { CreateCalendarEventTool } from './tools/create-calendar-event.tool';
import { CreateRoutineTool } from './tools/create-routine.tool';
import { DeleteRoutineTool } from './tools/delete-routine.tool';
import { AddTeamMemberTool } from './tools/add-team-member.tool';
import { AddProjectMemberTool } from './tools/add-project-member.tool';
import { SearchProjectsTool } from './tools/search-projects.tool';
import { SearchUsersTool } from './tools/search-users.tool';
import { SearchTeamsTool } from './tools/search-teams.tool';
import { SearchCalendarTool } from './tools/search-calendar.tool';
import { SearchRoutinesTool } from './tools/search-routines.tool';
import type { AiTool } from './tools/ai-tool.port';
import { EventsModule } from '../events/events.module';
import { DailyRoutineModule } from '../daily-routine/daily-routine.module';
import { TeamsModule } from '../teams/teams.module';
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
import { ProjectsService } from '../projects/projects.service';
import { TeamsService } from '../teams/teams.service';
import { EventsService } from '../events/events.service';
import { DailyRoutineService } from '../daily-routine/daily-routine.service';
import { TasksService } from '../tasks/tasks.service';
import { AI_PERMISSION_SERVICE, AiPermissionService } from './ai-permission.service';

@Module({
  imports: [ProjectsModule, TasksModule, UsersModule, EventsModule, DailyRoutineModule, TeamsModule],
  controllers: [AiController, AiAudioController, AiOAuthController, AiServerRuntimeController],
  providers: [
    AiService,
    AiContextService,
    AiIdentityContextService,
    AiAuditService,
    AiPermissionService,
    { provide: AI_PERMISSION_SERVICE, useExisting: AiPermissionService },
    { provide: SearchTasksTool, inject: [TasksService, UsersService, ProjectsService], useFactory: (tasks: TasksService, users: UsersService, projects: ProjectsService) => new SearchTasksTool(tasks, users, projects) },
    { provide: CreateTaskTool, inject: [TasksService, ProjectsService, UsersService], useFactory: (tasks: TasksService, projects: ProjectsService, users: UsersService) => new CreateTaskTool(tasks, projects, users) },
    { provide: UpdateTaskTool, inject: [TasksService, UsersService, ProjectsService], useFactory: (tasks: TasksService, users: UsersService, projects: ProjectsService) => new UpdateTaskTool(tasks, users, projects) },
    { provide: MoveTaskTool, inject: [TasksService, UsersService, ProjectsService], useFactory: (tasks: TasksService, users: UsersService, projects: ProjectsService) => new MoveTaskTool(tasks, users, projects) },
    CreateCalendarEventTool,
    CreateRoutineTool,
    DeleteRoutineTool,
    AddTeamMemberTool,
    AddProjectMemberTool,
    { provide: SearchProjectsTool, inject: [ProjectsService, UsersService], useFactory: (projects: ProjectsService, users: UsersService) => new SearchProjectsTool(projects, users) },
    { provide: SearchUsersTool, inject: [UsersService], useFactory: (users: UsersService) => new SearchUsersTool(users) },
    { provide: SearchTeamsTool, inject: [TeamsService, UsersService], useFactory: (teams: TeamsService, users: UsersService) => new SearchTeamsTool(teams, users) },
    { provide: SearchCalendarTool, inject: [EventsService, UsersService], useFactory: (events: EventsService, users: UsersService) => new SearchCalendarTool(events, users) },
    { provide: SearchRoutinesTool, inject: [DailyRoutineService, UsersService], useFactory: (routines: DailyRoutineService, users: UsersService) => new SearchRoutinesTool(routines, users) },
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
      inject: [AI_PERMISSION_SERVICE, SearchProjectsTool, SearchTasksTool, SearchUsersTool, SearchTeamsTool, SearchCalendarTool, SearchRoutinesTool, CreateTaskTool, UpdateTaskTool, MoveTaskTool, CreateCalendarEventTool, CreateRoutineTool, DeleteRoutineTool, AddTeamMemberTool, AddProjectMemberTool],
      useFactory: (permissions: AiPermissionService, ...tools: AiTool[]) => new AiToolRegistryService(tools, permissions),
    },
    {
      provide: AI_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => new OpenAiResponsesProvider(config),
    },
    {
      provide: AI_OLLAMA_PROVIDER_FACTORY,
      useFactory: () => defaultOllamaProviderFactory,
    },
    AiProviderRoutingService,
    { provide: AI_PROVIDER_ROUTING, useExisting: AiProviderRoutingService },
  ],
  // `AiServerRuntimeService` é exportado para o painel administrativo ler o
  // estado global sem duplicar a resolução de conexão/credencial.
  exports: [AiService, AiServerRuntimeService, AI_PERMISSION_SERVICE],
})
export class AiModule {}
