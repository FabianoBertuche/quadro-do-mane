import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { RedisService } from '../../common/redis/redis.service';
import { LoginDto } from './dto/login.dto';
import { SelectTenantDto } from './dto/select-tenant.dto';

export interface AuthRequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    private encryption: EncryptionService,
    private redis: RedisService,
  ) {}

  async login(dto: LoginDto, meta: AuthRequestMeta = {}) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    await this.recordLoginAttempt(dto.email, meta, !!user);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tenantUsers = await this.prisma.tenantUser.findMany({
      where: {
        userId: user.id,
        isActive: true,
        // Bloqueia login em vínculos suspensos ou ainda não confirmados.
        status: { in: ['ACTIVE'] },
      },
      include: { tenant: true },
    });

    if (tenantUsers.length === 0) {
      throw new UnauthorizedException('Usuário não vinculado a nenhuma empresa');
    }

    if (tenantUsers.length === 1) {
      return this.issueTenantSession(user.id, tenantUsers[0], meta);
    }

    const preAuthToken = this.jwtService.sign(
      { sub: user.id, type: 'pre-auth' },
      { expiresIn: '5m' },
    );

    return {
      requiresTenantSelection: true,
      preAuthToken,
      tenants: tenantUsers.map((tu) => ({
        id: tu.tenant.id,
        name: tu.tenant.name,
        slug: tu.tenant.slug,
      })),
    };
  }

  async selectTenant(userId: string, dto: SelectTenantDto, meta: AuthRequestMeta = {}) {
    const tenantUser = await this.prisma.tenantUser.findFirst({
      where: {
        userId,
        tenantId: dto.tenantId,
        isActive: true,
        status: { in: ['ACTIVE'] },
      },
      include: { tenant: true },
    });

    if (!tenantUser) {
      throw new UnauthorizedException('Acesso negado a este tenant');
    }

    return this.issueTenantSession(userId, tenantUser, meta);
  }

  /**
   * Refresh com rotação + detecção de reuso:
   * - Se o refresh token existe e não está revogado → revoga o atual, emite novo par.
   * - Se o refresh token está revogado (reuso detectado) → revoga TODA a família.
   */
  async refreshToken(refreshToken: string, meta: AuthRequestMeta = {}) {
    const tokenHash = this.encryption.hash(refreshToken);

    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!existing || existing.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    if (existing.isRevoked) {
      // REUSO DETECTADO — provável roubo. Revoga todos os tokens da família.
      this.logger.warn(
        `Reuso de refresh token detectado (user=${existing.userId}, family=${existing.family}). ` +
          `Revogando família inteira.`,
      );
      await this.prisma.refreshToken.updateMany({
        where: { family: existing.family },
        data: { isRevoked: true },
      });
      // Auditoria
      await this.prisma.auditLog.create({
        data: {
          tenantId: existing.tenantId,
          actorUserId: existing.userId,
          action: 'REFRESH_TOKEN_REUSE_DETECTED',
          targetType: 'RefreshToken',
          targetId: existing.id,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          metadataJson: JSON.stringify({ family: existing.family }),
        },
      });
      throw new UnauthorizedException('Sessão comprometida. Faça login novamente.');
    }

    const tenantUser = await this.prisma.tenantUser.findFirst({
      where: {
        userId: existing.userId,
        tenantId: existing.tenantId,
        isActive: true,
        status: { in: ['ACTIVE'] },
      },
      include: {
        role: { include: { rolePermissions: { include: { permission: true } } } },
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        tenant: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!tenantUser) {
      throw new UnauthorizedException('Sessão inválida');
    }

    // Gera novo par de tokens e rotaciona
    const newPair = await this.issueTokens(tenantUser, existing.family, meta);

    // Revoga o token antigo e marca replacedById
    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { isRevoked: true, replacedById: newPair.refreshTokenRecordId },
    });

    return newPair.tokens;
  }

  async logout(userId: string, tenantId: string, accessToken: string | undefined) {
    // Revoga TODOS os refresh tokens ativos do usuário neste tenant
    await this.prisma.refreshToken.updateMany({
      where: { userId, tenantId, isRevoked: false },
      data: { isRevoked: true },
    });

    // Denylist o access token até sua expiração natural (tabela token_denylist)
    if (accessToken) {
      const ttlSeconds = this.parseTtl(this.config.get<string>('JWT_EXPIRES_IN', '15m'));
      if (ttlSeconds > 0) {
        await this.redis.denylist(
          `access:${this.encryption.hash(accessToken)}`,
          ttlSeconds,
          { userId, reason: 'logout' },
        );
      }
    }

    return { message: 'Logout realizado com sucesso' };
  }

  /** Revoga todos os refresh tokens do usuário em todos os tenants (logout global). */
  async logoutAll(userId: string) {
    const result = await this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
    return { revoked: result.count, message: 'Todas as sessões foram encerradas' };
  }

  async getProfile(userId: string, tenantId: string) {
    const tenantUser = await this.prisma.tenantUser.findFirst({
      where: {
        userId,
        tenantId,
        isActive: true,
        status: { in: ['ACTIVE'] },
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        role: { include: { rolePermissions: { include: { permission: true } } } },
        tenant: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!tenantUser) {
      throw new UnauthorizedException('Perfil não encontrado');
    }

    const permissions = tenantUser.role?.rolePermissions.map(
      (rp) => rp.permission.code,
    ) || [];

    return {
      user: tenantUser.user,
      tenant: tenantUser.tenant,
      tenantUserId: tenantUser.id,
      role: tenantUser.role?.name,
      jobTitle: tenantUser.jobTitle,
      department: tenantUser.department,
      permissions,
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // Internals
  // ────────────────────────────────────────────────────────────────────────

  private async issueTenantSession(userId: string, tenantUser: any, meta: AuthRequestMeta) {
    const tuWithRole = await this.prisma.tenantUser.findUnique({
      where: { id: tenantUser.id },
      include: {
        role: { include: { rolePermissions: { include: { permission: true } } } },
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        tenant: { select: { id: true, name: true, slug: true } },
      },
    });

    const permissions = tuWithRole?.role?.rolePermissions.map(
      (rp) => rp.permission.code,
    ) || [];

    const family = crypto.randomUUID();
    const pair = await this.issueTokens(tuWithRole, family, meta);

    return {
      accessToken: pair.tokens.accessToken,
      refreshToken: pair.tokens.refreshToken,
      user: tuWithRole?.user,
      tenant: tuWithRole?.tenant,
      permissions,
      role: tuWithRole?.role?.name,
    };
  }

  private async issueTokens(
    tenantUser: any,
    family: string,
    meta: AuthRequestMeta,
  ): Promise<{ tokens: { accessToken: string; refreshToken: string }; refreshTokenRecordId: string }> {
    const permissions = tenantUser.role?.rolePermissions?.map(
      (rp: any) => rp.permission.code,
    ) || [];

    const payload = {
      sub: tenantUser.userId,
      tenantId: tenantUser.tenantId,
      tenantUserId: tenantUser.id,
      roleId: tenantUser.roleId,
      roleName: tenantUser.role?.name,
      permissions,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.config.get<string>('JWT_EXPIRES_IN', '15m'),
    });

    const refreshToken = this.jwtService.sign(
      { sub: tenantUser.userId, tenantId: tenantUser.tenantId, family },
      {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
      },
    );

    const ttl = this.parseTtl(this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'));
    const expiresAt = new Date(Date.now() + ttl * 1000);

    const record = await this.prisma.refreshToken.create({
      data: {
        userId: tenantUser.userId,
        tenantId: tenantUser.tenantId,
        tokenHash: this.encryption.hash(refreshToken),
        family,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        expiresAt,
      },
    });

    return {
      tokens: { accessToken, refreshToken },
      refreshTokenRecordId: record.id,
    };
  }

  private async recordLoginAttempt(email: string, meta: AuthRequestMeta, userExists: boolean) {
    try {
      await this.prisma.loginAttempt.create({
        data: {
          email,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          success: userExists,
          reason: userExists ? null : 'user_not_found',
        },
      });
    } catch (err) {
      this.logger.warn(`Falha ao registrar LoginAttempt: ${(err as Error).message}`);
    }
  }

  /**
   * Converte strings como '15m', '7d', '1h', '3600s' para segundos.
   */
  private parseTtl(ttl: string): number {
    const m = /^(\d+)([smhd])?$/.exec(ttl.trim());
    if (!m) return 900; // fallback 15min
    const n = parseInt(m[1], 10);
    switch (m[2]) {
      case 's': return n;
      case 'm': return n * 60;
      case 'h': return n * 3600;
      case 'd': return n * 86400;
      default: return n; // assume segundos
    }
  }
}
