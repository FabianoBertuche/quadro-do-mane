import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { MoveTaskDto } from './dto/move-task.dto';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private activityLog: ActivityLogService,
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
    statusId?: string;
    assigneeTenantUserId?: string;
    overdue?: boolean;
    completed?: boolean;
  }) {
    const where: any = { tenantId, archivedAt: null };

    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.statusId) where.statusId = filters.statusId;
    if (filters.assigneeTenantUserId) where.assigneeTenantUserId = filters.assigneeTenantUserId;

    if (filters.overdue) {
      where.dueDate = { lt: new Date() };
      where.status = { category: { not: 'done' } };
    }

    if (filters.completed) {
      where.status = { category: 'done' };
    }

    return this.prisma.task.findMany({
      where,
      include: {
        status: true,
        priority: true,
        assignee: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } },
        project: { select: { id: true, name: true, code: true } },
        _count: { select: { comments: true, attachments: true, checklists: true } },
      },
      orderBy: { createdAt: 'desc' },
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

    return task;
  }

  async update(tenantId: string, id: string, dto: UpdateTaskDto) {
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

    return updated;
  }

  async remove(tenantId: string, id: string) {
    const task = await this.findOne(tenantId, id);
    await this.prisma.task.update({
      where: { id },
      data: { archivedAt: new Date() },
    });

    await this.activityLog.log({
      tenantId,
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
      await this.activityLog.log({
        tenantId,
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
      let action = 'STATUS_CHANGED';
      if (status?.category === 'done') {
        action = 'TASK_COMPLETED';
      } else if (oldTask.status?.category === 'done') {
        action = 'TASK_REOPENED';
      }

      await this.activityLog.log({
        tenantId,
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
    }

    return updated;
  }

  // Change priority
  async changePriority(tenantId: string, id: string, priorityId: string) {
    const oldTask = await this.findOne(tenantId, id);
    const updated = await this.prisma.task.update({
      where: { id },
      data: { priorityId },
      include: { priority: true },
    });

    if (priorityId !== oldTask.priorityId) {
      await this.activityLog.log({
        tenantId,
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

    const task = await this.prisma.task.findFirst({
      where: { id: taskId, tenantId },
      select: { title: true, project: { select: { name: true, code: true } } },
    });

    await this.activityLog.log({
      tenantId,
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

    return comment;
  }

  async removeComment(tenantId: string, commentId: string) {
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
  async createChecklist(tenantId: string, taskId: string, title: string) {
    const checklist = await this.prisma.taskChecklist.create({
      data: { tenantId, taskId, title },
    });

    const task = await this.prisma.task.findFirst({
      where: { id: taskId, tenantId },
      select: { title: true, project: { select: { name: true, code: true } } },
    });

    await this.activityLog.log({
      tenantId,
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

  async addChecklistItem(tenantId: string, checklistId: string, content: string) {
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

  // Attachments
  async removeAttachment(tenantId: string, taskId: string, attachmentId: string) {
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
