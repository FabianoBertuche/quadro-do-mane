import { Module } from '@nestjs/common';
import { DailyRoutineController } from './daily-routine.controller';
import { DailyRoutineService } from './daily-routine.service';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DailyRoutineController],
  providers: [DailyRoutineService],
})
export class DailyRoutineModule {}
