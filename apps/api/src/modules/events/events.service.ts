import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { DispatchInput, NotificationDispatcherService } from '../notifications/notification-dispatcher.service';
import { CreateEventDto, RecurrenceUnit } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

const MAX_OCCURRENCES = 365;
const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';
const PRESET_RECURRENCE_UNITS: Record<string, RecurrenceUnit> = {
  DAILY: 'day',
  WEEKLY: 'week',
  MONTHLY: 'month',
  YEARLY: 'year',
};

/** O SDK do Expo ecoa o payload em mensagens de erro, então só o nome do erro é seguro. */
const safeError = (err: unknown) => (err instanceof Error ? err.name : 'erro desconhecido');

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private prisma: PrismaService,
    private activityLog: ActivityLogService,
    private dispatcher: NotificationDispatcherService,
  ) {}

  async findAll(
    tenantId: string,
    actorTenantUserId: string,
    actorRoleName: string,
    startDate?: string,
    endDate?: string,
    requestedTenantUserId?: string,
    attendeeLimit = 50,
  ) {
    const range = this.parseRange(startDate, endDate);
    const isAdmin = actorRoleName === 'admin';
    if (requestedTenantUserId && requestedTenantUserId !== actorTenantUserId && !isAdmin) {
      throw new ForbiddenException('Você não tem permissão para visualizar o calendário de outro colaborador.');
    }
    const targetTenantUserId = isAdmin && requestedTenantUserId ? requestedTenantUserId : actorTenantUserId;
    const targetUser = await this.prisma.tenantUser.findFirst({
      where: { id: targetTenantUserId, tenantId },
      select: { id: true },
    });
    if (!targetUser) throw new NotFoundException('Colaborador não encontrado neste workspace.');

    return this.prisma.event.findMany({
      where: {
        tenantId,
        OR: [
          { createdByTenantUserId: targetTenantUserId },
          { assigneeTenantUserId: targetTenantUserId },
          { attendees: { some: { tenantUserId: targetTenantUserId } } },
        ],
        ...(range
          ? { startAt: { lt: range.end }, endAt: { gt: range.start } }
          : {}),
      },
      include: this.includeForList(attendeeLimit),
      orderBy: { startAt: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const event = await this.prisma.event.findFirst({
      where: { id, tenantId },
      include: this.includeForOne(),
    });
    if (!event) throw new NotFoundException('Evento não encontrado');
    return event;
  }

  async create(tenantId: string, createdByTenantUserId: string, dto: CreateEventDto) {
    const { attendeeIds, recurrenceRule, recurrenceInterval, recurrenceUnit, recurrenceEndAt, ...eventData } = dto;
    this.validateEventDates(eventData.startAt, eventData.endAt);
    const recurrence = this.validateRecurrence({
      recurrenceRule,
      recurrenceInterval,
      recurrenceUnit,
      recurrenceEndAt,
      startAt: eventData.startAt,
    });

    const assigneeTenantUserId = eventData.assigneeTenantUserId;
    // Criador e responsável também participam automaticamente do evento,
    // para que ambos recebam lembretes e possam dispensá-los.
    const allAttendeeIds = Array.from(new Set([
      createdByTenantUserId,
      ...(assigneeTenantUserId ? [assigneeTenantUserId] : []),
      ...(attendeeIds ?? []),
    ]));
    await this.validateRelations(tenantId, {
      assigneeTenantUserId,
      attendeeIds: allAttendeeIds,
      relatedProjectId: eventData.relatedProjectId,
      relatedTaskId: eventData.relatedTaskId,
    });

    const { rule, interval: iv, unit, endAtLimit } = recurrence;

    if (!rule) {
      // Evento único
      const event = await this.prisma.event.create({
        data: { tenantId, createdByTenantUserId, ...eventData },
      });
      await this.createAttendees(tenantId, event.id, allAttendeeIds);
      return this.findOne(tenantId, event.id);
    }

    // Evento recorrente: gera todas as ocorrências
    const occurrences = this.expandOccurrences({
      startAt: new Date(eventData.startAt),
      endAt: new Date(eventData.endAt),
      rule,
      interval: iv,
      unit,
      endAtLimit,
    });

    if (occurrences.length === 0) {
      throw new BadRequestException('Não foi possível gerar ocorrências para a recorrência informada.');
    }

    const seriesId = randomUUID();
    const created = await this.prisma.$transaction(
      occurrences.map((occ) =>
        this.prisma.event.create({
          data: {
            tenantId,
            createdByTenantUserId,
            seriesId,
            recurrenceRule: rule,
            recurrenceInterval: iv,
            recurrenceUnit: unit,
            recurrenceEndAt: endAtLimit,
            title: eventData.title,
            description: eventData.description,
            type: eventData.type,
            allDay: eventData.allDay,
            assigneeTenantUserId,
            relatedProjectId: eventData.relatedProjectId,
            relatedTaskId: eventData.relatedTaskId,
            remindDaysBefore: eventData.remindDaysBefore,
            startAt: occ.startAt,
            endAt: occ.endAt,
          },
        }),
      ),
    );

    await this.createAttendees(tenantId, created[0].id, allAttendeeIds);
    for (let i = 1; i < created.length; i++) {
      await this.createAttendees(tenantId, created[i].id, allAttendeeIds);
    }

    return {
      seriesId,
      count: created.length,
      events: created.map((e) => e.id),
    };
  }

  async update(tenantId: string, id: string, dto: UpdateEventDto, actorTenantUserId?: string) {
    const event = await this.findOne(tenantId, id);
    const { attendeeIds, ...eventData } = dto;
    const previousRecipients = this.eventRecipientIds(event);

    // Se há recorrência nova/alterada no update, rejeitamos para eventos já criados
    const recurrenceFields = ['recurrenceRule', 'recurrenceInterval', 'recurrenceUnit', 'recurrenceEndAt'];
    if (recurrenceFields.some((k) => (dto as any)[k] !== undefined)) {
      throw new BadRequestException(
        'Não é possível alterar a recorrência de um evento já criado. Exclua e recrie a série.',
      );
    }
    if (event.seriesId && (eventData.startAt || eventData.endAt)) {
      throw new BadRequestException(
        'Não é possível alterar as datas de uma ocorrência recorrente. Exclua e recrie a série.',
      );
    }

    this.validateEventDates(eventData.startAt ?? event.startAt, eventData.endAt ?? event.endAt);
    const assigneeId = eventData.assigneeTenantUserId ?? event.assigneeTenantUserId;
    const mergedAttendeeIds = attendeeIds === undefined
      ? undefined
      : Array.from(new Set([event.createdByTenantUserId, ...(assigneeId ? [assigneeId] : []), ...attendeeIds]));

    await this.validateRelations(tenantId, {
      assigneeTenantUserId: assigneeId,
      attendeeIds: mergedAttendeeIds,
      relatedProjectId: eventData.relatedProjectId === undefined ? event.relatedProjectId : eventData.relatedProjectId,
      relatedTaskId: eventData.relatedTaskId === undefined ? event.relatedTaskId : eventData.relatedTaskId,
    });

    await this.prisma.event.update({ where: { id }, data: eventData });
    if (attendeeIds !== undefined) {
      await this.prisma.eventAttendee.deleteMany({ where: { eventId: id } });
      await this.createAttendees(tenantId, id, mergedAttendeeIds!);
    }
    const updatedEvent = await this.findOne(tenantId, id);
    const recipientsToInvite = [...this.eventRecipientIds(updatedEvent)]
      .filter((tenantUserId) => !previousRecipients.has(tenantUserId));
    await this.dispatchEventCollaboration({
      tenantId,
      eventId: id,
      type: 'event_invited',
      recipients: recipientsToInvite,
      actorTenantUserId,
      occurrenceKey: `update:${updatedEvent.updatedAt.toISOString()}`,
    });
    if (Object.keys(eventData).length > 0) {
      await this.dispatchEventCollaboration({
        tenantId,
        eventId: id,
        type: 'event_updated',
        recipients: [...previousRecipients],
        actorTenantUserId,
        occurrenceKey: `update:${updatedEvent.updatedAt.toISOString()}`,
      });
    }
    return updatedEvent;
  }

  async remove(tenantId: string, id: string, actorTenantUserId?: string) {
    const event = await this.findOne(tenantId, id);
    const recipients = this.eventRecipientIds(event);
    await this.prisma.eventAttendee.deleteMany({ where: { eventId: id } });
    const deleted = await this.prisma.event.delete({ where: { id } });
    await this.dispatchEventCollaboration({
      tenantId,
      eventId: id,
      type: 'event_cancelled',
      recipients: [...recipients],
      actorTenantUserId,
      occurrenceKey: `update:${event.updatedAt.toISOString()}`,
    });
    return deleted;
  }

  /**
   * Remove todas as ocorrências de uma série (eventos recorrentes).
   */
  async removeSeries(tenantId: string, seriesId: string) {
    const events = await this.prisma.event.findMany({
      where: { tenantId, seriesId },
      select: { id: true },
    });
    if (events.length === 0) throw new NotFoundException('Série não encontrada');
    const ids = events.map((e) => e.id);
    const deleted = await this.prisma.$transaction([
      this.prisma.eventAttendee.deleteMany({ where: { eventId: { in: ids } } }),
      this.prisma.event.deleteMany({ where: { id: { in: ids } } }),
    ]);
    return { seriesId, deletedCount: deleted[1].count };
  }

  // ─── Lembretes ──────────────────────────────────────────────────────────

  /**
   * Lembretes ativos do usuário: eventos onde ele é responsável/participante,
   * com lembrete configurado, dentro da janela (startAt - N dias <= agora <= endAt),
   * e não dispensados hoje nem permanentemente.
   */
  async findReminders(tenantId: string, tenantUserId: string, limit = 50) {
    const now = new Date();
    const [dayStart, dayEnd] = this.dayBoundary(now);

    const events = await this.prisma.event.findMany({
      where: {
        tenantId,
        remindDaysBefore: { not: null },
        endAt: { gte: now },
        AND: [
          {
            OR: [
              { assigneeTenantUserId: tenantUserId },
              { createdByTenantUserId: tenantUserId },
              { attendees: { some: { tenantUserId } } },
            ],
          },
          { reminderActions: { none: { tenantUserId, action: 'DISMISS_FOREVER' } } },
          {
            reminderActions: {
              none: { tenantUserId, action: 'DISMISS_DAY', actionDate: { gte: dayStart, lt: dayEnd } },
            },
          },
        ],
      },
      include: {
        assignee: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      },
      orderBy: { startAt: 'asc' },
      take: 200,
    });

    const reminders = events
      .map((e) => {
        const daysBefore = e.remindDaysBefore as number;
        const reminderStartsAt = new Date(e.startAt.getTime() - daysBefore * 86_400_000);
        if (reminderStartsAt > now) return null; // ainda não entrou na janela
        const daysLeft = Math.max(0, Math.ceil((e.startAt.getTime() - now.getTime()) / 86_400_000));
        return {
          id: e.id,
          title: e.title,
          startAt: e.startAt,
          endAt: e.endAt,
          remindDaysBefore: daysBefore,
          daysLeft,
          assignee: e.assignee && { name: e.assignee.user.name },
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .slice(0, limit);

    return { count: reminders.length, reminders };
  }

  /** Dispensa o lembrete de um evento pelo dia atual. */
  async dismissReminderDay(tenantId: string, tenantUserId: string, eventId: string) {
    const event = await this.assertReminderAccess(tenantId, tenantUserId, eventId);
    const [dayStart] = this.dayBoundary(new Date());
    await this.prisma.eventReminderAction.createMany({
      data: [{ tenantId, eventId, tenantUserId, action: 'DISMISS_DAY', actionDate: dayStart }],
      skipDuplicates: true,
    });
    await this.activityLog.log({
      tenantId,
      actorTenantUserId: tenantUserId,
      entityType: 'event',
      entityId: eventId,
      action: 'reminder.dismiss.day',
      newValues: { title: event.title, startAt: event.startAt.toISOString(), remindDaysBefore: event.remindDaysBefore },
    });
    return { dismissed: 'day', eventId };
  }

  /** Dispensa permanentemente o lembrete de um evento. */
  async dismissReminderForever(tenantId: string, tenantUserId: string, eventId: string) {
    const event = await this.assertReminderAccess(tenantId, tenantUserId, eventId);
    await this.prisma.eventReminderAction.createMany({
      data: [{ tenantId, eventId, tenantUserId, action: 'DISMISS_FOREVER', actionDate: null }],
      skipDuplicates: true,
    });
    await this.activityLog.log({
      tenantId,
      actorTenantUserId: tenantUserId,
      entityType: 'event',
      entityId: eventId,
      action: 'reminder.dismiss.forever',
      newValues: { title: event.title, startAt: event.startAt.toISOString(), remindDaysBefore: event.remindDaysBefore },
    });
    return { dismissed: 'forever', eventId };
  }

  /**
   * Envia o lembrete diário dos eventos elegíveis (chamado pelo scheduler a cada
   * 5 minutos e pelo fallback manual `POST /admin/send-event-reminders`).
   *
   * `EventReminderAction` continua sendo a guarda de seleção diária por
   * evento+usuário: quem já tem SEND hoje ou dispensou não recebe nada. O que
   * muda é o transporte — a entrega passa pelo dispatcher, que grava ledger e
   * Central idempotentes e só então tenta o push.
   */
  async sendDailyReminderPushes(now = new Date()) {
    const [dayStart, dayEnd] = this.dayBoundary(now);

    const events = await this.prisma.event.findMany({
      where: {
        remindDaysBefore: { not: null },
        endAt: { gte: now },
      },
      include: { attendees: { select: { tenantUserId: true } } },
    });

    const involved = new Map<string, Set<string>>();
    const meta = new Map<string, { tenantId: string; title: string; daysLeft: number }>();
    for (const e of events) {
      const daysBefore = e.remindDaysBefore as number;
      if (new Date(e.startAt.getTime() - daysBefore * 86_400_000) > now) continue;
      const users = new Set<string>();
      if (e.createdByTenantUserId) users.add(e.createdByTenantUserId);
      if (e.assigneeTenantUserId) users.add(e.assigneeTenantUserId);
      for (const a of e.attendees) users.add(a.tenantUserId);
      involved.set(e.id, users);
      const daysLeft = Math.max(0, Math.ceil((e.startAt.getTime() - now.getTime()) / 86_400_000));
      meta.set(e.id, { tenantId: e.tenantId, title: e.title, daysLeft });
    }

    const eventIds = [...involved.keys()];
    const dismissals = eventIds.length === 0 ? [] : await this.prisma.eventReminderAction.findMany({
      where: {
        eventId: { in: eventIds },
        OR: [
          { action: 'DISMISS_FOREVER' },
          { action: 'DISMISS_DAY', actionDate: { gte: dayStart, lt: dayEnd } },
        ],
      },
      select: { eventId: true, tenantUserId: true },
    });
    const dismissed = new Set(dismissals.map((action) => `${action.eventId}:${action.tenantUserId}`));
    const occurrenceKey = this.localDayKey(now);

    let sent = 0;
    for (const [eventId, userIds] of involved) {
      // Quem já recebeu push hoje?
      const already = await this.prisma.eventReminderAction.findMany({
        where: { eventId, action: 'SEND', actionDate: { gte: dayStart, lt: dayEnd } },
        select: { tenantUserId: true },
      });
      const alreadySent = new Set(already.map((a) => a.tenantUserId));
      const toSend = [...userIds].filter((id) => !alreadySent.has(id) && !dismissed.has(`${eventId}:${id}`));
      if (toSend.length === 0) continue;

      const { tenantId, title, daysLeft } = meta.get(eventId)!;
      const dayLabel = daysLeft === 0 ? 'hoje' : daysLeft === 1 ? 'amanhã' : `em ${daysLeft} dias`;

      for (const uid of toSend) {
        await this.prisma.eventReminderAction.createMany({
          data: [{ tenantId, eventId, tenantUserId: uid, action: 'SEND', actionDate: now }],
          skipDuplicates: true,
        });
        await this.deliverReminder({
          tenantId,
          tenantUserId: uid,
          category: 'CALENDAR',
          type: 'event_reminder',
          title: 'Lembrete de evento',
          message: `"${title}" é ${dayLabel}`,
          payload: { eventId, route: '/calendar' },
          entityType: 'event',
          entityId: eventId,
          occurrenceKey,
        });
      }
      sent += toSend.length;
    }
    return { sent, checkedAt: now.toISOString() };
  }

  /**
   * Uma entrega que falha não pode interromper os demais destinatários do mesmo
   * tique: o erro fica no log e a próxima rodada tenta de novo.
   */
  private async deliverReminder(input: DispatchInput): Promise<void> {
    try {
      await this.dispatcher.dispatch(input);
    } catch (err) {
      this.logger.error(
        `Falha ao entregar lembrete de evento (event=${input.entityId}, user=${input.tenantUserId}): ${safeError(err)}`,
      );
    }
  }

  // ─── helpers ────────────────────────────────────────────────────────────

  /** Limites do dia atual no fuso corporativo fixo do sistema. */
  private dayBoundary(now: Date): [Date, Date] {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: SAO_PAULO_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const value = (type: string) => parts.find((part) => part.type === type)?.value!;
    const date = new Date(Date.UTC(Number(value('year')), Number(value('month')) - 1, Number(value('day'))));
    const next = new Date(date.getTime() + 86_400_000);
    const format = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}T00:00:00-03:00`;
    const start = new Date(format(date));
    const end = new Date(format(next));
    return [start, end];
  }

  /** `YYYY-MM-DD` do dia corrente no fuso corporativo — a chave de ocorrência diária. */
  private localDayKey(now: Date): string {
    const [dayStart] = this.dayBoundary(now);
    const month = String(dayStart.getUTCMonth() + 1).padStart(2, '0');
    const day = String(dayStart.getUTCDate()).padStart(2, '0');
    return `${dayStart.getUTCFullYear()}-${month}-${day}`;
  }

  /** Garante que o evento existe no tenant e que o usuário está envolvido. */
  private async assertReminderAccess(tenantId: string, tenantUserId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, tenantId },
      include: { attendees: { select: { tenantUserId: true } } },
    });
    if (!event) throw new NotFoundException('Evento não encontrado');
    const isInvolved =
      event.createdByTenantUserId === tenantUserId ||
      event.assigneeTenantUserId === tenantUserId ||
      event.attendees.some((a) => a.tenantUserId === tenantUserId);
    if (!isInvolved) {
      throw new NotFoundException('Evento não encontrado');
    }
    return event;
  }

  private includeForList(attendeeLimit = 50) {
    return {
      createdBy: { include: { user: { select: { name: true, avatarUrl: true } } } },
      assignee: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      attendees: { take: attendeeLimit, include: { tenantUser: { include: { user: { select: { name: true, avatarUrl: true } } } } } },
      project: { select: { id: true, name: true } },
      task: { select: { id: true, title: true } },
    };
  }

  private includeForOne() {
    return {
      createdBy: { include: { user: { select: { name: true, avatarUrl: true } } } },
      assignee: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } },
      attendees: { include: { tenantUser: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } } } },
      project: { select: { id: true, name: true } },
      task: { select: { id: true, title: true } },
    };
  }

  private async createAttendees(tenantId: string, eventId: string, tenantUserIds: string[]) {
    if (!tenantUserIds.length) return;
    const existing = await this.prisma.eventAttendee.findMany({
      where: { eventId },
      select: { tenantUserId: true },
    });
    const existingSet = new Set(existing.map((e) => e.tenantUserId));
    const toCreate = tenantUserIds.filter((id) => !existingSet.has(id));
    if (toCreate.length) {
      await this.prisma.eventAttendee.createMany({
        data: toCreate.map((tenantUserId) => ({ tenantId, eventId, tenantUserId })),
      });
    }
  }

  private eventRecipientIds(event: { createdByTenantUserId: string; assigneeTenantUserId?: string | null; attendees: Array<{ tenantUserId: string }> }) {
    return new Set([
      event.createdByTenantUserId,
      ...(event.assigneeTenantUserId ? [event.assigneeTenantUserId] : []),
      ...event.attendees.map((attendee) => attendee.tenantUserId),
    ]);
  }

  private async dispatchEventCollaboration(params: {
    tenantId: string;
    eventId: string;
    type: 'event_invited' | 'event_updated' | 'event_cancelled';
    recipients: string[];
    actorTenantUserId?: string;
    occurrenceKey: string;
  }) {
    const recipients = new Set(params.recipients);
    if (params.actorTenantUserId) recipients.delete(params.actorTenantUserId);
    for (const tenantUserId of recipients) {
      await this.dispatcher.dispatch({
        tenantId: params.tenantId,
        tenantUserId,
        category: 'COLLABORATION',
        type: params.type,
        title: params.type === 'event_cancelled' ? 'Evento cancelado' : 'Atualização de evento',
        message: params.type === 'event_invited' ? 'Você foi convidado para um evento' : 'Um evento do calendário foi atualizado',
        payload: { eventId: params.eventId, route: '/calendar' },
        entityType: 'event',
        entityId: params.eventId,
        occurrenceKey: params.occurrenceKey,
      });
    }
  }

  private parseRange(startDate?: string, endDate?: string): { start: Date; end: Date } | undefined {
    if (!startDate && !endDate) return undefined;
    if (!startDate || !endDate) {
      throw new BadRequestException('Informe as datas de início e fim do período.');
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      throw new BadRequestException('O período informado é inválido.');
    }
    return { start, end };
  }

  private validateEventDates(startAt: string | Date, endAt: string | Date) {
    const start = new Date(startAt);
    const end = new Date(endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      throw new BadRequestException('A data final do evento deve ser posterior à data de início.');
    }
  }

  private validateRecurrence(params: {
    recurrenceRule?: string;
    recurrenceInterval?: number;
    recurrenceUnit?: RecurrenceUnit;
    recurrenceEndAt?: string;
    startAt: string;
  }): { rule?: string; interval: number; unit: RecurrenceUnit; endAtLimit?: Date } {
    const { recurrenceRule, recurrenceInterval, recurrenceUnit, recurrenceEndAt, startAt } = params;
    if (!recurrenceRule) {
      if (recurrenceInterval !== undefined || recurrenceUnit !== undefined || recurrenceEndAt !== undefined) {
        throw new BadRequestException('Informe uma regra de recorrência para configurar a repetição.');
      }
      return { interval: 1, unit: 'month' };
    }

    if (!recurrenceEndAt) {
      throw new BadRequestException('A data fim da recorrência é obrigatória para eventos recorrentes.');
    }
    const endAtLimit = new Date(recurrenceEndAt);
    const start = new Date(startAt);
    if (Number.isNaN(endAtLimit.getTime()) || endAtLimit < start) {
      throw new BadRequestException('A data fim da recorrência deve ser igual ou posterior à data de início do evento.');
    }

    const interval = recurrenceInterval ?? 1;
    if (!Number.isInteger(interval) || interval < 1) {
      throw new BadRequestException('O intervalo da recorrência deve ser um número inteiro maior que zero.');
    }
    const presetUnit = PRESET_RECURRENCE_UNITS[recurrenceRule];
    if (presetUnit && recurrenceUnit && recurrenceUnit !== presetUnit) {
      throw new BadRequestException('A unidade informada não corresponde à regra de recorrência selecionada.');
    }
    if (recurrenceRule === 'CUSTOM' && !recurrenceUnit) {
      throw new BadRequestException('Informe a unidade da recorrência personalizada.');
    }
    const unit = presetUnit ?? recurrenceUnit;
    if (!unit) {
      throw new BadRequestException('Informe uma unidade de recorrência válida.');
    }
    return { rule: recurrenceRule, interval, unit, endAtLimit };
  }

  private async validateRelations(tenantId: string, params: {
    assigneeTenantUserId?: string | null;
    attendeeIds?: string[];
    relatedProjectId?: string | null;
    relatedTaskId?: string | null;
  }) {
    const userIds = Array.from(new Set([
      ...(params.assigneeTenantUserId ? [params.assigneeTenantUserId] : []),
      ...(params.attendeeIds ?? []),
    ]));
    if (userIds.length) {
      const activeUsers = await this.prisma.tenantUser.findMany({
        where: { id: { in: userIds }, tenantId, isActive: true, status: 'ACTIVE' },
        select: { id: true },
      });
      if (activeUsers.length !== userIds.length) {
        throw new BadRequestException('Responsável ou participante inválido para este workspace.');
      }
    }
    if (params.relatedProjectId) {
      const project = await this.prisma.project.findFirst({ where: { id: params.relatedProjectId, tenantId }, select: { id: true } });
      if (!project) throw new BadRequestException('Projeto relacionado inválido para este workspace.');
    }
    if (params.relatedTaskId) {
      const task = await this.prisma.task.findFirst({ where: { id: params.relatedTaskId, tenantId }, select: { id: true } });
      if (!task) throw new BadRequestException('Tarefa relacionada inválida para este workspace.');
    }
  }

  /** Expande a série em ocorrências concretas, respeitando MAX_OCCURRENCES. */
  private expandOccurrences(params: {
    startAt: Date;
    endAt: Date;
    rule: string;
    interval: number;
    unit: RecurrenceUnit;
    endAtLimit?: Date;
  }): Array<{ startAt: Date; endAt: Date }> {
    const { startAt, endAt, rule, interval, unit, endAtLimit } = params;
    const rawDuration = endAt.getTime() - startAt.getTime();

    const occurrences: Array<{ startAt: Date; endAt: Date }> = [];
    const current = new Date(startAt);
    // A validação exige data fim; o teto adicional evita séries excessivamente grandes.
    const hardLimit = endAtLimit!;

    while (occurrences.length < MAX_OCCURRENCES && current <= hardLimit) {
      const occEnd = new Date(current.getTime() + rawDuration);
      occurrences.push({ startAt: new Date(current), endAt: occEnd });
      const next = this.addInterval(current, interval, unit, rule);
      if (next <= current) break; // proteção contra loop infinito
      current.setTime(next.getTime());
    }
    return occurrences;
  }

  private addInterval(date: Date, interval: number, unit: RecurrenceUnit, rule: string): Date {
    const d = new Date(date);
    if (rule === 'MONTHLY' || unit === 'month') {
      d.setMonth(d.getMonth() + interval);
    } else if (rule === 'YEARLY' || unit === 'year') {
      d.setFullYear(d.getFullYear() + interval);
    } else if (unit === 'week') {
      d.setDate(d.getDate() + 7 * interval);
    } else {
      d.setDate(d.getDate() + interval);
    }
    return d;
  }
}
