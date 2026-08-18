'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  RefreshCw,
  Filter,
  User as UserIcon,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
  ListChecks,
  FolderKanban,
  CheckSquare,
} from 'lucide-react';
import { api } from '@/lib/api';
import { usePermission } from '@/lib/permissions';

// ────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────

interface ActivityEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorTenantUserId: string | null;
  oldValuesJson: string | null;
  newValuesJson: string | null;
  createdAt: string;
  actor: {
    user: { id: string; name: string; email: string; avatarUrl: string | null };
  } | null;
}

interface UserOption {
  id: string;
  user: { id: string; name: string; email: string };
  role: { id: string; name: string } | null;
}

// ────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────

function entityTypeInfo(type: string) {
  switch (type) {
    case 'Task':
      return { icon: CheckSquare, label: 'Tarefa', classes: 'bg-blue-500/10 text-blue-600 border-blue-500/20' };
    case 'DailyRoutine':
      return { icon: ListChecks, label: 'Rotina Diária', classes: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' };
    case 'Project':
      return { icon: FolderKanban, label: 'Projeto', classes: 'bg-purple-500/10 text-purple-600 border-purple-500/20' };
    default:
      return { icon: Activity, label: type, classes: 'bg-muted text-muted-foreground border-border' };
  }
}

function actionLabel(action: string): string {
  switch (action) {
    case 'STATUS_CHANGED': return 'Status alterado';
    case 'TASK_COMPLETED': return 'Tarefa concluída';
    case 'TASK_REOPENED': return 'Tarefa reaberta';
    case 'TASK_CREATED': return 'Tarefa criada';
    case 'TASK_ARCHIVED': return 'Tarefa arquivada';
    case 'TASK_UPDATED': return 'Tarefa atualizada';
    case 'PRIORITY_CHANGED': return 'Prioridade alterada';
    case 'COMMENT_ADDED': return 'Nota adicionada';
    case 'COMMENT_REMOVED': return 'Nota removida';
    case 'CHECKLIST_CREATED': return 'Checklist criado';
    case 'CHECKLIST_ITEM_ADDED': return 'Item adicionado';
    case 'CHECKLIST_ITEM_COMPLETED': return 'Item concluído';
    case 'CHECKLIST_ITEM_UNCHECKED': return 'Item desmarcado';
    case 'ATTACHMENT_REMOVED': return 'Anexo removido';
    case 'ROUTINE_COMPLETED': return 'Rotina concluída';
    case 'ROUTINE_CREATED': return 'Rotina criada';
    default: return action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function describeActivity(entry: ActivityEntry): string {
  const newValues = prettyJson(entry.newValuesJson);
  const oldValues = prettyJson(entry.oldValuesJson);

  if (!newValues) return actionLabel(entry.action);

  switch (entry.action) {
    case 'TASK_CREATED': {
      const title = newValues.taskTitle ?? 'Sem título';
      const project = newValues.projectCode ? ` no projeto ${newValues.projectName} (${newValues.projectCode})` : '';
      const status = newValues.statusName ? ` com status "${newValues.statusName}"` : '';
      return `Criou a tarefa "${title}"${project}${status}`;
    }
    case 'TASK_COMPLETED': {
      const title = newValues.taskTitle ?? 'Sem título';
      const project = newValues.projectName ? ` no projeto "${newValues.projectName}"` : '';
      return `Concluiu a tarefa "${title}"${project}`;
    }
    case 'TASK_REOPENED': {
      const title = newValues.taskTitle ?? 'Sem título';
      return `Reabriu a tarefa "${title}"`;
    }
    case 'TASK_ARCHIVED': {
      const title = newValues.taskTitle ?? 'Sem título';
      const project = newValues.projectName ? ` do projeto "${newValues.projectName}"` : '';
      return `Arquivou a tarefa "${title}"${project}`;
    }
    case 'STATUS_CHANGED': {
      const title = newValues.taskTitle ?? 'Sem título';
      const oldStatus = oldValues?.oldStatusName ?? newValues?.oldStatusName ?? 'Desconhecido';
      const newStatus = newValues.newStatusName ?? 'Desconhecido';
      const project = newValues.projectName ? ` no projeto "${newValues.projectName}"` : '';
      return `Moveu "${title}" de "${oldStatus}" para "${newStatus}"${project}`;
    }
    case 'ROUTINE_COMPLETED': {
      const title = newValues.title ?? 'Sem título';
      const time = newValues.scheduledTime ? ` (${newValues.scheduledTime})` : '';
      const assignee = newValues.assignedUserName ? ` por ${newValues.assignedUserName}` : '';
      return `Concluiu a rotina "${title}"${time}${assignee}`;
    }
    case 'ROUTINE_CREATED': {
      const title = newValues.title ?? 'Sem título';
      const time = newValues.scheduledTime ? ` às ${newValues.scheduledTime}` : '';
      return `Criou a rotina "${title}"${time}`;
    }
    case 'TASK_UPDATED': {
      const title = newValues.taskTitle ?? 'Sem título';
      const parts: string[] = [];
      if (oldValues?.oldTitle || newValues?.newTitle) {
        parts.push(`título de "${oldValues?.oldTitle ?? ''}" para "${newValues?.newTitle ?? ''}"`);
      }
      if (oldValues?.oldDescription !== undefined || newValues?.newDescription !== undefined) {
        const oldDesc = oldValues?.oldDescription ? 'sim' : 'não';
        const newDesc = newValues?.newDescription ? 'sim' : 'não';
        if (oldDesc !== newDesc) parts.push(`descrição`);
      }
      if (oldValues?.oldStatusName || newValues?.newStatusName) {
        parts.push(`status de "${oldValues?.oldStatusName ?? ''}" para "${newValues?.newStatusName ?? ''}"`);
      }
      if (oldValues?.oldPriorityName || newValues?.newPriorityName) {
        parts.push(`prioridade de "${oldValues?.oldPriorityName ?? 'Nenhuma'}" para "${newValues?.newPriorityName ?? 'Nenhuma'}"`);
      }
      if (oldValues?.oldAssigneeName !== undefined || newValues?.newAssigneeName !== undefined) {
        const oldA = oldValues?.oldAssigneeName ?? 'Nenhum';
        const newA = newValues?.newAssigneeName ?? 'Nenhum';
        if (oldA !== newA) parts.push(`responsável de "${oldA}" para "${newA}"`);
      }
      if (oldValues?.oldStartDate !== undefined || newValues?.newStartDate !== undefined) {
        parts.push(`data inicial`);
      }
      if (oldValues?.oldDueDate !== undefined || newValues?.newDueDate !== undefined) {
        parts.push(`prazo`);
      }
      const project = newValues.projectName ? ` no projeto "${newValues.projectName}"` : '';
      return `Atualizou a tarefa "${title}" — ${parts.join(', ')}${project}`;
    }
    case 'PRIORITY_CHANGED': {
      const title = newValues.taskTitle ?? 'Sem título';
      const oldP = oldValues?.oldPriorityName ?? 'Nenhuma';
      const newP = newValues?.newPriorityName ?? 'Nenhuma';
      const project = newValues.projectName ? ` no projeto "${newValues.projectName}"` : '';
      return `Alterou prioridade de "${title}" de "${oldP}" para "${newP}"${project}`;
    }
    case 'COMMENT_ADDED': {
      const title = newValues.taskTitle ?? 'tarefa';
      const author = newValues.authorName ?? 'Alguém';
      return `${author} adicionou uma nota na tarefa "${title}"`;
    }
    case 'COMMENT_REMOVED': {
      const title = newValues.taskTitle ?? 'tarefa';
      return `Removeu uma nota da tarefa "${title}"`;
    }
    case 'CHECKLIST_CREATED': {
      const title = newValues.taskTitle ?? 'tarefa';
      const checklistTitle = newValues.checklistTitle ?? '';
      return `Criou checklist "${checklistTitle}" na tarefa "${title}"`;
    }
    case 'CHECKLIST_ITEM_ADDED': {
      const title = newValues.taskTitle ?? 'tarefa';
      const item = newValues.itemContent ?? '';
      return `Adicionou item "${item}" ao checklist da tarefa "${title}"`;
    }
    case 'CHECKLIST_ITEM_COMPLETED': {
      const title = newValues.taskTitle ?? 'tarefa';
      const item = newValues.itemContent ?? '';
      return `Concluiu item "${item}" do checklist da tarefa "${title}"`;
    }
    case 'CHECKLIST_ITEM_UNCHECKED': {
      const title = newValues.taskTitle ?? 'tarefa';
      const item = newValues.itemContent ?? '';
      return `Desmarcou item "${item}" do checklist da tarefa "${title}"`;
    }
    case 'ATTACHMENT_REMOVED': {
      const title = newValues.taskTitle ?? 'tarefa';
      const fileName = newValues.fileName ?? '';
      return `Removeu anexo "${fileName}" da tarefa "${title}"`;
    }
    default:
      return actionLabel(entry.action);
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch { return iso; }
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

interface RichValues {
  taskTitle?: string;
  projectName?: string;
  projectCode?: string;
  statusName?: string;
  oldStatusName?: string;
  newStatusName?: string;
  title?: string;
  scheduledTime?: string;
  assignedUserName?: string;
  completedByName?: string;
  newPriorityName?: string;
  oldPriorityName?: string;
  oldTitle?: string;
  newTitle?: string;
  oldDescription?: string;
  newDescription?: string;
  oldAssigneeName?: string;
  newAssigneeName?: string;
  oldStartDate?: string;
  newStartDate?: string;
  oldDueDate?: string;
  newDueDate?: string;
  authorName?: string;
  checklistTitle?: string;
  itemContent?: string;
  fileName?: string;
  date?: string;
  notes?: string;
  [key: string]: unknown;
}

function prettyJson<T = RichValues>(json?: string | null): T | null {
  if (!json) return null;
  try { return JSON.parse(json) as T; } catch { return null; }
}

// ────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────

export default function OperationalDashboardPage() {
  const canView = usePermission('audit.view');

  const [entityType, setEntityType] = useState('');
  const [userId, setUserId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [take, setTake] = useState(200);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: users } = useQuery<UserOption[]>({
    queryKey: ['users-list'],
    queryFn: () => api.get('/users').then((r) => r.data),
  });

  const { data, isLoading, isError, isFetching } = useQuery<ActivityEntry[]>({
    queryKey: ['activity-log', { entityType, userId, startDate, endDate, take }],
    queryFn: async () => {
      const params: Record<string, string> = { take: String(take) };
      if (entityType) params.entityType = entityType;
      if (userId) params.actorTenantUserId = userId;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const res = await api.get('/activity-log', { params });
      return res.data;
    },
    enabled: canView,
    refetchOnWindowFocus: false,
  });

  // Stats
  const stats = useMemo(() => {
    if (!data) return { tasks: 0, routines: 0, projects: 0 };
    return {
      tasks: data.filter((e) => e.entityType === 'Task').length,
      routines: data.filter((e) => e.entityType === 'DailyRoutine').length,
      projects: data.filter((e) => e.entityType === 'Project').length,
    };
  }, [data]);

  if (!canView) {
    return (
      <div className="text-center py-20">
        <Activity className="w-12 h-12 mx-auto text-muted-foreground" />
        <h1 className="mt-4 text-xl font-semibold">Sem permissão</h1>
        <p className="text-muted-foreground mt-2">
          Você não tem permissão para visualizar esta página.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6" />
            Atividades Operacionais
          </h1>
          <p className="text-muted-foreground mt-1">
            Mudanças em tarefas, rotinas diárias e projetos.
          </p>
        </div>
        <button
          onClick={() => {}}
          disabled={isFetching}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-lg shadow-primary/30"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Filters */}
      <div className="p-5 rounded-2xl bg-card border border-border shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <Filter className="w-3.5 h-3.5" />
          Filtros
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          {/* Entity Type */}
          <div className="flex-1 space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Tipo de Entidade
            </label>
            <select
              className="w-full px-3 py-2 rounded-xl bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-primary text-sm appearance-none"
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="Task">Tarefas</option>
              <option value="DailyRoutine">Rotinas Diárias</option>
              <option value="Project">Projetos</option>
            </select>
          </div>

          {/* User */}
          <div className="flex-1 space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Usuário
            </label>
            <select
              className="w-full px-3 py-2 rounded-xl bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-primary text-sm appearance-none"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              <option value="">Todos</option>
              {users?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.user.name}{u.role ? ` — ${u.role.name}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div className="flex-1 space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              <Calendar className="inline w-3 h-3 mr-1" />
              Data Início
            </label>
            <input
              type="date"
              className="w-full px-3 py-2 rounded-xl bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          {/* End Date */}
          <div className="flex-1 space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              <Calendar className="inline w-3 h-3 mr-1" />
              Data Fim
            </label>
            <input
              type="date"
              className="w-full px-3 py-2 rounded-xl bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          {/* Limit */}
          <div className="w-28 space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Limite
            </label>
            <select
              className="w-full px-3 py-2 rounded-xl bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              value={take}
              onChange={(e) => setTake(parseInt(e.target.value, 10))}
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </div>
        </div>

        {/* Active filters */}
        {(entityType || userId || startDate || endDate) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium">Filtros ativos:</span>
            {entityType && (
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                {entityType === 'Task' ? 'Tarefas' : entityType === 'DailyRoutine' ? 'Rotinas' : 'Projetos'}
              </span>
            )}
            {userId && (
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                {users?.find((u) => u.user.id === userId)?.user.name ?? userId}
              </span>
            )}
            {startDate && (
              <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                De: {startDate}
              </span>
            )}
            {endDate && (
              <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                Até: {endDate}
              </span>
            )}
            <button
              onClick={() => { setEntityType(''); setUserId(''); setStartDate(''); setEndDate(''); }}
              className="ml-auto text-destructive hover:underline"
            >
              Limpar tudo
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm text-center">
          <div className="text-2xl font-bold text-foreground">{stats.tasks}</div>
          <div className="text-xs text-muted-foreground mt-1">Tarefas</div>
        </div>
        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm text-center">
          <div className="text-2xl font-bold text-foreground">{stats.routines}</div>
          <div className="text-xs text-muted-foreground mt-1">Rotinas Diárias</div>
        </div>
        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm text-center">
          <div className="text-2xl font-bold text-foreground">{stats.projects}</div>
          <div className="text-xs text-muted-foreground mt-1">Projetos</div>
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">
            <div className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Carregando atividades...
            </div>
          </div>
        ) : isError ? (
          <div className="p-12 text-center text-destructive">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
            Erro ao carregar atividades.
          </div>
        ) : !data || data.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
            Nenhuma atividade encontrada com os filtros atuais.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {data.map((entry) => {
              const info = entityTypeInfo(entry.entityType);
              const Icon = info.icon;
              const isExpanded = expandedId === entry.id;
              const newValues = prettyJson(entry.newValuesJson);
              const oldValues = prettyJson(entry.oldValuesJson);

              return (
                <div key={entry.id} className="hover:bg-muted/30 transition-colors">
                  {/* Main row */}
                  <div
                    className="flex items-center gap-4 px-5 py-3.5 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  >
                    {/* Type badge */}
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-semibold shrink-0 ${info.classes}`}>
                      <Icon className="w-3 h-3" />
                      {info.label}
                    </div>

                    {/* Actor */}
                    <div className="flex items-center gap-2 min-w-[160px] shrink-0">
                      {entry.actor?.user?.avatarUrl ? (
                        <img src={entry.actor.user.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                          <UserIcon className="w-3 h-3 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">
                          {entry.actor?.user?.name ?? 'Sistema'}
                        </div>
                      </div>
                    </div>

                    {/* Rich description */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground leading-snug">
                        {describeActivity(entry)}
                      </p>
                    </div>

                    {/* Timestamp */}
                    <div className="text-right shrink-0">
                      <div className="text-xs tabular-nums text-muted-foreground">
                        {formatDate(entry.createdAt)}
                      </div>
                      <div className="text-[10px] text-muted-foreground/60">
                        {formatRelative(entry.createdAt)}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-5 pb-4 pt-1 border-t border-border/50">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                        {newValues?.taskTitle && (
                          <div>
                            <span className="text-muted-foreground font-medium">Tarefa</span>
                            <div className="mt-1 font-medium">{newValues.taskTitle}</div>
                          </div>
                        )}
                        {newValues?.projectName && (
                          <div>
                            <span className="text-muted-foreground font-medium">Projeto</span>
                            <div className="mt-1">
                              {newValues.projectCode && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-semibold mr-1.5">
                                  {newValues.projectCode}
                                </span>
                              )}
                              {newValues.projectName}
                            </div>
                          </div>
                        )}
                        {oldValues?.oldStatusName && newValues?.newStatusName && (
                          <div>
                            <span className="text-muted-foreground font-medium">Alteração de Status</span>
                            <div className="mt-1 flex items-center gap-1.5">
                              <span className="px-1.5 py-0.5 rounded bg-muted text-xs">{oldValues.oldStatusName}</span>
                              <span className="text-muted-foreground">→</span>
                              <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs">{newValues.newStatusName}</span>
                            </div>
                          </div>
                        )}
                        {newValues?.scheduledTime && (
                          <div>
                            <span className="text-muted-foreground font-medium">Horário</span>
                            <div className="mt-1">{newValues.scheduledTime}</div>
                          </div>
                        )}
                        {newValues?.assignedUserName && (
                          <div>
                            <span className="text-muted-foreground font-medium">Atribuído a</span>
                            <div className="mt-1">{newValues.assignedUserName}</div>
                          </div>
                        )}
                        {newValues?.completedByName && (
                          <div>
                            <span className="text-muted-foreground font-medium">Concluído por</span>
                            <div className="mt-1">{newValues.completedByName}</div>
                          </div>
                        )}
                        {newValues?.notes && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground font-medium">Observações</span>
                            <div className="mt-1 text-foreground bg-muted/50 rounded-lg p-2">{newValues.notes}</div>
                          </div>
                        )}
                      </div>
                      {/* Fallback: show raw JSON for unknown activity types */}
                      {!newValues?.taskTitle && !newValues?.title && (oldValues || newValues) && (
                        <div className="mt-3 grid grid-cols-2 gap-4">
                          {oldValues && (
                            <div>
                              <span className="text-xs text-muted-foreground font-medium">Valores Anteriores</span>
                              <pre className="mt-1 text-[11px] font-mono bg-muted/50 rounded-lg p-3 overflow-auto max-h-32 border border-border/50">
                                {JSON.stringify(oldValues, null, 2)}
                              </pre>
                            </div>
                          )}
                          {newValues && (
                            <div>
                              <span className="text-xs text-muted-foreground font-medium">Valores Novos</span>
                              <pre className="mt-1 text-[11px] font-mono bg-muted/50 rounded-lg p-3 overflow-auto max-h-32 border border-border/50">
                                {JSON.stringify(newValues, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
