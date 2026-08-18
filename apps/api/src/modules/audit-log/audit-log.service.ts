import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface AuditLogFilters {
  action?: string;
  actorUserId?: string;
  startDate?: string;
  endDate?: string;
  targetType?: string;
  take?: number;
}

@Injectable()
export class AuditLogService {
  constructor(private prisma: PrismaService) {}

  async log(params: {
    tenantId?: string;
    actorUserId?: string;
    action: string;
    targetType?: string;
    targetId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }) {
    return this.prisma.auditLog.create({
      data: {
        tenantId: params.tenantId,
        actorUserId: params.actorUserId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        metadataJson: params.metadata ? JSON.stringify(params.metadata) : null,
      },
    });
  }

  async findAllFiltered(
    tenantId: string,
    filters: AuditLogFilters = {},
  ) {
    const where: any = { tenantId };
    if (filters.action) where.action = { contains: filters.action, mode: 'insensitive' };
    if (filters.actorUserId) where.actorUserId = filters.actorUserId;
    if (filters.targetType) where.targetType = filters.targetType;
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    return this.prisma.auditLog.findMany({
      where,
      include: { actor: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
      take: filters.take ?? 200,
    });
  }

  async findActivityLogs(
    tenantId: string,
    filters: AuditLogFilters = {},
  ) {
    const where: any = { tenantId };
    if (filters.action) where.action = { contains: filters.action, mode: 'insensitive' };
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    return this.prisma.activityLog.findMany({
      where,
      include: {
        actor: {
          include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: filters.take ?? 200,
    });
  }

  async findLoginAttempts(
    tenantId: string,
    filters: AuditLogFilters = {},
  ) {
    const where: any = {};
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    if (filters.actorUserId) {
      const user = await this.prisma.user.findUnique({
        where: { id: filters.actorUserId },
        select: { email: true },
      });
      if (user) {
        where.email = user.email;
      } else {
        return [];
      }
    }

    return this.prisma.loginAttempt.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters.take ?? 200,
    });
  }

  async getUnifiedTimeline(
    tenantId: string,
    filters: AuditLogFilters = {},
  ) {
    const [auditLogs, activityLogs, loginAttempts] = await Promise.all([
      this.findAllFiltered(tenantId, { ...filters, take: filters.take ?? 100 }),
      this.findActivityLogs(tenantId, { ...filters, take: filters.take ?? 100 }),
      this.findLoginAttempts(tenantId, { ...filters, take: filters.take ?? 100 }),
    ]);

    const entries = [
      ...auditLogs.map((log) => ({
        id: log.id,
        type: 'audit' as const,
        timestamp: log.createdAt.toISOString(),
        action: log.action,
        actorName: log.actor?.name ?? null,
        actorEmail: log.actor?.email ?? null,
        actorAvatar: log.actor?.avatarUrl ?? null,
        targetType: log.targetType ?? null,
        targetId: log.targetId ?? null,
        ipAddress: log.ipAddress ?? null,
        metadata: log.metadataJson ?? null,
      })),
      ...activityLogs.map((log) => ({
        id: log.id,
        type: 'activity' as const,
        timestamp: log.createdAt.toISOString(),
        action: log.action,
        actorName: log.actor?.user?.name ?? null,
        actorEmail: log.actor?.user?.email ?? null,
        actorAvatar: log.actor?.user?.avatarUrl ?? null,
        targetType: log.entityType ?? null,
        targetId: log.entityId ?? null,
        ipAddress: null as string | null,
        metadata: log.newValuesJson ?? log.oldValuesJson ?? null,
      })),
      ...loginAttempts.map((log) => ({
        id: log.id,
        type: 'login' as const,
        timestamp: log.createdAt.toISOString(),
        action: log.success ? 'auth.login.success' : 'auth.login.failed',
        actorName: log.email,
        actorEmail: log.email,
        actorAvatar: null as string | null,
        targetType: 'LoginAttempt' as const,
        targetId: null as string | null,
        ipAddress: log.ipAddress ?? null,
        metadata: log.reason ? JSON.stringify({ reason: log.reason }) : null,
      })),
    ];

    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return entries.slice(0, filters.take ?? 200);
  }
}
