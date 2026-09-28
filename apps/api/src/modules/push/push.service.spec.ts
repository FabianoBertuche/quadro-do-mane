import assert from 'node:assert/strict';
import test from 'node:test';
import { PushService } from './push.service';

const TOKEN_1 = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaaaaaa]';
const TOKEN_2 = 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbbbbbb]';
const TOKEN_3 = 'ExponentPushToken[cccccccccccccccccccccccccc]';

type Device = { id: string; expoPushToken: string };
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

const serviceWith = (devices: Device[], expo: Record<string, any>) => {
  const prisma = {
    pushDevice: {
      findMany: spy(() => devices),
      upsert: spy(() => ({ id: 'device-1' })),
    },
  };
  const service = new PushService(prisma as any);
  (service as any).expo = expo;
  const lines: string[] = [];
  (service as any).logger = {
    debug: (m: string) => lines.push(m),
    warn: (m: string) => lines.push(m),
    error: (m: string) => lines.push(m),
  };
  return { service, prisma, lines };
};

/** Expo que responde com um único lote contendo todas as mensagens. */
const singleChunk = (send: (chunk: any[]) => Promise<any[]>) => ({
  chunkPushNotifications: (messages: any[]) => [messages],
  sendPushNotificationsAsync: send,
});

test('associates every Expo ticket with its PushDevice', async () => {
  const { service } = serviceWith(
    [{ id: 'device-1', expoPushToken: TOKEN_1 }],
    singleChunk(async () => [{ status: 'ok', id: 'ticket-1' }]),
  );

  const tickets = await service.sendToUser('user-1', { title: 'Título' });

  assert.deepEqual(tickets, [{ pushDeviceId: 'device-1', expoTicketId: 'ticket-1' }]);
});

test('associa cada ticket ao dispositivo do mesmo índice do lote', async () => {
  const sent: any[][] = [];
  const { service } = serviceWith(
    [
      { id: 'device-1', expoPushToken: TOKEN_1 },
      { id: 'device-2', expoPushToken: TOKEN_2 },
    ],
    {
      chunkPushNotifications: (messages: any[]) => [messages],
      sendPushNotificationsAsync: async (chunk: any[]) => {
        sent.push(chunk);
        return [
          { status: 'ok', id: 'ticket-1' },
          { status: 'ok', id: 'ticket-2' },
        ];
      },
    },
  );

  const tickets = await service.sendToUser('user-1', { title: 'Título' });

  assert.deepEqual(tickets, [
    { pushDeviceId: 'device-1', expoTicketId: 'ticket-1' },
    { pushDeviceId: 'device-2', expoTicketId: 'ticket-2' },
  ]);
  assert.deepEqual(sent[0].map((m) => m.to), [TOKEN_1, TOKEN_2]);
});

test('preserva a associação entre ticket e dispositivo quando o envio é dividido em lotes', async () => {
  const { service } = serviceWith(
    [
      { id: 'device-1', expoPushToken: TOKEN_1 },
      { id: 'device-2', expoPushToken: TOKEN_2 },
      { id: 'device-3', expoPushToken: TOKEN_3 },
    ],
    {
      chunkPushNotifications: (messages: any[]) => [[messages[0]], [messages[1], messages[2]]],
      sendPushNotificationsAsync: async (chunk: any[]) =>
        chunk.length === 1
          ? [{ status: 'ok', id: 'ticket-1' }]
          : [
              { status: 'ok', id: 'ticket-2' },
              { status: 'ok', id: 'ticket-3' },
            ],
    },
  );

  const tickets = await service.sendToUser('user-1', { title: 'Título' });

  assert.deepEqual(tickets, [
    { pushDeviceId: 'device-1', expoTicketId: 'ticket-1' },
    { pushDeviceId: 'device-2', expoTicketId: 'ticket-2' },
    { pushDeviceId: 'device-3', expoTicketId: 'ticket-3' },
  ]);
});

test('perde somente o lote cujo envio falhou e não registra o token Expo', async () => {
  const { service, lines } = serviceWith(
    [
      { id: 'device-1', expoPushToken: TOKEN_1 },
      { id: 'device-2', expoPushToken: TOKEN_2 },
      { id: 'device-3', expoPushToken: TOKEN_3 },
    ],
    {
      chunkPushNotifications: (messages: any[]) => [[messages[0]], [messages[1], messages[2]]],
      sendPushNotificationsAsync: async (chunk: any[]) => {
        if (chunk.length === 1) throw new Error(`falha de rede ao enviar ${chunk[0].to}`);
        return [
          { status: 'ok', id: 'ticket-2' },
          { status: 'ok', id: 'ticket-3' },
        ];
      },
    },
  );

  const tickets = await service.sendToUser('user-1', { title: 'Título' });

  assert.deepEqual(tickets, [
    { pushDeviceId: 'device-2', expoTicketId: 'ticket-2' },
    { pushDeviceId: 'device-3', expoTicketId: 'ticket-3' },
  ]);
  const log = lines.join('\n');
  assert.ok(log.includes('device-1'), 'o log deve identificar o device afetado');
  assert.ok(!log.includes(TOKEN_1), 'o token Expo não pode aparecer no log');
  assert.ok(!log.includes(TOKEN_2), 'o token Expo não pode aparecer no log');
});

test('descarta tickets rejeitados pelo Expo sem expor o token devolvido no erro', async () => {
  const { service, lines } = serviceWith(
    [
      { id: 'device-1', expoPushToken: TOKEN_1 },
      { id: 'device-2', expoPushToken: TOKEN_2 },
    ],
    singleChunk(async () => [
      { status: 'ok', id: 'ticket-1' },
      {
        status: 'error',
        message: 'Device not registered',
        details: { error: 'DeviceNotRegistered', expoPushToken: TOKEN_2 },
      },
    ]),
  );

  const tickets = await service.sendToUser('user-1', { title: 'Título' });

  assert.deepEqual(tickets, [{ pushDeviceId: 'device-1', expoTicketId: 'ticket-1' }]);
  assert.ok(!lines.join('\n').includes(TOKEN_2), 'o token Expo não pode aparecer no log');
});

test('ignora dispositivos cujo token não é válido e não chama o Expo', async () => {
  let calls = 0;
  const { service } = serviceWith([{ id: 'device-1', expoPushToken: 'token-invalido' }], {
    chunkPushNotifications: (messages: any[]) => [messages],
    sendPushNotificationsAsync: async () => {
      calls += 1;
      return [];
    },
  });

  const tickets = await service.sendToUser('user-1', { title: 'Título' });

  assert.deepEqual(tickets, []);
  assert.equal(calls, 0);
});

test('não consulta o Expo quando o usuário não possui dispositivos', async () => {
  let calls = 0;
  const { service } = serviceWith([], {
    chunkPushNotifications: (messages: any[]) => [messages],
    sendPushNotificationsAsync: async () => {
      calls += 1;
      return [];
    },
  });

  const tickets = await service.sendToUser('user-1', { title: 'Título' });

  assert.deepEqual(tickets, []);
  assert.equal(calls, 0);
});

test('não registra o token Expo ao recusar um token inválido', async () => {
  const { service, lines } = serviceWith([], singleChunk(async () => []));

  const result = await service.registerDevice('tenant-1', 'user-1', 'token-invalido', 'ios');

  assert.deepEqual(result, { success: false, registered: false });
  assert.ok(!lines.join('\n').includes('token-invalido'), 'o token Expo não pode aparecer no log');
});
