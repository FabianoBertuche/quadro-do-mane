import { AiTool, AiToolInput } from './ai-tool.port';
import { ForbiddenException } from '@nestjs/common';
import { ProjectsService } from '../../projects/projects.service';
import { clarification, requirePermission, resolveId, resolveOne, TaskToolInput, validateUpdateArgs, visibleProjects } from './task-tool.schemas';
import { PermissionCode } from './permission-codes';

export class UpdateTaskTool implements AiTool {
  name = 'update_task';
  permission: PermissionCode = 'tasks.edit';
  description = 'Atualiza campos permitidos de uma tarefa.';
  parameters = { type: 'object', additionalProperties: false, required: ['taskId'], properties: { taskId: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' }, assigneeName: { type: 'string' }, assigneeTenantUserId: { type: 'string' }, statusName: { type: 'string' }, statusId: { type: 'string' }, priorityName: { type: 'string' }, priorityId: { type: 'string' }, startDate: { type: 'string' }, dueDate: { type: 'string' } } };
  constructor(private readonly tasks: any, private readonly users: any, private readonly projects?: ProjectsService) {}
  validate = validateUpdateArgs;
  async authorize(input: AiToolInput) {
    await requirePermission(this.users, input as TaskToolInput, 'tasks.edit');
    const task = await this.tasks.findOne(input.tenantId, validateUpdateArgs(input.args).taskId);
    if (!task) throw new ForbiddenException('Tarefa não encontrada');
    if (this.projects) {
      const projects = await visibleProjects(this.projects, this.users, input as TaskToolInput);
      if (!projects.some((project: any) => project.id === task.projectId)) throw new ForbiddenException('Tarefa não encontrada');
    }
    return this.resolveReferences(input);
  }
  async execute(input: AiToolInput) {
    const args = validateUpdateArgs(input.args);
    const resolved = await this.resolveReferences(input);
    if (clarification(resolved)) return resolved;
    const { users, statuses, priorities } = resolved;
    const patch: any = { ...args, assigneeTenantUserId: users?.id ?? args.assigneeTenantUserId, statusId: statuses?.id ?? args.statusId, priorityId: priorities?.id ?? args.priorityId };
    delete patch.taskId; delete patch.assigneeName; delete patch.statusName; delete patch.priorityName;
    return this.tasks.update(input.tenantId, args.taskId, patch, input.actorTenantUserId);
  }

  private async resolveReferences(input: AiToolInput) {
    const args = validateUpdateArgs(input.args);
    const users = args.assigneeName
      ? resolveOne(await this.users.findAll(input.tenantId), args.assigneeName, 'assigneeName')
      : args.assigneeTenantUserId ? await this.users.findOne(input.tenantId, args.assigneeTenantUserId) : null;
    if (args.assigneeTenantUserId && !users) throw new ForbiddenException('assigneeTenantUserId não encontrado no tenant');
    if (clarification(users)) return users;
    const statuses = args.statusName ? resolveOne(await this.tasks.getStatuses(input.tenantId), args.statusName, 'statusName') : args.statusId ? resolveId(await this.tasks.getStatuses(input.tenantId), args.statusId, 'statusId') : null;
    if (clarification(statuses)) return statuses;
    const priorities = args.priorityName ? resolveOne(await this.tasks.getPriorities(input.tenantId), args.priorityName, 'priorityName') : args.priorityId ? resolveId(await this.tasks.getPriorities(input.tenantId), args.priorityId, 'priorityId') : null;
    if (clarification(priorities)) return priorities;
    return { users, statuses, priorities };
  }
}
