import { Module } from '@nestjs/common';
import { DailyRoutineController } from './daily-routine.controller';
import { DailyRoutineService } from './daily-routine.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [DailyRoutineController],
  providers: [DailyRoutineService],
  exports: [DailyRoutineService],
})
export class DailyRoutineModule {}
