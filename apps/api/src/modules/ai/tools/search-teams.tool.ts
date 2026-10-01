import { AiTool, AiToolInput } from './ai-tool.port';
import { TeamsService } from '../../teams/teams.service';
import { bounded, clarification, exact, requirePermission, resolveId, resolveOne, validateReadArgs } from './task-tool.schemas';

export class SearchTeamsTool implements AiTool {
  name = 'search_teams';
  description = 'Busca equipes do tenant com relacionamentos redigidos.';
  parameters = { type: 'object', additionalProperties: false, properties: { search: { type: 'string' }, name: { type: 'string' }, teamId: { type: 'string' } } };
  constructor(private readonly teams: TeamsService, private readonly users: any) {}

  validate = (args: unknown) => validateReadArgs(args, ['search', 'name', 'teamId']);
  authorize(input: AiToolInput) { return requirePermission(this.users, input as any, 'teams.view'); }

  async execute(input: AiToolInput) {
    await this.authorize(input);
    const args = this.validate(input.args) as any;
    const rows = await this.teams.findAll(input.tenantId);
    let selected = rows;
    if (args.teamId) selected = [resolveId(rows, args.teamId, 'teamId')];
    if (args.name) {
      const match = resolveOne(rows, args.name, 'name');
      if (clarification(match)) return match;
      selected = [match];
    }
    if (args.search) selected = selected.filter((row: any) => exact(row.name).includes(exact(args.search)));
    return bounded(selected).map((team: any) => ({
      id: team.id,
      name: team.name,
      color: team.color,
      manager: team.manager?.user?.name,
      members: team.members?.map((member: any) => member.tenantUser?.user?.name).filter(Boolean),
      memberCount: team._count?.members,
      projectCount: team._count?.projects,
    }));
  }
}
