import assert from 'node:assert/strict';
import test from 'node:test';
import { ExpoReceiptsService } from './expo-receipts.service';

const TICKET_A = 'expo-ticket-aaaa';
const TICKET_B = 'expo-ticket-bbbb';
const SECRET_TOKEN = 'ExponentPushToken[zzzzzzzzzzzzzzzzzzzzzzzzzz]';

type PendingReceipt = { id: string; dispatchId: string; pushDeviceId: string; expoTicketId: string };
type Spy = ((...args: any[]) => any) & { mock: { calls: any[][] } };

const spy = (impl: (...args: any[]) => any): Spy => {
  const calls: any[][] = [];
  const fn = ((...args: any[]) => {
    calls.push(args);
    return impl(...args);
  }) as Spy;
  fn.mock = { calls };
  return fn;
};

const serviceWith = (options: {
  pending?: PendingReceipt[];
  remaining?: Array<{ dispatchId: string; status: string }>;
  expoReceipts?: Record<string, any>;
  chunk?: (ids: string[]) => string[][];
  failOnExpo?: boolean;
  failUpdateFor?: string;
}) => {
  const pending = options.pending ?? [];
  const remaining = options.remaining ?? [];
  const prisma = {
    notificationPushReceipt: {
      // a reconsulta por dispatch é o único lugar que usa `where.dispatchId`
      findMany: spy((args: any) => ('dispatchId' in args.where ? remaining : pending)),
      update: spy((args: any) => {
        if (args.where.id === options.failUpdateFor) throw new Error('deadlock detectado');
        return { count: 1 };
      }),
    },
    pushDevice: { delete: spy(() => ({ id: 'device-1' })) },
    notificationDispatch: { update: spy(() => ({ count: 1 })) },
  };
  const service = new ExpoReceiptsService(prisma as any);
  const expoCalls: string[][] = [];
  (service as any).expo = {
    chunkPushNotificationReceiptIds: options.chunk ?? ((ids: string[]) => [ids]),
    getPushNotificationReceiptsAsync: async (ids: string[]) => {
      expoCalls.push(ids);
      if (options.failOnExpo) throw new Error(`expo indisponível (${ids.join(', ')})`);
      return options.expoReceipts ?? {};
    },
  };
  const lines: string[] = [];
  (service as any).logger = {
    debug: (m: string) => lines.push(m),
    warn: (m: string) => lines.push(m),
    error: (m: string) => lines.push(m),
  };
  return { service, prisma, lines, expoCalls };
};

const unregistered = (expoPushToken = SECRET_TOKEN) => ({
  status: 'error',
  message: 'Device not registered',
  details: { error: 'DeviceNotRegistered', expoPushToken },
});

const twoDevices = (): PendingReceipt[] => [
  { id: 'row-1', dispatchId: 'dispatch-1', pushDeviceId: 'device-1', expoTicketId: TICKET_A },
  { id: 'row-2', dispatchId: 'dispatch-1', pushDeviceId: 'device-2', expoTicketId: TICKET_B },
];

test('removes only the device reported as DeviceNotRegistered', async () => {
  const { service, prisma } = serviceWith({
    pending: twoDevices(),
    // o receipt de device-1 some junto com o device (cascade)
    remaining: [{ dispatchId: 'dispatch-1', status: 'OK' }],
    expoReceipts: {
      [TICKET_A]: unregistered(),
      [TICKET_B]: { status: 'ok' },
    },
  });

  await service.processPending();

  assert.deepEqual(prisma.pushDevice.delete.mock.calls[0][0], { where: { id: 'device-1' } });
  assert.equal(prisma.pushDevice.delete.mock.calls.length, 1);
});

test('marca o dispatch como FAILED quando todos os receipts falham', async () => {
  const { service, prisma } = serviceWith({
    pending: twoDevices(),
    remaining: [],
    expoReceipts: {
      [TICKET_A]: unregistered(),
      [TICKET_B]: { status: 'error', message: 'too big', details: { error: 'MessageTooBig' } },
    },
  });

  const summary = await service.processPending();

  assert.deepEqual(summary, { checked: 2, devicesRemoved: 1, failed: 2 });
  const updates: Record<string, any> = {};
  for (const call of prisma.notificationPushReceipt.update.mock.calls) {
    updates[call[0].where.id] = call[0].data;
  }
  assert.equal(updates['row-1'].status, 'ERROR');
  assert.equal(updates['row-1'].errorCode, 'DeviceNotRegistered');
  assert.equal(updates['row-2'].errorCode, 'MessageTooBig');
  const dispatchCalls = prisma.notificationDispatch.update.mock.calls;
  assert.equal(dispatchCalls.length, 1);
  assert.deepEqual(dispatchCalls[0][0].where, { id: 'dispatch-1' });
  assert.equal(dispatchCalls[0][0].data.pushStatus, 'FAILED');
  // a decisão depende de reler exatamente os receipts deste dispatch
  const reread = prisma.notificationPushReceipt.findMany.mock.calls[1][0];
  assert.deepEqual(reread.where, { dispatchId: { in: ['dispatch-1'] } });
  assert.deepEqual(reread.select, { dispatchId: true, status: true });
});

test('marca o dispatch como FAILED quando os receipts falham sem device desregistrado', async () => {
  const { service, prisma } = serviceWith({
    pending: twoDevices(),
    remaining: [
      { dispatchId: 'dispatch-1', status: 'ERROR' },
      { dispatchId: 'dispatch-1', status: 'ERROR' },
    ],
    expoReceipts: {
      [TICKET_A]: { status: 'error', message: 'too big', details: { error: 'MessageTooBig' } },
      [TICKET_B]: { status: 'error', message: 'rate', details: { error: 'MessageRateExceeded' } },
    },
  });

  const summary = await service.processPending();

  assert.deepEqual(summary, { checked: 2, devicesRemoved: 0, failed: 2 });
  const dispatchCalls = prisma.notificationDispatch.update.mock.calls;
  assert.equal(dispatchCalls.length, 1);
  assert.deepEqual(dispatchCalls[0][0].where, { id: 'dispatch-1' });
  assert.equal(dispatchCalls[0][0].data.pushStatus, 'FAILED');
});

test('não marca o dispatch como FAILED quando algum receipt teve sucesso', async () => {
  const { service, prisma } = serviceWith({
    pending: twoDevices(),
    remaining: [
      { dispatchId: 'dispatch-1', status: 'ERROR' },
      { dispatchId: 'dispatch-1', status: 'OK' },
    ],
    expoReceipts: {
      [TICKET_A]: { status: 'error', message: 'too big', details: { error: 'MessageTooBig' } },
      [TICKET_B]: { status: 'ok' },
    },
  });

  const summary = await service.processPending();

  assert.deepEqual(summary, { checked: 2, devicesRemoved: 0, failed: 1 });
  assert.equal(prisma.notificationDispatch.update.mock.calls.length, 0);
});

test('não marca o dispatch como FAILED enquanto existir receipt pendente', async () => {
  const { service, prisma } = serviceWith({
    pending: [{ id: 'row-1', dispatchId: 'dispatch-1', pushDeviceId: 'device-1', expoTicketId: TICKET_A }],
    remaining: [{ dispatchId: 'dispatch-1', status: 'PENDING' }],
    expoReceipts: {
      [TICKET_A]: { status: 'error', message: 'too big', details: { error: 'MessageTooBig' } },
    },
  });

  await service.processPending();

  assert.equal(prisma.notificationDispatch.update.mock.calls.length, 0);
});

test('consulta apenas receipts pendentes e registra a data de conferência', async () => {
  const { service, prisma } = serviceWith({
    pending: [{ id: 'row-1', dispatchId: 'dispatch-1', pushDeviceId: 'device-1', expoTicketId: TICKET_A }],
    remaining: [{ dispatchId: 'dispatch-1', status: 'OK' }],
    expoReceipts: { [TICKET_A]: { status: 'ok' } },
  });
  const before = Date.now();

  const summary = await service.processPending();

  assert.deepEqual(prisma.notificationPushReceipt.findMany.mock.calls[0][0].where, { status: 'PENDING' });
  const [call] = prisma.notificationPushReceipt.update.mock.calls;
  assert.deepEqual(call[0].where, { id: 'row-1' });
  assert.equal(call[0].data.status, 'OK');
  assert.ok(call[0].data.checkedAt instanceof Date);
  assert.ok(call[0].data.checkedAt.getTime() >= before);
  assert.deepEqual(summary, { checked: 1, devicesRemoved: 0, failed: 0 });
});

test('mantém os receipts pendentes quando a consulta ao Expo falha', async () => {
  const { service, prisma } = serviceWith({
    pending: twoDevices(),
    remaining: [],
    expoReceipts: {},
    failOnExpo: true,
  });

  const summary = await service.processPending();

  assert.deepEqual(summary, { checked: 0, devicesRemoved: 0, failed: 0 });
  assert.equal(prisma.notificationPushReceipt.update.mock.calls.length, 0);
  assert.equal(prisma.pushDevice.delete.mock.calls.length, 0);
  assert.equal(prisma.notificationDispatch.update.mock.calls.length, 0);
});

test('não registra o token Expo devolvido no erro de receipt', async () => {
  const { service, lines } = serviceWith({
    pending: [{ id: 'row-1', dispatchId: 'dispatch-1', pushDeviceId: 'device-1', expoTicketId: TICKET_A }],
    remaining: [],
    expoReceipts: { [TICKET_A]: unregistered() },
  });

  await service.processPending();

  assert.ok(!lines.join('\n').includes(SECRET_TOKEN), 'o token Expo não pode aparecer no log');
});

test('não consulta o Expo quando não há receipts pendentes', async () => {
  const { service, prisma, expoCalls } = serviceWith({ pending: [], remaining: [] });

  const summary = await service.processPending();

  assert.deepEqual(summary, { checked: 0, devicesRemoved: 0, failed: 0 });
  assert.equal(expoCalls.length, 0);
  assert.equal(prisma.notificationPushReceipt.update.mock.calls.length, 0);
});

test('um erro de persistência em um receipt não interrompe os demais do mesmo lote', async () => {
  const { service, prisma, lines } = serviceWith({
    pending: twoDevices(),
    remaining: [
      { dispatchId: 'dispatch-1', status: 'OK' },
      { dispatchId: 'dispatch-1', status: 'OK' },
    ],
    expoReceipts: {
      [TICKET_A]: { status: 'ok' },
      [TICKET_B]: { status: 'ok' },
    },
    failUpdateFor: 'row-1',
  });

  const summary = await service.processPending();

  const attempted = prisma.notificationPushReceipt.update.mock.calls.map((c) => c[0].where.id);
  assert.deepEqual(attempted, ['row-1', 'row-2'], 'a linha seguinte do lote deve ser processada');
  assert.deepEqual(summary, { checked: 1, devicesRemoved: 0, failed: 0 });
  const log = lines.join('\n');
  assert.ok(log.includes('row-1') || log.includes('device-1'), 'o log deve identificar a linha que falhou');
  assert.ok(!log.includes(SECRET_TOKEN), 'o token Expo não pode aparecer no log');
});

test('consulta o Expo em lotes e processa cada receipt do lote correspondente', async () => {
  const { service, prisma, expoCalls } = serviceWith({
    pending: twoDevices(),
    remaining: [],
    chunk: (ids) => [ids.slice(0, 1), ids.slice(1)],
    expoReceipts: {
      [TICKET_A]: { status: 'ok' },
      [TICKET_B]: { status: 'ok' },
    },
  });

  const summary = await service.processPending();

  assert.deepEqual(expoCalls, [[TICKET_A], [TICKET_B]]);
  assert.equal(prisma.notificationPushReceipt.update.mock.calls.length, 2);
  assert.deepEqual(summary, { checked: 2, devicesRemoved: 0, failed: 0 });
});
