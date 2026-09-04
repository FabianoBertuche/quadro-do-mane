import { Module } from '@nestjs/common';
import { CleanupController } from './cleanup.controller';
import { SendEventRemindersController } from './send-event-reminders.controller';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [EventsModule],
  controllers: [CleanupController, SendEventRemindersController],
})
export class AdminModule {}
