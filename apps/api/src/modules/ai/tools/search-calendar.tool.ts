import { AiTool, AiToolInput } from './ai-tool.port';
import { EventsService } from '../../events/events.service';
import { bounded, clarification, requirePermission, resolveOne, safeDate, validateReadArgs } from './task-tool.schemas';

export class SearchCalendarTool implements AiTool {
  name = 'search_calendar';
  description = 'Busca eventos autorizados em um período limitado.';
  parameters = { type: 'object', additionalProperties: false, properties: { startDate: { type: 'string' }, endDate: { type: 'string' }, requestedTenantUserId: { type: 'string' }, requestedUserName: { type: 'string' } } };
  constructor(private readonly events: EventsService, private readonly users: any) {}

  validate = (args: unknown) => validateReadArgs(args, ['startDate', 'endDate', 'requestedTenantUserId', 'requestedUserName']);
  authorize(input: AiToolInput) { return requirePermission(this.users, input as any, 'calendar.view'); }

  async execute(input: AiToolInput) {
    await this.authorize(input);
    const args = this.validate(input.args) as any;
    let requested = args.requestedTenantUserId;
    if (args.requestedUserName) {
      const match = resolveOne(await this.users.findAll(input.tenantId), args.requestedUserName, 'requestedUserName');
      if (clarification(match)) return match;
      requested = match.id;
    }
    if (requested) await this.users.findOne(input.tenantId, requested);
    const role = (await this.users.findOne(input.tenantId, input.actorTenantUserId))?.role?.name ?? null;
    const rows = await this.events.findAll(input.tenantId, input.actorTenantUserId, role, args.startDate, args.endDate, requested);
    return bounded(rows).map((event: any) => ({
      id: event.id,
      title: event.title,
      startAt: safeDate(event.startAt),
      endAt: safeDate(event.endAt),
      allDay: event.allDay,
      assignee: event.assignee?.user?.name,
      attendees: event.attendees?.map((attendee: any) => attendee.tenantUser?.user?.name).filter(Boolean),
      project: event.project ? { id: event.project.id, name: event.project.name } : undefined,
      task: event.task ? { id: event.task.id, title: event.task.title } : undefined,
    }));
  }
}
