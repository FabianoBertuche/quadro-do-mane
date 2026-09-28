import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { NotificationAdminService } from './notification-admin.service';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationPreferencesService,
    NotificationDispatcherService,
    NotificationAdminService,
  ],
  exports: [
    NotificationsService,
    NotificationPreferencesService,
    NotificationDispatcherService,
    NotificationAdminService,
  ],
})
export class NotificationsModule {}
