import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { RequestUser } from '../interfaces/request-context.interface';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as RequestUser;

    if (!user || !user.permissions) {
      throw new ForbiddenException('Sem permissões carregadas');
    }

    // Admin always passes
    if (user.roleName === 'admin') {
      return true;
    }

    // Fast path: check JWT permissions snapshot
    const hasInJwt = requiredPermissions.every((perm) => user.permissions.includes(perm));
    if (hasInJwt) {
      return true;
    }

    // JWT is stale — load fresh permissions from database
    try {
      // Step 1: Try direct lookup by roleId (may be UUID or slug)
      let freshRolePermissions = await this.prisma.rolePermission.findMany({
        where: { roleId: user.roleId },
        include: { permission: { select: { code: true } } },
      });

      // Step 2: If no results, the roleId might be a slug — resolve the actual UUID via roleName
      if (freshRolePermissions.length === 0 && user.roleName) {
        const role = await this.prisma.role.findFirst({
          where: { name: user.roleName },
          select: { id: true },
        });

        if (role) {
          freshRolePermissions = await this.prisma.rolePermission.findMany({
            where: { roleId: role.id },
            include: { permission: { select: { code: true } } },
          });
        }
      }

      const freshCodes = freshRolePermissions.map((rp) => rp.permission.code);

      const hasFresh = requiredPermissions.every((perm) => freshCodes.includes(perm));

      if (hasFresh) {
        // Update in-memory permissions for downstream guards/middleware
        user.permissions = freshCodes;
        this.logger.debug(
          `Refreshed permissions from DB for user ${user.userId} (stale JWT)`,
        );
        return true;
      }
    } catch (err) {
      this.logger.warn(
        `Failed to refresh permissions from DB: ${(err as Error).message}`,
      );
    }

    throw new ForbiddenException('Permissão insuficiente');
  }
}
