import assert from 'node:assert/strict';
import test from 'node:test';
import { DailyRoutineService } from './daily-routine.service';

type Mock = ((...args: any[]) => any) & {
  mock: { calls: any[][] };
  mockImplementation(impl: (...args: any[]) => any): Mock;
  mockResolvedValue(value: any): Mock;
  mockRejectedValue(reason: any): Mock;
};

/** Mock manual no mesmo estilo dos specs de notificações (node 20 não tem `mockResolvedValue`). */
const mock = (impl: (...args: any[]) => any = () => undefined): Mock => {
  const calls: any[][] = [];
  let current = impl;
  const fn = ((...args: any[]) => {
    calls.push(args);
    return current(...args);
  }) as Mock;
  fn.mock = { calls };
  fn.mockImplementation = (next) => {
    current = next;
    return fn;
  };
  fn.mockResolvedValue = (value) => fn.mockImplementation(async () => value);
  fn.mockRejectedValue = (reason) =>
    fn.mockImplementation(async () => {
      throw reason;
    });
  return fn;
};

/** 11:00 e 11:20 de São Paulo em 28/09/2026 (UTC-3). */
const ELEVEN_AM_SP = new Date('2026-09-28T14:00:00.000Z');
const ELEVEN_TWENTY_AM_SP = new Date('2026-09-28T14:20:00.000Z');
/** 11:30 de São Paulo: os 30 minutos exigidos depois do horário da rotina. */
const ELEVEN_THIRTY_AM_SP = new Date('2026-09-28T14:30:00.000Z');
/** 00:10 de São Paulo, antes de existir janela de pendência no dia. */
const TEN_PM_SP = new Date('2026-09-28T03:10:00.000Z');

const routine = (overrides: Record<string, any> = {}) => ({
  id: 'routine-1',
  tenantId: 'tenant-1',
  assignedTenantUserId: 'user-1',
  title: 'Beber água',
  scheduledTime: '11:00' as string | null,
  isActive: true,
  ...overrides,
});

/**
 * O falso `findMany` reproduz o filtro do banco: rotina ativa, sem log do dia
 * corrente e `scheduledTime` dentro da janela textual pedida. O `not: null` do
 * horário fica de fora de propósito, para provar a guarda defensiva do laço.
 */
const doubles = (rows: any[] = []) => {
  const prisma: any = {
    dailyRoutineItem: {
      findMany: mock(async (args: any) => {
        const window = args.where.scheduledTime;
        return rows.filter((row) => {
          if (args.where.isActive && !row.isActive) return false;
          if (row.completedOn === args.where.logs.none.date) return false;
          if (typeof row.scheduledTime !== 'string') return true;
          if (window.lte && row.scheduledTime > window.lte) return false;
          if (window.gt && row.scheduledTime <= window.gt) return false;
          if (window.gte && row.scheduledTime < window.gte) return false;
          return true;
        });
      }),
    },
  };
  const activityLog = { log: mock(async () => undefined) };
  const dispatcher = { dispatch: mock(async () => ({ id: 'dispatch-1' })) };
  const service = new DailyRoutineService(prisma as any, activityLog as any, dispatcher as any);
  const lines: string[] = [];
  (service as any).logger = {
    debug: (m: string) => lines.push(m),
    warn: (m: string) => lines.push(m),
    error: (m: string) => lines.push(m),
  };
  return { service, prisma, activityLog, dispatcher, lines };
};

const dispatched = (dispatcher: { dispatch: Mock }) => dispatcher.dispatch.mock.calls.map(([input]) => input);

test('avisa a rotina no horário configurado', async () => {
  const { service, dispatcher } = doubles([routine()]);

  await service.sendScheduledNotifications(ELEVEN_AM_SP);

  assert.deepEqual(dispatched(dispatcher), [
    {
      tenantId: 'tenant-1',
      tenantUserId: 'user-1',
      category: 'ROUTINE',
      type: 'routine_scheduled',
      title: 'Rotina agora',
      message: '"Beber água" está marcada para 11:00',
      payload: { routineId: 'routine-1', route: '/daily-routine' },
      entityType: 'routine',
      entityId: 'routine-1',
      occurrenceKey: 'scheduled:11:00:2026-09-28',
    },
  ]);
});

test('envia o lembrete pendente só 30 minutos depois do horário', async () => {
  const { service, dispatcher } = doubles([routine()]);

  await service.sendScheduledNotifications(ELEVEN_THIRTY_AM_SP);

  assert.deepEqual(dispatched(dispatcher), [
    {
      tenantId: 'tenant-1',
      tenantUserId: 'user-1',
      category: 'ROUTINE',
      type: 'routine_pending',
      title: 'Rotina pendente',
      message: '"Beber água" (11:00) ainda não foi concluída hoje',
      payload: { routineId: 'routine-1', route: '/daily-routine' },
      entityType: 'routine',
      entityId: 'routine-1',
      occurrenceKey: 'pending:11:00:2026-09-28',
    },
  ]);
});

test('antes dos 30 minutos só existe a janela do horário, e o ledger a repete', async () => {
  const { service, dispatcher } = doubles([routine()]);

  await service.sendScheduledNotifications(ELEVEN_TWENTY_AM_SP);

  assert.deepEqual(
    dispatched(dispatcher).map((input) => [input.type, input.occurrenceKey]),
    [['routine_scheduled', 'scheduled:11:00:2026-09-28']],
  );
});

test('rotina já concluída hoje não gera dispatch porque as janelas exigem ausência de log do dia', async () => {
  const { service, prisma, dispatcher } = doubles([]);

  await service.sendScheduledNotifications(ELEVEN_AM_SP);

  assert.equal(prisma.dailyRoutineItem.findMany.mock.calls.length, 2);
  for (const [args] of prisma.dailyRoutineItem.findMany.mock.calls) {
    assert.deepEqual(args.where.logs, { none: { date: '2026-09-28' } });
  }
  assert.equal(dispatcher.dispatch.mock.calls.length, 0);
});

test('as janelas são consultas separadas, ativas e ancoradas na meia-noite do próprio dia', async () => {
  const { service, prisma } = doubles([]);

  await service.sendScheduledNotifications(ELEVEN_THIRTY_AM_SP);

  const [onTime, pending] = prisma.dailyRoutineItem.findMany.mock.calls.map(([args]: any[]) => args.where);
  assert.equal(onTime.isActive, true);
  assert.equal(pending.isActive, true);
  assert.deepEqual(onTime.scheduledTime, { not: null, gt: '11:00', lte: '11:30' });
  assert.deepEqual(pending.scheduledTime, { not: null, lte: '11:00' });
});

test('antes da meia-noite e meia existe só a janela do horário', async () => {
  const { service, prisma, dispatcher } = doubles([routine({ scheduledTime: '00:05' })]);

  await service.sendScheduledNotifications(TEN_PM_SP);

  assert.equal(prisma.dailyRoutineItem.findMany.mock.calls.length, 1);
  assert.deepEqual(prisma.dailyRoutineItem.findMany.mock.calls[0][0].where.scheduledTime, {
    not: null,
    gte: '00:00',
    lte: '00:10',
  });
  assert.deepEqual(
    dispatched(dispatcher).map((input) => input.occurrenceKey),
    ['scheduled:00:05:2026-09-28'],
  );
});

test('rotina inativa não gera dispatch', async () => {
  const { service, dispatcher } = doubles([routine({ isActive: false })]);

  await service.sendScheduledNotifications(ELEVEN_AM_SP);

  assert.equal(dispatcher.dispatch.mock.calls.length, 0);
});

test('ignora rotina sem horário devolvida pela consulta', async () => {
  const { service, dispatcher } = doubles([routine({ scheduledTime: null })]);

  await service.sendScheduledNotifications(ELEVEN_AM_SP);

  assert.equal(dispatcher.dispatch.mock.calls.length, 0);
});

test('uma entrega que falha não interrompe as demais rotinas e não ecoa o erro', async () => {
  const { service, dispatcher, lines } = doubles([
    routine(),
    routine({ id: 'routine-2', title: 'Caminhada', scheduledTime: '10:50' }),
  ]);
  let first = true;
  dispatcher.dispatch.mockImplementation(async () => {
    if (first) {
      first = false;
      throw new Error('ExponentPushToken[segredo] rejeitado');
    }
    return { id: 'dispatch-2' };
  });

  await service.sendScheduledNotifications(ELEVEN_AM_SP);

  assert.equal(dispatcher.dispatch.mock.calls.length, 2);
  assert.deepEqual(
    dispatched(dispatcher).map((input) => input.entityId),
    ['routine-1', 'routine-2'],
  );
  const logged = lines.join(' | ');
  assert.ok(logged.includes('routine=routine-1') && logged.includes('Error'), `o erro precisa identificar a rotina que falhou: ${logged}`);
  assert.equal(logged.includes('segredo'), false, 'a mensagem do erro pode conter token e não pode ser logada');
});
