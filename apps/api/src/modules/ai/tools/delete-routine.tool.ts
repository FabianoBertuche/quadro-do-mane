import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { DailyRoutineService } from '../../daily-routine/daily-routine.service';
import { UsersService } from '../../users/users.service';
import { AiTool, AiToolInput, AiToolResult } from './ai-tool.port';
import { requirePermission, TaskToolInput } from './task-tool.schemas';

const validate = (args: unknown): { routineId: string } => {
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new BadRequestException('Argumentos inválidos');
  const value = args as Record<string, any>;
  const unknown = Object.keys(value).find((key) => key !== 'routineId');
  if (unknown) throw new BadRequestException(`Campo não suportado: ${unknown}`);
  if (typeof value.routineId !== 'string' || !value.routineId.trim()) throw new BadRequestException('routineId é obrigatório');
  return { routineId: value.routineId };
};

@Injectable()
export class DeleteRoutineTool implements AiTool {
  name = 'delete_routine';
  description = 'Remove uma rotina diária existente. Use search_routines para encontrar o ID da rotina.';
  parameters = { type: 'object', additionalProperties: false, required: ['routineId'], properties: { routineId: { type: 'string' } } };
  validate = validate;

  constructor(private readonly routines: DailyRoutineService, private readonly users: UsersService) {}

  async authorize(input: AiToolInput): Promise<void | AiToolResult> {
    await requirePermission(this.users, input as TaskToolInput, 'daily_routine.manage');
  }

  async execute(input: AiToolInput) {
    const args = validate(input.args);
    return this.routines.remove(args.routineId, input.tenantId);
  }
}