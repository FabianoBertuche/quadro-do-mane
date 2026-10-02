import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { TeamsService } from '../../teams/teams.service';
import { UsersService } from '../../users/users.service';
import { AiTool, AiToolInput, AiToolResult } from './ai-tool.port';
import { clarification, requirePermission, resolveOne, TaskToolInput } from './task-tool.schemas';
import { PermissionCode } from './permission-codes';

const validate = (args: unknown) => {
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new BadRequestException('Argumentos inválidos');
  const value = args as Record<string, any>;
  if (Object.keys(value).some((key) => !['teamId', 'memberTenantUserId', 'memberName'].includes(key))) throw new BadRequestException('Campo não suportado');
  for (const field of ['teamId', 'memberTenantUserId', 'memberName']) if (value[field] !== undefined && (typeof value[field] !== 'string' || !value[field].trim())) throw new BadRequestException(`${field} inválido`);
  return value;
};

@Injectable()
export class AddTeamMemberTool implements AiTool {
  name = 'add_team_member';
  permission: PermissionCode = 'teams.manage_members';
  description = 'Adiciona um colaborador a uma equipe autorizada.';
  parameters = { type: 'object', additionalProperties: false, required: ['teamId'], properties: { teamId: { type: 'string' }, memberTenantUserId: { type: 'string' }, memberName: { type: 'string' } } };
  validate = validate;
  constructor(private readonly teams: TeamsService, private readonly users: UsersService) {}
  async authorize(input: AiToolInput): Promise<void | AiToolResult> { await requirePermission(this.users, input as TaskToolInput, 'teams.manage_members'); return this.resolve(input); }
  async execute(input: AiToolInput) { const args = validate(input.args); const resolved = await this.resolve(input); if (clarification(resolved)) return resolved; return this.teams.addMember(input.tenantId, args.teamId, resolved.userId, input.actorTenantUserId); }
  private async resolve(input: AiToolInput) { const args = validate(input.args); if (!args.teamId) return { needsClarification: true as const, field: 'teamId', matches: [] }; if (!args.memberTenantUserId && !args.memberName) return { needsClarification: true as const, field: 'memberTenantUserId', matches: [] }; if (!await this.teams.findOne(input.tenantId, args.teamId)) throw new ForbiddenException('teamId não encontrado no tenant'); const user = args.memberTenantUserId ? await this.users.findOne(input.tenantId, args.memberTenantUserId) : resolveOne(await this.users.findAll(input.tenantId), args.memberName, 'memberName'); if (clarification(user)) return user; if (!user) throw new ForbiddenException('memberTenantUserId não encontrado no tenant'); return { userId: user.id }; }
}
