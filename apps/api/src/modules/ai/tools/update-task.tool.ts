import { AiTool, AiToolInput } from './ai-tool.port';
import { clarification, requirePermission, resolveId, resolveOne, TaskToolInput, validateUpdateArgs } from './task-tool.schemas';

export class UpdateTaskTool implements AiTool {
  name = 'update_task';
  description = 'Atualiza campos permitidos de uma tarefa.';
  parameters = { type: 'object', additionalProperties: false, required: ['taskId'], properties: { taskId: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' }, assigneeName: { type: 'string' }, assigneeTenantUserId: { type: 'string' }, statusName: { type: 'string' }, statusId: { type: 'string' }, priorityName: { type: 'string' }, priorityId: { type: 'string' }, startDate: { type: 'string' }, dueDate: { type: 'string' } } };
  constructor(private readonly tasks: any, private readonly users: any) {}
  validate = validateUpdateArgs;
  async authorize(input: AiToolInput) { await requirePermission(this.users, input as TaskToolInput, 'tasks.edit'); await this.tasks.findOne(input.tenantId, validateUpdateArgs(input.args).taskId); }
  async execute(input: AiToolInput) {
    const args = validateUpdateArgs(input.args);
    const users = args.assigneeName ? resolveOne(await this.users.findAll(input.tenantId), args.assigneeName, 'assigneeName') : args.assigneeTenantUserId ? await this.users.findOne(input.tenantId, args.assigneeTenantUserId) : null;
    if (clarification(users)) return users;
    const statuses = args.statusName ? resolveOne(await this.tasks.getStatuses(input.tenantId), args.statusName, 'statusName') : args.statusId ? resolveId(await this.tasks.getStatuses(input.tenantId), args.statusId, 'statusId') : null;
    if (clarification(statuses)) return statuses;
    const priorities = args.priorityName ? resolveOne(await this.tasks.getPriorities(input.tenantId), args.priorityName, 'priorityName') : args.priorityId ? resolveId(await this.tasks.getPriorities(input.tenantId), args.priorityId, 'priorityId') : null;
    if (clarification(priorities)) return priorities;
    const patch: any = { ...args, assigneeTenantUserId: users?.id ?? args.assigneeTenantUserId, statusId: statuses?.id ?? args.statusId, priorityId: priorities?.id ?? args.priorityId };
    delete patch.taskId; delete patch.assigneeName; delete patch.statusName; delete patch.priorityName;
    return this.tasks.update(input.tenantId, args.taskId, patch, input.actorTenantUserId);
  }
}
