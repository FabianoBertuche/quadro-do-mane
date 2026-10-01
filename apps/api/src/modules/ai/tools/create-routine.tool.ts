import { ForbiddenException, Injectable } from '@nestjs/common';
import { DailyRoutineService } from '../../daily-routine/daily-routine.service';
import { UsersService } from '../../users/users.service';
import { AiTool, AiToolInput, AiToolResult } from './ai-tool.port';
import { clarification, requirePermission, resolveOne, TaskToolInput } from './task-tool.schemas';

const validate = (args: unknown): Record<string, any> => {
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Argumentos inválidos');
  const value = args as Record<string, any>;
  const unknown = Object.keys(value).find((key) => !['title', 'description', 'scheduledTime', 'assignedTenantUserId', 'assignedUserName'].includes(key));
  if (unknown) throw new Error(`Campo não suportado: ${unknown}`);
  if (typeof value.title !== 'string' || !value.title.trim()) throw new Error('title é obrigatório');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value.scheduledTime ?? '')) throw new Error('scheduledTime inválido');
  return value;
};

@Injectable()
export class CreateRoutineTool implements AiTool {
  name = 'create_routine';
  description = 'Cria uma rotina diária com responsável inequívoco.';
  parameters = { type: 'object', additionalProperties: false, required: ['title', 'scheduledTime', 'assignedTenantUserId'], properties: { title: { type: 'string' }, description: { type: 'string' }, scheduledTime: { type: 'string' }, assignedTenantUserId: { type: 'string' }, assignedUserName: { type: 'string' } } };
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
    return this.routines.create({ ...args, assignedTenantUserId: resolved.userId } as any, { tenantId: input.tenantId, tenantUserId: input.actorTenantUserId, actorTenantUserId: input.actorTenantUserId } as any);
  }

  private async resolve(input: AiToolInput) {
    const args = validate(input.args);
    if (!args.assignedTenantUserId && !args.assignedUserName) return { needsClarification: true as const, field: 'assignedTenantUserId', matches: [] };
    let user = args.assignedTenantUserId ? await this.users.findOne(input.tenantId, args.assignedTenantUserId) : resolveOne(await this.users.findAll(input.tenantId), args.assignedUserName, 'assignedUserName');
    if (clarification(user)) return user;
    if (!user) throw new ForbiddenException('assignedTenantUserId não encontrado no tenant');
    return { userId: user.id };
  }
}
