import { Body, Controller, Get, Param, ParseEnumPipe, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';
import { RequestUser } from '../../common/interfaces/request-context.interface';
import {
  NOTIFICATION_CATEGORIES,
  NotificationCategoryName,
  NotificationPreferencesService,
} from './notification-preferences.service';
import { UpdateNotificationPreferenceDto } from './dto/update-notification-preference.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), TenantContextGuard, PermissionGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private notificationsService: NotificationsService,
    private preferencesService: NotificationPreferencesService,
  ) {}

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

  /** As seis categorias sempre presentes, na ordem do contrato. */
  @Get('notification-preferences')
  @RequirePermissions('notifications.view')
  listPreferences(@CurrentUser() user: RequestUser) {
    return this.preferencesService.listForUser(user.tenantId, user.tenantUserId);
  }

  /**
   * Alteração da categoria. Categoria travada pela empresa é conflito (409)
   * lançado pelo service — o lock é a única coisa que o usuário não decide.
   */
  @Patch('notification-preferences/:category')
  @RequirePermissions('notifications.view')
  updatePreference(
    @CurrentUser() user: RequestUser,
    @Param('category', new ParseEnumPipe(NOTIFICATION_CATEGORIES)) category: NotificationCategoryName,
    @Body() dto: UpdateNotificationPreferenceDto,
  ) {
    return this.preferencesService.updateByUser(
      user.tenantId,
      user.tenantUserId,
      category,
      dto.pushEnabled,
    );
  }

  @Patch(':id/read')
  @RequirePermissions('notifications.view')
  markAsRead(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.notificationsService.markAsRead(user.tenantId, user.tenantUserId, id);
  }

  @Patch('read-all')
  @RequirePermissions('notifications.view')
  markAllAsRead(@CurrentUser() user: RequestUser) {
    return this.notificationsService.markAllAsRead(user.tenantId, user.tenantUserId);
  }
}
