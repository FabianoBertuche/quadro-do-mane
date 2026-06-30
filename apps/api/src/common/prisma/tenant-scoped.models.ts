/**
 * Lista central de models que carregam `tenantId` na tabela.
 *
 * Prisma Client Extension usa este conjunto para injetar automaticamente
 * `where: { tenantId }` em todas as queries quando há um tenant ativo no contexto.
 *
 * IMPORTANTE: qualquer model novo que tenha `tenantId` no schema DEVE ser adicionado aqui.
 *              Models SEM tenantId (Tenant, Plan, User, Permission, Role global, etc.) NÃO entram.
 */
export const TENANT_SCOPED_MODELS: ReadonlySet<string> = new Set([
  // Auth/sessões
  'TenantUser',
  'RefreshToken',

  // RBAC customizado por tenant
  'Role', // Roles com tenantId != null são customizadas
  'EmailSetting',

  // Equipes / projetos / tarefas
  'Team',
  'TeamMember',
  'Project',
  'ProjectMember',
  'ProjectView',
  'TaskStatus',
  'TaskPriority',
  'Task',
  'TaskAssignee',
  'TaskTag',
  'TaskTagLink',
  'TaskChecklist',
  'TaskChecklistItem',
  'TaskComment',
  'Attachment',

  // Calendário
  'Event',
  'EventAttendee',

  // Catálogo
  'Contact',

  // Engajamento
  'Notification',
  'ActivityLog',
  'AuditLog',

  // Billing / limites
  'Subscription',
  'UsageCounter',

  // Avançado
  'Automation',
  'CustomField',
  'CustomFieldValue',
]);

/**
 * Helper: verifica se um model é tenant-scoped.
 */
export function isTenantScoped(modelName: string): boolean {
  return TENANT_SCOPED_MODELS.has(modelName);
}