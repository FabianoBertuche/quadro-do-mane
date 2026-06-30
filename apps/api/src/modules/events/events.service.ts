import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, startDate?: string, endDate?: string) {
    return this.prisma.event.findMany({
      where: {
        tenantId,
        ...(startDate && endDate ? { startAt: { gte: new Date(startDate) }, endAt: { lte: new Date(endDate) } } : {}),
      },
      include: {
        createdBy: { include: { user: { select: { name: true, avatarUrl: true } } } },
        attendees: { include: { tenantUser: { include: { user: { select: { name: true, avatarUrl: true } } } } } },
        project: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
      },
      orderBy: { startAt: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const event = await this.prisma.event.findFirst({
      where: { id, tenantId },
      include: {
        createdBy: { include: { user: { select: { name: true, avatarUrl: true } } } },
        attendees: { include: { tenantUser: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } } } },
        project: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
      },
    });
    if (!event) throw new NotFoundException('Evento não encontrado');
    return event;
  }

  async create(tenantId: string, createdByTenantUserId: string, dto: CreateEventDto) {
    const { attendeeIds, ...eventData } = dto;
    const event = await this.prisma.event.create({
      data: { tenantId, createdByTenantUserId, ...eventData },
    });
    if (attendeeIds?.length) {
      await this.prisma.eventAttendee.createMany({
        data: attendeeIds.map((tenantUserId) => ({ tenantId, eventId: event.id, tenantUserId })),
      });
    }
    return this.findOne(tenantId, event.id);
  }

  async update(tenantId: string, id: string, dto: UpdateEventDto) {
    await this.findOne(tenantId, id);
    const { attendeeIds, ...eventData } = dto;
    await this.prisma.event.update({ where: { id }, data: eventData });
    if (attendeeIds) {
      await this.prisma.eventAttendee.deleteMany({ where: { eventId: id } });
      if (attendeeIds.length) {
        await this.prisma.eventAttendee.createMany({
          data: attendeeIds.map((tenantUserId) => ({ tenantId, eventId: id, tenantUserId })),
        });
      }
    }
    return this.findOne(tenantId, id);
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.prisma.eventAttendee.deleteMany({ where: { eventId: id } });
    return this.prisma.event.delete({ where: { id } });
  }
}
