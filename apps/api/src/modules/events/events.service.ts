import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { PushService } from '../push/push.service';
import { CreateEventDto, RecurrenceUnit } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

const MAX_OCCURRENCES = 365;

@Injectable()
export class EventsService {
  constructor(
    private prisma: PrismaService,
    private activityLog: ActivityLogService,
    private pushService: PushService,
  ) {}

  async findAll(tenantId: string, startDate?: string, endDate?: string) {
    return this.prisma.event.findMany({
      where: {
        tenantId,
        ...(startDate && endDate
          ? { startAt: { gte: new Date(startDate), lte: new Date(endDate) } }
          : {}),
      },
      include: this.includeForList(),
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

    const assigneeTenantUserId = eventData.assigneeTenantUserId;
    // O responsável também participa automaticamente do evento
    const allAttendeeIds = Array.from(new Set([
      ...(assigneeTenantUserId ? [assigneeTenantUserId] : []),
      ...(attendeeIds ?? []),
    ]));

    // Garante intervalos/unidade por padrão conforme a regra
    const iv = recurrenceInterval ?? 1;
    const unit: RecurrenceUnit = recurrenceUnit ?? this.defaultUnitFor(recurrenceRule);
    const rule = recurrenceRule ?? (recurrenceUnit ? 'CUSTOM' : undefined);

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
      endAtLimit: recurrenceEndAt ? new Date(recurrenceEndAt) : undefined,
    });

    if (occurrences.length === 0) {
      throw new BadRequestException('Não foi possível gerar ocorrências para a recorrência informada. Verifique as datas.');
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
            recurrenceEndAt: recurrenceEndAt ? new Date(recurrenceEndAt) : undefined,
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

  async update(tenantId: string, id: string, dto: UpdateEventDto) {
    const event = await this.findOne(tenantId, id);
    const { attendeeIds, ...eventData } = dto;

    // Se há recorrência nova/alterada no update, rejeitamos para eventos já criados
    const recurrenceFields = ['recurrenceRule', 'recurrenceInterval', 'recurrenceUnit', 'recurrenceEndAt'];
    if (recurrenceFields.some((k) => (dto as any)[k] !== undefined)) {
      throw new BadRequestException(
        'Não é possível alterar a recorrência de um evento já criado. Exclua e recrie a série.',
      );
    }
    if (event.seriesId && eventData.startAt) {
      throw new BadRequestException(
        'Para editar uma ocorrência de evento recorrente, contacte o responsável. Use a exclusão para remover ocorrências.',
      );
    }

    await this.prisma.event.update({ where: { id }, data: eventData });
    if (attendeeIds) {
      await this.prisma.eventAttendee.deleteMany({ where: { eventId: id } });
      const assigneeId = eventData.assigneeTenantUserId ?? event.assigneeTenantUserId;
      const merged = Array.from(new Set([...(assigneeId ? [assigneeId] : []), ...attendeeIds]));
      await this.createAttendees(tenantId, id, merged);
    }
    return this.findOne(tenantId, id);
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.prisma.eventAttendee.deleteMany({ where: { eventId: id } });
    return this.prisma.event.delete({ where: { id } });
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
              { attendees: { some: { tenantUserId } } },
            ],
          },
          { reminderActions: { none: { action: 'DISMISS_FOREVER' } } },
          {
            reminderActions: {
              none: { action: 'DISMISS_DAY', actionDate: { gte: dayStart, lt: dayEnd } },
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
   * Envia o push diário dos lembretes ativos (chamado pelo cron externo).
   * Dedup: grava action SEND por evento+usuário+dia; se já enviado hoje, ignora.
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
    const meta = new Map<string, { title: string; daysLeft: number }>();
    for (const e of events) {
      const daysBefore = e.remindDaysBefore as number;
      if (new Date(e.startAt.getTime() - daysBefore * 86_400_000) > now) continue;
      const users = new Set<string>();
      if (e.assigneeTenantUserId) users.add(e.assigneeTenantUserId);
      for (const a of e.attendees) users.add(a.tenantUserId);
      involved.set(e.id, users);
      const daysLeft = Math.max(0, Math.ceil((e.startAt.getTime() - now.getTime()) / 86_400_000));
      meta.set(e.id, { title: e.title, daysLeft });
    }

    let sent = 0;
    for (const [eventId, userIds] of involved) {
      // Quem já recebeu push hoje?
      const already = await this.prisma.eventReminderAction.findMany({
        where: { eventId, action: 'SEND', actionDate: { gte: dayStart, lt: dayEnd } },
        select: { tenantUserId: true },
      });
      const alreadySent = new Set(already.map((a) => a.tenantUserId));
      const toSend = [...userIds].filter((id) => !alreadySent.has(id));
      if (toSend.length === 0) continue;

      const { title, daysLeft } = meta.get(eventId)!;
      const dayLabel = daysLeft === 0 ? 'hoje' : daysLeft === 1 ? 'amanhã' : `em ${daysLeft} dias`;
      const tenantId = (await this.prisma.event.findUnique({ where: { id: eventId }, select: { tenantId: true } }))?.tenantId;

      for (const uid of toSend) {
        await this.prisma.eventReminderAction.createMany({
          data: [{ tenantId: tenantId!, eventId, tenantUserId: uid, action: 'SEND', actionDate: now }],
          skipDuplicates: true,
        });
        await this.pushService.sendToUser(uid, {
          title: 'Lembrete de evento',
          body: `"${title}" é ${dayLabel}`,
          data: { type: 'event-reminder', eventId },
        });
      }
      sent += toSend.length;
    }
    return { sent, checkedAt: now.toISOString() };
  }

  // ─── helpers ────────────────────────────────────────────────────────────

  /** Limites do dia atual no fuso local do servidor (America/Sao_Paulo). */
  private dayBoundary(now: Date): [Date, Date] {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start.getTime() + 86_400_000);
    return [start, end];
  }

  /** Garante que o evento existe no tenant e que o usuário está envolvido. */
  private async assertReminderAccess(tenantId: string, tenantUserId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, tenantId },
      include: { attendees: { select: { tenantUserId: true } } },
    });
    if (!event) throw new NotFoundException('Evento não encontrado');
    const isInvolved =
      event.assigneeTenantUserId === tenantUserId ||
      event.attendees.some((a) => a.tenantUserId === tenantUserId);
    if (!isInvolved) {
      throw new NotFoundException('Evento não encontrado');
    }
    return event;
  }

  private includeForList() {
    return {
      createdBy: { include: { user: { select: { name: true, avatarUrl: true } } } },
      assignee: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      attendees: { include: { tenantUser: { include: { user: { select: { name: true, avatarUrl: true } } } } } },
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

  private defaultUnitFor(rule?: string): RecurrenceUnit {
    switch (rule) {
      case 'DAILY': return 'day';
      case 'WEEKLY': return 'week';
      case 'MONTHLY': return 'month';
      case 'YEARLY': return 'year';
      default: return 'month';
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
    // Limite padrão: se o usuário não informou fim, limita a 1 ano à frente (ou 365 ocorrências)
    const hardLimit = endAtLimit ?? new Date(startAt.getTime());
    if (!endAtLimit) hardLimit.setFullYear(hardLimit.getFullYear() + 1);

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