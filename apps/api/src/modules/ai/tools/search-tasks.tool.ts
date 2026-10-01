import { AiTool, AiToolInput } from './ai-tool.port';
import { ProjectsService } from '../../projects/projects.service';
import { clarification, resolveId, resolveOne, TaskToolInput, requirePermission, validateSearchArgs, visibleProjects } from './task-tool.schemas';

export class SearchTasksTool implements AiTool {
  name = 'search_tasks';
  description = 'Busca tarefas acessíveis no tenant e retorna resumos limitados.';
  parameters = { type: 'object', additionalProperties: false, properties: { search: { type: 'string' }, projectId: { type: 'string' }, projectName: { type: 'string' }, statusId: { type: 'string' }, statusName: { type: 'string' }, assigneeTenantUserId: { type: 'string' }, assigneeName: { type: 'string' }, priorityId: { type: 'string' }, priorityName: { type: 'string' } } };
  constructor(private readonly tasks: any, private readonly users: any, private readonly projects: ProjectsService) {}
  validate = validateSearchArgs;
  authorize(input: AiToolInput) { return requirePermission(this.users, input as TaskToolInput, 'tasks.view'); }
  async execute(input: AiToolInput) {
    const args = validateSearchArgs(input.args);
    const filters: any = { ...args };
    const projects = await visibleProjects(this.projects, this.users, input as TaskToolInput);
    if (args.projectName) {
      const project = resolveOne(projects, args.projectName, 'projectName');
      if (clarification(project)) return project;
      filters.projectId = project.id;
    } else if (args.projectId) filters.projectId = resolveId(projects, args.projectId, 'projectId').id;
    else filters.projectIds = projects.map((project: any) => project.id);
    if (args.statusName) {
      const status = resolveOne(await this.tasks.getStatuses(input.tenantId), args.statusName, 'statusName');
      if (clarification(status)) return status;
      filters.statusId = status.id;
    } else if (args.statusId) filters.statusId = resolveId(await this.tasks.getStatuses(input.tenantId), args.statusId, 'statusId').id;
    if (args.priorityName) {
      const priority = resolveOne(await this.tasks.getPriorities(input.tenantId), args.priorityName, 'priorityName');
      if (clarification(priority)) return priority;
      filters.priorityId = priority.id;
    } else if (args.priorityId) filters.priorityId = resolveId(await this.tasks.getPriorities(input.tenantId), args.priorityId, 'priorityId').id;
    if (args.assigneeName) {
      const assignee = resolveOne(await this.users.findAll(input.tenantId), args.assigneeName, 'assigneeName');
      if (clarification(assignee)) return assignee;
      filters.assigneeTenantUserId = assignee.id;
    } else if (args.assigneeTenantUserId) {
      const assignee = await this.users.findOne(input.tenantId, args.assigneeTenantUserId);
      filters.assigneeTenantUserId = resolveId(assignee ? [assignee] : [], args.assigneeTenantUserId, 'assigneeTenantUserId').id;
    }
    delete filters.projectName; delete filters.statusName; delete filters.priorityName; delete filters.assigneeName;
    const rows = await this.tasks.findByFilters(input.tenantId, filters);
    return rows.slice(0, 50).map((task: any) => ({
      id: task.id, title: task.title, projectId: task.projectId, status: task.status?.name, priority: task.priority?.name, assignee: task.assignee?.user?.name,
    }));
  }
}
