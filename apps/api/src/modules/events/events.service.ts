import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateEventDto, RecurrenceUnit } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

const MAX_OCCURRENCES = 365;

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, startDate?: string, endDate?: string) {
    return this.prisma.event.findMany({
      where: {
        tenantId,
        ...(startDate && endDate ? { startAt: { gte: new Date(startDate) }, endAt: { lte: new Date(endDate) } } : {}),
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

  // ─── helpers ────────────────────────────────────────────────────────────

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