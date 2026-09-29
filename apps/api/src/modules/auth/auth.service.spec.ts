import assert from 'node:assert/strict';
import test from 'node:test';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

type Mock = ((...args: any[]) => any) & { mock: { calls: any[][] } };

const mock = (implementation: (...args: any[]) => any): Mock => {
  const calls: any[][] = [];
  const fn = ((...args: any[]) => {
    calls.push(args);
    return implementation(...args);
  }) as Mock;
  fn.mock = { calls };
  return fn;
};

function makeService(overrides: Record<string, unknown> = {}) {
  const signCalls: { payload: unknown; opts: Record<string, unknown> }[] = [];
  const jwt = {
    sign: (payload: unknown, opts?: Record<string, unknown>) => {
      signCalls.push({ payload, opts: opts ?? {} });
      return `token:${signCalls.length}`;
    },
  };
  const config = {
    get: (key: string, def?: string) =>
      ({
        JWT_EXPIRES_IN: '15m',
        JWT_REFRESH_EXPIRES_IN: '7d',
        JWT_REFRESH_SECRET: 'test-secret',
      })[key] ?? def,
  };
  let created: any = null;
  const prisma = {
    refreshToken: {
      create: async (args: { data: Record<string, any> }) => {
        created = args.data;
        return { id: 'rt-1', ...args.data };
      },
    },
    ...overrides,
  };
  const encryption = { hash: (v: string) => `hash:${v}` };
  const dispatcher = { dispatch: mock(async () => undefined) };

  const moduleRef = { get: () => dispatcher };
  const service = new (AuthService as any)(
    prisma as any,
    jwt as any,
    config as any,
    encryption as any,
    {} as any,
    moduleRef as any,
  ) as any;

  return {
    service,
    signCalls,
    getCreated: () => created,
    dispatcher,
  };
}

const tenantUser = {
  userId: 'u1',
  tenantId: 't1',
  id: 'tu1',
  roleId: null,
  role: null,
};

test('mobile: refresh token emitido SEM expiração (JWT sem expiresIn e banco expiresAt null)', async () => {
  const { service, signCalls, getCreated } = makeService();

  await service.issueTokens(tenantUser, 'family-1', { clientType: 'mobile' });

  const refreshOpts = signCalls[1].opts;
  assert.equal(refreshOpts.expiresIn, undefined, 'refresh JWT não deve ter expiresIn p/ mobile');

  const record = getCreated();
  assert.equal(record.expiresAt, null, 'registro no banco deve ter expiresAt null p/ mobile');
  assert.equal(record.family, 'family-1');
});

test('web: refresh token continua com expiração (7d no JWT e banco)', async () => {
  const { service, signCalls, getCreated } = makeService();

  await service.issueTokens(tenantUser, 'family-2', {});

  const refreshOpts = signCalls[1].opts;
  assert.equal(refreshOpts.expiresIn, '7d', 'refresh JWT deve manter expiresIn p/ demais clientes');

  const record = getCreated();
  assert.ok(record.expiresAt instanceof Date, 'banco deve manter expiresAt p/ demais clientes');
  assert.ok(record.expiresAt.getTime() > Date.now(), 'expiresAt deve estar no futuro');
});

test('mobile no select-tenant: sessão também sai sem expiração', async () => {
  const prisma = {
    tenantUser: {
      findFirst: async () => ({ id: 'tu1', tenantId: 't1', userId: 'u1' }),
      findUnique: async () => ({
        id: 'tu1',
        tenantId: 't1',
        userId: 'u1',
        roleId: null,
        role: null,
        user: { id: 'u1' },
        tenant: { id: 't1' },
      }),
    },
    refreshToken: {
      create: async (args: { data: Record<string, any> }) => ({ id: 'rt-1', ...args.data }),
    },
  };
  const { service, signCalls } = makeService(prisma);

  await service.selectTenant('u1', { tenantId: 't1' }, { clientType: 'mobile' });

  const refreshOpts = signCalls[1].opts;
  assert.equal(refreshOpts.expiresIn, undefined, 'refresh do select-tenant mobile também sem expiração');
});

test('login interativo dispara segurança após emitir sessão, mas refresh não dispara', async () => {
  const passwordHash = await bcrypt.hash('secret', 4);
  const prisma = {
    user: {
      findUnique: async () => ({ id: 'u1', passwordHash, isActive: true }),
      update: async () => undefined,
    },
    loginAttempt: { create: async () => undefined },
    tenantUser: {
      findMany: async () => [{ id: 'tu1', userId: 'u1', tenantId: 't1', tenant: { id: 't1' } }],
      findUnique: async () => ({
        id: 'tu1', userId: 'u1', tenantId: 't1', role: null,
        user: { id: 'u1' }, tenant: { id: 't1' },
      }),
      findFirst: async () => ({
        id: 'tu1', userId: 'u1', tenantId: 't1', role: null,
        user: { id: 'u1' }, tenant: { id: 't1' },
      }),
    },
    refreshToken: {
      create: async () => ({ id: 'rt-new' }),
      findUnique: async () => ({
        id: 'rt-old', userId: 'u1', tenantId: 't1', isRevoked: false,
        expiresAt: null, family: 'family-1', user: {},
      }),
      update: async () => undefined,
    },
  };
  const { service, dispatcher } = makeService(prisma);

  await service.login({ email: 'user@example.com', password: 'secret' });

  assert.equal(dispatcher.dispatch.mock.calls.length, 1);
  assert.deepEqual(dispatcher.dispatch.mock.calls[0][0], {
    tenantId: 't1',
    tenantUserId: 'tu1',
    category: 'SECURITY',
    type: 'security_login',
    title: 'Novo login detectado',
    message: 'Sua conta foi acessada com sucesso.',
    payload: { route: '/notifications' },
    entityType: 'user',
    entityId: 'u1',
    occurrenceKey: 'login:hash:token:2',
  });

  dispatcher.dispatch.mock.calls.length = 0;
  await service.refreshToken('refresh-token');
  assert.equal(dispatcher.dispatch.mock.calls.length, 0);
});
