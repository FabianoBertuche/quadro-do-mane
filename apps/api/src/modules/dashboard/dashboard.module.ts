import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { UserActivityService } from './user-activity.service';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService, UserActivityService],
  exports: [DashboardService, UserActivityService],
})
export class DashboardModule {}
