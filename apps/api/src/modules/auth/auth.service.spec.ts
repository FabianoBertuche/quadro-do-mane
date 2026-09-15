import assert from 'node:assert/strict';
import test from 'node:test';
import { AuthService } from './auth.service';

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

  const service = new AuthService(
    prisma as any,
    jwt as any,
    config as any,
    encryption as any,
    {} as any,
  ) as any;

  return {
    service,
    signCalls,
    getCreated: () => created,
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