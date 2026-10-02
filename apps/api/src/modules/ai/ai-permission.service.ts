import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PermissionCode } from './tools/permission-codes';

export const AI_PERMISSION_SERVICE = Symbol('AI_PERMISSION_SERVICE');

interface ResolvedRole {
  name: string | null;
  codes: readonly string[];
}

/**
 * Permissões do ator para o assistente.
 *
 * Espelha `PermissionGuard`: apenas `admin` ignora a checagem. Os demais papéis
 * passam somente com o código no conjunto, sem bypass. Uma consulta no caminho
 * frio, nenhuma no quente, porque a resolução é memoizada por usuário.
 */
@Injectable()
export class AiPermissionService {
  private readonly cache = new Map<string, ResolvedRole>();

  constructor(private readonly prisma: PrismaService) {}

  private async roleFor(input: { tenantId: string; tenantUserId: string }): Promise<ResolvedRole> {
    const key = `${input.tenantId}:${input.tenantUserId}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const tenantUser = await this.prisma.tenantUser.findFirst({
      where: { id: input.tenantUserId, tenantId: input.tenantId },
      select: {
        role: {
          select: {
            name: true,
            rolePermissions: { select: { permission: { select: { code: true } } } },
          },
        },
      },
    });
    const role = tenantUser?.role;
    const resolved: ResolvedRole = {
      name: role?.name ?? null,
      codes: (role?.rolePermissions ?? []).map((item: any) => item.permission.code as string),
    };
    this.cache.set(key, resolved);
    return resolved;
  }

  async codesFor(input: { tenantId: string; tenantUserId: string }): Promise<readonly string[]> {
    return (await this.roleFor(input)).codes;
  }

  async can(input: { tenantId: string; tenantUserId: string }, permission: PermissionCode): Promise<boolean> {
    const role = await this.roleFor(input);
    return role.name === 'admin' || role.codes.includes(permission);
  }

  invalidate(tenantId: string, tenantUserId: string): void {
    this.cache.delete(`${tenantId}:${tenantUserId}`);
  }
}
