import { BadRequestException, ForbiddenException } from '@nestjs/common';

export type TaskToolInput = { tenantId: string; actorTenantUserId: string; args: any };
export type Permission = 'tasks.view' | 'tasks.create' | 'tasks.edit' | 'tasks.change_status';

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
  if (!value.projectId && !value.projectName) throw new BadRequestException('projectId ou projectName é obrigatório');
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

export const exact = (value: unknown) => typeof value === 'string' ? value.trim().toLocaleLowerCase() : '';

export const resolveOne = (items: any[], name: string, field: string) => {
  const matches = items.filter((item) => exact(item.name ?? item.user?.name) === exact(name));
  if (matches.length > 1) return { needsClarification: true, field, matches: matches.map((item) => item.id) };
  if (matches.length === 0) throw new ForbiddenException(`${field} não encontrado no tenant`);
  return matches[0];
};

export const resolveId = (items: any[], id: string, field: string) => {
  const match = items.find((item) => item.id === id);
  if (!match) throw new ForbiddenException(`${field} não encontrado no tenant`);
  return match;
};

export const clarification = (value: any): value is { needsClarification: true } => value?.needsClarification === true;
