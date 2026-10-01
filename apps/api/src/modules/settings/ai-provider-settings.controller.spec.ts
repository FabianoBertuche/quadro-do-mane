import assert from 'node:assert/strict';
import test from 'node:test';
import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS_KEY } from '../../common/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';
import { AiProviderSettingsController, COMING_SOON_AI_PROVIDERS } from './ai-provider-settings.controller';
import { SettingsModule } from './settings.module';
import { AiModule } from '../ai/ai.module';

test('settings module registers the AI provider controller and imports the AI module for the global runtime', () => {
  assert.ok((Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, SettingsModule) ?? []).includes(AiProviderSettingsController));
  assert.ok((Reflect.getMetadata(MODULE_METADATA.IMPORTS, SettingsModule) ?? []).includes(AiModule));
});

test('provider status endpoint is administrator-only through the settings permission gate', () => {
  const guards = Reflect.getMetadata(GUARDS_METADATA, AiProviderSettingsController) as Function[];
  assert.equal(guards.length, 3);
  assert.equal(guards.includes(TenantContextGuard), true);
  assert.equal(guards.includes(PermissionGuard), true);
  assert.deepEqual(Reflect.getMetadata(PERMISSIONS_KEY, AiProviderSettingsController), ['settings.edit']);
});

test('provider status is read at GET /api/settings/ai/providers', () => {
  const handler = AiProviderSettingsController.prototype.providers;
  assert.equal(Reflect.getMetadata(PATH_METADATA, AiProviderSettingsController), 'settings/ai');
  assert.equal(Reflect.getMetadata(METHOD_METADATA, handler), RequestMethod.GET);
  assert.equal(Reflect.getMetadata(PATH_METADATA, handler), 'providers');
});

test('lists the ChatGPT provider with live global connection status and no credential or action fields', async () => {
  const controller = new AiProviderSettingsController({
    getRuntime: async () => ({
      primaryProvider: 'chatgpt', failoverProvider: null,
      providers: {
        chatgpt: { connectionStatus: 'connected', selectedModel: { slug: 'gpt-5', displayName: 'GPT-5' }, accessToken: 'secret-token', oauthConnectionId: 'connection-1' },
        ollama: { connectionStatus: 'disconnected', selectedModel: null },
      },
    }),
  } as any);

  const result = await controller.providers();

  assert.deepEqual(result.providers[0], {
    id: 'chatgpt', name: 'ChatGPT', status: 'active', connectionStatus: 'connected', connectable: false,
  });
  assert.equal(result.providers.length, 1 + COMING_SOON_AI_PROVIDERS.length);
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes('secret-token'), false);
  assert.equal(serialized.includes('accessToken'), false);
  assert.equal(serialized.includes('oauthConnection'), false);
});

test('ChatGPT provider reads as disconnected when no global connection exists', async () => {
  const controller = new AiProviderSettingsController({
    getRuntime: async () => ({
      primaryProvider: 'chatgpt', failoverProvider: null,
      providers: {
        chatgpt: { connectionStatus: 'disconnected', selectedModel: null },
        ollama: { connectionStatus: 'disconnected', selectedModel: null },
      },
    }),
  } as any);

  const [chatgpt, ...comingSoon] = (await controller.providers()).providers;

  assert.equal(chatgpt.status, 'active');
  assert.equal((chatgpt as { connectionStatus: string }).connectionStatus, 'disconnected');
  assert.deepEqual(comingSoon, [...COMING_SOON_AI_PROVIDERS]);
});

test('future providers are fixed coming_soon descriptors with no connect action', () => {
  assert.ok(COMING_SOON_AI_PROVIDERS.length > 0);
  for (const provider of COMING_SOON_AI_PROVIDERS) {
    // O conjunto de chaves é literal de propósito: `connectUrl`, `actions` ou
    // `credentials` added aqui reabrem a porta que esta rota não deve ter.
    assert.deepEqual(Object.keys(provider).sort(), ['connectable', 'id', 'name', 'status']);
    assert.equal(provider.status, 'coming_soon');
    assert.equal(provider.connectable, false);
    assert.equal(typeof provider.id, 'string');
    assert.equal(typeof provider.name, 'string');
  }
  const ids = COMING_SOON_AI_PROVIDERS.map((provider) => provider.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.includes('chatgpt' as never), false);
});