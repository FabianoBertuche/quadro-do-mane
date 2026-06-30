import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { UsersService, ActorContext } from './users.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-context.interface';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SetStatusDto } from './dto/set-status.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), TenantContextGuard, PermissionGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  private buildActor(user: RequestUser, req: Request): ActorContext {
    return {
      actorUserId: user.userId,
      tenantId: user.tenantId,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // Lista e detalhes
  // ────────────────────────────────────────────────────────────────────────

  @Get()
  @RequirePermissions('users.view')
  findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.usersService.findAll(tenantId);
  }

  /**
   * Retorna APENAS o próprio `TenantUser` do usuário logado.
   * Útil para colaboradores sem `users.view` (ex.: papel `colaborador`) que
   * precisam ver/editar o próprio card mesmo sem acesso à lista geral.
   */
  @Get('me/tenant-link')
  getMyTenantLink(@CurrentUser('userId') userId: string, @CurrentUser('tenantId') tenantId: string) {
    return this.usersService.findOwnTenantLink(userId, tenantId);
  }

  /**
   * Atualiza o próprio `TenantUser` do usuário logado.
   * Não exige `users.edit` — qualquer usuário pode manter o próprio
   * card. Não permite alterar role/status (auto-promoção proibida).
   * Campos aceitos: name, phone, avatarUrl, jobTitle, department.
   */
  @Patch('me/tenant-link')
  updateMyTenantLink(
    @CurrentUser('userId') userId: string,
    @CurrentUser('tenantId') tenantId: string,
    @Body() data: {
      name?: string;
      phone?: string | null;
      avatarUrl?: string | null;
      jobTitle?: string | null;
      department?: string | null;
    },
  ) {
    return this.usersService.updateOwnTenantLink(userId, tenantId, data);
  }

  @Get(':id')
  @RequirePermissions('users.view')
  findOne(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.usersService.findOne(tenantId, id);
  }

  @Get(':id/permissions')
  @RequirePermissions('users.view')
  permissions(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.usersService.getEffectivePermissions(tenantId, id);
  }

  // ────────────────────────────────────────────────────────────────────────
  // Perfil do próprio usuário
  // ────────────────────────────────────────────────────────────────────────

  @Patch('me')
  updateProfile(@CurrentUser() user: RequestUser, @Body() data: any) {
    const userId = user.userId || (user as any).sub;
    return this.usersService.updateProfile(userId, data);
  }

  // ────────────────────────────────────────────────────────────────────────
  // Troca de senha do próprio usuário
  // ────────────────────────────────────────────────────────────────────────

  @Patch('me/password')
  changeMyPassword(
    @CurrentUser('userId') userId: string,
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.usersService.changeMyPassword(userId, tenantId, dto);
  }

  // ────────────────────────────────────────────────────────────────────────
  // Comandos administrativos
  // ────────────────────────────────────────────────────────────────────────

  @Post()
  @RequirePermissions('users.create')
  create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser() actor: RequestUser,
    @Req() req: Request,
    @Body() dto: CreateUserDto,
  ) {
    return this.usersService.create(
      tenantId,
      dto,
      this.buildActor(actor, req),
    );
  }

  @Patch(':id')
  @RequirePermissions('users.edit')
  update(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser() actor: RequestUser,
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(
      tenantId,
      id,
      dto,
      this.buildActor(actor, req),
    );
  }

  @Patch(':id/status')
  @RequirePermissions('users.disable')
  setStatus(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser() actor: RequestUser,
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: SetStatusDto,
  ) {
    return this.usersService.setStatus(
      tenantId,
      id,
      dto,
      this.buildActor(actor, req),
    );
  }

  @Patch(':id/role')
  @RequirePermissions('users.edit')
  assignRole(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser() actor: RequestUser,
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: AssignRoleDto,
  ) {
    return this.usersService.assignRole(
      tenantId,
      id,
      dto,
      this.buildActor(actor, req),
    );
  }
}
