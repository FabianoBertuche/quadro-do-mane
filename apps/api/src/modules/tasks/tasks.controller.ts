import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { MoveTaskDto } from './dto/move-task.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';
import { RequestUser } from '../../common/interfaces/request-context.interface';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), TenantContextGuard, PermissionGuard)
@Controller('tasks')
export class TasksController {
  constructor(private tasksService: TasksService) {}

  @Get()
  @RequirePermissions('tasks.view')
  findAll(@CurrentUser('tenantId') tenantId: string, @Query('projectId') projectId?: string) {
    if (projectId) return this.tasksService.findByProject(tenantId, projectId);
    return this.tasksService.findAll(tenantId);
  }

  @Get('statuses')
  @RequirePermissions('tasks.view')
  getStatuses(@CurrentUser('tenantId') tenantId: string) {
    return this.tasksService.getStatuses(tenantId);
  }

  @Get('priorities')
  @RequirePermissions('tasks.view')
  getPriorities(@CurrentUser('tenantId') tenantId: string) {
    return this.tasksService.getPriorities(tenantId);
  }

  @Get(':id')
  @RequirePermissions('tasks.view')
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.tasksService.findOne(tenantId, id);
  }

  @Post()
  @RequirePermissions('tasks.create')
  create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions('tasks.edit')
  update(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.tasksService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('tasks.delete')
  remove(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.tasksService.remove(tenantId, id);
  }

  @Patch(':id/move')
  @RequirePermissions('tasks.move')
  moveTask(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string, @Body() dto: MoveTaskDto) {
    return this.tasksService.moveTask(tenantId, id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions('tasks.change_status')
  changeStatus(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string, @Body('statusId') statusId: string) {
    return this.tasksService.changeStatus(tenantId, id, statusId);
  }

  @Patch(':id/priority')
  @RequirePermissions('tasks.change_priority')
  changePriority(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string, @Body('priorityId') priorityId: string) {
    return this.tasksService.changePriority(tenantId, id, priorityId);
  }

  @Post(':id/comments')
  @RequirePermissions('tasks.comment')
  addComment(
    @CurrentUser() user: RequestUser,
    @Param('id') taskId: string,
    @Body('content') content: string,
  ) {
    return this.tasksService.addComment(user.tenantId, taskId, user.tenantUserId, content);
  }

  @Delete('comments/:commentId')
  @RequirePermissions('tasks.comment')
  removeComment(@CurrentUser('tenantId') tenantId: string, @Param('commentId') commentId: string) {
    return this.tasksService.removeComment(tenantId, commentId);
  }

  @Post(':id/checklists')
  @RequirePermissions('tasks.checklist_manage')
  createChecklist(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') taskId: string,
    @Body('title') title: string,
  ) {
    return this.tasksService.createChecklist(tenantId, taskId, title);
  }

  @Post('checklists/:checklistId/items')
  @RequirePermissions('tasks.checklist_manage')
  addChecklistItem(
    @CurrentUser('tenantId') tenantId: string,
    @Param('checklistId') checklistId: string,
    @Body('content') content: string,
  ) {
    return this.tasksService.addChecklistItem(tenantId, checklistId, content);
  }

  @Patch('checklist-items/:itemId/toggle')
  @RequirePermissions('tasks.checklist_manage')
  toggleChecklistItem(
    @CurrentUser() user: RequestUser,
    @Param('itemId') itemId: string,
  ) {
    return this.tasksService.toggleChecklistItem(user.tenantId, itemId, user.tenantUserId);
  }
}
