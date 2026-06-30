import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, tenantUserId: string) {
    return this.prisma.notification.findMany({
      where: { tenantId, tenantUserId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markAsRead(tenantId: string, id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(tenantId: string, tenantUserId: string) {
    return this.prisma.notification.updateMany({
      where: { tenantId, tenantUserId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async create(tenantId: string, tenantUserId: string, type: string, title: string, message: string, payloadJson?: string) {
    return this.prisma.notification.create({
      data: { tenantId, tenantUserId, type, title, message, payloadJson },
    });
  }

  async getUnreadCount(tenantId: string, tenantUserId: string) {
    return this.prisma.notification.count({
      where: { tenantId, tenantUserId, isRead: false },
    });
  }
}
