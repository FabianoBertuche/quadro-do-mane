import { Module } from '@nestjs/common';
import { CleanupController } from './cleanup.controller';

@Module({
  controllers: [CleanupController],
})
export class AdminModule {}
