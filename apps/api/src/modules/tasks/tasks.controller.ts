import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { MoveTaskDto } from './dto/move-task.dto';
import { FilterTasksDto } from './dto/filter-tasks.dto';
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
  findAll(
    @CurrentUser() user: RequestUser,
    @Query() filters: FilterTasksDto,
  ) {
    const serviceFilters: any = { ...filters };

    if (filters.overdue) serviceFilters.overdue = filters.overdue === 'true';
    if (filters.completed) serviceFilters.completed = filters.completed === 'true';
    if (filters.myTasks && filters.myTasks === 'true') {
      serviceFilters.assigneeTenantUserId = user.tenantUserId;
    }
    if (filters.blocked) serviceFilters.blocked = filters.blocked === 'true';

    return this.tasksService.findByFilters(user.tenantId, serviceFilters);
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

  @Get('tags')
  @RequirePermissions('tasks.view')
  getTags(@CurrentUser('tenantId') tenantId: string) {
    return this.tasksService.getTags(tenantId);
  }

  @Get(':id')
  @RequirePermissions('tasks.view')
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.tasksService.findOne(tenantId, id);
  }

  @Get(':id/comments')
  @RequirePermissions('tasks.view')
  getComments(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.tasksService.getComments(tenantId, id);
  }

  @Post()
  @RequirePermissions('tasks.create')
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasksService.create(user.tenantId, dto, user.tenantUserId);
  }

  @Patch(':id')
  @RequirePermissions('tasks.edit')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(user.tenantId, id, dto, user.tenantUserId);
  }

  @Delete(':id')
  @RequirePermissions('tasks.delete')
  remove(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.tasksService.remove(user.tenantId, id, user.tenantUserId);
  }

  @Patch(':id/move')
  @RequirePermissions('tasks.move')
  moveTask(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: MoveTaskDto,
  ) {
    return this.tasksService.moveTask(user.tenantId, id, dto, user.tenantUserId);
  }

  @Patch(':id/status')
  @RequirePermissions('tasks.change_status')
  changeStatus(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body('statusId') statusId: string,
  ) {
    return this.tasksService.changeStatus(user.tenantId, id, statusId, user.tenantUserId);
  }

  @Patch(':id/priority')
  @RequirePermissions('tasks.change_priority')
  changePriority(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body('priorityId') priorityId: string,
  ) {
    return this.tasksService.changePriority(user.tenantId, id, priorityId, user.tenantUserId);
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
  removeComment(
    @CurrentUser() user: RequestUser,
    @Param('commentId') commentId: string,
  ) {
    return this.tasksService.removeComment(user.tenantId, commentId, user.tenantUserId);
  }

  @Delete(':id/attachments/:attachmentId')
  @RequirePermissions('tasks.edit')
  removeAttachment(
    @CurrentUser() user: RequestUser,
    @Param('id') taskId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.tasksService.removeAttachment(user.tenantId, taskId, attachmentId, user.tenantUserId);
  }

  @Post(':id/checklists')
  @RequirePermissions('tasks.checklist_manage')
  createChecklist(
    @CurrentUser() user: RequestUser,
    @Param('id') taskId: string,
    @Body('title') title: string,
  ) {
    return this.tasksService.createChecklist(user.tenantId, taskId, title, user.tenantUserId);
  }

  @Post('checklists/:checklistId/items')
  @RequirePermissions('tasks.checklist_manage')
  addChecklistItem(
    @CurrentUser() user: RequestUser,
    @Param('checklistId') checklistId: string,
    @Body('content') content: string,
  ) {
    return this.tasksService.addChecklistItem(user.tenantId, checklistId, content, user.tenantUserId);
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
