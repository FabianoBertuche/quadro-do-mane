import { AiTool, AiToolInput, AiToolResult } from './ai-tool.port';
import { ForbiddenException } from '@nestjs/common';
import { ProjectsService } from '../../projects/projects.service';
import { assertVisibleProject, clarification, missingProject, requirePermission, resolveId, resolveOne, TaskToolInput, validateCreateArgs, visibleProjects } from './task-tool.schemas';

export class CreateTaskTool implements AiTool {
  name = 'create_task';
  description = 'Cria uma tarefa após resolver projeto e referências dentro do tenant.';
  parameters = { type: 'object', additionalProperties: false, required: ['title'], properties: { title: { type: 'string' }, projectId: { type: 'string' }, projectName: { type: 'string' }, description: { type: 'string' }, assigneeName: { type: 'string' }, assigneeTenantUserId: { type: 'string' }, statusName: { type: 'string' }, statusId: { type: 'string' }, priorityName: { type: 'string' }, priorityId: { type: 'string' }, startDate: { type: 'string' }, dueDate: { type: 'string' } } };
  constructor(private readonly tasks: any, private readonly projects: ProjectsService, private readonly users: any) {}
  validate = validateCreateArgs;
  async authorize(input: AiToolInput): Promise<void | AiToolResult> {
    await requirePermission(this.users, input as TaskToolInput, 'tasks.create');
    return this.resolveReferences(input);
  }
  async execute(input: AiToolInput) {
    const args = validateCreateArgs(input.args);
    const resolved = await this.resolveReferences(input);
    if (clarification(resolved)) return resolved;
    const { project, users, statuses, priorities } = resolved;
    const dto: any = { ...args, projectId: project.id, assigneeTenantUserId: users?.id ?? args.assigneeTenantUserId, statusId: statuses?.id ?? args.statusId, priorityId: priorities?.id ?? args.priorityId };
    delete dto.projectName; delete dto.assigneeName; delete dto.statusName; delete dto.priorityName;
    return this.tasks.create(input.tenantId, dto, input.actorTenantUserId);
  }

  private async resolveReferences(input: AiToolInput) {
    const args = validateCreateArgs(input.args);
    if (!args.projectId && !args.projectName) return missingProject();
    const projects = await visibleProjects(this.projects, this.users, input as TaskToolInput);
    const project = args.projectId ? assertVisibleProject(projects, args.projectId) : resolveOne(projects, args.projectName, 'projectName');
    if (clarification(project)) return project;
    const users = args.assigneeName
      ? resolveOne(await this.users.findAll(input.tenantId), args.assigneeName, 'assigneeName')
      : args.assigneeTenantUserId ? await this.users.findOne(input.tenantId, args.assigneeTenantUserId) : null;
    if (args.assigneeTenantUserId && !users) throw new ForbiddenException('assigneeTenantUserId não encontrado no tenant');
    if (clarification(users)) return users;
    const statuses = args.statusName ? resolveOne(await this.tasks.getStatuses(input.tenantId), args.statusName, 'statusName') : args.statusId ? resolveId(await this.tasks.getStatuses(input.tenantId), args.statusId, 'statusId') : null;
    if (clarification(statuses)) return statuses;
    const priorities = args.priorityName ? resolveOne(await this.tasks.getPriorities(input.tenantId), args.priorityName, 'priorityName') : args.priorityId ? resolveId(await this.tasks.getPriorities(input.tenantId), args.priorityId, 'priorityId') : null;
    if (clarification(priorities)) return priorities;
    return { project, users, statuses, priorities };
  }
}
