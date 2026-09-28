import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventsService } from '../events/events.service';
import { TasksService } from '../tasks/tasks.service';
import { DailyRoutineService } from '../daily-routine/daily-routine.service';
import { ExpoReceiptsService } from '../push/expo-receipts.service';

const safeError = (err: unknown) => (err instanceof Error ? err.name : 'erro desconhecido');

@Injectable()
export class NotificationSchedulerService {
  private readonly logger = new Logger(NotificationSchedulerService.name);

  constructor(
    private events: EventsService,
    private tasks: TasksService,
    private routines: DailyRoutineService,
    private receipts: ExpoReceiptsService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES, { timeZone: 'America/Sao_Paulo' })
  async run(now: Date = new Date()): Promise<void> {
    await this.step('events', () => this.events.sendDailyReminderPushes(now));
    await this.step('tasks', () => this.tasks.sendScheduledNotifications(now));
    await this.step('routines', () => this.routines.sendScheduledNotifications(now));
    await this.step('receipts', () => this.receipts.processPending());
  }

  /**
   * Isola cada unidade: a falha de uma categoria não pode impedir as demais de
   * rodarem nem fazer o tique inteiro rejeitar.
   */
  private async step(unit: string, work: () => Promise<unknown>): Promise<void> {
    try {
      await work();
    } catch (err) {
      this.logger.error(`Falha na unidade de notificação "${unit}": ${safeError(err)}`);
    }
  }
}
