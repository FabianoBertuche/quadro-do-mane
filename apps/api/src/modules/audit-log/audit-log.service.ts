import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface AuditLogFilters {
  action?: string;
  actorUserId?: string;
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

  async findAll(tenantId: string) {
    return this.prisma.auditLog.findMany({
      where: { tenantId },
      include: { actor: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async findAllFiltered(
    tenantId: string,
    filters: AuditLogFilters = {},
  ) {
    const where: any = { tenantId };
    if (filters.action) where.action = filters.action;
    if (filters.actorUserId) where.actorUserId = filters.actorUserId;

    return this.prisma.auditLog.findMany({
      where,
      include: { actor: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: filters.take ?? 100,
    });
  }
}
