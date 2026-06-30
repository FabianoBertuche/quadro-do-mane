import { Controller, Get, Patch, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';
import { RequestUser } from '../../common/interfaces/request-context.interface';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), TenantContextGuard, PermissionGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  @RequirePermissions('notifications.view')
  findAll(@CurrentUser() user: RequestUser) {
    return this.notificationsService.findAll(user.tenantId, user.tenantUserId);
  }

  @Get('unread-count')
  @RequirePermissions('notifications.view')
  unreadCount(@CurrentUser() user: RequestUser) {
    return this.notificationsService.getUnreadCount(user.tenantId, user.tenantUserId);
  }

  @Patch(':id/read')
  @RequirePermissions('notifications.view')
  markAsRead(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.notificationsService.markAsRead(tenantId, id);
  }

  @Patch('read-all')
  @RequirePermissions('notifications.view')
  markAllAsRead(@CurrentUser() user: RequestUser) {
    return this.notificationsService.markAllAsRead(user.tenantId, user.tenantUserId);
  }
}
