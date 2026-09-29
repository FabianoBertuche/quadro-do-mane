import { AiTool, AiToolInput } from './ai-tool.port';
import { ForbiddenException } from '@nestjs/common';
import { ProjectsService } from '../../projects/projects.service';
import { clarification, requirePermission, resolveId, resolveOne, TaskToolInput, validateMoveArgs, visibleProjects } from './task-tool.schemas';

export class MoveTaskTool implements AiTool {
  name = 'move_task';
  description = 'Altera o status de uma tarefa.';
  parameters = { type: 'object', additionalProperties: false, required: ['taskId'], properties: { taskId: { type: 'string' }, statusId: { type: 'string' }, statusName: { type: 'string' } } };
  constructor(private readonly tasks: any, private readonly users: any, private readonly projects?: ProjectsService) {}
  validate = validateMoveArgs;
  async authorize(input: AiToolInput) {
    await requirePermission(this.users, input as TaskToolInput, 'tasks.change_status');
    const task = await this.tasks.findOne(input.tenantId, validateMoveArgs(input.args).taskId);
    if (this.projects) {
      const projects = await visibleProjects(this.projects, this.users, input as TaskToolInput);
      if (!projects.some((project: any) => project.id === task.projectId)) throw new ForbiddenException('Tarefa não encontrada');
    }
  }
  async execute(input: AiToolInput) {
    const args = validateMoveArgs(input.args);
    const status = args.statusName ? resolveOne(await this.tasks.getStatuses(input.tenantId), args.statusName, 'statusName') : resolveId(await this.tasks.getStatuses(input.tenantId), args.statusId, 'statusId');
    if (clarification(status)) return status;
    return this.tasks.changeStatus(input.tenantId, args.taskId, status.id, input.actorTenantUserId);
  }
}
