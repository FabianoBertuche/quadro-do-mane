import { Injectable, Logger } from '@nestjs/common';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { PrismaService } from '../../common/prisma/prisma.service';

/** Ticket Expo aceito, pareado com o PushDevice que o originou. Nunca contém o token. */
export type PushTicketRef = { pushDeviceId: string; expoTicketId: string };

/**
 * O SDK eco o payload da requisição em mensagens de erro de rede, então só o
 * nome do erro é seguro para log.
 */
const safeError = (err: unknown) => (err instanceof Error ? err.name : 'erro desconhecido');

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private expo = new Expo();

  constructor(private prisma: PrismaService) {}

  /** Registra (ou atualiza) o dispositivo do usuário logado. */
  async registerDevice(
    tenantId: string,
    tenantUserId: string,
    expoPushToken: string,
    platform?: string,
  ) {
    const isValid = Expo.isExpoPushToken(expoPushToken);
    if (!isValid) {
      // token inválido não deve ser persistido — evita lixo e envios falhos
      this.logger.warn(
        `Token push inválido rejeitado (user=${tenantUserId}, platform=${platform ?? 'desconhecido'})`,
      );
      return { success: false, registered: false };
    }
    return this.prisma.pushDevice.upsert({
      where: { expoPushToken },
      create: { tenantId, tenantUserId, expoPushToken, platform },
      update: { tenantId, tenantUserId, platform },
    });
  }

  async removeDevice(tenantUserId: string, expoPushToken: string) {
    await this.prisma.pushDevice.deleteMany({
      where: { tenantUserId, expoPushToken },
    });
    return { success: true };
  }

  /**
   * Envia push para todos os dispositivos de um usuário e devolve cada ticket
   * aceito pelo Expo pareado com o `PushDevice` de origem, para que o chamador
   * registre o receipt. Falha silenciosa — push nunca deve quebrar o fluxo
   * principal. O token Expo não sai daqui: apenas IDs de device e de ticket.
   */
  async sendToUser(
    tenantUserId: string,
    payload: { title: string; body?: string; data?: Record<string, any> },
  ): Promise<PushTicketRef[]> {
    const tickets: PushTicketRef[] = [];
    try {
      const devices = await this.prisma.pushDevice.findMany({
        where: { tenantUserId },
        select: { id: true, expoPushToken: true },
      });
      const targets = devices.filter((d) => Expo.isExpoPushToken(d.expoPushToken));
      if (targets.length === 0) return tickets;

      const messages: ExpoPushMessage[] = targets.map((d) => ({
        to: d.expoPushToken,
        sound: 'default',
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
      }));

      // SDK recomenda chunks de até 100; o nth ticket corresponde à nth mensagem
      let offset = 0;
      for (const chunk of this.expo.chunkPushNotifications(messages)) {
        const chunkTargets = targets.slice(offset, offset + chunk.length);
        offset += chunk.length;
        try {
          const chunkTickets = await this.expo.sendPushNotificationsAsync(chunk);
          chunkTickets.forEach((ticket, index) => {
            const device = chunkTargets[index];
            if (!device) return;
            if (ticket.status === 'error') {
              this.logger.warn(
                `Ticket push rejeitado (user=${tenantUserId}, device=${device.id}): ${ticket.message} (${ticket.details?.error})`,
              );
              return;
            }
            tickets.push({ pushDeviceId: device.id, expoTicketId: ticket.id });
          });
        } catch (err) {
          // o lote inteiro é perdido, mas os demais lotes seguem
          this.logger.error(
            `Lote de ${chunk.length} push(s) não enviado (user=${tenantUserId}, devices=${chunkTargets
              .map((d) => d.id)
              .join(',')}): ${safeError(err)}`,
          );
        }
      }
      this.logger.debug(`Push aceito para ${tickets.length} dispositivo(s) de ${tenantUserId}`);
    } catch (err) {
      this.logger.error(`Falha ao enviar push (user=${tenantUserId}): ${safeError(err)}`);
    }
    return tickets;
  }
}
