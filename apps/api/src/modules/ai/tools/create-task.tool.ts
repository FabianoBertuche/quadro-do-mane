import { AiTool, AiToolInput } from './ai-tool.port';
import { actorRoleName, clarification, requirePermission, resolveId, resolveOne, TaskToolInput, validateCreateArgs } from './task-tool.schemas';

export class CreateTaskTool implements AiTool {
  name = 'create_task';
  description = 'Cria uma tarefa após resolver projeto e referências dentro do tenant.';
  parameters = { type: 'object', additionalProperties: false, required: ['title'], properties: { title: { type: 'string' }, projectId: { type: 'string' }, projectName: { type: 'string' }, description: { type: 'string' }, assigneeName: { type: 'string' }, assigneeTenantUserId: { type: 'string' }, statusName: { type: 'string' }, statusId: { type: 'string' }, priorityName: { type: 'string' }, priorityId: { type: 'string' }, startDate: { type: 'string' }, dueDate: { type: 'string' } } };
  constructor(private readonly tasks: any, private readonly projects: any, private readonly users: any) {}
  validate = validateCreateArgs;
  authorize(input: AiToolInput) { return requirePermission(this.users, input as TaskToolInput, 'tasks.create'); }
  async execute(input: AiToolInput) {
    const args = validateCreateArgs(input.args);
    const project = args.projectId ? await this.projects.findOne(input.tenantId, args.projectId) : resolveOne(await this.projects.findAll(input.tenantId, input.actorTenantUserId, await actorRoleName(this.users, input as TaskToolInput)), args.projectName, 'projectName');
    if (clarification(project)) return project;
    const users = args.assigneeName ? resolveOne(await this.users.findAll(input.tenantId), args.assigneeName, 'assigneeName') : args.assigneeTenantUserId ? await this.users.findOne(input.tenantId, args.assigneeTenantUserId) : null;
    if (clarification(users)) return users;
    const statuses = args.statusName ? resolveOne(await this.tasks.getStatuses(input.tenantId), args.statusName, 'statusName') : args.statusId ? resolveId(await this.tasks.getStatuses(input.tenantId), args.statusId, 'statusId') : null;
    if (clarification(statuses)) return statuses;
    const priorities = args.priorityName ? resolveOne(await this.tasks.getPriorities(input.tenantId), args.priorityName, 'priorityName') : args.priorityId ? resolveId(await this.tasks.getPriorities(input.tenantId), args.priorityId, 'priorityId') : null;
    if (clarification(priorities)) return priorities;
    const dto: any = { ...args, projectId: project.id, assigneeTenantUserId: users?.id ?? args.assigneeTenantUserId, statusId: statuses?.id ?? args.statusId, priorityId: priorities?.id ?? args.priorityId };
    delete dto.projectName; delete dto.assigneeName; delete dto.statusName; delete dto.priorityName;
    return this.tasks.create(input.tenantId, dto, input.actorTenantUserId);
  }
}
