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
   * Lista os registros de auditoria do tenant atual.
   * Suporta filtros simples: ?action=&actorUserId=&take= (default 100, max 500).
   */
  @Get()
  @RequirePermissions('audit.view')
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('action') action?: string,
    @Query('actorUserId') actorUserId?: string,
    @Query('take') take?: string,
  ) {
    const limit = Math.min(parseInt(take || '100', 10) || 100, 500);
    return this.audit.findAllFiltered(tenantId, { action, actorUserId, take: limit });
  }
}