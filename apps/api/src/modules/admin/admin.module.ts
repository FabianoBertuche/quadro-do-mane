import { Module } from '@nestjs/common';
import { CleanupController } from './cleanup.controller';
import { SendEventRemindersController } from './send-event-reminders.controller';
import { NotificationAdminController } from './notification-admin.controller';
import { EventsModule } from '../events/events.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [EventsModule, NotificationsModule],
  controllers: [CleanupController, SendEventRemindersController, NotificationAdminController],
})
export class AdminModule {}
