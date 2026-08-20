import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { UserActivityService } from '../../modules/dashboard/user-activity.service';

@Injectable()
export class ActivityTrackingMiddleware implements NestMiddleware {
  constructor(private readonly activityService: UserActivityService) {}

  use(req: Request, _res: Response, next: NextFunction) {
    const user = (req as any).user;
    if (user?.tenantUserId && user?.tenantId) {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      this.activityService.trackActivity(user.tenantUserId, user.tenantId, ip);
    }
    next();
  }
}
