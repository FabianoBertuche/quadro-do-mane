import { Injectable } from '@nestjs/common';
import { NotificationPushStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { effectivePreferences, NotificationCategoryName } from './notification-preferences.service';

export type AdminPreferenceView = {
  tenantUserId: string;
  tenantUser: { name: string; email: string; avatarUrl: string | null };
} & { category: NotificationCategoryName; pushEnabled: boolean; lockedByAdmin: boolean };

export type PreferenceHistoryView = {
  category: NotificationCategoryName;
  source: string;
  previousValueJson: string | null;
  nextValueJson: string;
  actorTenantUserId: string | null;
  createdAt: Date;
  actor: { name: string } | null;
};

export type DispatchFilters = {
  category?: NotificationCategoryName;
  pushStatus?: NotificationPushStatus;
  tenantUserId?: string;
};

/**
 * Leitura administrativa das notificações: quem está com o push desligado, quem
 * a empresa travou, o que cada mudança alterou e como as entregas estão indo.
 * A escrita (defaults, lock e auditoria) continua em
 * `NotificationPreferencesService`; aqui só há consulta.
 */
@Injectable()
export class NotificationAdminService {
  constructor(private prisma: PrismaService) {}

  /**
   * Preferências efetivas de todas as pessoas do tenant, uma linha por
   * destinatário e categoria. Mesmo estado da Central, com a identidade de quem
   * recebe para o admin saber a quem está aplicando a política da empresa.
   */
  async listPreferences(tenantId: string): Promise<AdminPreferenceView[]> {
    const users = await this.prisma.tenantUser.findMany({
      where: { tenantId },
      include: {
        user: { select: { name: true, email: true, avatarUrl: true } },
        notificationPreferences: {
          select: { category: true, pushEnabled: true, lockedByAdmin: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return users.flatMap((tenantUser) =>
      effectivePreferences(tenantUser.notificationPreferences).map((preference) => ({
        tenantUserId: tenantUser.id,
        tenantUser: {
          name: tenantUser.user.name,
          email: tenantUser.user.email,
          avatarUrl: tenantUser.user.avatarUrl,
        },
        ...preference,
      })),
    );
  }

  /**
   * Histórico de uma pessoa, do mais recente ao mais antigo. A auditoria guarda
   * a preferência, não a pessoa, então o recorte sai pela relação `preference`.
   */
  async history(tenantId: string, tenantUserId: string): Promise<PreferenceHistoryView[]> {
    const rows = await this.prisma.notificationPreferenceAudit.findMany({
      where: { preference: { tenantId, tenantUserId } },
      include: {
        preference: { select: { category: true } },
        actor: { select: { user: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => ({
      category: row.preference.category,
      source: row.source,
      previousValueJson: row.previousValueJson,
      nextValueJson: row.nextValueJson,
      actorTenantUserId: row.actorTenantUserId,
      createdAt: row.createdAt,
      actor: row.actor?.user?.name ? { name: row.actor.user.name } : null,
    }));
  }

  /**
   * Ledger de entregas para investigação de push. Traz o conteúdo da Central e
   * o recibo, mas não o device: o token do Expo nunca sai daqui.
   */
  async listDispatches(tenantId: string, filters: DispatchFilters = {}) {
    return this.prisma.notificationDispatch.findMany({
      where: {
        tenantId,
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.pushStatus ? { pushStatus: filters.pushStatus } : {}),
        ...(filters.tenantUserId ? { tenantUserId: filters.tenantUserId } : {}),
      },
      include: {
        notification: { select: { title: true, message: true } },
        pushReceipts: {
          select: { id: true, status: true, errorCode: true, checkedAt: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
