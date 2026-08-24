import { Injectable, Logger } from '@nestjs/common';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { PrismaService } from '../../common/prisma/prisma.service';

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
      // não lança 400 rígido — token inválido é apenas ignorado/logado
      this.logger.warn(`Token push inválido recebido: ${String(expoPushToken).slice(0, 20)}…`);
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
   * Envia push para todos os dispositivos de um usuário.
   * Falha silenciosa — push nunca deve quebrar o fluxo principal.
   */
  async sendToUser(
    tenantUserId: string,
    payload: { title: string; body?: string; data?: Record<string, any> },
  ): Promise<void> {
    try {
      const devices = await this.prisma.pushDevice.findMany({
        where: { tenantUserId },
        select: { expoPushToken: true },
      });
      const messages: ExpoPushMessage[] = devices
        .filter((d) => Expo.isExpoPushToken(d.expoPushToken))
        .map((d) => ({
          to: d.expoPushToken,
          sound: 'default',
          title: payload.title,
          body: payload.body,
          data: payload.data ?? {},
        }));
      if (messages.length === 0) return;

      // SDK recomenda chunks de até 100
      for (const chunk of this.expo.chunkPushNotifications(messages)) {
        await this.expo.sendPushNotificationsAsync(chunk);
      }
    } catch (err) {
      this.logger.warn(`Falha ao enviar push: ${String(err)}`);
    }
  }
}
