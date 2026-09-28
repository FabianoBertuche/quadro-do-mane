import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationDispatcherService } from './notification-dispatcher.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationPreferencesService, NotificationDispatcherService],
  exports: [NotificationsService, NotificationPreferencesService, NotificationDispatcherService],
})
export class NotificationsModule {}
