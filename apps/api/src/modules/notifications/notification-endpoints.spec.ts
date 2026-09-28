import assert from 'node:assert/strict';
import test from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ArgumentMetadata } from '@nestjs/common/interfaces';
import { GUARDS_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';
import { PERMISSIONS_KEY } from '../../common/decorators/require-permissions.decorator';
import { RequestUser } from '../../common/interfaces/request-context.interface';
import { NotificationAdminController } from '../admin/notification-admin.controller';
import { NotificationsController } from './notifications.controller';
import { NotificationPreferencesService } from './notification-preferences.service';
import { UpdateNotificationPreferenceDto } from './dto/update-notification-preference.dto';
import { UpdateAdminNotificationPreferenceDto } from './dto/update-admin-notification-preference.dto';
import { NotificationDispatchQueryDto } from './dto/notification-dispatch-query.dto';

/** Usuário comum: só o próprio tenant e o próprio tenantUserId chegam ao service. */
const USER: RequestUser = {
  userId: 'user-1',
  email: 'maria@acme.com',
  tenantId: 'tenant-1',
  tenantUserId: 'user-1',
  roleId: 'role-1',
  roleName: 'gestor',
  permissions: ['notifications.view'],
};

const ADMIN: RequestUser = { ...USER, userId: 'admin-0', tenantUserId: 'admin-1', roleName: 'admin' };

type Spy = ((...args: any[]) => any) & { mock: { calls: any[][] } };

/** Duplo estrito: devolve um resultado fixo e guarda os argumentos recebidos. */
const spy = (result: unknown = undefined): Spy => {
  const calls: any[][] = [];
  const fn = ((...args: any[]) => {
    calls.push(args);
    return Promise.resolve(result);
  }) as Spy;
  fn.mock = { calls };
  return fn;
};

/** Duplo do `NotificationPreferencesService` com a mesma superfície do real. */
const preferencesDouble = () => ({
  listForUser: spy([]),
  isPushEnabled: spy(true),
  updateByUser: spy({ id: 'pref-1' }),
  updateByAdmin: spy({ id: 'pref-1' }),
});

/** Duplo do `NotificationAdminService` com a mesma superfície do real. */
const adminDouble = () => ({
  listPreferences: spy([]),
  history: spy([]),
  listDispatches: spy([]),
});

/** Duplo do `NotificationsService` com a mesma superfície do real. */
const notificationsDouble = () => ({
  findAll: spy([]),
  getUnreadCount: spy(0),
  markAsRead: spy({ id: 'notification-1' }),
  markAllAsRead: spy({ count: 0 }),
});

/** Prisma só com o que a política de preferências toca. */
const preferencePrisma = (current: { pushEnabled: boolean; lockedByAdmin: boolean } | null) => {
  const record = (impl: (...args: any[]) => any) => {
    const calls: any[][] = [];
    const fn = ((...args: any[]) => {
      calls.push(args);
      return impl(...args);
    }) as Spy;
    fn.mock = { calls };
    return fn;
  };
  const prisma: any = {
    notificationPreference: {
      findUnique: record(async () => (current ? { id: 'pref-1', ...current } : null)),
      upsert: record(async () => ({ id: 'pref-1' })),
    },
    notificationPreferenceAudit: { create: record(async () => ({ id: 'audit-1' })) },
  };
  return {
    prisma,
    upsert: prisma.notificationPreference.upsert.mock,
    audit: prisma.notificationPreferenceAudit.create.mock,
  };
};

const selfServiceController = (preferences: any) =>
  new NotificationsController(notificationsDouble() as any, preferences);

const adminController = (admin: any, preferences: any) =>
  new NotificationAdminController(admin as any, preferences);

const PARAM_METADATA: ArgumentMetadata = { type: 'param', metatype: String };

/** Pipe declarado no param `data` da rota — a chave real do Nest é `${paramtype}:${index}`. */
const paramPipe = (controller: Function, handler: string, data: string) => {
  const args = (Reflect.getMetadata(ROUTE_ARGS_METADATA, controller, handler) ?? {}) as Record<string, any>;
  return Object.values(args).find((param: any) => param.data === data).pipes[0];
};

const permissionsOf = (prototype: object, handler: string) =>
  Reflect.getMetadata(PERMISSIONS_KEY, (prototype as any)[handler]);

test('o self-service lê e altera apenas as preferências de quem está autenticado', async () => {
  const preferences = preferencesDouble();
  const controller = selfServiceController(preferences);

  await controller.listPreferences(USER);
  await controller.updatePreference(USER, 'TASKS', plainToInstance(UpdateNotificationPreferenceDto, { pushEnabled: false }));

  assert.deepEqual(preferences.listForUser.mock.calls[0], ['tenant-1', 'user-1']);
  assert.deepEqual(preferences.updateByUser.mock.calls[0], ['tenant-1', 'user-1', 'TASKS', false]);
});

test('a categoria travada pela empresa responde 409 pela rota de autoatendimento, sem gravar nada', async () => {
  const { prisma, upsert, audit } = preferencePrisma({ pushEnabled: true, lockedByAdmin: true });
  const controller = selfServiceController(new NotificationPreferencesService(prisma as any));

  await assert.rejects(
    () =>
      controller.updatePreference(
        USER,
        'TASKS',
        plainToInstance(UpdateNotificationPreferenceDto, { pushEnabled: false }),
      ),
    { status: 409 },
  );
  assert.equal(upsert.calls.length, 0);
  assert.equal(audit.calls.length, 0);
});

test('a rota administrativa trava a categoria do destinatário e assina a auditoria como ADMIN', async () => {
  const { prisma, upsert, audit } = preferencePrisma({ pushEnabled: true, lockedByAdmin: false });
  const controller = adminController(adminDouble(), new NotificationPreferencesService(prisma as any));

  await controller.updatePreference(
    ADMIN,
    'user-1',
    'TASKS',
    plainToInstance(UpdateAdminNotificationPreferenceDto, { pushEnabled: false, lockedByAdmin: true }),
  );

  assert.deepEqual(upsert.calls[0][0].create, {
    tenantId: 'tenant-1',
    tenantUserId: 'user-1',
    category: 'TASKS',
    pushEnabled: false,
    lockedByAdmin: true,
    updatedByTenantUserId: 'admin-1',
  });
  assert.equal(upsert.calls[0][0].create.updatedByTenantUserId !== 'user-1', true);
  assert.equal(audit.calls[0][0].data.source, 'ADMIN');
  assert.equal(audit.calls[0][0].data.actorTenantUserId, 'admin-1');
  assert.equal(audit.calls[0][0].data.nextValueJson, JSON.stringify({ pushEnabled: false, lockedByAdmin: true }));
});

test('destravar pela rota administrativa mantém o valor do admin e devolve a categoria ao usuário', async () => {
  const { prisma, upsert } = preferencePrisma({ pushEnabled: false, lockedByAdmin: true });
  const controller = adminController(adminDouble(), new NotificationPreferencesService(prisma as any));

  await controller.updatePreference(
    ADMIN,
    'user-1',
    'TASKS',
    plainToInstance(UpdateAdminNotificationPreferenceDto, { pushEnabled: false, lockedByAdmin: false }),
  );

  assert.deepEqual(upsert.calls[0][0].update, {
    pushEnabled: false,
    lockedByAdmin: false,
    updatedByTenantUserId: 'admin-1',
  });
});

test('as rotas administrativas leem sempre o tenant do admin e o destinatário informado na URL', async () => {
  const admin = adminDouble();
  const controller = adminController(admin, preferencesDouble());

  await controller.listPreferences(ADMIN);
  await controller.history(ADMIN, 'user-1');
  await controller.listDispatches(
    ADMIN,
    plainToInstance(NotificationDispatchQueryDto, { category: 'CALENDAR', pushStatus: 'FAILED' }),
  );

  assert.deepEqual(admin.listPreferences.mock.calls[0], ['tenant-1']);
  assert.deepEqual(admin.history.mock.calls[0], ['tenant-1', 'user-1']);
  const [tenantId, filters] = admin.listDispatches.mock.calls[0];
  assert.equal(tenantId, 'tenant-1');
  assert.equal(filters.category, 'CALENDAR');
  assert.equal(filters.pushStatus, 'FAILED');
  assert.equal(filters.tenantUserId, undefined);
});

test('preferência do usuário aceita apenas boolean e a administrativa exige o lock junto', () => {
  assert.deepEqual(validateSync(plainToInstance(UpdateNotificationPreferenceDto, { pushEnabled: false })), []);
  assert.equal(
    validateSync(plainToInstance(UpdateNotificationPreferenceDto, { pushEnabled: 'sim' })).length,
    1,
  );
  assert.equal(validateSync(plainToInstance(UpdateNotificationPreferenceDto, {})).length, 1);

  assert.deepEqual(
    validateSync(
      plainToInstance(UpdateAdminNotificationPreferenceDto, { pushEnabled: false, lockedByAdmin: true }),
    ),
    [],
  );
  assert.equal(
    validateSync(plainToInstance(UpdateAdminNotificationPreferenceDto, { pushEnabled: false })).length,
    1,
  );
  assert.equal(
    validateSync(plainToInstance(UpdateAdminNotificationPreferenceDto, { pushEnabled: 0, lockedByAdmin: 'não' }))
      .length,
    2,
  );
});

test('o filtro de entregas recusa categoria e status fora do contrato, mas aceita a ausência deles', () => {
  assert.deepEqual(
    validateSync(plainToInstance(NotificationDispatchQueryDto, { category: 'TASKS', pushStatus: 'SENT' })),
    [],
  );
  assert.deepEqual(validateSync(plainToInstance(NotificationDispatchQueryDto, {})), []);

  const bad = validateSync(
    plainToInstance(NotificationDispatchQueryDto, { category: 'BILLING', pushStatus: 'MEIO-ENVIO' }),
  );
  assert.deepEqual(bad.map((error) => error.property).sort(), ['category', 'pushStatus']);
});

test('a categoria da rota só passa quando é uma das seis do contrato e vira 400 caso contrário', async () => {
  for (const [controller, handler] of [
    [NotificationsController, 'updatePreference'],
    [NotificationAdminController, 'updatePreference'],
  ] as [Function, string][]) {
    const pipe = paramPipe(controller, handler, 'category');
    assert.equal(await pipe.transform('TASKS', PARAM_METADATA), 'TASKS');
    await assert.rejects(() => pipe.transform('BILLING', PARAM_METADATA), { status: 400 });
  }
});

test('o self-service exige notifications.view e toda a porta administrativa exige notifications.manage', () => {
  assert.deepEqual(permissionsOf(NotificationsController.prototype, 'listPreferences'), ['notifications.view']);
  assert.deepEqual(permissionsOf(NotificationsController.prototype, 'updatePreference'), ['notifications.view']);

  for (const handler of ['listPreferences', 'updatePreference', 'history', 'listDispatches']) {
    assert.deepEqual(permissionsOf(NotificationAdminController.prototype, handler), ['notifications.manage']);
  }
});

test('as duas portas de preferência ficam atrás de JWT, tenant e permissão', () => {
  for (const controller of [NotificationsController, NotificationAdminController]) {
    const guards = (Reflect.getMetadata(GUARDS_METADATA, controller) ?? []) as Function[];
    assert.equal(guards.includes(PermissionGuard), true);
    assert.equal(guards.includes(TenantContextGuard), true);
    // O terceiro é o mixin de `AuthGuard('jwt')`, que não expõe o nome da porta.
    assert.equal(guards.length, 3);
  }
});
