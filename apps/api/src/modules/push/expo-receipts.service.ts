import { Injectable, Logger } from '@nestjs/common';
import { Expo, ExpoPushReceipt } from 'expo-server-sdk';
import { PrismaService } from '../../common/prisma/prisma.service';

/** Recebidos da última consulta são os mais antigos; 300 é o limite do SDK. */
const RECEIPT_BATCH_SIZE = 300;

/**
 * Dispatch que teve ao menos um receipt falho → nº de receipts que sumiram em
 * cascade junto do device desregistrado.
 */
type DispatchFailures = { unregistered: number };

/**
 * O SDK eco o payload da requisição em mensagens de erro de rede, então só o
 * nome do erro é seguro para log.
 */
const safeError = (err: unknown) => (err instanceof Error ? err.name : 'erro desconhecido');

@Injectable()
export class ExpoReceiptsService {
  private readonly logger = new Logger(ExpoReceiptsService.name);
  private expo = new Expo();

  constructor(private prisma: PrismaService) {}

  /**
   * Confere os receipts pendentes com o Expo: grava `status`/`checkedAt`,
   * remove o `PushDevice` que o Expo reportar como DeviceNotRegistered e
   * rebaixa o dispatch para FAILED quando todos os seus receipts falharam.
   * O token Expo nunca é registrado — só IDs de receipt, device e dispatch.
   */
  async processPending(): Promise<{ checked: number; devicesRemoved: number; failed: number }> {
    const result = { checked: 0, devicesRemoved: 0, failed: 0 };

    const pending = await this.prisma.notificationPushReceipt.findMany({
      where: { status: 'PENDING' },
      select: { id: true, dispatchId: true, pushDeviceId: true, expoTicketId: true },
      orderBy: { createdAt: 'asc' },
      take: RECEIPT_BATCH_SIZE,
    });
    if (pending.length === 0) return result;

    const byTicketId = new Map(pending.map((row) => [row.expoTicketId, row]));
    const failedDispatches = new Map<string, DispatchFailures>();

    for (const chunk of this.expo.chunkPushNotificationReceiptIds(
      pending.map((row) => row.expoTicketId),
    )) {
      let receipts: { [id: string]: ExpoPushReceipt };
      try {
        receipts = await this.expo.getPushNotificationReceiptsAsync(chunk);
      } catch (err) {
        // o lote continua PENDING e é tentado de novo na próxima rodada
        this.logger.error(
          `Falha ao consultar receipts do Expo (lote de ${chunk.length}): ${safeError(err)}`,
        );
        continue;
      }

      for (const ticketId of chunk) {
        const row = byTicketId.get(ticketId);
        if (!row) continue;
        const receipt = receipts[ticketId];
        if (!receipt) {
          this.logger.warn(
            `Receipt não encontrado no Expo (dispatch=${row.dispatchId}, device=${row.pushDeviceId})`,
          );
          continue;
        }

        try {
          const checkedAt = new Date();
          if (receipt.status === 'ok') {
            await this.prisma.notificationPushReceipt.update({
              where: { id: row.id },
              data: { status: 'OK', errorCode: null, checkedAt },
            });
            result.checked += 1;
            continue;
          }

          const errorCode = receipt.details?.error ?? 'Unknown';
          await this.prisma.notificationPushReceipt.update({
            where: { id: row.id },
            data: { status: 'ERROR', errorCode, checkedAt },
          });
          result.checked += 1;
          result.failed += 1;

          const failures = failedDispatches.get(row.dispatchId) ?? { unregistered: 0 };
          if (errorCode === 'DeviceNotRegistered') {
            await this.prisma.pushDevice.delete({ where: { id: row.pushDeviceId } });
            result.devicesRemoved += 1;
            failures.unregistered += 1;
          }
          failedDispatches.set(row.dispatchId, failures);
        } catch (err) {
          // a linha fica PENDING e é reprocessada na próxima rodada
          this.logger.error(
            `Falha ao registrar o receipt (dispatch=${row.dispatchId}, device=${row.pushDeviceId}): ${safeError(err)}`,
          );
        }
      }
    }

    await this.failFullyFailedDispatches(failedDispatches);
    return result;
  }

  /**
   * Rebaixa para FAILED apenas o dispatch cujos receipts estão todos resolvidos
   * como falha. O receipt que sumiu em cascade com o device conta como falha;
   * qualquer receipt OK ou ainda PENDING mantém o dispatch como está.
   */
  private async failFullyFailedDispatches(failed: Map<string, DispatchFailures>): Promise<void> {
    if (failed.size === 0) return;

    const remaining = await this.prisma.notificationPushReceipt.findMany({
      where: { dispatchId: { in: [...failed.keys()] } },
      select: { dispatchId: true, status: true },
    });
    const overview = new Map<string, { total: number; ok: number; pending: number }>();
    for (const row of remaining) {
      const stats = overview.get(row.dispatchId) ?? { total: 0, ok: 0, pending: 0 };
      stats.total += 1;
      if (row.status === 'OK') stats.ok += 1;
      if (row.status === 'PENDING') stats.pending += 1;
      overview.set(row.dispatchId, stats);
    }

    for (const [dispatchId, failures] of failed) {
      const stats = overview.get(dispatchId) ?? { total: 0, ok: 0, pending: 0 };
      if (stats.total + failures.unregistered === 0) continue;
      if (stats.ok > 0 || stats.pending > 0) continue;
      await this.prisma.notificationDispatch.update({
        where: { id: dispatchId },
        data: { pushStatus: 'FAILED', failureReason: 'ALL_PUSH_RECEIPTS_FAILED' },
      });
    }
  }
}
