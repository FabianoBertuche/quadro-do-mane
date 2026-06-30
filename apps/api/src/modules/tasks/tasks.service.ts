import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { MoveTaskDto } from './dto/move-task.dto';

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) { }

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
        attachments: true,
        subTasks: { include: { status: true, assignee: { include: { user: { select: { name: true, avatarUrl: true } } } } } },
        project: { select: { id: true, name: true, code: true } },
      },
    });
    if (!task) throw new NotFoundException('Tarefa não encontrada');
    return task;
  }

  async create(tenantId: string, dto: CreateTaskDto) {
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

    return this.prisma.task.create({
      data: { tenantId, ...dto, statusId },
      include: { status: true, priority: true },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateTaskDto) {
    const oldTask = await this.findOne(tenantId, id);
    const updated = await this.prisma.task.update({
      where: { id },
      data: dto,
      include: { status: true, priority: true },
    });

    if (dto.statusId && dto.statusId !== oldTask.statusId) {
      await this.prisma.activityLog.create({
        data: {
          tenantId,
          entityType: 'Task',
          entityId: id,
          action: 'STATUS_CHANGED',
          oldValuesJson: JSON.stringify({ statusId: oldTask.statusId }),
          newValuesJson: JSON.stringify({ statusId: dto.statusId }),
        }
      });
    }

    return updated;
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.task.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  }

  // Kanban move
  async moveTask(tenantId: string, id: string, dto: MoveTaskDto) {
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
      await this.prisma.activityLog.create({
        data: {
          tenantId,
          entityType: 'Task',
          entityId: id,
          action: 'STATUS_CHANGED',
          oldValuesJson: JSON.stringify({ statusId: oldTask.statusId }),
          newValuesJson: JSON.stringify({ statusId: dto.statusId }),
        }
      });
    }

    return updated;
  }

  // Change status
  async changeStatus(tenantId: string, id: string, statusId: string) {
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
      await this.prisma.activityLog.create({
        data: {
          tenantId,
          entityType: 'Task',
          entityId: id,
          action: 'STATUS_CHANGED',
          oldValuesJson: JSON.stringify({ statusId: oldTask.statusId }),
          newValuesJson: JSON.stringify({ statusId }),
        }
      });
    }

    return updated;
  }

  // Change priority
  async changePriority(tenantId: string, id: string, priorityId: string) {
    await this.findOne(tenantId, id);
    return this.prisma.task.update({
      where: { id },
      data: { priorityId },
      include: { priority: true },
    });
  }

  // Comments
  async addComment(tenantId: string, taskId: string, authorTenantUserId: string, content: string) {
    return this.prisma.taskComment.create({
      data: { tenantId, taskId, authorTenantUserId, content },
      include: { author: { include: { user: { select: { name: true, avatarUrl: true } } } } },
    });
  }

  async removeComment(tenantId: string, commentId: string) {
    const comment = await this.prisma.taskComment.findFirst({ where: { id: commentId, tenantId } });
    if (!comment) throw new NotFoundException('Comentário não encontrado');
    return this.prisma.taskComment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });
  }

  // Checklists
  async createChecklist(tenantId: string, taskId: string, title: string) {
    return this.prisma.taskChecklist.create({
      data: { tenantId, taskId, title },
    });
  }

  async addChecklistItem(tenantId: string, checklistId: string, content: string) {
    return this.prisma.taskChecklistItem.create({
      data: { tenantId, checklistId, content },
    });
  }

  async toggleChecklistItem(tenantId: string, itemId: string, tenantUserId: string) {
    const item = await this.prisma.taskChecklistItem.findFirst({ where: { id: itemId, tenantId } });
    if (!item) throw new NotFoundException('Item não encontrado');
    return this.prisma.taskChecklistItem.update({
      where: { id: itemId },
      data: {
        isDone: !item.isDone,
        doneByTenantUserId: !item.isDone ? tenantUserId : null,
        doneAt: !item.isDone ? new Date() : null,
      },
    });
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
}
