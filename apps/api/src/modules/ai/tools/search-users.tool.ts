import { AiTool, AiToolInput } from './ai-tool.port';
import { bounded, clarification, exact, requirePermission, resolveId, resolveReadOne, validateReadArgs } from './task-tool.schemas';
import { PermissionCode } from './permission-codes';

export class SearchUsersTool implements AiTool {
  name = 'search_users';
  permission: PermissionCode = 'users.view';
  readOnly = true;
  description = 'Busca colaboradores do tenant sem expor dados de contato.';
  parameters = { type: 'object', additionalProperties: false, required: [], properties: { search: { type: 'string' }, name: { type: 'string' }, userId: { type: 'string' } } };
  constructor(private readonly users: any) {}

  validate = (args: unknown) => validateReadArgs(args, ['search', 'name', 'userId']);
  authorize(input: AiToolInput) { return requirePermission(this.users, input as any, 'users.view'); }

  async execute(input: AiToolInput) {
    await this.authorize(input);
    const args = this.validate(input.args) as any;
    const rows = await this.users.findAll(input.tenantId, undefined, undefined, 50);
    let selected = rows;
    if (args.userId) selected = [resolveId(rows, args.userId, 'userId')];
    if (args.name) {
      const match = resolveReadOne(rows, args.name, 'name');
      if (clarification(match)) return match;
      selected = [match];
    }
    if (args.search) selected = selected.filter((row: any) => exact(row.user?.name).includes(exact(args.search)));
    return bounded(selected).map((user: any) => ({
      id: user.id,
      name: user.user?.name,
      role: user.role?.name,
      active: user.isActive ?? user.user?.isActive,
      teams: bounded(user.teamMemberships ?? []).map((membership: any) => membership.team?.name).filter(Boolean),
    }));
  }
}
