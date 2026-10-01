import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import 'reflect-metadata';
import express from 'express';
import { Type, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AiServerRuntimeController } from './ai-server-runtime.controller';
import { AiProviderSettingsController } from '../settings/ai-provider-settings.controller';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';

const runtimeUser = {
  userId: 'user-1', email: 'person@example.com', tenantId: 'tenant-a', tenantUserId: 'tenant-user-1',
  roleId: 'role-1', roleName: 'collaborator', permissions: ['ai.use'],
};
const adminUser = { ...runtimeUser, roleName: 'admin', permissions: [] };
const runtime = {
  getRuntime: async () => ({
    connectionStatus: 'connected', provider: 'chatgpt',
    selectedModel: { slug: 'gpt-5', displayName: 'GPT-5' },
    oauthConnectionId: 'secret-connection', accessToken: 'secret-token',
  }),
  listModels: async () => [{ slug: 'gpt-5', displayName: 'GPT-5' }],
  selectModel: async (slug: string) => ({
    connectionStatus: 'connected', provider: 'chatgpt', selectedModel: { slug, displayName: 'GPT-5' },
  }),
};

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

function app() {
  const server = express();
  server.use(express.json());
  const reflector = new Reflector();
  const permissionGuard = new PermissionGuard(reflector, {
    rolePermission: { findMany: async () => [] },
    role: { findFirst: async () => null },
  } as any);
  const tenantContextGuard = new TenantContextGuard();

  // This is a deterministic fixture adapter, not a JWT implementation or a
  // claim that arbitrary bearer strings authenticate in production.
  function testAuthAdapter(req: express.Request, res: express.Response, next: express.NextFunction) {
    const token = req.header('authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ statusCode: 401, message: 'Unauthorized' });
    const users: Record<string, typeof runtimeUser> = {
      'test-admin': adminUser,
      'test-limited': { ...runtimeUser, permissions: [] },
      'test-user': runtimeUser,
    };
    const user = users[token];
    if (!user) return res.status(401).json({ statusCode: 401, message: 'Unauthorized' });
    (req as any).user = user;
    next();
  }
  server.use(testAuthAdapter);
  const runtimeController = new AiServerRuntimeController(runtime as any);
  const settingsController = new AiProviderSettingsController(runtime as any);
  const guard = (guardInstance: PermissionGuard | TenantContextGuard, handler: Function, controller: Function) =>
    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const context = {
        getHandler: () => handler,
        getClass: () => controller,
        switchToHttp: () => ({ getRequest: () => req }),
      } as any;
      try {
        if (await guardInstance.canActivate(context)) next();
      } catch (error) {
        next(error);
      }
    };
  const runtimeGuards = [
    guard(tenantContextGuard, AiServerRuntimeController.prototype.getRuntime, AiServerRuntimeController),
    guard(permissionGuard, AiServerRuntimeController.prototype.getRuntime, AiServerRuntimeController),
  ];
  const selectModelGuards = [
    guard(tenantContextGuard, AiServerRuntimeController.prototype.selectModel, AiServerRuntimeController),
    guard(permissionGuard, AiServerRuntimeController.prototype.selectModel, AiServerRuntimeController),
  ];
  const settingsGuards = [
    guard(tenantContextGuard, AiProviderSettingsController.prototype.providers, AiProviderSettingsController),
    guard(permissionGuard, AiProviderSettingsController.prototype.providers, AiProviderSettingsController),
  ];
  server.get('/api/ai/runtime', ...runtimeGuards, async (_req, res, next) => {
    try { res.json(await runtimeController.getRuntime()); } catch (error) { next(error); }
  });
  server.post('/api/ai/runtime/model', ...selectModelGuards, async (req, res, next) => {
    try {
      const dto = await pipe.transform(req.body, { type: 'body', metatype: (Reflect.getMetadata('design:paramtypes', AiServerRuntimeController.prototype, 'selectModel') as unknown[])[1] as Type });
      res.json(await runtimeController.selectModel((req as any).user, dto));
    } catch (error) { next(error); }
  });
  server.get('/api/settings/ai/providers', ...settingsGuards, async (_req, res, next) => {
    try { res.json(await settingsController.providers()); } catch (error) { next(error); }
  });
  server.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(error.status ?? 500).json({ statusCode: error.status ?? 500, message: error.message }));
  return server;
}

async function request(server: express.Express, method: string, path: string, options: { token?: string; body?: unknown } = {}) {
  const listener = http.createServer(server);
  await new Promise<void>((resolve) => listener.listen(0, '127.0.0.1', resolve));
  const address = listener.address() as { port: number };
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
      method,
      headers: { ...(options.token ? { authorization: `Bearer ${options.token}` } : {}), ...(options.body ? { 'content-type': 'application/json' } : {}) },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    return { status: response.status, body: await response.json() };
  } finally {
    await new Promise<void>((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  }
}

test('HTTP runtime routes enforce auth, permission, DTO validation, and response redaction', async () => {
  const server = app();
  assert.equal((await request(server, 'GET', '/api/ai/runtime')).status, 401);
  assert.equal((await request(server, 'GET', '/api/ai/runtime', { token: 'test-limited' })).status, 403);
  assert.equal((await request(server, 'GET', '/api/ai/runtime', { token: 'test-user' })).status, 200);
  const selected = await request(server, 'POST', '/api/ai/runtime/model', { token: 'test-user', body: { slug: 'gpt-5', extra: true } });
  assert.equal(selected.status, 400);
  const selectedResponse = await request(server, 'POST', '/api/ai/runtime/model', { token: 'test-user', body: { slug: 'gpt-5' } });
  assert.equal(selectedResponse.status, 200);
  assert.equal(selectedResponse.body.selectedModel.slug, 'gpt-5');
  const response = await request(server, 'GET', '/api/ai/runtime', { token: 'test-user' });
  assert.deepEqual(response.body, {
    connectionStatus: 'connected', provider: 'chatgpt', selectedModel: { slug: 'gpt-5', displayName: 'GPT-5' },
    models: [{ slug: 'gpt-5', displayName: 'GPT-5' }],
  });
  assert.equal(JSON.stringify(response.body).includes('secret-token'), false);
});

test('HTTP settings provider route requires admin permission and returns redacted status', async () => {
  const server = app();
  assert.equal((await request(server, 'GET', '/api/settings/ai/providers', { token: 'test-user' })).status, 403);
  const response = await request(server, 'GET', '/api/settings/ai/providers', { token: 'test-admin' });
  assert.equal(response.status, 200);
  assert.equal(response.body.providers[0].connectionStatus, 'connected');
  assert.equal(JSON.stringify(response.body).includes('secret-token'), false);
});
