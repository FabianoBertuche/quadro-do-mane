import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

interface UserActivity {
  tenantUserId: string;
  tenantId: string;
  lastActivity: Date;
  ip: string;
}

@Injectable()
export class UserActivityService {
  private activities = new Map<string, UserActivity>();

  constructor(private prisma: PrismaService) {}

  trackActivity(tenantUserId: string, tenantId: string, ip: string) {
    this.activities.set(tenantUserId, {
      tenantUserId,
      tenantId,
      lastActivity: new Date(),
      ip,
    });
  }

  async getActiveUsers(tenantId: string, inactiveThresholdMinutes = 10) {
    const now = new Date();
    const thresholdMs = inactiveThresholdMinutes * 60 * 1000;

    const result: Array<{
      tenantUserId: string;
      lastActivity: Date;
      isActive: boolean;
      ip: string;
      userName: string;
    }> = [];

    const tenantUserIds = Array.from(this.activities.values())
      .filter((a) => a.tenantId === tenantId)
      .map((a) => a.tenantUserId);

    const nameMap = new Map<string, string>();
    if (tenantUserIds.length > 0) {
      const tenantUsers = await this.prisma.tenantUser.findMany({
        where: { id: { in: tenantUserIds } },
        include: { user: { select: { name: true } } },
      });
      for (const tu of tenantUsers) {
        nameMap.set(tu.id, tu.user?.name || 'Usuário');
      }
    }

    this.activities.forEach((activity) => {
      if (activity.tenantId === tenantId) {
        const timeSinceActivity = now.getTime() - activity.lastActivity.getTime();
        result.push({
          tenantUserId: activity.tenantUserId,
          lastActivity: activity.lastActivity,
          isActive: timeSinceActivity < thresholdMs,
          ip: activity.ip,
          userName: nameMap.get(activity.tenantUserId) || 'Usuário',
        });
      }
    });

    return result.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
  }

  removeUser(tenantUserId: string) {
    this.activities.delete(tenantUserId);
  }
}
