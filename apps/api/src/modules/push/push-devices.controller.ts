import { Body, Controller, Delete, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PushService } from './push.service';

@ApiTags('Push')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('push-devices')
export class PushDevicesController {
  constructor(private push: PushService) {}

  @Post()
  async register(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('tenantUserId') tenantUserId: string,
    @Body() dto: { expoPushToken: string; platform?: string },
  ) {
    return this.push.registerDevice(
      tenantId,
      tenantUserId,
      dto.expoPushToken,
      dto.platform,
    );
  }

  @Delete(':token')
  async remove(
    @CurrentUser('tenantUserId') tenantUserId: string,
    @Param('token') token: string,
  ) {
    return this.push.removeDevice(tenantUserId, decodeURIComponent(token));
  }
}
