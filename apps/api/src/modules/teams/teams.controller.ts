import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';

@ApiTags('Teams')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), TenantContextGuard, PermissionGuard)
@Controller('teams')
export class TeamsController {
  constructor(private teamsService: TeamsService) {}

  @Get()
  @RequirePermissions('teams.view')
  findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.teamsService.findAll(tenantId);
  }

  @Get(':id')
  @RequirePermissions('teams.view')
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.teamsService.findOne(tenantId, id);
  }

  @Post()
  @RequirePermissions('teams.create')
  create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateTeamDto) {
    return this.teamsService.create(tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions('teams.edit')
  update(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string, @Body() dto: UpdateTeamDto) {
    return this.teamsService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('teams.delete')
  remove(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.teamsService.remove(tenantId, id);
  }

  @Post(':id/members')
  @RequirePermissions('teams.manage_members')
  addMember(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') teamId: string,
    @Body('tenantUserId') tenantUserId: string,
  ) {
    return this.teamsService.addMember(tenantId, teamId, tenantUserId);
  }

  @Delete(':id/members/:tenantUserId')
  @RequirePermissions('teams.manage_members')
  removeMember(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') teamId: string,
    @Param('tenantUserId') tenantUserId: string,
  ) {
    return this.teamsService.removeMember(tenantId, teamId, tenantUserId);
  }
}
