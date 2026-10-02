import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AiToolClarification, AiToolClarificationMatch } from './ai-tool.port';

export type TaskToolInput = { tenantId: string; actorTenantUserId: string; args: any };
import { PermissionCode } from './permission-codes';

/** @deprecated Use `PermissionCode`. Mantido só para não quebrar as tools atuais. */
export type Permission = PermissionCode;

const objectArgs = (args: unknown, allowed: string[]) => {
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new BadRequestException('Argumentos inválidos');
  const value = args as Record<string, any>;
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown) throw new BadRequestException(`Campo não suportado: ${unknown}`);
  return value;
};

const nonEmpty = (value: unknown, field: string) => {
  if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(`${field} é obrigatório`);
  return value.trim();
};

const optionalDate = (value: unknown, field: string) => {
  if (value === undefined || value === null) return;
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new BadRequestException(`${field} inválido`);
};

export const validateSearchArgs = (args: unknown) => {
  const value = objectArgs(args, ['search', 'projectId', 'projectName', 'statusId', 'statusName', 'assigneeTenantUserId', 'assigneeName', 'priorityId', 'priorityName']);
  for (const field of ['search', 'projectId', 'projectName', 'statusId', 'statusName', 'assigneeTenantUserId', 'assigneeName', 'priorityId', 'priorityName']) {
    if (value[field] !== undefined && typeof value[field] !== 'string') throw new BadRequestException(`${field} inválido`);
  }
  return value;
};

export const validateCreateArgs = (args: unknown) => {
  const value = objectArgs(args, ['title', 'projectId', 'projectName', 'description', 'assigneeName', 'assigneeTenantUserId', 'statusName', 'statusId', 'priorityName', 'priorityId', 'startDate', 'dueDate']);
  nonEmpty(value.title, 'title');
  for (const field of ['description', 'assigneeName', 'assigneeTenantUserId', 'statusName', 'statusId', 'priorityName', 'priorityId']) {
    if (value[field] !== undefined && typeof value[field] !== 'string') throw new BadRequestException(`${field} inválido`);
  }
  optionalDate(value.startDate, 'startDate');
  optionalDate(value.dueDate, 'dueDate');
  return value;
};

const patchFields = ['title', 'description', 'assigneeName', 'assigneeTenantUserId', 'statusName', 'statusId', 'priorityName', 'priorityId', 'startDate', 'dueDate'];
export const validateUpdateArgs = (args: unknown) => {
  const value = objectArgs(args, ['taskId', ...patchFields]);
  nonEmpty(value.taskId, 'taskId');
  const fields = patchFields.filter((field) => value[field] !== undefined);
  if (!fields.length) throw new BadRequestException('O patch da tarefa não pode ser vazio');
  if (value.title !== undefined) nonEmpty(value.title, 'title');
  for (const field of patchFields.filter((field) => !['title', 'startDate', 'dueDate'].includes(field))) {
    if (value[field] !== undefined && typeof value[field] !== 'string') throw new BadRequestException(`${field} inválido`);
  }
  optionalDate(value.startDate, 'startDate');
  optionalDate(value.dueDate, 'dueDate');
  return value;
};

export const validateMoveArgs = (args: unknown) => {
  const value = objectArgs(args, ['taskId', 'statusId', 'statusName']);
  nonEmpty(value.taskId, 'taskId');
  if (!value.statusId && !value.statusName) throw new BadRequestException('statusId ou statusName é obrigatório');
  return value;
};

export const requirePermission = async (users: any, input: TaskToolInput, permission: Permission) => {
  const actor = await users.findOne(input.tenantId, input.actorTenantUserId);
  const role = actor?.role;
  const codes = (role?.rolePermissions ?? []).map((item: any) => item.permission?.code ?? item.code);
  if (role?.name !== 'admin' && role?.name !== 'gestor' && !codes.includes(permission)) {
    throw new ForbiddenException('Você não tem permissão para usar esta ferramenta');
  }
};

export const validateReadArgs = (
  args: unknown,
  allowed: string[],
  options: { dateRange?: [string, string] } = {},
) => {
  const value = objectArgs(args, allowed);
  for (const field of allowed) {
    if (value[field] !== undefined && (typeof value[field] !== 'string' || !value[field].trim())) {
      throw new BadRequestException(`${field} inválido`);
    }
  }
  const range = options.dateRange;
  if (range) {
    const [startField, endField] = range;
    const start = value[startField];
    const end = value[endField];
    if ((start === undefined) !== (end === undefined)) {
      throw new BadRequestException(`${startField} e ${endField} devem ser informados juntos`);
    }
    if (start !== undefined && (Number.isNaN(Date.parse(start)) || Number.isNaN(Date.parse(end)) || new Date(end) <= new Date(start))) {
      throw new BadRequestException('Período inválido');
    }
  }
  return value;
};

export const bounded = <T>(items: T[]) => items.slice(0, 50);

export const safeDate = (value: unknown) => value instanceof Date
  ? value.toISOString()
  : typeof value === 'string' ? new Date(value).toISOString() : value;

export const actorRoleName = async (users: any, input: TaskToolInput) => {
  const actor = await users.findOne(input.tenantId, input.actorTenantUserId);
  return actor?.role?.name ?? null;
};

export const visibleProjects = async (projects: any, users: any, input: TaskToolInput) =>
  projects.findAll(input.tenantId, input.actorTenantUserId, await actorRoleName(users, input));

export const assertVisibleProject = (projects: any[], projectId: string, field = 'projectId') =>
  resolveId(projects, projectId, field);

export const exact = (value: unknown) => typeof value === 'string' ? value.trim().toLocaleLowerCase() : '';

const clarificationMatch = (item: any, field: string): AiToolClarificationMatch => {
  const name = item.name ?? item.user?.name;
  if (typeof item.id !== 'string' || typeof name !== 'string') throw new ForbiddenException(`${field} não encontrado no tenant`);
  return { id: item.id, name };
};

export const resolveOne = (items: any[], name: string, field: string) => {
  const matches = items.filter((item) => exact(item.name ?? item.user?.name) === exact(name));
  if (matches.length > 1) return { needsClarification: true as const, field, matches: matches.map((item) => clarificationMatch(item, field)) };
  if (matches.length === 0) throw new ForbiddenException(`${field} não encontrado no tenant`);
  return matches[0];
};

export const resolveReadOne = (items: any[], name: string, field: string) => {
  const matches = items.filter((item) => exact(item.name ?? item.user?.name) === exact(name));
  if (matches.length > 1) {
    return {
      needsClarification: true as const,
      field,
      matches: matches.map((item) => clarificationMatch(item, field)),
    };
  }
  if (matches.length === 0) throw new ForbiddenException(`${field} não encontrado no tenant`);
  return matches[0];
};

export const resolveId = (items: any[], id: string, field: string) => {
  const match = items.find((item) => item.id === id);
  if (!match) throw new ForbiddenException(`${field} não encontrado no tenant`);
  return match;
};

export const clarification = (value: any): value is AiToolClarification => value?.needsClarification === true;

export const missingProject = () => ({ needsClarification: true as const, field: 'projectName', matches: [] });
