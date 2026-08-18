import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditLogService } from './audit-log.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), TenantContextGuard, PermissionGuard)
@Controller('audit-log')
export class AuditLogController {
  constructor(private readonly audit: AuditLogService) {}

  /**
   * Unified timeline: all system activity (audit + activity + login attempts).
   * Filters: ?action=&actorUserId=&startDate=&endDate=&targetType=&take=
   */
  @Get('timeline')
  @RequirePermissions('audit.view')
  getTimeline(
    @CurrentUser('tenantId') tenantId: string,
    @Query('action') action?: string,
    @Query('actorUserId') actorUserId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('targetType') targetType?: string,
    @Query('take') take?: string,
  ) {
    const limit = Math.min(parseInt(take || '200', 10) || 200, 500);
    return this.audit.getUnifiedTimeline(tenantId, {
      action, actorUserId, startDate, endDate, targetType, take: limit,
    });
  }

  /**
   * Audit logs only (security events).
   */
  @Get()
  @RequirePermissions('audit.view')
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('action') action?: string,
    @Query('actorUserId') actorUserId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('targetType') targetType?: string,
    @Query('take') take?: string,
  ) {
    const limit = Math.min(parseInt(take || '200', 10) || 200, 500);
    return this.audit.findAllFiltered(tenantId, {
      action, actorUserId, startDate, endDate, targetType, take: limit,
    });
  }

  /**
   * Activity logs only (operational changes).
   */
  @Get('activity')
  @RequirePermissions('audit.view')
  findActivity(
    @CurrentUser('tenantId') tenantId: string,
    @Query('action') action?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('take') take?: string,
  ) {
    const limit = Math.min(parseInt(take || '200', 10) || 200, 500);
    return this.audit.findActivityLogs(tenantId, {
      action, startDate, endDate, take: limit,
    });
  }

  /**
   * Login attempts only.
   */
  @Get('logins')
  @RequirePermissions('audit.view')
  findLogins(
    @CurrentUser('tenantId') tenantId: string,
    @Query('actorUserId') actorUserId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('take') take?: string,
  ) {
    const limit = Math.min(parseInt(take || '200', 10) || 200, 500);
    return this.audit.findLoginAttempts(tenantId, {
      actorUserId, startDate, endDate, take: limit,
    });
  }
}
