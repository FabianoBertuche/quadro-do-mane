import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class ActivityLogService {
  constructor(private prisma: PrismaService) {}

  async log(params: {
    tenantId: string;
    actorTenantUserId?: string;
    entityType: string;
    entityId: string;
    action: string;
    oldValues?: Record<string, any>;
    newValues?: Record<string, any>;
  }) {
    return this.prisma.activityLog.create({
      data: {
        tenantId: params.tenantId,
        actorTenantUserId: params.actorTenantUserId,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        oldValuesJson: params.oldValues ? JSON.stringify(params.oldValues) : null,
        newValuesJson: params.newValues ? JSON.stringify(params.newValues) : null,
      },
    });
  }

  async findByEntity(tenantId: string, entityType: string, entityId: string) {
    return this.prisma.activityLog.findMany({
      where: { tenantId, entityType, entityId },
      include: { actor: { include: { user: { select: { name: true, avatarUrl: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async findRecent(tenantId: string, limit = 20) {
    return this.prisma.activityLog.findMany({
      where: { tenantId },
      include: { actor: { include: { user: { select: { name: true, avatarUrl: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async findFiltered(
    tenantId: string,
    filters: {
      entityType?: string;
      action?: string;
      startDate?: string;
      endDate?: string;
      actorTenantUserId?: string;
      take?: number;
    } = {},
  ) {
    const where: any = { tenantId };
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.action) where.action = { contains: filters.action, mode: 'insensitive' };
    if (filters.actorTenantUserId) where.actorTenantUserId = filters.actorTenantUserId;
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
}
