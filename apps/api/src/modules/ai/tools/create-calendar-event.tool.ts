import { ForbiddenException, Injectable } from '@nestjs/common';
import { EventsService } from '../../events/events.service';
import { ProjectsService } from '../../projects/projects.service';
import { UsersService } from '../../users/users.service';
import { AiTool, AiToolInput, AiToolResult } from './ai-tool.port';
import { clarification, requirePermission, resolveOne, TaskToolInput, visibleProjects } from './task-tool.schemas';

const allowed = ['title', 'description', 'type', 'startAt', 'endAt', 'allDay', 'relatedProjectId', 'relatedProjectName', 'relatedTaskId', 'assigneeTenantUserId', 'assigneeName', 'attendeeIds', 'attendeeNames', 'recurrenceRule', 'recurrenceInterval', 'recurrenceUnit', 'recurrenceEndAt', 'remindDaysBefore'];
const validate = (args: unknown): Record<string, any> => {
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Argumentos inválidos');
  const value = args as Record<string, any>;
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown) throw new Error(`Campo não suportado: ${unknown}`);
  for (const field of ['title', 'description', 'type', 'startAt', 'endAt', 'relatedProjectId', 'relatedProjectName', 'relatedTaskId', 'assigneeTenantUserId', 'assigneeName', 'recurrenceRule', 'recurrenceUnit', 'recurrenceEndAt']) {
    if (value[field] !== undefined && typeof value[field] !== 'string') throw new Error(`${field} inválido`);
  }
  if (typeof value.title !== 'string' || !value.title.trim()) throw new Error('title é obrigatório');
  if (value.startAt !== undefined && (Number.isNaN(Date.parse(value.startAt)) || !/[zZ]|[+-]\d\d:\d\d$/.test(value.startAt))) throw new Error('startAt inválido');
  if (value.endAt !== undefined && (Number.isNaN(Date.parse(value.endAt)) || !/[zZ]|[+-]\d\d:\d\d$/.test(value.endAt))) throw new Error('endAt inválido');
  if (value.attendeeIds !== undefined && (!Array.isArray(value.attendeeIds) || value.attendeeIds.some((id: unknown) => typeof id !== 'string'))) throw new Error('attendeeIds inválido');
  if (value.attendeeNames !== undefined && (!Array.isArray(value.attendeeNames) || value.attendeeNames.some((name: unknown) => typeof name !== 'string'))) throw new Error('attendeeNames inválido');
  return value;
};

@Injectable()
export class CreateCalendarEventTool implements AiTool {
  name = 'create_calendar_event';
  description = 'Cria um evento de calendário após resolver projeto e participantes autorizados.';
  parameters = { type: 'object', additionalProperties: false, required: ['title', 'startAt', 'endAt'], properties: Object.fromEntries(allowed.map((field) => [field, { type: field.endsWith('Ids') || field.endsWith('Names') ? 'array' : 'string' }])) };
  validate = validate;

  constructor(private readonly events: EventsService, private readonly users: UsersService, private readonly projects?: ProjectsService) {}

  async authorize(input: AiToolInput): Promise<void | AiToolResult> {
    await requirePermission(this.users, input as TaskToolInput, 'calendar.create');
    return this.resolve(input);
  }

  async execute(input: AiToolInput) {
    const args = validate(input.args);
    const resolved = await this.resolve(input);
    if (clarification(resolved)) return resolved;
    return this.events.create(input.tenantId, input.actorTenantUserId, this.dto(args, resolved) as any);
  }

  private async resolve(input: AiToolInput): Promise<any> {
    const args = validate(input.args);
    if (!args.startAt) return { needsClarification: true, field: 'startAt', matches: [] };
    if (!args.endAt) return { needsClarification: true, field: 'endAt', matches: [] };
    if (!(args.attendeeIds?.length || args.attendeeNames?.length || args.assigneeTenantUserId || args.assigneeName)) {
      return { needsClarification: true, field: 'attendeeIds', matches: [] };
    }
    if (this.projects && (args.relatedProjectId || args.relatedProjectName)) {
      const projects = await visibleProjects(this.projects, this.users, input as TaskToolInput);
      const project = args.relatedProjectId
        ? projects.find((item: any) => item.id === args.relatedProjectId)
        : resolveOne(projects, args.relatedProjectName, 'relatedProjectName');
      if (!project) throw new ForbiddenException('relatedProjectId não encontrado no tenant');
      if (clarification(project)) return project;
      args.relatedProjectId = project.id;
    }
    const attendeeIds = [...(args.attendeeIds ?? [])];
    for (const name of args.attendeeNames ?? []) {
      const match = resolveOne(await this.users.findAll(input.tenantId), name, 'attendeeName');
      if (clarification(match)) return match;
      attendeeIds.push(match.id);
    }
    for (const id of attendeeIds) {
      if (!await this.users.findOne(input.tenantId, id)) throw new ForbiddenException('participante não encontrado no tenant');
    }
    if (args.assigneeTenantUserId && !await this.users.findOne(input.tenantId, args.assigneeTenantUserId)) throw new ForbiddenException('assigneeTenantUserId não encontrado no tenant');
    if (args.assigneeName) {
      const assignee = resolveOne(await this.users.findAll(input.tenantId), args.assigneeName, 'assigneeName');
      if (clarification(assignee)) return assignee;
      args.assigneeTenantUserId = assignee.id;
    }
    return { attendeeIds };
  }

  private dto(args: Record<string, any>, resolved: any) {
    const dto: Record<string, any> = { ...args, attendeeIds: resolved.attendeeIds };
    delete dto.relatedProjectName; delete dto.assigneeName; delete dto.attendeeNames;
    return dto;
  }
}
