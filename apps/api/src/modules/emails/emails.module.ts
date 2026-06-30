import { Module } from '@nestjs/common';
import { EmailsService, EmailsConfigResolver } from './emails.service';
import { EmailsController } from './emails.controller';

@Module({
  controllers: [EmailsController],
  providers: [EmailsService, EmailsConfigResolver],
  exports: [EmailsService],
})
export class EmailsModule {}
