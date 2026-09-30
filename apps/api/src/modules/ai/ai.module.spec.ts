import assert from 'node:assert/strict';
import test from 'node:test';
import 'reflect-metadata';
import { SELF_DECLARED_DEPS_METADATA } from '@nestjs/common/constants';
import { AiModule } from './ai.module';
import { AiService, AI_OAUTH_SERVICE, AI_PROVIDER, AI_SERVER_RUNTIME } from './ai.service';
import { AiOAuthService } from './ai-oauth.service';
import { AiServerRuntimeService } from './ai-server-runtime.service';
import { AiServerRuntimeController } from './ai-server-runtime.controller';
import { OpenAiResponsesProvider } from './providers/openai-responses.provider';

const config = (values: Record<string, unknown>) => ({ get: (key: string, fallback?: unknown) => values[key] ?? fallback }) as any;

function providerFactory() {
  const providers = Reflect.getMetadata('providers', AiModule) ?? [];
  const provider = providers.find((entry: any) => entry?.provide === AI_PROVIDER);
  return provider.useFactory;
}

test('declares the actor-scoped OAuth service through an explicit Nest token', () => {
  const dependencies = Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, AiService) ?? [];
  const oauthDependency = dependencies.find((dependency: any) => dependency.index === 7);
  assert.equal(oauthDependency.param, AI_OAUTH_SERVICE);

  const providers = Reflect.getMetadata('providers', AiModule) ?? [];
  const oauthAlias = providers.find((provider: any) => provider?.provide === AI_OAUTH_SERVICE);
  assert.equal(oauthAlias.useExisting, AiOAuthService);
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
