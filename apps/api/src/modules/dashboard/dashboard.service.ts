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
        to_char(gs.day, 'YYYY-MM-DD') AS date,
        COALESCE(c.count, 0) AS completed,
        COALESCE(cr.count, 0) AS created
      FROM generate_series(
        date_trunc('day', now() - interval '6 day'),
        date_trunc('day', now()),
        interval '1 day'
      ) AS gs(day)
      LEFT JOIN (
        SELECT date_trunc('day', completed_at) AS day, COUNT(*) AS count
        FROM "tasks"
        WHERE tenant_id = ${tenantId} AND completed_at IS NOT NULL
          AND completed_at >= now() - interval '6 day'
        GROUP BY date_trunc('day', completed_at)
      ) AS c ON c.day = gs.day
      LEFT JOIN (
        SELECT date_trunc('day', created_at) AS day, COUNT(*) AS count
        FROM "tasks"
        WHERE tenant_id = ${tenantId}
          AND created_at >= now() - interval '6 day'
        GROUP BY date_trunc('day', created_at)
      ) AS cr ON cr.day = gs.day
      ORDER BY gs.day ASC;
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

  async getDailyRoutineSummary(tenantId: string) {
    const now = new Date();
    const today = now.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

    const [totalItems, completedItems, lateItems, overdueByUser, onTimeByUser] = await Promise.all([
      this.prisma.dailyRoutineItem.count({
        where: { tenantId, isActive: true },
      }),
      this.prisma.dailyRoutineLog.count({
        where: { tenantId, date: today, isCompleted: true },
      }),
      this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) AS count
        FROM daily_routine_logs drl
        JOIN daily_routine_items dri ON drl.routine_item_id = dri.id
        WHERE drl.tenant_id = ${tenantId}
          AND drl.date = ${today}
          AND drl.is_completed = true
          AND dri.scheduled_time IS NOT NULL
          AND (drl.completed_at AT TIME ZONE 'America/Sao_Paulo')::time > dri.scheduled_time::time
      `,
      this.prisma.$queryRaw<Array<{
        tenant_user_id: string;
        user_name: string;
        overdue_count: bigint;
      }>>`
        SELECT
          dri.assigned_tenant_user_id AS tenant_user_id,
          u.name AS user_name,
          COUNT(*) AS overdue_count
        FROM daily_routine_items dri
        JOIN tenant_users tu ON dri.assigned_tenant_user_id = tu.id
        JOIN users u ON tu.user_id = u.id
        LEFT JOIN daily_routine_logs drl
          ON drl.routine_item_id = dri.id
          AND drl.date = ${today}
          AND drl.is_completed = true
        WHERE dri.tenant_id = ${tenantId}
          AND dri.is_active = true
          AND drl.id IS NULL
        GROUP BY dri.assigned_tenant_user_id, u.name
        ORDER BY overdue_count DESC
      `,
      this.prisma.$queryRaw<Array<{
        tenant_user_id: string;
        user_name: string;
        total_items: bigint;
        completed_items: bigint;
        on_time_items: bigint;
        late_items: bigint;
      }>>`
        SELECT
          dri.assigned_tenant_user_id AS tenant_user_id,
          u.name AS user_name,
          COUNT(*) AS total_items,
          COUNT(drl.id) FILTER (WHERE drl.is_completed = true) AS completed_items,
          COUNT(drl.id) FILTER (
            WHERE drl.is_completed = true
            AND dri.scheduled_time IS NOT NULL
            AND (drl.completed_at AT TIME ZONE 'America/Sao_Paulo')::time <= dri.scheduled_time::time
          ) AS on_time_items,
          COUNT(drl.id) FILTER (
            WHERE drl.is_completed = true
            AND dri.scheduled_time IS NOT NULL
            AND (drl.completed_at AT TIME ZONE 'America/Sao_Paulo')::time > dri.scheduled_time::time
          ) AS late_items
        FROM daily_routine_items dri
        JOIN tenant_users tu ON dri.assigned_tenant_user_id = tu.id
        JOIN users u ON tu.user_id = u.id
        LEFT JOIN daily_routine_logs drl
          ON drl.routine_item_id = dri.id
          AND drl.date = ${today}
        WHERE dri.tenant_id = ${tenantId}
          AND dri.is_active = true
        GROUP BY dri.assigned_tenant_user_id, u.name
        ORDER BY user_name ASC
      `,
    ]);

    const lateCount = Number(lateItems[0]?.count ?? 0);
    const completionPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    return {
      totalItems,
      completedItems,
      lateItems: lateCount,
      completionPercentage,
      usersWithOverdueTasks: overdueByUser.map((row) => ({
        tenantUserId: row.tenant_user_id,
        userName: row.user_name,
        overdueCount: Number(row.overdue_count),
      })),
      usersOnTime: onTimeByUser.map((row) => ({
        tenantUserId: row.tenant_user_id,
        userName: row.user_name,
        totalItems: Number(row.total_items),
        completedItems: Number(row.completed_items),
        onTimeItems: Number(row.on_time_items),
        lateItems: Number(row.late_items),
      })),
    };
  }

  async getDailyRoutineItems(tenantId: string, userId?: string) {
    const today = new Date().toISOString().slice(0, 10);

    const where: any = { tenantId, isActive: true };
    if (userId) where.assignedTenantUserId = userId;

    const items = await this.prisma.dailyRoutineItem.findMany({
      where,
      include: {
        assignedTenantUser: {
          include: { user: { select: { name: true } } },
        },
        logs: {
          where: { date: today },
          select: { id: true, completedAt: true, isCompleted: true },
        },
      },
      orderBy: { scheduledTime: 'asc' },
    });

    return items.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      scheduledTime: item.scheduledTime,
      assignedTo: item.assignedTenantUser?.user?.name ?? 'Sem nome',
      assignedUserId: item.assignedTenantUserId,
      completedToday: item.logs.length > 0 && item.logs[0].isCompleted,
      completedAt: item.logs[0]?.completedAt ?? null,
    }));
  }
}
