import assert from 'node:assert/strict';
import test from 'node:test';
import 'reflect-metadata';
import { SELF_DECLARED_DEPS_METADATA } from '@nestjs/common/constants';
import { AiModule } from './ai.module';
import { AiService, AI_OAUTH_SERVICE, AI_PROVIDER, AI_SERVER_RUNTIME } from './ai.service';
import { AiIdentityContextService } from './ai-identity.service';
import { AiOAuthService } from './ai-oauth.service';
import { AiServerRuntimeService } from './ai-server-runtime.service';
import { AiServerRuntimeController } from './ai-server-runtime.controller';
import { OpenAiResponsesProvider } from './providers/openai-responses.provider';
import { AiToolRegistryService } from './tools/ai-tool-registry.service';
import { SearchProjectsTool } from './tools/search-projects.tool';
import { SearchUsersTool } from './tools/search-users.tool';
import { SearchTeamsTool } from './tools/search-teams.tool';
import { SearchCalendarTool } from './tools/search-calendar.tool';
import { SearchRoutinesTool } from './tools/search-routines.tool';
import { SearchTasksTool } from './tools/search-tasks.tool';
import { CreateTaskTool } from './tools/create-task.tool';
import { UpdateTaskTool } from './tools/update-task.tool';
import { MoveTaskTool } from './tools/move-task.tool';
import { CreateCalendarEventTool } from './tools/create-calendar-event.tool';
import { CreateRoutineTool } from './tools/create-routine.tool';
import { AddTeamMemberTool } from './tools/add-team-member.tool';
import { AddProjectMemberTool } from './tools/add-project-member.tool';

const config = (values: Record<string, unknown>) => ({ get: (key: string, fallback?: unknown) => values[key] ?? fallback }) as any;

function providerFactory() {
  const providers = Reflect.getMetadata('providers', AiModule) ?? [];
  const provider = providers.find((entry: any) => entry?.provide === AI_PROVIDER);
  return provider.useFactory;
}

test('declares the actor-scoped OAuth service through an explicit Nest token', () => {
  const dependencies = Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, AiService) ?? [];
  const oauthDependency = dependencies.find((dependency: any) => dependency.index === 8);
  assert.equal(oauthDependency.param, AI_OAUTH_SERVICE);

  const providers = Reflect.getMetadata('providers', AiModule) ?? [];
  const oauthAlias = providers.find((provider: any) => provider?.provide === AI_OAUTH_SERVICE);
  assert.equal(oauthAlias.useExisting, AiOAuthService);
});

test('requires and registers authenticated identity context in the production module', () => {
  const parameterTypes = Reflect.getMetadata('design:paramtypes', AiService) ?? [];
  assert.equal(parameterTypes[5], AiIdentityContextService);

  const providers = Reflect.getMetadata('providers', AiModule) ?? [];
  assert.ok(providers.includes(AiIdentityContextService));
});

test('exposes the global server runtime through an explicit Nest token', () => {
  const providers = Reflect.getMetadata('providers', AiModule) ?? [];
  const runtimeAlias = providers.find((provider: any) => provider?.provide === AI_SERVER_RUNTIME);
  assert.equal(runtimeAlias.useExisting, AiServerRuntimeService);
});

test('registers the runtime controller and exports the runtime service to the admin settings module', () => {
  const controllers = Reflect.getMetadata('controllers', AiModule) ?? [];
  assert.ok(controllers.includes(AiServerRuntimeController));
  const exports = Reflect.getMetadata('exports', AiModule) ?? [];
  assert.ok(exports.includes(AiServerRuntimeService));
});

test('always supplies the Responses provider while the API-key fallback is disabled', () => {
  const factory = providerFactory();
  assert.ok(factory(config({ AI_ENABLED: false })) instanceof OpenAiResponsesProvider);
  assert.ok(factory(config({ AI_ENABLED: true, OPENAI_API_KEY: 'api-key' })) instanceof OpenAiResponsesProvider);
  assert.ok(factory(config({})) instanceof OpenAiResponsesProvider);
});

test('registers every authorized read and action tool with concrete dependencies', () => {
  const providers = Reflect.getMetadata('providers', AiModule) ?? [];
  const expected = [
    SearchProjectsTool, SearchTasksTool, SearchUsersTool, SearchTeamsTool, SearchCalendarTool, SearchRoutinesTool,
    CreateTaskTool, UpdateTaskTool, MoveTaskTool, CreateCalendarEventTool,
    CreateRoutineTool, AddTeamMemberTool, AddProjectMemberTool,
  ];
  for (const tool of expected) assert.ok(providers.some((entry: any) => entry === tool || entry?.provide === tool), `${tool.name} is not registered`);

  const registryProvider = providers.find((entry: any) => entry?.provide === AiToolRegistryService);
  assert.deepEqual(registryProvider.inject, expected);
});

test('publishes strict schemas that reject unknown tool arguments', () => {
  const providers = Reflect.getMetadata('providers', AiModule) ?? [];
  const registryProvider = providers.find((entry: any) => entry?.provide === AiToolRegistryService);
  const tools = registryProvider.useFactory(...registryProvider.inject.map((Tool: any) =>
    new Tool({ findAll: async () => [], findOne: async () => ({}) } as any, { findAll: async () => [], findOne: async () => ({}) } as any, { findByFilters: async () => [], getStatuses: async () => [], getPriorities: async () => [] } as any)));

  assert.ok(tools instanceof AiToolRegistryService);
  for (const tool of tools.list()) assert.throws(() => tool.validate?.({ unexpected: true }), /Campo não suportado|Argumentos inválidos/);
});
