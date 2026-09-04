import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';
import { RequestUser } from '../../common/interfaces/request-context.interface';

@ApiTags('Events')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), TenantContextGuard, PermissionGuard)
@Controller('events')
export class EventsController {
  constructor(private eventsService: EventsService) {}

  @Get()
  @RequirePermissions('calendar.view')
  findAll(@CurrentUser('tenantId') tenantId: string, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.eventsService.findAll(tenantId, startDate, endDate);
  }

  @Get('reminders')
  @RequirePermissions('calendar.view')
  findReminders(@CurrentUser('tenantId') tenantId: string, @CurrentUser('tenantUserId') tenantUserId: string) {
    return this.eventsService.findReminders(tenantId, tenantUserId);
  }

  @Post(':id/reminders/dismiss-day')
  @RequirePermissions('calendar.view')
  dismissReminderDay(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('tenantUserId') tenantUserId: string,
    @Param('id') id: string,
  ) {
    return this.eventsService.dismissReminderDay(tenantId, tenantUserId, id);
  }

  @Post(':id/reminders/dismiss-forever')
  @RequirePermissions('calendar.view')
  dismissReminderForever(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('tenantUserId') tenantUserId: string,
    @Param('id') id: string,
  ) {
    return this.eventsService.dismissReminderForever(tenantId, tenantUserId, id);
  }

  @Get(':id')
  @RequirePermissions('calendar.view')
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.eventsService.findOne(tenantId, id);
  }

  @Post()
  @RequirePermissions('calendar.create')
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateEventDto) {
    return this.eventsService.create(user.tenantId, user.tenantUserId, dto);
  }

  @Patch(':id')
  @RequirePermissions('calendar.edit')
  update(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.eventsService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('calendar.delete')
  remove(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.eventsService.remove(tenantId, id);
  }

  @Delete('series/:seriesId')
  @RequirePermissions('calendar.delete')
  removeSeries(@CurrentUser('tenantId') tenantId: string, @Param('seriesId') seriesId: string) {
    return this.eventsService.removeSeries(tenantId, seriesId);
  }
}
