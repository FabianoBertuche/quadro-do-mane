import { Global, Module } from '@nestjs/common';
import { PushService } from './push.service';
import { ExpoReceiptsService } from './expo-receipts.service';
import { PushDevicesController } from './push-devices.controller';

@Global()
@Module({
  controllers: [PushDevicesController],
  providers: [PushService, ExpoReceiptsService],
  exports: [PushService, ExpoReceiptsService],
})
export class PushModule {}
