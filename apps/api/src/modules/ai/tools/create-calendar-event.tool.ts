import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { EventsService } from '../../events/events.service';
import { ProjectsService } from '../../projects/projects.service';
import { UsersService } from '../../users/users.service';
import { AiTool, AiToolInput, AiToolResult } from './ai-tool.port';
import { clarification, requirePermission, resolveOne, TaskToolInput, visibleProjects } from './task-tool.schemas';

const allowed = ['title', 'description', 'type', 'startAt', 'endAt', 'allDay', 'relatedProjectId', 'relatedProjectName', 'relatedTaskId', 'assigneeTenantUserId', 'assigneeName', 'attendeeIds', 'attendeeNames', 'recurrenceRule', 'recurrenceInterval', 'recurrenceUnit', 'recurrenceEndAt', 'remindDaysBefore'];
const recurrenceUnits = ['day', 'week', 'month', 'year'] as const;
const recurrenceRules = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM'] as const;
const validate = (args: unknown): Record<string, any> => {
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new BadRequestException('Argumentos inválidos');
  const value = args as Record<string, any>;
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown) throw new BadRequestException(`Campo não suportado: ${unknown}`);
  const stringFields = ['title', 'description', 'type', 'startAt', 'endAt', 'relatedProjectId', 'relatedProjectName', 'relatedTaskId', 'assigneeTenantUserId', 'assigneeName', 'recurrenceRule', 'recurrenceUnit', 'recurrenceEndAt'];
  for (const field of stringFields) {
    if (value[field] !== undefined && (typeof value[field] !== 'string' || !value[field].trim())) throw new BadRequestException(`${field} inválido`);
  }
  if (typeof value.title !== 'string' || !value.title.trim()) throw new BadRequestException('title é obrigatório');
  for (const field of ['startAt', 'endAt']) {
    if (value[field] !== undefined && (Number.isNaN(Date.parse(value[field])) || !/[zZ]|[+-]\d\d:\d\d$/.test(value[field]))) throw new BadRequestException(`${field} inválido`);
  }
  if (value.startAt && value.endAt && new Date(value.endAt) <= new Date(value.startAt)) throw new BadRequestException('endAt deve ser posterior a startAt');
  if (value.allDay !== undefined && typeof value.allDay !== 'boolean') throw new BadRequestException('allDay inválido');
  if (value.attendeeIds !== undefined && (!Array.isArray(value.attendeeIds) || value.attendeeIds.length === 0 || value.attendeeIds.some((id: unknown) => typeof id !== 'string' || !id.trim()))) throw new BadRequestException('attendeeIds inválido');
  if (value.attendeeNames !== undefined && (!Array.isArray(value.attendeeNames) || value.attendeeNames.length === 0 || value.attendeeNames.some((name: unknown) => typeof name !== 'string' || !name.trim()))) throw new BadRequestException('attendeeNames inválido');
  if (value.recurrenceRule !== undefined && !recurrenceRules.includes(value.recurrenceRule)) throw new BadRequestException('recurrenceRule inválido');
  if (value.recurrenceUnit !== undefined && !recurrenceUnits.includes(value.recurrenceUnit)) throw new BadRequestException('recurrenceUnit inválido');
  if (value.recurrenceInterval !== undefined && (!Number.isInteger(value.recurrenceInterval) || value.recurrenceInterval < 1 || value.recurrenceInterval > 365)) throw new BadRequestException('recurrenceInterval inválido');
  if (value.remindDaysBefore !== undefined && (!Number.isInteger(value.remindDaysBefore) || value.remindDaysBefore < 0 || value.remindDaysBefore > 365)) throw new BadRequestException('remindDaysBefore inválido');
  const recurrenceConfigured = value.recurrenceRule !== undefined;
  const recurrenceFieldsPresent = value.recurrenceInterval !== undefined || value.recurrenceUnit !== undefined || value.recurrenceEndAt !== undefined;
  if (recurrenceConfigured && !value.recurrenceEndAt) throw new BadRequestException('recurrenceEndAt é obrigatório com recurrenceRule');
  if (!recurrenceConfigured && recurrenceFieldsPresent) throw new BadRequestException('recurrenceRule é obrigatório para configurar recorrência');
  if (value.recurrenceEndAt && Number.isNaN(Date.parse(value.recurrenceEndAt))) throw new BadRequestException('recurrenceEndAt inválido');
  if (value.recurrenceEndAt && value.startAt && new Date(value.recurrenceEndAt) < new Date(value.startAt)) throw new BadRequestException('recurrenceEndAt deve ser posterior a startAt');
  if (value.recurrenceRule === 'CUSTOM' && !value.recurrenceUnit) throw new BadRequestException('recurrenceUnit é obrigatório com CUSTOM');
  const presetUnits: Record<string, string> = { DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month', YEARLY: 'year' };
  if (value.recurrenceRule && value.recurrenceRule !== 'CUSTOM' && value.recurrenceUnit && presetUnits[value.recurrenceRule] !== value.recurrenceUnit) throw new BadRequestException('recurrenceUnit incompatível com recurrenceRule');
  return value;
};

@Injectable()
export class CreateCalendarEventTool implements AiTool {
  name = 'create_calendar_event';
  description = 'Cria um evento de calendário após resolver projeto e participantes autorizados.';
  parameters = { type: 'object', additionalProperties: false, required: ['title', 'startAt', 'endAt'], properties: {
    title: { type: 'string', minLength: 1 }, description: { type: 'string', minLength: 1 }, type: { type: 'string', minLength: 1 }, startAt: { type: 'string', minLength: 1 }, endAt: { type: 'string', minLength: 1 }, allDay: { type: 'boolean' }, relatedProjectId: { type: 'string', minLength: 1 }, relatedProjectName: { type: 'string', minLength: 1 }, relatedTaskId: { type: 'string', minLength: 1 }, assigneeTenantUserId: { type: 'string', minLength: 1 }, assigneeName: { type: 'string', minLength: 1 }, attendeeIds: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } }, attendeeNames: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } }, recurrenceRule: { type: 'string', minLength: 1, enum: recurrenceRules }, recurrenceInterval: { type: 'integer', minimum: 1, maximum: 365 }, recurrenceUnit: { type: 'string', minLength: 1, enum: recurrenceUnits }, recurrenceEndAt: { type: 'string', minLength: 1 }, remindDaysBefore: { type: 'integer', minimum: 0, maximum: 365 },
  } };
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
