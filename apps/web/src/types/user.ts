/**
 * Tipos do domínio de usuários e permissões — espelham o backend NestJS.
 * Mantenha em sincronia com:
 *   - apps/api/prisma/schema.prisma
 *   - apps/api/src/modules/users/users.service.ts
 */

export type TenantUserStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED';

export interface RoleLite {
  id: string;
  name: string;
  description?: string | null;
  isSystemRole?: boolean;
}

export interface TeamLite {
  id: string;
  name: string;
  color?: string | null;
}

export interface UserLite {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  phone?: string | null;
  isActive?: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
}

/**
 * Vínculo usuário ↔ tenant retornado por GET /api/users.
 * Inclui role, equipes e dados mínimos do User.
 */
export interface TenantUserCard {
  id: string;            // tenantUserId
  tenantId: string;
  userId: string;
  roleId: string | null;
  jobTitle: string | null;
  department: string | null;
  isActive: boolean;
  status: TenantUserStatus;
  mustChangePassword: boolean;
  lastInviteAt: string | null;
  disabledAt: string | null;
  disabledReason: string | null;
  createdAt: string;
  updatedAt: string;
  user: UserLite;
  role: RoleLite | null;
  teamMemberships: { team: TeamLite }[];
}

/**
 * Detalhe retornado por GET /api/users/:id (com role.rolePermissions expandido).
 */
export interface TenantUserDetail extends TenantUserCard {
  user: UserLite;
  role:
    | (RoleLite & {
        rolePermissions: { permission: { code: string; module: string } }[];
      })
    | null;
}

/**
 * Permissões efetivas resolvidas por GET /api/users/:id/permissions.
 */
export interface EffectivePermissions {
  tenantUserId: string;
  roleId: string | null;
  roleName: string | null;
  isSystemRole: boolean;
  status: TenantUserStatus;
  isActive: boolean;
  permissions: string[];
}

/**
 * Item de auditoria retornado por GET /api/audit-log.
 */
export interface AuditLogEntry {
  id: string;
  tenantId?: string | null;
  actorUserId?: string | null;
  actor?: { id: string; name: string; email: string } | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadataJson?: string | null;
  createdAt: string;
}

// ────────────────────────────────────────────────────────────────────────
// Payloads de mutação
// ────────────────────────────────────────────────────────────────────────

export interface CreateUserPayload {
  name: string;
  email: string;
  phone?: string;
  password?: string;
  roleId?: string | null;
  jobTitle?: string;
  department?: string;
  sendInvite?: boolean;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  roleId?: string | null;
  jobTitle?: string;
  department?: string;
}

export interface SetStatusPayload {
  status: TenantUserStatus;
  reason?: string;
}

export interface AssignRolePayload {
  roleId: string | null;
}