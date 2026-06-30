import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getOverview(tenantId: string) {
    const [totalTasks, inProgressTasks, completedTasks, overdueTasks, activeProjects, totalTeams] = await Promise.all([
      this.prisma.task.count({ where: { tenantId, archivedAt: null } }),
      this.prisma.task.count({
        where: { tenantId, archivedAt: null, status: { category: 'active' } },
      }),
      this.prisma.task.count({
        where: { tenantId, archivedAt: null, status: { category: 'done' } },
      }),
      this.prisma.task.count({
        where: { tenantId, archivedAt: null, dueDate: { lt: new Date() }, completedAt: null },
      }),
      this.prisma.project.count({ where: { tenantId, status: 'ACTIVE', archivedAt: null } }),
      this.prisma.team.count({ where: { tenantId } }),
    ]);

    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      totalTasks,
      inProgressTasks,
      completedTasks,
      overdueTasks,
      activeProjects,
      totalTeams,
      completionRate,
    };
  }

  async getWorkload(tenantId: string) {
    const assignees = await this.prisma.task.groupBy({
      by: ['assigneeTenantUserId'],
      where: { tenantId, archivedAt: null, completedAt: null },
      _count: { id: true },
    });

    const result = [];
    for (const item of assignees) {
      if (!item.assigneeTenantUserId) continue;
      const tenantUser = await this.prisma.tenantUser.findUnique({
        where: { id: item.assigneeTenantUserId },
        include: { user: { select: { name: true, avatarUrl: true } } },
      });
      result.push({
        tenantUserId: item.assigneeTenantUserId,
        name: tenantUser?.user?.name || 'Sem nome',
        avatarUrl: tenantUser?.user?.avatarUrl,
        taskCount: item._count.id,
      });
    }

    return result.sort((a, b) => b.taskCount - a.taskCount);
  }

  async getProductivity(tenantId: string) {
    const now = new Date();
    const weekData = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));

      const completed = await this.prisma.task.count({
        where: { tenantId, completedAt: { gte: dayStart, lte: dayEnd } },
      });

      const created = await this.prisma.task.count({
        where: { tenantId, createdAt: { gte: dayStart, lte: dayEnd } },
      });

      weekData.push({
        date: dayStart.toISOString().split('T')[0],
        completed,
        created,
      });
    }

    return weekData;
  }

  async getProjectProgress(tenantId: string) {
    const projects = await this.prisma.project.findMany({
      where: { tenantId, status: 'ACTIVE', archivedAt: null },
      select: {
        id: true,
        name: true,
        code: true,
        color: true,
        progressPercent: true,
        _count: { select: { tasks: true } },
      },
      take: 10,
      orderBy: { updatedAt: 'desc' },
    });

    const result = [];
    for (const project of projects) {
      const completedTasks = await this.prisma.task.count({
        where: { projectId: project.id, tenantId, status: { category: 'done' } },
      });
      const progress = project._count.tasks > 0
        ? Math.round((completedTasks / project._count.tasks) * 100)
        : 0;

      result.push({
        id: project.id,
        name: project.name,
        code: project.code,
        color: project.color,
        totalTasks: project._count.tasks,
        completedTasks,
        progress,
      });
    }

    return result;
  }
}
