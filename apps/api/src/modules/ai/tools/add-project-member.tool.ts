import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { ProjectsService } from '../../projects/projects.service';
import { UsersService } from '../../users/users.service';
import { AiTool, AiToolInput, AiToolResult } from './ai-tool.port';
import { clarification, requirePermission, resolveOne, TaskToolInput } from './task-tool.schemas';

const validate = (args: unknown) => {
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new BadRequestException('Argumentos inválidos');
  const value = args as Record<string, any>;
  if (Object.keys(value).some((key) => !['projectId', 'memberTenantUserId', 'memberName', 'roleInProject'].includes(key))) throw new BadRequestException('Campo não suportado');
  for (const field of ['projectId', 'memberTenantUserId', 'memberName', 'roleInProject']) if (value[field] !== undefined && (typeof value[field] !== 'string' || !value[field].trim())) throw new BadRequestException(`${field} inválido`);
  return value;
};

@Injectable()
export class AddProjectMemberTool implements AiTool {
  name = 'add_project_member';
  description = 'Adiciona um colaborador a um projeto autorizado.';
  parameters = { type: 'object', additionalProperties: false, required: ['projectId'], properties: { projectId: { type: 'string' }, memberTenantUserId: { type: 'string' }, memberName: { type: 'string' }, roleInProject: { type: 'string' } } };
  validate = validate;
  constructor(private readonly projects: ProjectsService, private readonly users: UsersService) {}
  async authorize(input: AiToolInput): Promise<void | AiToolResult> { await requirePermission(this.users, input as TaskToolInput, 'projects.manage_members'); return this.resolve(input); }
  async execute(input: AiToolInput) { const args = validate(input.args); const resolved = await this.resolve(input); if (clarification(resolved)) return resolved; return this.projects.addMember(input.tenantId, args.projectId, resolved.userId, args.roleInProject, input.actorTenantUserId); }
  private async resolve(input: AiToolInput) { const args = validate(input.args); if (!args.projectId) return { needsClarification: true as const, field: 'projectId', matches: [] }; if (!args.memberTenantUserId && !args.memberName) return { needsClarification: true as const, field: 'memberTenantUserId', matches: [] }; if (!await this.projects.findOne(input.tenantId, args.projectId)) throw new ForbiddenException('projectId não encontrado no tenant'); const user = args.memberTenantUserId ? await this.users.findOne(input.tenantId, args.memberTenantUserId) : resolveOne(await this.users.findAll(input.tenantId), args.memberName, 'memberName'); if (clarification(user)) return user; if (!user) throw new ForbiddenException('memberTenantUserId não encontrado no tenant'); return { userId: user.id }; }
}
