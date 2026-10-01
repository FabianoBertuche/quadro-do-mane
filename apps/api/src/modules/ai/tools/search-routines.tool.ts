import { AiTool, AiToolInput } from './ai-tool.port';
import { DailyRoutineService } from '../../daily-routine/daily-routine.service';
import { bounded, clarification, requirePermission, resolveReadOne, validateReadArgs } from './task-tool.schemas';

export class SearchRoutinesTool implements AiTool {
  name = 'search_routines';
  readOnly = true;
  description = 'Busca rotinas autorizadas sem expor notas privadas.';
  parameters = { type: 'object', additionalProperties: false, required: [], properties: { requestedTenantUserId: { type: 'string' }, requestedUserName: { type: 'string' } } };
  constructor(private readonly routines: DailyRoutineService, private readonly users: any) {}

  validate = (args: unknown) => validateReadArgs(args, ['requestedTenantUserId', 'requestedUserName']);
  authorize(input: AiToolInput) { return requirePermission(this.users, input as any, 'daily_routine.view'); }

  async execute(input: AiToolInput) {
    await this.authorize(input);
    const args = this.validate(input.args) as any;
    let target = args.requestedTenantUserId ?? input.actorTenantUserId;
    if (args.requestedUserName) {
      const match = resolveReadOne(await this.users.findAll(input.tenantId), args.requestedUserName, 'requestedUserName');
      if (clarification(match)) return match;
      target = match.id;
    }
    await this.users.findOne(input.tenantId, target);
    const actor = await this.users.findOne(input.tenantId, input.actorTenantUserId);
    const permissions = (actor?.role?.rolePermissions ?? []).map((item: any) => item.permission?.code ?? item.code).filter(Boolean);
    const rows = await this.routines.getRoutinesForUserAuthorized({
      tenantId: input.tenantId,
      tenantUserId: input.actorTenantUserId,
      roleName: actor?.role?.name ?? null,
      permissions,
    }, target);
    return bounded(rows).map((routine: any) => ({
      id: routine.id,
      title: routine.title,
      scheduledTime: routine.scheduledTime,
      completedToday: routine.completedToday,
    }));
  }
}
