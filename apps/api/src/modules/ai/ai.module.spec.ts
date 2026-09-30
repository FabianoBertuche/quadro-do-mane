import assert from 'node:assert/strict';
import test from 'node:test';
import 'reflect-metadata';
import { SELF_DECLARED_DEPS_METADATA } from '@nestjs/common/constants';
import { AiModule } from './ai.module';
import { AiService, AI_OAUTH_SERVICE } from './ai.service';
import { AiOAuthService } from './ai-oauth.service';

test('declares the actor-scoped OAuth service through an explicit Nest token', () => {
  const dependencies = Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, AiService) ?? [];
  const oauthDependency = dependencies.find((dependency: any) => dependency.index === 7);
  assert.equal(oauthDependency.param, AI_OAUTH_SERVICE);

  const providers = Reflect.getMetadata('providers', AiModule) ?? [];
  const oauthAlias = providers.find((provider: any) => provider?.provide === AI_OAUTH_SERVICE);
  assert.equal(oauthAlias.useExisting, AiOAuthService);
});
