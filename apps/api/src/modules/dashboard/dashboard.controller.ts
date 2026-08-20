import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { UserActivityService } from './user-activity.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), TenantContextGuard, PermissionGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(
    private dashboardService: DashboardService,
    private userActivityService: UserActivityService,
  ) {}

  @Get('overview')
  @RequirePermissions('dashboard.view')
  overview(@CurrentUser('tenantId') tenantId: string) {
    return this.dashboardService.getOverview(tenantId);
  }

  @Get('workload')
  @RequirePermissions('dashboard.view')
  workload(@CurrentUser('tenantId') tenantId: string) {
    return this.dashboardService.getWorkload(tenantId);
  }

  @Get('productivity')
  @RequirePermissions('dashboard.view')
  productivity(@CurrentUser('tenantId') tenantId: string) {
    return this.dashboardService.getProductivity(tenantId);
  }

  @Get('project-progress')
  @RequirePermissions('dashboard.view')
  projectProgress(@CurrentUser('tenantId') tenantId: string) {
    return this.dashboardService.getProjectProgress(tenantId);
  }

  @Get('daily-routine-summary')
  @RequirePermissions('dashboard.view')
  dailyRoutineSummary(@CurrentUser('tenantId') tenantId: string) {
    return this.dashboardService.getDailyRoutineSummary(tenantId);
  }

  @Get('daily-routine-items')
  @RequirePermissions('dashboard.view')
  dailyRoutineItems(
    @CurrentUser('tenantId') tenantId: string,
    @Query('userId') userId?: string,
  ) {
    return this.dashboardService.getDailyRoutineItems(tenantId, userId);
  }

  @Get('active-users')
  @RequirePermissions('dashboard.view')
  activeUsers(@CurrentUser('tenantId') tenantId: string) {
    return this.userActivityService.getActiveUsers(tenantId);
  }
}
