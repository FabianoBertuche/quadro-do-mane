import { Controller, Headers, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { EventsService } from '@/modules/events/events.service';

/**
 * Envio dos lembretes de eventos (push diário).
 *
 * Chamado 1x/dia por um **Cron Job** externo (mesmo padrão do cleanup-denylist).
 *
 * Endpoint: `POST /admin/send-event-reminders`
 * Header:   `X-Cleanup-Token: <seu-token>`
 *
 * Se `CLEANUP_TOKEN` não estiver configurado, responde `{ disabled: true }` — fail-safe.
 */
@Controller('admin/send-event-reminders')
export class SendEventRemindersController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  @HttpCode(200)
  async run(@Headers('x-cleanup-token') token?: string) {
    const expected = this.config.get<string>('CLEANUP_TOKEN') || '';

    if (!expected) {
      return { disabled: true, reason: 'CLEANUP_TOKEN not configured' };
    }

    if (!token || !this.safeEqual(token, expected)) {
      throw new UnauthorizedException('Invalid cleanup token');
    }

    return this.eventsService.sendDailyReminderPushes();
  }

  private safeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  }
}