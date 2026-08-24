import { Global, Module } from '@nestjs/common';
import { PushService } from './push.service';
import { PushDevicesController } from './push-devices.controller';

@Global()
@Module({
  controllers: [PushDevicesController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
