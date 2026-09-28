import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';
import { RequestUser } from '../../common/interfaces/request-context.interface';
import { NotificationAdminService } from '../notifications/notification-admin.service';
import {
  NOTIFICATION_CATEGORIES,
  NotificationCategoryName,
  NotificationPreferencesService,
} from '../notifications/notification-preferences.service';
import { UpdateAdminNotificationPreferenceDto } from '../notifications/dto/update-admin-notification-preference.dto';
import { NotificationDispatchQueryDto } from '../notifications/dto/notification-dispatch-query.dto';

/**
 * Administração das notificações da empresa: a política de push por pessoa, o
 * que cada mudança alterou e o ledger de entregas. `notifications.manage` é o
 * que separa esta porta da Central do usuário.
 */
@ApiTags('Notifications Admin')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), TenantContextGuard, PermissionGuard)
@Controller('admin')
export class NotificationAdminController {
  constructor(
    private adminService: NotificationAdminService,
    private preferencesService: NotificationPreferencesService,
  ) {}

  /** Preferências efetivas de todo o tenant, com a identidade de cada destinatário. */
  @Get('notification-preferences')
  @RequirePermissions('notifications.manage')
  listPreferences(@CurrentUser() user: RequestUser) {
    return this.adminService.listPreferences(user.tenantId);
  }

  /**
   * Política da empresa sobre uma pessoa. O alvo vem da URL; o autor da
   * auditoria é o admin autenticado, nunca o `:tenantUserId`.
   */
  @Patch('notification-preferences/:tenantUserId/:category')
  @RequirePermissions('notifications.manage')
  updatePreference(
    @CurrentUser() user: RequestUser,
    @Param('tenantUserId') tenantUserId: string,
    @Param('category', new ParseEnumPipe(NOTIFICATION_CATEGORIES)) category: NotificationCategoryName,
    @Body() dto: UpdateAdminNotificationPreferenceDto,
  ) {
    return this.preferencesService.updateByAdmin(
      user.tenantId,
      tenantUserId,
      category,
      dto.pushEnabled,
      dto.lockedByAdmin,
      user.tenantUserId,
    );
  }

  @Get('notification-preferences/:tenantUserId/history')
  @RequirePermissions('notifications.manage')
  history(@CurrentUser() user: RequestUser, @Param('tenantUserId') tenantUserId: string) {
    return this.adminService.history(user.tenantId, tenantUserId);
  }

  /** Ledger de entregas para investigação de push. Filtros todos opcionais. */
  @Get('notification-dispatches')
  @RequirePermissions('notifications.manage')
  listDispatches(@CurrentUser() user: RequestUser, @Query() query: NotificationDispatchQueryDto) {
    return this.adminService.listDispatches(user.tenantId, query);
  }
}
