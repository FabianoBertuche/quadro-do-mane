import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), TenantContextGuard, PermissionGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private projectsService: ProjectsService) { }

  @Get()
  @RequirePermissions('projects.view')
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('tenantUserId') tenantUserId: string,
    @CurrentUser('roleName') roleName: string,
  ) {
    return this.projectsService.findAll(tenantId, tenantUserId, roleName);
  }

  @Get(':id')
  @RequirePermissions('projects.view')
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.projectsService.findOne(tenantId, id);
  }

  @Post()
  @RequirePermissions('projects.create')
  create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions('projects.edit')
  update(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('projects.delete')
  remove(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.projectsService.remove(tenantId, id);
  }

  @Post(':id/members')
  @RequirePermissions('projects.manage_members')
  addMember(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') projectId: string,
    @Body('tenantUserId') tenantUserId: string,
    @Body('roleInProject') role?: string,
  ) {
    return this.projectsService.addMember(tenantId, projectId, tenantUserId, role);
  }

  @Delete(':id/members/:tenantUserId')
  @RequirePermissions('projects.manage_members')
  removeMember(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') projectId: string,
    @Param('tenantUserId') tenantUserId: string,
  ) {
    return this.projectsService.removeMember(tenantId, projectId, tenantUserId);
  }
}
