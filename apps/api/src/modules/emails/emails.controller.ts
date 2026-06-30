import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { EmailsService } from './emails.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import {
  ReplyEmailDto,
  SendEmailDto,
  SetEmailPasswordDto,
  TestEmailConnectionDto,
  UpdateEmailTenantSettingsDto,
} from './dto';
import { EMAIL_DOMAIN_PRESETS } from './domain-presets';

@UseGuards(AuthGuard('jwt'), TenantContextGuard, PermissionGuard)
@Controller()
export class EmailsController {
  constructor(private readonly emailsService: EmailsService) {}

  // ─────────────────────────────────────────────────────────────────────
  // Presets de domínio (qualquer usuário autenticado pode consultar)
  // ─────────────────────────────────────────────────────────────────────
  @Get('email/domain-presets')
  @RequirePermissions('email.view')
  getDomainPresets() {
    return { presets: EMAIL_DOMAIN_PRESETS };
  }

  // ─────────────────────────────────────────────────────────────────────
  // Config do tenant (admin)
  // ─────────────────────────────────────────────────────────────────────
  @Get('email/tenant-settings')
  @RequirePermissions('email.view')
  getTenantSettings(@CurrentUser('tenantId') tenantId: string) {
    return this.emailsService.getTenantSettings(tenantId);
  }

  @Patch('email/tenant-settings')
  @RequirePermissions('email.admin')
  upsertTenantSettings(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('tenantUserId') tenantUserId: string,
    @Body() dto: UpdateEmailTenantSettingsDto,
  ) {
    return this.emailsService.upsertTenantSettings(tenantId, tenantUserId, dto);
  }

  // ─────────────────────────────────────────────────────────────────────
  // Senha do usuário (colaborador)
  // ─────────────────────────────────────────────────────────────────────
  @Get('emails/settings')
  @RequirePermissions('email.view')
  getMySettings(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('tenantUserId') tenantUserId: string,
  ) {
    return this.emailsService.getMySettingsSnapshot(tenantId, tenantUserId);
  }

  @Patch('emails/password')
  @RequirePermissions('email.view')
  setPassword(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('tenantUserId') tenantUserId: string,
    @Body() dto: SetEmailPasswordDto,
  ) {
    return this.emailsService.setUserPassword(tenantId, tenantUserId, dto);
  }

  @Post('emails/test-connection')
  @RequirePermissions('email.view')
  testConnection(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('tenantUserId') tenantUserId: string,
    @Body() dto: TestEmailConnectionDto,
  ) {
    return this.emailsService.testConnection(tenantId, tenantUserId, dto.password);
  }

  // ─────────────────────────────────────────────────────────────────────
  // Operações de e-mail
  // ─────────────────────────────────────────────────────────────────────
  @Get('emails/messages')
  @RequirePermissions('email.view')
  listMessages(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('tenantUserId') tenantUserId: string,
    @Query('folder') folder?: string,
  ) {
    return this.emailsService.listMessages(tenantId, tenantUserId, folder);
  }

  @Get('emails/messages/:uid')
  @RequirePermissions('email.view')
  getMessage(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('tenantUserId') tenantUserId: string,
    @Param('uid') uid: string,
  ) {
    return this.emailsService.getMessage(tenantId, tenantUserId, uid);
  }

  @Post('emails/send')
  @RequirePermissions('email.view')
  sendMessage(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('tenantUserId') tenantUserId: string,
    @Body() dto: SendEmailDto,
  ) {
    return this.emailsService.sendMessage(tenantId, tenantUserId, dto);
  }

  @Post('emails/reply')
  @RequirePermissions('email.view')
  replyMessage(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('tenantUserId') tenantUserId: string,
    @Body() dto: ReplyEmailDto,
  ) {
    return this.emailsService.replyMessage(tenantId, tenantUserId, dto);
  }
}
