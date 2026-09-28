import assert from 'node:assert/strict';
import test from 'node:test';
import { EventsService } from './events.service';

/** Terceiro argumento do construtor é o dispatcher, que substituiu o push direto. */
const service = (prisma: Record<string, unknown> = {}) => new EventsService(prisma as any, {} as any, {} as any);

/** 08:00 de São Paulo em 28/09/2026 (UTC-3). */
const NOW = new Date('2026-09-28T11:00:00.000Z');

/**
 * Evento elegível no instante `NOW`: começa amanhã e o lembrete abre um dia
 * antes, então a janela já está aberta. Por padrão tem três envolvidos
 * (criador, responsável e participante) para exercitar a seleção de destinatários.
 */
const reminderEvent = (overrides: Record<string, any> = {}) => ({
  id: 'event-a', tenantId: 'tenant-a', title: 'Reunião', remindDaysBefore: 1,
  startAt: new Date('2026-09-29T10:00:00.000Z'), endAt: new Date('2026-09-29T12:00:00.000Z'),
  createdByTenantUserId: 'user-a', assigneeTenantUserId: 'user-a', attendees: [{ tenantUserId: 'user-b' }],
  ...overrides,
});

test('rejeita intervalos de evento inválidos', () => {
  const events = service() as any;
  assert.throws(
    () => events.validateEventDates('2026-09-08T12:00:00.000Z', '2026-09-08T12:00:00.000Z'),
    /data final do evento/,
  );
});

test('exige fim e coerência para recorrências', () => {
  const events = service() as any;
  assert.throws(
    () => events.validateRecurrence({ recurrenceRule: 'DAILY', startAt: '2026-09-08T12:00:00.000Z' }),
    /fim da recorrência é obrigatória/,
  );
  assert.throws(
    () => events.validateRecurrence({
      recurrenceRule: 'WEEKLY', recurrenceUnit: 'month', recurrenceEndAt: '2026-09-10T12:00:00.000Z', startAt: '2026-09-08T12:00:00.000Z',
    }),
    /não corresponde/,
  );
});

test('limita a série a 365 ocorrências', () => {
  const events = service() as any;
  const occurrences = events.expandOccurrences({
    startAt: new Date('2026-01-01T12:00:00.000Z'),
    endAt: new Date('2026-01-01T13:00:00.000Z'),
    rule: 'DAILY', interval: 1, unit: 'day', endAtLimit: new Date('2028-01-01T12:00:00.000Z'),
  });
  assert.equal(occurrences.length, 365);
});

test('calcula o dia no fuso de São Paulo', () => {
  const events = service() as any;
  const [start, end] = events.dayBoundary(new Date('2026-09-08T02:30:00.000Z'));
  assert.equal(start.toISOString(), '2026-09-07T03:00:00.000Z');
  assert.equal(end.toISOString(), '2026-09-08T03:00:00.000Z');
});

test('consulta eventos que sobrepõem o período solicitado', async () => {
  let where: any;
  const events = service({
    event: { findMany: async (args: any) => { where = args.where; return []; } },
    tenantUser: { findFirst: async () => ({ id: 'user-a' }) },
  }) as any;
  await events.findAll('tenant-a', 'user-a', 'member', '2026-09-01T03:00:00.000Z', '2026-10-01T03:00:00.000Z');
  assert.equal(where.startAt.lt.toISOString(), '2026-10-01T03:00:00.000Z');
  assert.equal(where.endAt.gt.toISOString(), '2026-09-01T03:00:00.000Z');
  assert.equal(where.OR[0].createdByTenantUserId, 'user-a');
});

test('impede que não administradores consultem o calendário de outro colaborador', async () => {
  const events = service() as any;
  await assert.rejects(
    events.findAll('tenant-a', 'user-a', 'member', undefined, undefined, 'user-b'),
    /não tem permissão/,
  );
});

test('filtra dispensas de lembrete pelo usuário atual', async () => {
  let where: any;
  const events = service({
    event: { findMany: async (args: any) => { where = args.where; return []; } },
  }) as any;
  await events.findReminders('tenant-a', 'user-a');
  const clauses = where.AND as any[];
  assert.equal(clauses[0].OR[1].createdByTenantUserId, 'user-a');
  assert.equal(clauses[1].reminderActions.none.tenantUserId, 'user-a');
  assert.equal(clauses[2].reminderActions.none.tenantUserId, 'user-a');
});

test('não entrega lembrete para participante que dispensou', async () => {
  const dispatchedTo: string[] = [];
  const createdFor: string[] = [];
  const events = new EventsService({
    event: {
      findMany: async () => [reminderEvent()],
    },
    eventReminderAction: {
      findMany: async (args: any) => args.where.OR ? [{ eventId: 'event-a', tenantUserId: 'user-b' }] : [],
      createMany: async (args: any) => { createdFor.push(args.data[0].tenantUserId); return { count: 1 }; },
    },
  } as any, {} as any, { dispatch: async (input: any) => { dispatchedTo.push(input.tenantUserId); } } as any);

  await events.sendDailyReminderPushes(NOW);
  assert.deepEqual(dispatchedTo, ['user-a']);
  assert.deepEqual(createdFor, ['user-a']);
});

test('entrega o lembrete de calendário pelo dispatcher com chave do dia local', async () => {
  const dispatched: any[] = [];
  const events = new EventsService({
    event: { findMany: async () => [reminderEvent({ attendees: [] })] },
    eventReminderAction: { findMany: async () => [], createMany: async () => ({ count: 1 }) },
  } as any, {} as any, { dispatch: async (input: any) => { dispatched.push(input); } } as any);

  const result = await events.sendDailyReminderPushes(NOW);

  assert.equal(dispatched.length, 1);
  const [delivered] = dispatched;
  assert.equal(delivered.tenantId, 'tenant-a');
  assert.equal(delivered.tenantUserId, 'user-a');
  assert.equal(delivered.category, 'CALENDAR');
  assert.equal(delivered.type, 'event_reminder');
  assert.equal(delivered.entityType, 'event');
  assert.equal(delivered.entityId, 'event-a');
  assert.equal(delivered.occurrenceKey, '2026-09-28', 'a chave de ocorrência é o dia em São Paulo');
  assert.equal(delivered.title, 'Lembrete de evento');
  assert.equal(delivered.message, '"Reunião" é amanhã');
  assert.deepEqual(delivered.payload, { eventId: 'event-a', route: '/calendar' });
  assert.deepEqual(result, { sent: 1, checkedAt: NOW.toISOString() });
});

test('não repete a entrega para quem já recebeu hoje', async () => {
  const dispatched: any[] = [];
  const events = new EventsService({
    event: { findMany: async () => [reminderEvent()] },
    eventReminderAction: {
      findMany: async (args: any) => args.where.OR ? [] : [{ tenantUserId: 'user-a' }, { tenantUserId: 'user-b' }],
      createMany: async () => ({ count: 1 }),
    },
  } as any, {} as any, { dispatch: async (input: any) => { dispatched.push(input); } } as any);

  const result = await events.sendDailyReminderPushes(NOW);

  assert.deepEqual(dispatched, []);
  assert.equal(result.sent, 0);
});

test('uma entrega que falha não impede os demais destinatários do evento', async () => {
  const dispatched: string[] = [];
  const events = new EventsService({
    event: { findMany: async () => [reminderEvent()] },
    eventReminderAction: { findMany: async () => [], createMany: async () => ({ count: 1 }) },
  } as any, {} as any, {
    dispatch: async (input: any) => {
      dispatched.push(input.tenantUserId);
      if (input.tenantUserId === 'user-a') throw Object.assign(new Error('banco fora do ar'), { name: 'PrismaClientKnownRequestError' });
    },
  } as any);
  const lines: string[] = [];
  (events as any).logger = { error: (m: string) => lines.push(m) };

  await events.sendDailyReminderPushes(NOW);

  assert.deepEqual(dispatched, ['user-a', 'user-b']);
  assert.ok(
    lines.join(' | ').includes('PrismaClientKnownRequestError'),
    'a falha da entrega precisa ser logada',
  );
});

test('bloqueia colaboradores ausentes, inativos ou de outro tenant', async () => {
  const events = service({
    tenantUser: { findMany: async () => [{ id: 'user-a' }] },
  }) as any;
  await assert.rejects(
    events.validateRelations('tenant-a', { attendeeIds: ['user-a', 'user-b'] }),
    /participante inválido/,
  );
});
