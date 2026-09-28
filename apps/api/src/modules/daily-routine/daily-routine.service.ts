import { Injectable, ConflictException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { DispatchInput, NotificationDispatcherService } from '../notifications/notification-dispatcher.service';
import { CreateRoutineDto, CompleteRoutineDto, AdminFilterDto, UpdateRoutineDto } from './dto/daily-routine.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-context.interface';
import { Prisma } from '@prisma/client';

const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';
/** O lembrete de pendência dispara 30 minutos depois do horário da rotina. */
const PENDING_DELAY_MINUTES = 30;

/**
 * Relógio de parede de São Paulo. O dia do calendário e o `HH:mm` saem do fuso,
 * não de `toISOString()`, que entregaria o dia de UTC.
 */
const localClock = (moment: Date) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: SAO_PAULO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(moment);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '00';
  return {
    day: `${value('year')}-${value('month')}-${value('day')}`,
    minutes: Number(value('hour')) * 60 + Number(value('minute')),
    label: `${value('hour')}:${value('minute')}`,
  };
};

const hhmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** O SDK do Expo ecoa o payload em mensagens de erro, então só o nome do erro é seguro. */
const safeError = (err: unknown) => (err instanceof Error ? err.name : 'erro desconhecido');

@Injectable()
export class DailyRoutineService {
  private readonly logger = new Logger(DailyRoutineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly dispatcher: NotificationDispatcherService,
  ) {}

  async create(dto: CreateRoutineDto, currentUser: RequestUser) {
    // If no assigned user specified, assign to self
    const targetUserId = dto.assignedTenantUserId || currentUser.tenantUserId;

    // Only validate assignment if admin/gestor specified a different user
    if (dto.assignedTenantUserId && dto.assignedTenantUserId !== currentUser.tenantUserId) {
      const assignedUser = await this.prisma.tenantUser.findUnique({
        where: { id: dto.assignedTenantUserId },
        select: { tenantId: true },
      });

      if (!assignedUser) {
        throw new NotFoundException('Assigned user not found');
      }

      if (assignedUser.tenantId !== currentUser.tenantId) {
        throw new ForbiddenException('Assigned user does not belong to the same tenant');
      }
    }

    const created = await this.prisma.dailyRoutineItem.create({
      data: {
        tenantId: currentUser.tenantId,
        title: dto.title,
        description: dto.description,
        scheduledTime: dto.scheduledTime,
        assignedTenantUserId: targetUserId,
        createdById: currentUser.tenantUserId,
      },
    });

    await this.activityLog.log({
      tenantId: currentUser.tenantId,
      actorTenantUserId: currentUser.tenantUserId,
      entityType: 'DailyRoutine',
      entityId: created.id,
      action: 'ROUTINE_CREATED',
      newValues: {
        title: dto.title,
        scheduledTime: dto.scheduledTime,
        assignedTo: targetUserId,
      },
    });

    return created;
  }

  async getUserRoutines(userId: string) {
    const today = new Date().toISOString().split('T')[0];

    const routines = await this.prisma.dailyRoutineItem.findMany({
      where: {
        assignedTenantUserId: userId,
      },
      include: {
        logs: {
          where: {
            date: today,
          },
          select: {
            id: true,
            completedAt: true,
            date: true,
          },
        },
      },
      orderBy: { scheduledTime: 'asc' },
    });

    return routines.map((item) => ({
      ...item,
      completedToday: item.logs.length > 0,
      log: item.logs[0] || null,
    }));
  }

  async completeRoutine(currentUser: RequestUser, routineItemId: string, dto: CompleteRoutineDto) {
    const { notes } = dto;

    const item = await this.prisma.dailyRoutineItem.findUnique({
      where: { id: routineItemId },
    });

    if (!item) {
      throw new NotFoundException('Routine item not found');
    }

    const today = new Date().toISOString().split('T')[0];

    // Sequential order enforcement: all items with earlier scheduledTime must be completed first
    const allUserRoutines = await this.prisma.dailyRoutineItem.findMany({
      where: {
        assignedTenantUserId: item.assignedTenantUserId,
      },
      include: {
        logs: {
          where: { date: today },
          select: { id: true },
        },
      },
      orderBy: { scheduledTime: 'asc' },
    });

    const currentIndex = allUserRoutines.findIndex(r => r.id === routineItemId);
    if (currentIndex > 0) {
      const previousItems = allUserRoutines.slice(0, currentIndex);
      const incompletePrevious = previousItems.filter(r => r.logs.length === 0);
      if (incompletePrevious.length > 0) {
        const missingTitles = incompletePrevious.map(r => `"${r.title}"`).join(', ');
        throw new ConflictException(
          `Você precisa completar as tarefas anteriores primeiro: ${missingTitles}`
        );
      }
    }

    // Admin/gestor can complete routines for any user in their tenant
    const isManager = currentUser.permissions?.includes('daily_routine.manage') || currentUser.roleName === 'admin';
    if (!isManager && item.assignedTenantUserId !== currentUser.tenantUserId) {
      throw new NotFoundException('Routine item not assigned to this user');
    }

    try {
      const log = await this.prisma.dailyRoutineLog.create({
        data: {
          routineItemId,
          tenantUserId: item.assignedTenantUserId,
          tenantId: item.tenantId,
          date: today,
          notes,
        },
      });

      // Log activity for the operational dashboard
      const [assignedUser, actorUser] = await Promise.all([
        this.prisma.tenantUser.findUnique({
          where: { id: item.assignedTenantUserId },
          include: { user: { select: { name: true } } },
        }),
        this.prisma.tenantUser.findUnique({
          where: { id: currentUser.tenantUserId },
          include: { user: { select: { name: true } } },
        }),
      ]);

      await this.activityLog.log({
        tenantId: item.tenantId,
        actorTenantUserId: currentUser.tenantUserId,
        entityType: 'DailyRoutine',
        entityId: routineItemId,
        action: 'ROUTINE_COMPLETED',
        newValues: {
          title: item.title,
          scheduledTime: item.scheduledTime,
          assignedUserName: assignedUser?.user?.name ?? 'Desconhecido',
          completedByName: actorUser?.user?.name ?? 'Desconhecido',
          date: today,
          notes: notes || null,
        },
      });

      return log;
    } catch (error: unknown) {
      if (error instanceof Error && (error as any).code === 'P2002') {
        throw new ConflictException('Routine already completed for today');
      }
      throw error;
    }
  }

  async getAdminLogs(filters: AdminFilterDto) {
    const { userId, startDate, endDate, routineItemId } = filters;

    const where: Prisma.DailyRoutineLogWhereInput = {};
    if (userId) where.tenantUserId = userId;
    if (routineItemId) where.routineItemId = routineItemId;
    if (startDate || endDate) {
      const startStr = startDate || '2000-01-01';
      const endStr = endDate || '2099-12-31';
      where.date = {
        gte: startStr,
        lte: endStr,
      };
    }

    const logs = await this.prisma.dailyRoutineLog.findMany({
      where,
      include: {
        routineItem: true,
        tenantUser: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    let efficiency = null;

    if (userId) {
      const totalScheduledItems = await this.prisma.dailyRoutineItem.count({
        where: { assignedTenantUserId: userId },
      });

      if (totalScheduledItems === 0) {
        efficiency = 0;
      } else {
        const startStr = startDate || (logs[0]?.date || new Date().toISOString().split('T')[0]);
        const endStr = endDate || new Date().toISOString().split('T')[0];

        if (endStr < startStr) {
          efficiency = 0;
        } else {
          const startDateObj = new Date(startStr);
          const endDateObj = new Date(endStr);
          const daysDiff = Math.max(1, Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)));
          const totalExpectedCompletions = totalScheduledItems * daysDiff;

          const uniqueCompletions = new Set(
            logs.map((l) => `${l.routineItemId}_${l.date}`)
          ).size;

          efficiency = (uniqueCompletions / totalExpectedCompletions) * 100;
        }
      }
    }

    return {
      logs,
      efficiency: efficiency !== null ? Number(efficiency.toFixed(2)) : null,
    };
  }

  async getRoutinesForUser(userId: string, tenantId: string) {
    const today = new Date().toISOString().split('T')[0];

    const routines = await this.prisma.dailyRoutineItem.findMany({
      where: {
        assignedTenantUserId: userId,
        tenantId,
      },
      include: {
        logs: {
          where: {
            date: today,
          },
        },
      },
      orderBy: { scheduledTime: 'asc' },
    });

    return routines.map((item) => ({
      ...item,
      completedToday: item.logs.length > 0,
      log: item.logs[0] || null,
    }));
  }

  async update(id: string, dto: UpdateRoutineDto, currentUser: RequestUser) {
    const item = await this.prisma.dailyRoutineItem.findUnique({
      where: { id },
    });

    if (!item) {
      throw new NotFoundException('Routine item not found');
    }

    if (item.tenantId !== currentUser.tenantId) {
      throw new ForbiddenException('Routine item does not belong to this tenant');
    }

    // If reassigning, validate the new user belongs to the same tenant
    if (dto.assignedTenantUserId) {
      const assignedUser = await this.prisma.tenantUser.findUnique({
        where: { id: dto.assignedTenantUserId },
        select: { tenantId: true },
      });

      if (!assignedUser || assignedUser.tenantId !== currentUser.tenantId) {
        throw new ForbiddenException('Assigned user does not belong to the same tenant');
      }
    }

    return this.prisma.dailyRoutineItem.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.scheduledTime !== undefined && { scheduledTime: dto.scheduledTime }),
        ...(dto.assignedTenantUserId !== undefined && { assignedTenantUserId: dto.assignedTenantUserId }),
      },
    });
  }

  async remove(id: string, tenantId: string) {
    const item = await this.prisma.dailyRoutineItem.findUnique({
      where: { id },
    });

    if (!item) {
      throw new NotFoundException('Routine item not found');
    }

    if (item.tenantId !== tenantId) {
      throw new ForbiddenException('Routine item does not belong to this tenant');
    }

    // Delete associated logs first
    await this.prisma.dailyRoutineLog.deleteMany({
      where: { routineItemId: id },
    });

    return this.prisma.dailyRoutineItem.delete({
      where: { id },
    });
  }

  /**
   * Alertas operacionais de rotina. Duas consultas candidatas no dia local de São
   * Paulo: a que ainda está dentro dos 30 minutos do horário configurado e a que
   * já passou deles. O piso da janela pendente é a meia-noite do próprio dia, então
   * uma rotina de ontem não vira pendência hoje — a `occurrenceKey` carrega o dia
   * e o ledger descarta o que já saiu no mesmo horário.
   */
  async sendScheduledNotifications(now: Date = new Date()): Promise<void> {
    const { day, minutes, label } = localClock(now);
    const elapsed = minutes - PENDING_DELAY_MINUTES;

    const select = {
      id: true,
      tenantId: true,
      assignedTenantUserId: true,
      title: true,
      scheduledTime: true,
    } as const;
    const onTime = await this.prisma.dailyRoutineItem.findMany({
      where: {
        isActive: true,
        scheduledTime: { not: null, ...(elapsed > 0 ? { gt: hhmm(elapsed) } : { gte: '00:00' }), lte: label },
        logs: { none: { date: day } },
      },
      select,
    });
    const pending = elapsed > 0
      ? await this.prisma.dailyRoutineItem.findMany({
        where: {
          isActive: true,
          // Sem piso explícito: todo `HH:mm` é >= '00:00', ou seja, do próprio dia.
          scheduledTime: { not: null, lte: hhmm(elapsed) },
          logs: { none: { date: day } },
        },
        select,
      })
      : [];

    for (const item of onTime) {
      if (!item.scheduledTime) continue;
      await this.deliverAlert({
        tenantId: item.tenantId,
        tenantUserId: item.assignedTenantUserId,
        category: 'ROUTINE',
        type: 'routine_scheduled',
        title: 'Rotina agora',
        message: `"${item.title}" está marcada para ${item.scheduledTime}`,
        payload: { routineId: item.id, route: '/daily-routine' },
        entityType: 'routine',
        entityId: item.id,
        occurrenceKey: `scheduled:${item.scheduledTime}:${day}`,
      });
    }

    for (const item of pending) {
      if (!item.scheduledTime) continue;
      await this.deliverAlert({
        tenantId: item.tenantId,
        tenantUserId: item.assignedTenantUserId,
        category: 'ROUTINE',
        type: 'routine_pending',
        title: 'Rotina pendente',
        message: `"${item.title}" (${item.scheduledTime}) ainda não foi concluída hoje`,
        payload: { routineId: item.id, route: '/daily-routine' },
        entityType: 'routine',
        entityId: item.id,
        occurrenceKey: `pending:${item.scheduledTime}:${day}`,
      });
    }
  }

  /** Uma entrega que falha não pode interromper as demais rotinas. */
  private async deliverAlert(input: DispatchInput): Promise<void> {
    try {
      await this.dispatcher.dispatch(input);
    } catch (err) {
      this.logger.error(
        `Falha ao entregar alerta de rotina (routine=${input.entityId}, user=${input.tenantUserId}): ${safeError(err)}`,
      );
    }
  }
}
