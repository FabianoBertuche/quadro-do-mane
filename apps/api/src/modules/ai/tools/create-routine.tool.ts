import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { DailyRoutineService } from '../../daily-routine/daily-routine.service';
import { UsersService } from '../../users/users.service';
import { AiTool, AiToolInput, AiToolResult } from './ai-tool.port';
import { clarification, requirePermission, resolveOne, TaskToolInput } from './task-tool.schemas';
import { PermissionCode } from './permission-codes';

const validate = (args: unknown): Record<string, any> => {
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new BadRequestException('Argumentos inválidos');
  const value = args as Record<string, any>;
  const unknown = Object.keys(value).find((key) => !['title', 'description', 'scheduledTime', 'assignedTenantUserId', 'assignedUserName'].includes(key));
  if (unknown) throw new BadRequestException(`Campo não suportado: ${unknown}`);
  if (typeof value.title !== 'string' || !value.title.trim()) throw new BadRequestException('title é obrigatório');
  if (value.description !== undefined && typeof value.description !== 'string') throw new BadRequestException('description inválido');
  if (value.scheduledTime !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.scheduledTime)) throw new BadRequestException('scheduledTime inválido');
  for (const field of ['assignedTenantUserId', 'assignedUserName']) if (value[field] !== undefined && (typeof value[field] !== 'string' || !value[field].trim())) throw new BadRequestException(`${field} inválido`);
  return value;
};

@Injectable()
export class CreateRoutineTool implements AiTool {
  name = 'create_routine';
  permission: PermissionCode = 'daily_routine.manage';
  description = 'Cria uma rotina diária com responsável inequívoco.';
  parameters = { type: 'object', additionalProperties: false, required: ['title'], properties: { title: { type: 'string' }, description: { type: 'string' }, scheduledTime: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' }, assignedTenantUserId: { type: 'string' }, assignedUserName: { type: 'string' } } };
  validate = validate;

  constructor(private readonly routines: DailyRoutineService, private readonly users: UsersService) {}

  async authorize(input: AiToolInput): Promise<void | AiToolResult> {
    await requirePermission(this.users, input as TaskToolInput, 'daily_routine.manage');
    return this.resolve(input);
  }

  async execute(input: AiToolInput) {
    const args = validate(input.args);
    const resolved = await this.resolve(input);
    if (clarification(resolved)) return resolved;
    const dto = { ...args };
    delete dto.assignedUserName;
    if (resolved.userId) dto.assignedTenantUserId = resolved.userId;
    return this.routines.create(dto as any, { tenantId: input.tenantId, tenantUserId: input.actorTenantUserId, actorTenantUserId: input.actorTenantUserId } as any);
  }

  private async resolve(input: AiToolInput) {
    const args = validate(input.args);
    if (!args.scheduledTime) return { needsClarification: true as const, field: 'scheduledTime', matches: [] };
    if (!args.assignedTenantUserId && !args.assignedUserName) return {};
    let user = args.assignedTenantUserId ? await this.users.findOne(input.tenantId, args.assignedTenantUserId) : resolveOne(await this.users.findAll(input.tenantId), args.assignedUserName, 'assignedUserName');
    if (clarification(user)) return user;
    if (!user) throw new ForbiddenException('assignedTenantUserId não encontrado no tenant');
    return { userId: user.id };
  }
}
