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
    const assigneeCounts = await this.prisma.task.groupBy({
      by: ['assigneeTenantUserId'],
      where: {
        tenantId,
        archivedAt: null,
        completedAt: null,
        assigneeTenantUserId: { not: null },
      },
      _count: { id: true },
    });

    const tenantUserIds = assigneeCounts
      .map((item) => item.assigneeTenantUserId)
      .filter((id): id is string => Boolean(id));

    if (tenantUserIds.length === 0) {
      return [];
    }

    const tenantUsers = await this.prisma.tenantUser.findMany({
      where: { id: { in: tenantUserIds } },
      include: { user: { select: { name: true, avatarUrl: true } } },
    });

    const userMap = new Map(tenantUsers.map((tenantUser) => [tenantUser.id, tenantUser]));

    return assigneeCounts
      .map((item) => {
        const tenantUser = item.assigneeTenantUserId
          ? userMap.get(item.assigneeTenantUserId)
          : undefined;

        return {
          tenantUserId: item.assigneeTenantUserId ?? 'unknown',
          name: tenantUser?.user?.name ?? 'Sem nome',
          avatarUrl: tenantUser?.user?.avatarUrl,
          taskCount: item._count.id,
        };
      })
      .sort((a, b) => b.taskCount - a.taskCount);
  }

  async getProductivity(tenantId: string) {
    const weekData = await this.prisma.$queryRaw<Array<{ date: string; completed: number; created: number }>>`
      SELECT
        to_char(day, 'YYYY-MM-DD') AS date,
        COALESCE(completed.count, 0) AS completed,
        COALESCE(created.count, 0) AS created
      FROM generate_series(
        date_trunc('day', now() - interval '6 day'),
        date_trunc('day', now()),
        interval '1 day'
      ) AS day
      LEFT JOIN (
        SELECT date_trunc('day', completed_at) AS day, COUNT(*) AS count
        FROM "Task"
        WHERE tenant_id = ${tenantId} AND completed_at IS NOT NULL
          AND completed_at >= now() - interval '6 day'
        GROUP BY date_trunc('day', completed_at)
      ) AS completed ON completed.day = day
      LEFT JOIN (
        SELECT date_trunc('day', created_at) AS day, COUNT(*) AS count
        FROM "Task"
        WHERE tenant_id = ${tenantId}
          AND created_at >= now() - interval '6 day'
        GROUP BY date_trunc('day', created_at)
      ) AS created ON created.day = day
      ORDER BY day ASC;
    `;

    return weekData.map((item) => ({
      date: item.date,
      completed: Number(item.completed),
      created: Number(item.created),
    }));
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

    const completedCounts = await this.prisma.task.groupBy({
      by: ['projectId'],
      where: { tenantId, status: { category: 'done' }, projectId: { in: projects.map((project) => project.id) } },
      _count: { id: true },
    });

    const completedMap = new Map(completedCounts.map((item) => [item.projectId, item._count.id]));

    return projects.map((project) => {
      const completedTasks = completedMap.get(project.id) ?? 0;
      const progress = project._count.tasks > 0
        ? Math.round((completedTasks / project._count.tasks) * 100)
        : 0;

      return {
        id: project.id,
        name: project.name,
        code: project.code,
        color: project.color,
        totalTasks: project._count.tasks,
        completedTasks,
        progress,
      };
    });
  }
}
