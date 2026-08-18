import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ActivityLogService } from './activity-log.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';

@ApiTags('Activity Log')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), TenantContextGuard, PermissionGuard)
@Controller('activity-log')
export class ActivityLogController {
  constructor(private readonly activityLog: ActivityLogService) {}

  /**
   * Query activity logs with filters.
   * Filters: ?entityType=&action=&startDate=&endDate=&actorTenantUserId=&take=
   */
  @Get()
  @RequirePermissions('audit.view')
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('actorTenantUserId') actorTenantUserId?: string,
    @Query('take') take?: string,
  ) {
    const limit = Math.min(parseInt(take || '200', 10) || 200, 500);
    return this.activityLog.findFiltered(tenantId, {
      entityType, action, startDate, endDate, actorTenantUserId, take: limit,
    });
  }
}
