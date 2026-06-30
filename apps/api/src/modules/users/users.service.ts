import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { TenantUserStatusEnum, SetStatusDto } from './dto/set-status.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

/**
 * Contexto do ator para registrar auditoria. Sempre que possível,
 * passa-se o `RequestUser` decodificado do JWT.
 */
export interface ActorContext {
  actorUserId: string;
  tenantId: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private audit: AuditLogService,
  ) {}

  private get bcryptRounds(): number {
    return this.config.get<number>('BCRYPT_ROUNDS', 12);
  }

  // ────────────────────────────────────────────────────────────────────────
  // Queries
  // ────────────────────────────────────────────────────────────────────────

  async findAll(tenantId: string, status?: TenantUserStatusEnum) {
    return this.prisma.tenantUser.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            phone: true,
            isActive: true,
            lastLoginAt: true,
          },
        },
        role: {
          select: { id: true, name: true, isSystemRole: true },
        },
        teamMemberships: {
          include: {
            team: { select: { id: true, name: true, color: true } },
          },
        },
      },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(tenantId: string, tenantUserId: string) {
    const tenantUser = await this.prisma.tenantUser.findFirst({
      where: { id: tenantUserId, tenantId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            avatarUrl: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
        role: {
          include: {
            rolePermissions: { include: { permission: true } },
          },
        },
        teamMemberships: {
          include: {
            team: { select: { id: true, name: true, color: true } },
          },
        },
      },
    });

    if (!tenantUser) {
      throw new NotFoundException('Colaborador não encontrado');
    }

    return tenantUser;
  }

  /**
   * Retorna o vínculo do próprio usuário autenticado com o tenant atual.
   * Não exige a permissão users.view — qualquer usuário pode consultar
   * o próprio card para edição do próprio perfil.
   */
  async findOwnTenantLink(userId: string, tenantId: string) {
    const tenantUser = await this.prisma.tenantUser.findFirst({
      where: { userId, tenantId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            avatarUrl: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
            isSystemRole: true,
          },
        },
        teamMemberships: {
          include: {
            team: { select: { id: true, name: true, color: true } },
          },
        },
      },
    });

    if (!tenantUser) {
      throw new NotFoundException(
        'Seu vínculo com este workspace não foi encontrado',
      );
    }

    return tenantUser;
  }

  async getEffectivePermissions(tenantId: string, tenantUserId: string) {
    const tu = await this.prisma.tenantUser.findFirst({
      where: { id: tenantUserId, tenantId },
      select: {
        id: true,
        status: true,
        isActive: true,
        role: {
          select: {
            id: true,
            name: true,
            isSystemRole: true,
            rolePermissions: { select: { permission: { select: { code: true, module: true } } } },
          },
        },
      },
    });

    if (!tu) throw new NotFoundException('Colaborador não encontrado');

    const codes = tu.role?.rolePermissions.map((rp) => rp.permission.code) ?? [];
    return {
      tenantUserId: tu.id,
      roleId: tu.role?.id ?? null,
      roleName: tu.role?.name ?? null,
      isSystemRole: tu.role?.isSystemRole ?? false,
      status: tu.status,
      isActive: tu.isActive,
      permissions: codes,
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // Comandos
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Cria um usuário (se não existir pelo e-mail) e o vincula ao tenant
   * com a role informada. Status inicial: ACTIVE (senha definida) ou
   * INVITED (sem senha, fluxo de convite posterior).
   */
  async create(tenantId: string, dto: CreateUserDto, actor: ActorContext) {
    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, this.bcryptRounds)
      : null;

    // 1. Garantir User existente (escopo global)
    let user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      if (!passwordHash) {
        throw new BadRequestException(
          'Senha provisória é obrigatória para criar um novo usuário do zero',
        );
      }
      user = await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          phone: dto.phone,
          passwordHash,
        },
      });
    }

    // 2. Validar duplicidade no tenant
    const existingLink = await this.prisma.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId, userId: user.id } },
    });
    if (existingLink) {
      throw new ConflictException('Usuário já faz parte desta empresa');
    }

    // 3. Validar role (se informada) pertence ao tenant ou é global.
    // Aceita tanto o id (uuid) quanto o name (legado do seed inicial).
    let resolvedRoleId: string | null = null;
    if (dto.roleId) {
      const role = await this.prisma.role.findFirst({
        where: {
          OR: [
            { id: dto.roleId, tenantId },
            { id: dto.roleId, tenantId: null },
            { name: dto.roleId, tenantId },
            { name: dto.roleId, tenantId: null },
          ],
        },
      });
      if (!role) throw new BadRequestException('Função inválida para este tenant');
      resolvedRoleId = role.id;
    }

    // 4. Criar vínculo
    const inviteMode = dto.sendInvite || !passwordHash;
    const tenantUser = await this.prisma.tenantUser.create({
      data: {
        tenantId,
        userId: user.id,
        roleId: resolvedRoleId,
        jobTitle: dto.jobTitle,
        department: dto.department,
        isActive: !inviteMode,
        status: inviteMode ? 'INVITED' : 'ACTIVE',
        mustChangePassword: !passwordHash,
        lastInviteAt: inviteMode ? new Date() : null,
      },
      include: { user: true, role: true },
    });

    await this.audit.log({
      tenantId,
      actorUserId: actor.actorUserId,
      action: 'user.create',
      targetType: 'TenantUser',
      targetId: tenantUser.id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      metadata: {
        email: user.email,
        roleId: dto.roleId ?? null,
        inviteMode,
      },
    });

    return tenantUser;
  }

  async update(
    tenantId: string,
    tenantUserId: string,
    dto: UpdateUserDto,
    actor: ActorContext,
  ) {
    const tenantUser = await this.prisma.tenantUser.findFirst({
      where: { id: tenantUserId, tenantId },
      include: { user: true, role: true },
    });
    if (!tenantUser) throw new NotFoundException('Colaborador não encontrado');

    // Bloquear admin do tenant de remover a própria role (autoescudo).
    if (
      actor.actorUserId === tenantUser.userId &&
      dto.roleId !== undefined &&
      dto.roleId !== tenantUser.roleId
    ) {
      throw new ForbiddenException('Você não pode alterar sua própria função');
    }

    const userPatch: Record<string, any> = {};
    if (dto.name !== undefined) userPatch.name = dto.name;
    if (dto.email !== undefined) userPatch.email = dto.email;
    if (dto.phone !== undefined) userPatch.phone = dto.phone;
    // IMPORTANTE: nunca aceitar string vazia como senha — isso sobrescreveria o hash
    // com bcrypt.hash('', ...) que é inutilizável para login. Só re-hashar se vier
    // string não-vazia com pelo menos 6 caracteres.
    let passwordChanged = false;
    if (typeof dto.password === 'string' && dto.password.length >= 6) {
      userPatch.passwordHash = await bcrypt.hash(dto.password, this.bcryptRounds);
      // mustChangePassword vive em TenantUser, não em User. Marcamos para
      // setar abaixo em tenantPatch. Isso evita PrismaClientValidationError
      // ao chamar prisma.user.update.
      passwordChanged = true;
    }

    if (Object.keys(userPatch).length > 0) {
      await this.prisma.user.update({
        where: { id: tenantUser.userId },
        data: userPatch,
      });
    }

    const tenantPatch: Record<string, any> = {};
    if (dto.jobTitle !== undefined) tenantPatch.jobTitle = dto.jobTitle;
    if (dto.department !== undefined) tenantPatch.department = dto.department;
    if (passwordChanged) tenantPatch.mustChangePassword = false;
    if (dto.roleId !== undefined) {
      if (dto.roleId === null) {
        tenantPatch.roleId = null;
      } else {
        const role = await this.prisma.role.findFirst({
          where: {
            OR: [
              { id: dto.roleId, tenantId },
              { id: dto.roleId, tenantId: null },
              { name: dto.roleId, tenantId },
              { name: dto.roleId, tenantId: null },
            ],
          },
        });
        if (!role) throw new BadRequestException('Função inválida para este tenant');
        tenantPatch.roleId = role.id;
      }
    }

    let updated = tenantUser;
    if (Object.keys(tenantPatch).length > 0) {
      updated = await this.prisma.tenantUser.update({
        where: { id: tenantUserId },
        data: tenantPatch,
        include: { user: true, role: true },
      });
    }

    await this.audit.log({
      tenantId,
      actorUserId: actor.actorUserId,
      action: 'user.update',
      targetType: 'TenantUser',
      targetId: tenantUserId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      metadata: {
        userFields: Object.keys(userPatch),
        tenantFields: Object.keys(tenantPatch),
        passwordChanged,
      },
    });

    return updated;
  }

  async setStatus(
    tenantId: string,
    tenantUserId: string,
    dto: SetStatusDto,
    actor: ActorContext,
  ) {
    const tenantUser = await this.prisma.tenantUser.findFirst({
      where: { id: tenantUserId, tenantId },
      select: { id: true, userId: true, status: true, isActive: true },
    });
    if (!tenantUser) throw new NotFoundException('Colaborador não encontrado');

    // Auto-proteção: admin não pode desativar a si mesmo
    if (
      actor.actorUserId === tenantUser.userId &&
      dto.status !== TenantUserStatusEnum.ACTIVE
    ) {
      throw new ForbiddenException('Você não pode desativar seu próprio usuário');
    }

    const now = new Date();
    const suspended = dto.status === TenantUserStatusEnum.SUSPENDED;
    const previousStatus =
      (tenantUser as any).status ??
      (tenantUser.isActive ? 'ACTIVE' : 'SUSPENDED');

    const updated = await this.prisma.tenantUser.update({
      where: { id: tenantUserId },
      data: {
        status: dto.status,
        isActive: dto.status === TenantUserStatusEnum.ACTIVE,
        disabledAt: suspended ? now : null,
        disabledReason: suspended ? dto.reason ?? null : null,
      },
      include: { user: true, role: true },
    });

    // Revoga refresh tokens ativos quando suspenso/invited para forçar novo login.
    if (dto.status !== TenantUserStatusEnum.ACTIVE) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: tenantUser.userId, tenantId, isRevoked: false },
        data: { isRevoked: true },
      });
    }

    await this.audit.log({
      tenantId,
      actorUserId: actor.actorUserId,
      action:
        dto.status === TenantUserStatusEnum.ACTIVE
          ? 'user.activate'
          : dto.status === TenantUserStatusEnum.SUSPENDED
          ? 'user.suspend'
          : 'user.invite',
      targetType: 'TenantUser',
      targetId: tenantUserId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      metadata: { previousStatus, newStatus: dto.status, reason: dto.reason ?? null },
    });

    return updated;
  }

  async assignRole(
    tenantId: string,
    tenantUserId: string,
    dto: AssignRoleDto,
    actor: ActorContext,
  ) {
    const tenantUser = await this.prisma.tenantUser.findFirst({
      where: { id: tenantUserId, tenantId },
      include: { role: true },
    });
    if (!tenantUser) throw new NotFoundException('Colaborador não encontrado');

    if (actor.actorUserId === tenantUser.userId) {
      throw new ForbiddenException('Você não pode alterar sua própria função');
    }

    let newRoleId: string | null = null;
    if (dto.roleId) {
      // Aceita tanto o id (uuid) quanto o name (legado do seed inicial).
      const role = await this.prisma.role.findFirst({
        where: {
          OR: [
            { id: dto.roleId, tenantId },
            { id: dto.roleId, tenantId: null },
            { name: dto.roleId, tenantId },
            { name: dto.roleId, tenantId: null },
          ],
        },
      });
      if (!role) throw new BadRequestException('Função inválida para este tenant');
      newRoleId = role.id;
    }

    const updated = await this.prisma.tenantUser.update({
      where: { id: tenantUserId },
      data: { roleId: newRoleId },
      include: { role: true, user: true },
    });

    await this.audit.log({
      tenantId,
      actorUserId: actor.actorUserId,
      action: 'user.role_change',
      targetType: 'TenantUser',
      targetId: tenantUserId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      metadata: {
        previousRoleId: tenantUser.roleId,
        previousRoleName: tenantUser.role?.name ?? null,
        newRoleId,
        newRoleName: updated.role?.name ?? null,
      },
    });

    return updated;
  }

  /**
   * Atualização de perfil do próprio usuário (sem alterar tenant/role).
   */
  async updateProfile(userId: string, data: any) {
    const updateData: Record<string, any> = {};
    if (data.name) updateData.name = data.name;
    if (data.phone) updateData.phone = data.phone;
    if (data.avatarUrl) updateData.avatarUrl = data.avatarUrl;

    // Senha é gerenciada EXCLUSIVAMENTE via /users/me/password (com validação
    // da senha atual). Bloquear aqui para evitar bypass de segurança.
    if (data.password) {
      throw new BadRequestException(
        'Para alterar a senha use o endpoint PATCH /users/me/password',
      );
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatarUrl: true,
      },
    });
  }

  /**
   * Troca de senha do próprio usuário.
   *
   * Fluxo de segurança:
   *  1. Valida `currentPassword` contra o `passwordHash` atual (bcrypt.compare).
   *  2. Garante que a nova senha é diferente da atual.
   *  3. Hash da nova senha com bcrypt.
   *  4. Persiste hash + limpa flag `mustChangePassword`.
   *  5. Revoga todos os refresh tokens ativos do usuário em TODOS os tenants
   *     para forçar re-login em outros dispositivos.
   *  6. Registra evento de auditoria `user.password_change`.
   */
  async changeMyPassword(userId: string, tenantId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // Bloqueia troca de senha se a conta nunca teve senha definida
    // (caso de convite com mustChangePassword).
    if (!user.passwordHash) {
      throw new BadRequestException(
        'Sua conta ainda não possui uma senha definida. Use o fluxo de convite para criar uma nova senha.',
      );
    }

    const currentMatches = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!currentMatches) {
      throw new BadRequestException('Senha atual incorreta');
    }

    const newHash = await bcrypt.hash(dto.newPassword, this.bcryptRounds);
    if (await bcrypt.compare(dto.newPassword, user.passwordHash)) {
      throw new BadRequestException('A nova senha deve ser diferente da senha atual');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
      select: { id: true },
    });

    // Limpa a flag mustChangePassword em todos os tenantUsers vinculados.
    await this.prisma.tenantUser.updateMany({
      where: { userId },
      data: { mustChangePassword: false },
    });

    // Revoga refresh tokens ativos do usuário em todos os tenants.
    // Isso força re-login em outros dispositivos após troca de senha.
    await this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });

    await this.audit.log({
      tenantId,
      actorUserId: userId,
      action: 'user.password_change',
      targetType: 'User',
      targetId: userId,
      metadata: {
        revokedTokens: true,
        source: 'self_service',
      },
    });

    return {
      ok: true,
      message:
        'Senha alterada com sucesso. Você precisará fazer login novamente em outros dispositivos.',
    };
  }

  /**
   * Atualiza os dados do próprio vínculo do usuário com o tenant atual.
   * Não exige users.edit — qualquer usuário pode manter o próprio perfil.
   * Não permite alterar roleId/status/isActive (auto-promoção proibida).
   */
  async updateOwnTenantLink(
    userId: string,
    tenantId: string,
    data: {
      name?: string;
      phone?: string | null;
      avatarUrl?: string | null;
      jobTitle?: string | null;
      department?: string | null;
    },
  ) {
    const tenantUser = await this.prisma.tenantUser.findFirst({
      where: { userId, tenantId },
    });
    if (!tenantUser) {
      throw new NotFoundException(
        'Seu vínculo com este workspace não foi encontrado',
      );
    }

    const userUpdate: Record<string, any> = {};
    if (data.name !== undefined) userUpdate.name = data.name;
    if (data.phone !== undefined) userUpdate.phone = data.phone;
    if (data.avatarUrl !== undefined) userUpdate.avatarUrl = data.avatarUrl;
    if (Object.keys(userUpdate).length > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: userUpdate,
      });
    }

    const tenantUserUpdate: Record<string, any> = {};
    if (data.jobTitle !== undefined) tenantUserUpdate.jobTitle = data.jobTitle;
    if (data.department !== undefined) tenantUserUpdate.department = data.department;
    if (Object.keys(tenantUserUpdate).length > 0) {
      await this.prisma.tenantUser.update({
        where: { id: tenantUser.id },
        data: tenantUserUpdate,
      });
    }

    return this.findOwnTenantLink(userId, tenantId);
  }
}
