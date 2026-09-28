import { Injectable, Logger } from '@nestjs/common';
import { NotificationCategory } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PushService, PushTicketRef } from '../push/push.service';
import { NotificationPreferencesService } from './notification-preferences.service';

export type DispatchInput = {
  tenantId: string;
  tenantUserId: string;
  category: NotificationCategory;
  type: string;
  title: string;
  message: string;
  payload?: Record<string, unknown>;
  entityType: string;
  entityId: string;
  occurrenceKey: string;
};

/** O SDK do Expo ecoa o payload em mensagens de erro, então só o nome do erro é seguro. */
const safeError = (err: unknown) => (err instanceof Error ? err.name : 'erro desconhecido');

const isUniqueViolation = (err: unknown) => (err as { code?: string } | null)?.code === 'P2002';

/**
 * Ponto único de entrega de notificações. Grava o ledger idempotente e a entrada
 * da Central numa transação e só depois tenta o push — falha de push nunca desfaz
 * a Central nem a operação de negócio que originou a chamada.
 */
@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name);

  constructor(
    private prisma: PrismaService,
    private preferences: NotificationPreferencesService,
    private push: PushService,
  ) {}

  /**
   * Cria a entrega. A chave `(tenantUserId, type, entityId, occurrenceKey)` é
   * única: quando já existe, devolve a entrega existente sem recriar Central nem
   * reenviar push, o que torna execuções repetidas, reinícios e réplicas seguras.
   */
  async dispatch(input: DispatchInput) {
    const key = {
      tenantUserId: input.tenantUserId,
      type: input.type,
      entityId: input.entityId,
      occurrenceKey: input.occurrenceKey,
    };

    let dispatch;
    try {
      dispatch = await this.prisma.$transaction(async (tx) => {
        const ledger = await tx.notificationDispatch.create({
          data: {
            tenantId: input.tenantId,
            tenantUserId: input.tenantUserId,
            category: input.category,
            type: input.type,
            entityType: input.entityType,
            entityId: input.entityId,
            occurrenceKey: input.occurrenceKey,
          },
        });
        const notification = await tx.notification.create({
          data: {
            tenantId: input.tenantId,
            tenantUserId: input.tenantUserId,
            type: input.type,
            title: input.title,
            message: input.message,
            payloadJson: JSON.stringify(input.payload ?? {}),
          },
        });
        return tx.notificationDispatch.update({
          where: { id: ledger.id },
          data: { notificationId: notification.id },
        });
      });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      const existing = await this.prisma.notificationDispatch.findUnique({
        where: { tenantUserId_type_entityId_occurrenceKey: key },
      });
      if (!existing) throw err;
      return existing;
    }

    return this.deliverPush(dispatch, input);
  }

  /** Pós-transação: resolve a preferência da categoria e tenta o push. */
  private async deliverPush(dispatch: { id: string }, input: DispatchInput) {
    const pushEnabled = await this.preferences.isPushEnabled(
      input.tenantId,
      input.tenantUserId,
      input.category,
    );
    if (!pushEnabled) {
      return this.prisma.notificationDispatch.update({
        where: { id: dispatch.id },
        data: { pushStatus: 'SKIPPED' },
      });
    }

    let tickets: PushTicketRef[];
    try {
      tickets = await this.push.sendToUser(input.tenantUserId, {
        title: input.title,
        body: input.message,
        data: input.payload ?? {},
      });
    } catch (err) {
      this.logger.error(
        `Falha ao enviar push (dispatch=${dispatch.id}, user=${input.tenantUserId}): ${safeError(err)}`,
      );
      return this.markFailed(dispatch.id, 'PUSH_SEND_FAILED');
    }

    if (tickets.length > 0) {
      try {
        await this.prisma.notificationPushReceipt.createMany({
          data: tickets.map((ticket) => ({
            dispatchId: dispatch.id,
            pushDeviceId: ticket.pushDeviceId,
            expoTicketId: ticket.expoTicketId,
          })),
        });
      } catch (err) {
        this.logger.error(
          `Falha ao gravar receipts do push (dispatch=${dispatch.id}): ${safeError(err)}`,
        );
        return this.markFailed(dispatch.id, 'PUSH_RECEIPT_PERSIST_FAILED');
      }
    }

    return this.prisma.notificationDispatch.update({
      where: { id: dispatch.id },
      data: { pushStatus: 'SENT', sentAt: new Date() },
    });
  }

  /**
   * Rebaixa o dispatch com um motivo seguro — o erro original fica só no log,
   * porque pode conter o token Expo devolvido pelo SDK.
   */
  private markFailed(dispatchId: string, failureReason: string) {
    return this.prisma.notificationDispatch.update({
      where: { id: dispatchId },
      data: { pushStatus: 'FAILED', failureReason },
    });
  }
}
