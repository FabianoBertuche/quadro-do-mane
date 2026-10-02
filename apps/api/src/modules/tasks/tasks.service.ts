import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { DispatchInput, NotificationDispatcherService } from '../notifications/notification-dispatcher.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { MoveTaskDto } from './dto/move-task.dto';

const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';
/** Os alertas de prazo do dia abrem às 08:00 no fuso corporativo. */
const DAILY_ALERT_MINUTE = 8 * 60;

/** Relógio de parede de São Paulo: dia `YYYY-MM-DD`, minutos desde a meia-noite e o mesmo relógio como UTC. */
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
  const year = Number(value('year'));
  const month = Number(value('month'));
  const day = Number(value('day'));
  const hour = Number(value('hour'));
  const minute = Number(value('minute'));
  return {
    day: `${value('year')}-${value('month')}-${value('day')}`,
    minutes: hour * 60 + minute,
    wallClockUtc: Date.UTC(year, month - 1, day, hour, minute),
  };
};

/** `YYYY-MM-DD` somado em dias de calendário, sem passar por fuso. */
const shiftDay = (day: string, days: number) => {
  const [year, month, date] = day.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, date + days));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
};

/** Meia-noite do dia em São Paulo como instante UTC, com o offset lido do próprio fuso. */
const localDayStart = (day: string) => {
  const guess = new Date(`${day}T00:00:00.000Z`);
  return new Date(guess.getTime() - (localClock(guess).wallClockUtc - guess.getTime()));
};

const brDate = (day: string) => {
  const [year, month, date] = day.split('-');
  return `${date}/${month}/${year}`;
};

/** O SDK do Expo ecoa o payload em mensagens de erro, então só o nome do erro é seguro. */
const safeError = (err: unknown) => (err instanceof Error ? err.name : 'erro desconhecido');

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);
  constructor(
    private prisma: PrismaService,
    private activityLog: ActivityLogService,
    private dispatcher: NotificationDispatcherService,
  ) {}

  async findAll(tenantId: string, projectId?: string) {
    return this.prisma.task.findMany({
      where: {
        tenantId,
        archivedAt: null,
        ...(projectId ? { projectId } : {}),
      },
      include: {
        status: true,
        priority: true,
        assignee: { include: { user: { select: { name: true, avatarUrl: true } } } },
        project: { select: { id: true, name: true, color: true } },
        _count: { select: { comments: true, checklists: true, attachments: true, subTasks: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findByFilters(tenantId: string, filters: {
    projectId?: string;
    projectIds?: string[];
    statusId?: string;
    statusCategory?: string;
    assigneeTenantUserId?: string;
    priorityId?: string;
    teamId?: string;
    tagId?: string;
    overdue?: boolean;
    completed?: boolean;
    myTasks?: boolean;
    blocked?: boolean;
    search?: string;
    startDateFrom?: string;
    startDateTo?: string;
    dueDateFrom?: string;
    dueDateTo?: string;
  }) {
    const where: any = { tenantId, archivedAt: null };

    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.projectIds) where.projectId = { in: filters.projectIds };
    if (filters.statusId) where.statusId = filters.statusId;
    if (filters.statusCategory) where.status = { category: filters.statusCategory };
    if (filters.assigneeTenantUserId) where.assigneeTenantUserId = filters.assigneeTenantUserId;
    if (filters.priorityId) where.priorityId = filters.priorityId;
    if (filters.teamId) where.teamId = filters.teamId;

    if (filters.tagId) {
      where.tagLinks = { some: { tagId: filters.tagId } };
    }

    if (filters.overdue) {
      where.dueDate = { lt: new Date() };
      where.status = { category: { not: 'done' } };
    }

    if (filters.completed) {
      where.status = { category: 'done' };
    }

    if (filters.blocked) {
      where.isBlocked = true;
    }

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.startDateFrom || filters.startDateTo) {
      where.startDate = {};
      if (filters.startDateFrom) where.startDate.gte = new Date(filters.startDateFrom);
      if (filters.startDateTo) where.startDate.lte = new Date(filters.startDateTo);
    }

    if (filters.dueDateFrom || filters.dueDateTo) {
      if (!where.dueDate) where.dueDate = {};
      if (filters.dueDateFrom) where.dueDate.gte = new Date(filters.dueDateFrom);
      if (filters.dueDateTo) where.dueDate.lte = new Date(filters.dueDateTo);
    }

    return this.prisma.task.findMany({
      where,
      include: {
        status: true,
        priority: true,
        assignee: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } },
        project: { select: { id: true, name: true, code: true } },
        tagLinks: { include: { tag: true } },
        _count: { select: { comments: true, attachments: true, checklists: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findByProject(tenantId: string, projectId: string) {
    return this.prisma.task.findMany({
      where: { tenantId, projectId, archivedAt: null },
      include: {
        status: true,
        priority: true,
        assignee: { include: { user: { select: { name: true, avatarUrl: true } } } },
        tagLinks: { include: { tag: true } },
        project: { select: { id: true, name: true, color: true } },
        _count: { select: { comments: true, checklists: true, attachments: true, subTasks: true } },
      },
      orderBy: [{ kanbanPosition: 'asc' }],
    });
  }

  async findOne(tenantId: string, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, tenantId },
      include: {
        status: true,
        priority: true,
        assignee: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } },
        reporter: { include: { user: { select: { name: true, avatarUrl: true } } } },
        assignees: { include: { tenantUser: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } } } },
        tagLinks: { include: { tag: true } },
        checklists: { include: { items: { orderBy: { position: 'asc' } } }, orderBy: { position: 'asc' } },
        comments: {
          where: { deletedAt: null },
          include: { author: { include: { user: { select: { name: true, avatarUrl: true } } } } },
          orderBy: { createdAt: 'desc' },
        },
        attachments: {
          include: {
            uploadedBy: { include: { user: { select: { name: true, avatarUrl: true } } } },
          },
        },
        subTasks: { include: { status: true, assignee: { include: { user: { select: { name: true, avatarUrl: true } } } } } },
        project: { select: { id: true, name: true, code: true } },
      },
    });
    if (!task) throw new NotFoundException('Tarefa não encontrada');
    return task;
  }

  async create(tenantId: string, dto: CreateTaskDto, actorTenantUserId?: string) {
    let statusId = dto.statusId;

    if (!statusId) {
      const defaultStatus = await this.prisma.taskStatus.findFirst({
        where: { tenantId, isDefault: true },
      });
      if (defaultStatus) {
        statusId = defaultStatus.id;
      } else {
        const firstStatus = await this.prisma.taskStatus.findFirst({
          where: { tenantId },
          orderBy: { position: 'asc' },
        });
        if (firstStatus) statusId = firstStatus.id;
      }
    }

    const task = await this.prisma.task.create({
      data: { tenantId, ...dto, statusId },
      include: {
        status: true,
        priority: true,
        project: { select: { id: true, name: true, code: true } },
      },
    });

    await this.activityLog.log({
      tenantId,
      actorTenantUserId,
      entityType: 'Task',
      entityId: task.id,
      action: 'TASK_CREATED',
      newValues: {
        taskTitle: task.title,
        projectName: task.project?.name,
        projectCode: task.project?.code,
        statusName: task.status?.name,
        priorityName: task.priority?.name,
      },
    });

    // Alerta para o responsável recém-atribuído (não notificar o próprio ator)
    if (dto.assigneeTenantUserId && dto.assigneeTenantUserId !== actorTenantUserId) {
      await this.deliverAlert({
        tenantId,
        tenantUserId: dto.assigneeTenantUserId,
        category: 'TASKS',
        type: 'task_assigned',
        title: 'Nova tarefa atribuída',
        message: task.title,
        payload: { taskId: task.id, projectId: task.projectId, route: `/task/${task.id}` },
        entityType: 'task',
        entityId: task.id,
        occurrenceKey: `assignment:${task.updatedAt.toISOString()}`,
      });
    }

    return task;
  }

  async update(tenantId: string, id: string, dto: UpdateTaskDto, actorTenantUserId?: string) {
    const oldTask = await this.findOne(tenantId, id);
    const updated = await this.prisma.task.update({
      where: { id },
      data: dto,
      include: { status: true, priority: true },
    });

    // Build change log for ALL fields
    const oldValues: Record<string, any> = {};
    const newValues: Record<string, any> = { taskTitle: oldTask.title };

    if (dto.title !== undefined && dto.title !== oldTask.title) {
      oldValues.oldTitle = oldTask.title;
      newValues.newTitle = dto.title;
    }
    if (dto.description !== undefined && dto.description !== oldTask.description) {
      oldValues.oldDescription = oldTask.description || null;
      newValues.newDescription = dto.description || null;
    }
    if (dto.statusId && dto.statusId !== oldTask.statusId) {
      oldValues.oldStatusName = oldTask.status?.name;
      newValues.newStatusName = updated.status?.name;
    }
    if (dto.priorityId !== undefined && dto.priorityId !== oldTask.priorityId) {
      oldValues.oldPriorityName = oldTask.priority?.name || null;
      newValues.newPriorityName = updated.priority?.name || null;
    }
    if (dto.assigneeTenantUserId !== undefined && dto.assigneeTenantUserId !== oldTask.assigneeTenantUserId) {
      oldValues.oldAssigneeName = (oldTask.assignee as any)?.user?.name || null;
      if (dto.assigneeTenantUserId) {
        const newAssignee = await this.prisma.tenantUser.findUnique({
          where: { id: dto.assigneeTenantUserId },
          include: { user: { select: { name: true } } },
        });
        newValues.newAssigneeName = newAssignee?.user?.name || null;
      } else {
        newValues.newAssigneeName = null;
      }
    }
    if (dto.startDate !== undefined) {
      const oldStart = oldTask.startDate ? new Date(oldTask.startDate).toISOString() : null;
      const newStart = dto.startDate ? new Date(dto.startDate).toISOString() : null;
      if (oldStart !== newStart) {
        oldValues.oldStartDate = oldStart;
        newValues.newStartDate = newStart;
      }
    }
    if (dto.dueDate !== undefined) {
      const oldDue = oldTask.dueDate ? new Date(oldTask.dueDate).toISOString() : null;
      const newDue = dto.dueDate ? new Date(dto.dueDate).toISOString() : null;
      if (oldDue !== newDue) {
        oldValues.oldDueDate = oldDue;
        newValues.newDueDate = newDue;
      }
    }

    const hasChanges = Object.keys(oldValues).length > 0 || Object.keys(newValues).length > 1;
    if (hasChanges) {
      await this.activityLog.log({
        tenantId,
        actorTenantUserId,
        entityType: 'Task',
        entityId: id,
        action: 'TASK_UPDATED',
        oldValues,
        newValues: {
          ...newValues,
          projectName: oldTask.project?.name,
          projectCode: oldTask.project?.code,
        },
      });
    }

    // Alerta quando a tarefa é reatribuída (não notificar o próprio ator)
    const newAssignee = dto.assigneeTenantUserId;
    if (
      newAssignee &&
      newAssignee !== oldTask.assigneeTenantUserId &&
      newAssignee !== actorTenantUserId
    ) {
      await this.deliverAlert({
        tenantId,
        tenantUserId: newAssignee,
        category: 'TASKS',
        type: 'task_assigned',
        title: 'Tarefa atribuída a você',
        message: updated.title,
        payload: { taskId: updated.id, projectId: updated.projectId, route: `/task/${updated.id}` },
        entityType: 'task',
        entityId: updated.id,
        occurrenceKey: `assignment:${updated.updatedAt.toISOString()}`,
      });
    }

    if (updated.statusId !== oldTask.statusId) {
      const type = updated.status?.category === 'done'
        ? 'task_completed'
        : oldTask.status?.category === 'done' ? 'task_reopened' : 'task_status_changed';
      await this.dispatchCollaboration(tenantId, { ...oldTask, ...updated }, actorTenantUserId, type, `update:${updated.updatedAt.toISOString()}`);
    }

    if (dto.dueDate !== undefined) {
      const oldDue = oldTask.dueDate ? new Date(oldTask.dueDate).toISOString() : null;
      const newDue = updated.dueDate ? new Date(updated.dueDate).toISOString() : null;
      if (oldDue !== newDue) {
        await this.dispatchCollaboration(
          tenantId,
          { ...oldTask, ...updated },
          actorTenantUserId,
          'task_due_date_changed',
          `update:${updated.updatedAt.toISOString()}`,
        );
      }
    }

    return updated;
  }

  async remove(tenantId: string, id: string, actorTenantUserId?: string) {
    const task = await this.findOne(tenantId, id);
    await this.prisma.task.update({
      where: { id },
      data: { archivedAt: new Date() },
    });

    await this.activityLog.log({
      tenantId,
      actorTenantUserId,
      entityType: 'Task',
      entityId: id,
      action: 'TASK_ARCHIVED',
      newValues: {
        taskTitle: task.title,
        projectName: task.project?.name,
        projectCode: task.project?.code,
      },
    });
  }

  // Kanban move
  async moveTask(tenantId: string, id: string, dto: MoveTaskDto, actorTenantUserId?: string) {
    const oldTask = await this.findOne(tenantId, id);
    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        statusId: dto.statusId,
        kanbanPosition: dto.kanbanPosition,
      },
      include: { status: true },
    });

    if (dto.statusId && dto.statusId !== oldTask.statusId) {
      await this.activityLog.log({
        tenantId,
        actorTenantUserId,
        entityType: 'Task',
        entityId: id,
        action: 'STATUS_CHANGED',
        oldValues: {
          oldStatusName: oldTask.status?.name,
        },
        newValues: {
          taskTitle: oldTask.title,
          projectName: oldTask.project?.name,
          projectCode: oldTask.project?.code,
          newStatusName: updated.status?.name,
        },
      });
      const type = updated.status?.category === 'done'
        ? 'task_completed'
        : oldTask.status?.category === 'done' ? 'task_reopened' : 'task_status_changed';
      await this.dispatchCollaboration(tenantId, { ...oldTask, ...updated }, actorTenantUserId, type, `update:${updated.updatedAt.toISOString()}`);
    }

    return updated;
  }

  // Change status
  async changeStatus(tenantId: string, id: string, statusId: string, actorTenantUserId?: string) {
    const oldTask = await this.findOne(tenantId, id);
    const data: any = { statusId };
    // Check if status is "done" category
    const status = await this.prisma.taskStatus.findUnique({ where: { id: statusId } });
    if (status?.category === 'done') {
      data.completedAt = new Date();
    } else {
      data.completedAt = null;
    }
    const updated = await this.prisma.task.update({ where: { id }, data, include: { status: true } });

    if (statusId !== oldTask.statusId) {
      let action = 'STATUS_CHANGED';
      if (status?.category === 'done') {
        action = 'TASK_COMPLETED';
      } else if (oldTask.status?.category === 'done') {
        action = 'TASK_REOPENED';
      }

      await this.activityLog.log({
        tenantId,
        actorTenantUserId,
        entityType: 'Task',
        entityId: id,
        action,
        oldValues: {
          oldStatusName: oldTask.status?.name,
        },
        newValues: {
          taskTitle: oldTask.title,
          projectName: oldTask.project?.name,
          projectCode: oldTask.project?.code,
          newStatusName: status?.name,
        },
      });
      const type = status?.category === 'done'
        ? 'task_completed'
        : oldTask.status?.category === 'done' ? 'task_reopened' : 'task_status_changed';
      await this.dispatchCollaboration(tenantId, { ...oldTask, ...updated }, actorTenantUserId, type, `update:${updated.updatedAt.toISOString()}`);
    }

    return updated;
  }

  // Change priority
  async changePriority(tenantId: string, id: string, priorityId: string, actorTenantUserId?: string) {
    const oldTask = await this.findOne(tenantId, id);
    const updated = await this.prisma.task.update({
      where: { id },
      data: { priorityId },
      include: { priority: true },
    });

    if (priorityId !== oldTask.priorityId) {
      await this.activityLog.log({
        tenantId,
        actorTenantUserId,
        entityType: 'Task',
        entityId: id,
        action: 'PRIORITY_CHANGED',
        oldValues: {
          oldPriorityName: oldTask.priority?.name || null,
        },
        newValues: {
          taskTitle: oldTask.title,
          projectName: oldTask.project?.name,
          projectCode: oldTask.project?.code,
          newPriorityName: updated.priority?.name || null,
        },
      });
    }

    return updated;
  }

  /**
   * Alertas operacionais de prazo. Duas janelas, ambas ancoradas no dia local de
   * São Paulo: a que vence amanhã e a que já venceu antes da meia-noite de hoje.
   * A janela só abre às 08:00 — a `occurrenceKey` com o dia local faz o ledger
   * descartar o resto do dia, então o alerta atrasado sai uma única vez por dia.
   */
  async sendScheduledNotifications(now: Date = new Date()): Promise<void> {
    const { day, minutes } = localClock(now);
    if (minutes < DAILY_ALERT_MINUTE) return;

    const tomorrow = shiftDay(day, 1);
    const open = {
      archivedAt: null,
      completedAt: null,
      status: { category: { not: 'done' as const } },
      assigneeTenantUserId: { not: null },
    };
    const select = {
      id: true,
      tenantId: true,
      title: true,
      dueDate: true,
      assigneeTenantUserId: true,
    } as const;

    const dueTomorrow = await this.prisma.task.findMany({
      where: { ...open, dueDate: { gte: localDayStart(tomorrow), lt: localDayStart(shiftDay(tomorrow, 1)) } },
      select,
    });
    const overdue = await this.prisma.task.findMany({
      where: { ...open, dueDate: { lt: localDayStart(day) } },
      select,
    });

    for (const task of dueTomorrow) {
      if (!task.assigneeTenantUserId || !task.dueDate) continue;
      await this.deliverAlert({
        tenantId: task.tenantId,
        tenantUserId: task.assigneeTenantUserId,
        category: 'TASKS',
        type: 'task_due_soon',
        title: 'Prazo próximo',
        message: `"${task.title}" vence amanhã`,
        payload: { taskId: task.id, route: `/task/${task.id}` },
        entityType: 'task',
        entityId: task.id,
        occurrenceKey: localClock(task.dueDate).day,
      });
    }

    for (const task of overdue) {
      if (!task.assigneeTenantUserId || !task.dueDate) continue;
      await this.deliverAlert({
        tenantId: task.tenantId,
        tenantUserId: task.assigneeTenantUserId,
        category: 'TASKS',
        type: 'task_overdue',
        title: 'Tarefa atrasada',
        message: `"${task.title}" venceu em ${brDate(localClock(task.dueDate).day)}`,
        payload: { taskId: task.id, route: `/task/${task.id}` },
        entityType: 'task',
        entityId: task.id,
        occurrenceKey: day,
      });
    }
  }

  /** Uma entrega que falha não pode roubar o alerta dos demais candidatos. */
  private async deliverAlert(input: DispatchInput): Promise<void> {
    try {
      await this.dispatcher.dispatch(input);
    } catch (err) {
      this.logger.error(
        `Falha ao entregar alerta de tarefa (task=${input.entityId}, user=${input.tenantUserId}): ${safeError(err)}`,
      );
    }
  }

  private collaborationRecipients(task: any, actorTenantUserId?: string): string[] {
    const recipients = new Set<string>();
    if (task.reporterTenantUserId) recipients.add(task.reporterTenantUserId);
    if (task.assigneeTenantUserId) recipients.add(task.assigneeTenantUserId);
    for (const assignee of task.assignees ?? []) {
      if (assignee.tenantUserId) recipients.add(assignee.tenantUserId);
    }
    if (actorTenantUserId) recipients.delete(actorTenantUserId);
    return [...recipients];
  }

  private async dispatchCollaboration(
    tenantId: string,
    task: any,
    actorTenantUserId: string | undefined,
    type: string,
    occurrenceKey: string,
    message = task.title,
  ): Promise<void> {
    for (const tenantUserId of this.collaborationRecipients(task, actorTenantUserId)) {
      await this.deliverAlert({
        tenantId,
        tenantUserId,
        category: 'COLLABORATION',
        type,
        title: 'Atualização na tarefa',
        message,
        payload: { taskId: task.id, projectId: task.projectId, route: `/task/${task.id}` },
        entityType: 'task',
        entityId: task.id,
        occurrenceKey,
      });
    }
  }

  // Comments
  async getComments(tenantId: string, taskId: string) {
    return this.prisma.taskComment.findMany({
      where: { tenantId, taskId, deletedAt: null },
      include: { author: { include: { user: { select: { name: true, avatarUrl: true } } } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addComment(tenantId: string, taskId: string, authorTenantUserId: string, content: string) {
    const comment = await this.prisma.taskComment.create({
      data: { tenantId, taskId, authorTenantUserId, content },
      include: { author: { include: { user: { select: { name: true, avatarUrl: true } } } } },
    });

    const task = await this.findOne(tenantId, taskId);

    await this.activityLog.log({
      tenantId,
      actorTenantUserId: authorTenantUserId,
      entityType: 'Task',
      entityId: taskId,
      action: 'COMMENT_ADDED',
      newValues: {
        taskTitle: task?.title,
        projectName: task?.project?.name,
        projectCode: task?.project?.code,
        authorName: comment.author?.user?.name || null,
        commentContent: content.substring(0, 200),
      },
    });

    await this.dispatchCollaboration(
      tenantId,
      task,
      authorTenantUserId,
      'task_comment_created',
      `comment:${comment.id}`,
      content.substring(0, 200),
    );

    return comment;
  }

  async removeComment(tenantId: string, commentId: string, actorTenantUserId?: string) {
    const comment = await this.prisma.taskComment.findFirst({ where: { id: commentId, tenantId } });
    if (!comment) throw new NotFoundException('Comentário não encontrado');

    await this.prisma.taskComment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });

    const task = await this.prisma.task.findFirst({
      where: { id: comment.taskId, tenantId },
      select: { title: true, project: { select: { name: true, code: true } } },
    });

    await this.activityLog.log({
      tenantId,
      actorTenantUserId,
      entityType: 'Task',
      entityId: comment.taskId,
      action: 'COMMENT_REMOVED',
      newValues: {
        taskTitle: task?.title,
        projectName: task?.project?.name,
        projectCode: task?.project?.code,
        commentContent: comment.content.substring(0, 200),
      },
    });

    return { success: true };
  }

  // Checklists
  async createChecklist(tenantId: string, taskId: string, title: string, actorTenantUserId?: string) {
    const checklist = await this.prisma.taskChecklist.create({
      data: { tenantId, taskId, title },
    });

    const task = await this.prisma.task.findFirst({
      where: { id: taskId, tenantId },
      select: { title: true, project: { select: { name: true, code: true } } },
    });

      await this.activityLog.log({
        tenantId,
        actorTenantUserId,
        entityType: 'Task',
        entityId: taskId,
        action: 'CHECKLIST_CREATED',
      newValues: {
        taskTitle: task?.title,
        projectName: task?.project?.name,
        checklistTitle: title,
      },
    });

    return checklist;
  }

  async addChecklistItem(tenantId: string, checklistId: string, content: string, actorTenantUserId?: string) {
    const item = await this.prisma.taskChecklistItem.create({
      data: { tenantId, checklistId, content },
    });

    const checklist = await this.prisma.taskChecklist.findFirst({
      where: { id: checklistId, tenantId },
      select: { title: true, task: { select: { id: true, title: true, project: { select: { name: true, code: true } } } } },
    });

    if (checklist?.task) {
      await this.activityLog.log({
        tenantId,
        actorTenantUserId,
        entityType: 'Task',
        entityId: checklist.task.id,
        action: 'CHECKLIST_ITEM_ADDED',
        newValues: {
          taskTitle: checklist.task.title,
          projectName: checklist.task.project?.name,
          checklistTitle: checklist.title,
          itemContent: content,
        },
      });
    }

    return item;
  }

  async toggleChecklistItem(tenantId: string, itemId: string, tenantUserId: string) {
    const item = await this.prisma.taskChecklistItem.findFirst({ where: { id: itemId, tenantId } });
    if (!item) throw new NotFoundException('Item não encontrado');

    const updated = await this.prisma.taskChecklistItem.update({
      where: { id: itemId },
      data: {
        isDone: !item.isDone,
        doneByTenantUserId: !item.isDone ? tenantUserId : null,
        doneAt: !item.isDone ? new Date() : null,
      },
    });

    const checklist = await this.prisma.taskChecklist.findFirst({
      where: { id: item.checklistId, tenantId },
      select: { title: true, task: { select: { id: true, title: true, project: { select: { name: true, code: true } } } } },
    });

    if (checklist?.task) {
      await this.activityLog.log({
        tenantId,
        actorTenantUserId: tenantUserId,
        entityType: 'Task',
        entityId: checklist.task.id,
        action: !item.isDone ? 'CHECKLIST_ITEM_COMPLETED' : 'CHECKLIST_ITEM_UNCHECKED',
        newValues: {
          taskTitle: checklist.task.title,
          projectName: checklist.task.project?.name,
          checklistTitle: checklist.title,
          itemContent: item.content,
        },
      });
    }

    return updated;
  }

  // Task Statuses for a tenant
  async getStatuses(tenantId: string) {
    return this.prisma.taskStatus.findMany({
      where: { tenantId },
      orderBy: { position: 'asc' },
    });
  }

  // Task Priorities for a tenant
  async getPriorities(tenantId: string) {
    return this.prisma.taskPriority.findMany({
      where: { tenantId },
      orderBy: { level: 'asc' },
    });
  }

  async getTags(tenantId: string) {
    return this.prisma.taskTag.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  // Attachments
  async removeAttachment(tenantId: string, taskId: string, attachmentId: string, actorTenantUserId?: string) {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, tenantId, taskId },
    });
    if (!attachment) throw new NotFoundException('Anexo não encontrado');

    await this.prisma.attachment.delete({ where: { id: attachmentId } });

    const task = await this.prisma.task.findFirst({
      where: { id: taskId, tenantId },
      select: { title: true, project: { select: { name: true, code: true } } },
    });

    await this.activityLog.log({
      tenantId,
      actorTenantUserId,
      entityType: 'Task',
      entityId: taskId,
      action: 'ATTACHMENT_REMOVED',
      newValues: {
        taskTitle: task?.title,
        projectName: task?.project?.name,
        fileName: attachment.fileName,
      },
    });

    return { success: true };
  }
}
