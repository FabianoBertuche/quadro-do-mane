import assert from 'node:assert/strict';
import test from 'node:test';
import { EventsService } from './events.service';

const service = (prisma: Record<string, unknown> = {}) => new EventsService(prisma as any, {} as any, {} as any);

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

test('não envia push para participante que dispensou o lembrete', async () => {
  const sentTo: string[] = [];
  const createdFor: string[] = [];
  const now = new Date('2026-09-08T12:00:00.000Z');
  const events = new EventsService({
    event: {
      findMany: async () => [{
        id: 'event-a', tenantId: 'tenant-a', title: 'Reunião', remindDaysBefore: 0,
        startAt: new Date('2026-09-08T11:00:00.000Z'), endAt: new Date('2026-09-08T15:00:00.000Z'),
        createdByTenantUserId: 'user-a', assigneeTenantUserId: 'user-a', attendees: [{ tenantUserId: 'user-b' }],
      }],
    },
    eventReminderAction: {
      findMany: async (args: any) => args.where.OR ? [{ eventId: 'event-a', tenantUserId: 'user-b' }] : [],
      createMany: async (args: any) => { createdFor.push(args.data[0].tenantUserId); return { count: 1 }; },
    },
  } as any, {} as any, { sendToUser: async (id: string) => { sentTo.push(id); } } as any);

  await events.sendDailyReminderPushes(now);
  assert.deepEqual(sentTo, ['user-a']);
  assert.deepEqual(createdFor, ['user-a']);
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
