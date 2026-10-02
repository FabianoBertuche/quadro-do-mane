import { AiTool, AiToolInput } from './ai-tool.port';
import { ProjectsService } from '../../projects/projects.service';
import { bounded, clarification, exact, requirePermission, resolveId, resolveReadOne, validateReadArgs } from './task-tool.schemas';
import { PermissionCode } from './permission-codes';

export class SearchProjectsTool implements AiTool {
  name = 'search_projects';
  permission: PermissionCode = 'projects.view';
  readOnly = true;
  description = 'Busca projetos visíveis no tenant e retorna resumos limitados.';
  parameters = { type: 'object', additionalProperties: false, required: [], properties: { search: { type: 'string' }, name: { type: 'string' }, projectId: { type: 'string' } } };
  constructor(private readonly projects: ProjectsService, private readonly users: any) {}

  validate = (args: unknown) => validateReadArgs(args, ['search', 'name', 'projectId']);
  authorize(input: AiToolInput) { return requirePermission(this.users, input as any, 'projects.view'); }

  async execute(input: AiToolInput) {
    await this.authorize(input);
    const args = this.validate(input.args) as any;
    const rows = await this.projects.findAll(input.tenantId, input.actorTenantUserId, await this.role(input));
    let selected = rows;
    if (args.projectId) selected = [resolveId(rows, args.projectId, 'projectId')];
    if (args.name) {
      const match = resolveReadOne(rows, args.name, 'name');
      if (clarification(match)) return match;
      selected = [match];
    }
    if (args.search) selected = selected.filter((row: any) => exact(row.name).includes(exact(args.search)));
    return bounded(selected).map((project: any) => ({
      id: project.id,
      name: project.name,
      status: project.status,
      owner: project.owner?.user?.name,
      team: project.team?.name,
      progressPercent: project.progressPercent,
      totalTasks: project.totalTasks ?? project._count?.tasks,
    }));
  }

  private async role(input: AiToolInput) {
    return (await this.users.findOne(input.tenantId, input.actorTenantUserId))?.role?.name ?? null;
  }
}
