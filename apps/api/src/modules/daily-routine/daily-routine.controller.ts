import { 
  Controller, 
  Get, 
  Post, 
  Patch, 
  Delete,
  Body, 
  Param, 
  UseGuards, 
  Query 
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { 
  TenantContextGuard, 
  PermissionGuard 
} from '../../common/guards';
import { 
  RequirePermissions 
} from '../../common/decorators/require-permissions.decorator';
import { 
  CurrentUser 
} from '../../common/decorators/current-user.decorator';
import { 
  DailyRoutineService 
} from './daily-routine.service';
import { 
  CreateRoutineDto, 
  CompleteRoutineDto, 
  AdminFilterDto,
  UpdateRoutineDto,
} from './dto/daily-routine.dto';
import { RequestUser } from '../../common/interfaces/request-context.interface';

@Controller('daily-routine')
@UseGuards(AuthGuard('jwt'), TenantContextGuard, PermissionGuard)
export class DailyRoutineController {
  constructor(private readonly routineService: DailyRoutineService) {}

  @Get()
  @RequirePermissions('daily_routine.view')
  async getUserRoutines(@CurrentUser() user: RequestUser) {
    return this.routineService.getUserRoutines(user.tenantUserId);
  }

  @Post()
  @RequirePermissions('daily_routine.manage')
  async create(@Body() dto: CreateRoutineDto, @CurrentUser() user: RequestUser) {
    return this.routineService.create(dto, user);
  }

  @Patch(':id/complete')
  @RequirePermissions('daily_routine.complete')
  async complete(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CompleteRoutineDto
  ) {
    return this.routineService.completeRoutine(user, id, dto);
  }

  @Get('admin/efficiency')
  @RequirePermissions('daily_routine.manage')
  async getAdminEfficiency(@Query() filters: AdminFilterDto) {
    const result = await this.routineService.getAdminLogs(filters);
    return { percentage: result.efficiency ?? 0 };
  }

  @Get('admin/logs')
  @RequirePermissions('daily_routine.manage')
  async getAdminLogs(@Query() filters: AdminFilterDto) {
    return this.routineService.getAdminLogs(filters);
  }

  @Get('admin/user/:userId')
  @RequirePermissions('daily_routine.manage')
  async getRoutinesForUser(
    @Param('userId') userId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.routineService.getRoutinesForUser(userId, user.tenantId);
  }

  @Patch(':id')
  @RequirePermissions('daily_routine.manage')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRoutineDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.routineService.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions('daily_routine.manage')
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.routineService.remove(id, user.tenantId);
  }
}
