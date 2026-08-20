import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';
import { UserActivityService } from '../../modules/dashboard/user-activity.service';

@Injectable()
export class ActivityTrackingInterceptor implements NestInterceptor {
  constructor(private readonly activityService: UserActivityService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user;

    if (user?.tenantUserId && user?.tenantId) {
      const ip = request.ip || request.socket.remoteAddress || 'unknown';
      this.activityService.trackActivity(user.tenantUserId, user.tenantId, ip);
    }

    return next.handle();
  }
}
