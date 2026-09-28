import { ConflictException, Injectable } from '@nestjs/common';
import { NotificationCategory } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/** Contrato de categorias da Central. A ordem é a exibida nas telas. */
export const NOTIFICATION_CATEGORIES = [
  'TASKS',
  'CALENDAR',
  'ROUTINE',
  'COLLABORATION',
  'PROJECTS_TEAMS',
  'SECURITY',
] as const;

export type NotificationCategoryName = (typeof NOTIFICATION_CATEGORIES)[number];

export type PreferenceView = {
  category: NotificationCategoryName;
  pushEnabled: boolean;
  lockedByAdmin: boolean;
};

/** Estado antes/depois gravado na auditoria imutável. */
type PreferenceState = { pushEnabled: boolean; lockedByAdmin: boolean };

const DEFAULT_STATE: PreferenceState = { pushEnabled: true, lockedByAdmin: false };

const stateOf = (row?: { pushEnabled?: boolean; lockedByAdmin?: boolean } | null): PreferenceState => ({
  pushEnabled: row?.pushEnabled ?? DEFAULT_STATE.pushEnabled,
  lockedByAdmin: row?.lockedByAdmin ?? DEFAULT_STATE.lockedByAdmin,
});

/**
 * Política única de preferências de notificação: defaults, lock administrativo e
 * auditoria imutável de cada mudança. O lock governs apenas push — a Central
 * recebe todos os alertas.
 */
@Injectable()
export class NotificationPreferencesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Preferências efetivas do usuário: as seis categorias sempre presentes, na
   * ordem do contrato, com as linhas gravadas sobreporem o default
   * (habilitado e destravado).
   */
  async listForUser(tenantId: string, tenantUserId: string): Promise<PreferenceView[]> {
    const stored = await this.prisma.notificationPreference.findMany({
      where: { tenantId, tenantUserId },
      select: { category: true, pushEnabled: true, lockedByAdmin: true },
    });
    const byCategory = new Map(stored.map((row) => [row.category, row]));
    return NOTIFICATION_CATEGORIES.map((category) => {
      const state = stateOf(byCategory.get(category));
      return { category, ...state };
    });
  }

  /** Push habilitado para a categoria; ausência de linha significa habilitado. */
  async isPushEnabled(
    _tenantId: string,
    tenantUserId: string,
    category: NotificationCategoryName,
  ): Promise<boolean> {
    const row = await this.prisma.notificationPreference.findUnique({
      where: { tenantUserId_category: { tenantUserId, category } },
      select: { pushEnabled: true },
    });
    return row?.pushEnabled ?? DEFAULT_STATE.pushEnabled;
  }

  /**
   * Alteração pelo próprio usuário. Categoria travada pelo admin é conflito
   * (409) e nada é gravado. O usuário nunca altera o lock.
   */
  async updateByUser(
    tenantId: string,
    tenantUserId: string,
    category: NotificationCategoryName,
    pushEnabled: boolean,
  ) {
    const current = await this.prisma.notificationPreference.findUnique({
      where: { tenantUserId_category: { tenantUserId, category } },
    });
    if (current?.lockedByAdmin) {
      throw new ConflictException(
        'Esta categoria é gerenciada pela empresa e não pode ser alterada.',
      );
    }

    const saved = await this.prisma.notificationPreference.upsert({
      where: { tenantUserId_category: { tenantUserId, category } },
      create: { tenantId, tenantUserId, category, pushEnabled, updatedByTenantUserId: tenantUserId },
      update: { pushEnabled, updatedByTenantUserId: tenantUserId },
    });
    await this.audit(saved.id, tenantUserId, 'USER', stateOf(current), {
      ...stateOf(current),
      pushEnabled,
    });
    return saved;
  }

  /**
   * Alteração administrativa: define estado e lock juntos. Destravar mantém o
   * valor escolhido pelo admin como estado atual, e devolve o controle da
   * categoria ao usuário.
   */
  async updateByAdmin(
    tenantId: string,
    tenantUserId: string,
    category: NotificationCategoryName,
    pushEnabled: boolean,
    lockedByAdmin: boolean,
    adminTenantUserId: string,
  ) {
    const current = await this.prisma.notificationPreference.findUnique({
      where: { tenantUserId_category: { tenantUserId, category } },
    });

    const saved = await this.prisma.notificationPreference.upsert({
      where: { tenantUserId_category: { tenantUserId, category } },
      create: {
        tenantId,
        tenantUserId,
        category,
        pushEnabled,
        lockedByAdmin,
        updatedByTenantUserId: adminTenantUserId,
      },
      update: { pushEnabled, lockedByAdmin, updatedByTenantUserId: adminTenantUserId },
    });
    await this.audit(saved.id, adminTenantUserId, 'ADMIN', stateOf(current), {
      pushEnabled,
      lockedByAdmin,
    });
    return saved;
  }

  /** Registro imutável da mudança: quem, por qual porta e de qual estado para qual. */
  private async audit(
    notificationPreferenceId: string,
    actorTenantUserId: string,
    source: 'USER' | 'ADMIN',
    previous: PreferenceState,
    next: PreferenceState,
  ) {
    return this.prisma.notificationPreferenceAudit.create({
      data: {
        notificationPreferenceId,
        actorTenantUserId,
        source,
        previousValueJson: JSON.stringify(previous),
        nextValueJson: JSON.stringify(next),
      },
    });
  }
}
