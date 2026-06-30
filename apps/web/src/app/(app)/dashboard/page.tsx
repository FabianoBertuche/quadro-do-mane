'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  CheckSquare,
  PlayCircle,
  CheckCircle2,
  AlertTriangle,
  FolderKanban,
  Users,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Rocket,
  Clock,
  Archive,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';

/**
 * Limite de projetos visíveis antes de mostrar o botão "Ver mais".
 * Mantemos este limite como salvaguarda para boa legibilidade.
 */
const PROJECT_PROGRESS_MAX_VISIBLE = 10;

/**
 * Helper para mapear status do projeto → configuração visual.
 */
function statusMeta(status: string | undefined) {
  const s = (status || '').toUpperCase();
  if (s === 'ACTIVE') {
    return { label: 'Ativo', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  }
  if (s === 'DRAFT') {
    return { label: 'Rascunho', className: 'bg-amber-100 text-amber-700 border-amber-200' };
  }
  if (s === 'COMPLETED' || s === 'DONE') {
    return { label: 'Concluído', className: 'bg-blue-100 text-blue-700 border-blue-200' };
  }
  if (s === 'ARCHIVED' || s === 'PAUSED') {
    return { label: s === 'PAUSED' ? 'Pausado' : 'Arquivado', className: 'bg-slate-100 text-slate-600 border-slate-200' };
  }
  return { label: s || '—', className: 'bg-slate-100 text-slate-600 border-slate-200' };
}

export default function DashboardPage() {
  const { data: overview } = useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: () => api.get('/dashboard/overview').then((r) => r.data),
  });

  const { data: productivity } = useQuery({
    queryKey: ['dashboard', 'productivity'],
    queryFn: () => api.get('/dashboard/productivity').then((r) => r.data),
  });

  const queryClient = useQueryClient();

  const { data: projectProgress, isLoading: isLoadingProjectProgress } = useQuery({
    queryKey: ['dashboard', 'project-progress'],
    queryFn: () => api.get('/dashboard/project-progress').then((r) => r.data),
  });

  /**
   * Lista COMPLETA de projetos (incluindo DRAFT/rascunhos).
   * Necessária porque o endpoint `project-progress` filtra apenas `ACTIVE`.
   */
  const { data: allProjects, isLoading: isLoadingAllProjects } = useQuery({
    queryKey: ['projects', 'all-for-dashboard'],
    queryFn: () => api.get('/projects').then((r) => r.data),
    staleTime: 30_000,
  });

  /**
   * Para CADA projeto visível, buscamos as tarefas via /api/tasks?projectId=...
   * Isso é necessário porque o endpoint /dashboard/project-progress só considera
   * projetos ACTIVE. Para projetos DRAFT/Concluídos, calculamos progresso real no
   * cliente contando tarefas com `status.category === 'done'`.
   *
   * Usamos `useQueries` para paralelizar N requisições e cachear por projeto.
   */
  const projectIds = useMemo(
    () => (Array.isArray(allProjects) ? allProjects.map((p: any) => p.id) : []),
    [allProjects],
  );

  const tasksQueries = useQueries({
    queries: projectIds.map((projectId) => ({
      queryKey: ['tasks', 'by-project', projectId],
      queryFn: () =>
        api.get('/tasks', { params: { projectId } }).then((r) => r.data as any[]),
      staleTime: 30_000,
      enabled: !!projectId,
    })),
  });

  /**
   * Mapa projectId → { totalTasks, completedTasks } calculado a partir das tarefas reais.
   * Para projetos ACTIVE, usamos a contagem do endpoint de progresso (consistente com KPIs).
   * Para os demais, contamos as tarefas obtidas via /api/tasks.
   */
  const progressByProjectId = useMemo(() => {
    const map = new Map<string, { totalTasks: number; completedTasks: number; progress: number }>();
    // 1) Map do endpoint de progresso (fonte oficial para projetos ACTIVE)
    if (Array.isArray(projectProgress)) {
      for (const p of projectProgress) {
        map.set(p.id, {
          totalTasks: p.totalTasks ?? 0,
          completedTasks: p.completedTasks ?? 0,
          progress: p.progress ?? 0,
        });
      }
    }
    // 2) Para projetos não cobertos pelo endpoint de progresso, contamos via tasksQueries
    projectIds.forEach((projectId, idx) => {
      if (map.has(projectId)) return; // já temos
      const q = tasksQueries[idx];
      const tasks = q?.data;
      if (!Array.isArray(tasks)) return;
      let total = 0;
      let done = 0;
      for (const t of tasks) {
        // Considera concluída quando status.category === 'done' OU completedAt !== null
        const isDone =
          t?.status?.category === 'done' ||
          (t?.completedAt && typeof t.completedAt !== 'string') ||
          (typeof t?.completedAt === 'string' && t.completedAt !== null);
        if (isDone) done += 1;
        total += 1;
      }
      const progress = total > 0 ? Math.round((done / total) * 100) : 0;
      map.set(projectId, { totalTasks: total, completedTasks: done, progress });
    });
    return map;
  }, [projectProgress, projectIds, tasksQueries]);

  /**
   * Lista completa de projetos normalizada para o formato da UI,
   * já com progresso calculado e ordenação estável.
   */
  const sortedProjectProgress = useMemo(() => {
    if (!Array.isArray(allProjects)) return [];
    const enriched = allProjects.map((p: any) => {
      const known = progressByProjectId.get(p.id);
      const fallbackTotal =
        typeof p?._count?.tasks === 'number' ? p._count.tasks : known?.totalTasks ?? 0;
      const totalTasks = known?.totalTasks ?? fallbackTotal;
      const completedTasks = known?.completedTasks ?? 0;
      const progress =
        known?.progress ??
        (totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0);
      return {
        id: p.id,
        name: p.name,
        code: p.code ?? null,
        color: p.color ?? null,
        status: p.status ?? 'DRAFT',
        totalTasks,
        completedTasks,
        progress,
      };
    });
    // 1) Ativos primeiro; 2) DRAFT depois; 3) outros no fim.
    // Dentro de cada grupo: progresso desc; empatados → nome asc.
    const statusRank = (s: string) => {
      const up = (s || '').toUpperCase();
      if (up === 'ACTIVE') return 0;
      if (up === 'DRAFT') return 1;
      return 2;
    };
    return enriched.sort((a: any, b: any) => {
      const ra = statusRank(a.status);
      const rb = statusRank(b.status);
      if (ra !== rb) return ra - rb;
      if (b.progress !== a.progress) return b.progress - a.progress;
      const cmp = String(a.name ?? '').localeCompare(String(b.name ?? ''), 'pt-BR', { sensitivity: 'base' });
      if (cmp !== 0) return cmp;
      return String(a.id ?? '').localeCompare(String(b.id ?? ''));
    });
  }, [allProjects, progressByProjectId]);

  const [showAllProjects, setShowAllProjects] = useState(false);
  const visibleProjectProgress = showAllProjects
    ? sortedProjectProgress
    : sortedProjectProgress.slice(0, PROJECT_PROGRESS_MAX_VISIBLE);
  const hasMoreProjects = sortedProjectProgress.length > PROJECT_PROGRESS_MAX_VISIBLE;

  const tasksQueriesLoading = tasksQueries.some((q) => q.isLoading);
  const isLoadingProjects =
    isLoadingProjectProgress || isLoadingAllProjects || tasksQueriesLoading;
  const activeCount = sortedProjectProgress.filter((p) => (p.status || '').toUpperCase() === 'ACTIVE').length;
  const draftCount = sortedProjectProgress.filter((p) => (p.status || '').toUpperCase() === 'DRAFT').length;

  const { data: workload } = useQuery({
    queryKey: ['dashboard', 'workload'],
    queryFn: () => api.get('/dashboard/workload').then((r) => r.data),
  });

  const kpiCards = [
    { label: 'Total de Tarefas', value: overview?.totalTasks ?? '-', icon: CheckSquare, color: 'bg-blue-500/10 text-blue-500', iconBg: 'bg-blue-500' },
    { label: 'Em Andamento', value: overview?.inProgressTasks ?? '-', icon: PlayCircle, color: 'bg-amber-500/10 text-amber-500', iconBg: 'bg-amber-500' },
    { label: 'Concluídas', value: overview?.completedTasks ?? '-', icon: CheckCircle2, color: 'bg-emerald-500/10 text-emerald-500', iconBg: 'bg-emerald-500' },
    { label: 'Atrasadas', value: overview?.overdueTasks ?? '-', icon: AlertTriangle, color: 'bg-red-500/10 text-red-500', iconBg: 'bg-red-500' },
    { label: 'Projetos Ativos', value: overview?.activeProjects ?? '-', icon: FolderKanban, color: 'bg-purple-500/10 text-purple-500', iconBg: 'bg-purple-500' },
    { label: 'Taxa de Conclusão', value: overview?.completionRate ? `${overview.completionRate}%` : '-', icon: TrendingUp, color: 'bg-primary/10 text-primary', iconBg: 'bg-primary' },
  ];

  const pieData = [
    { name: 'Concluídas', value: overview?.completedTasks || 0, color: '#22C55E' },
    { name: 'Em Andamento', value: overview?.inProgressTasks || 0, color: '#F59E0B' },
    { name: 'Atrasadas', value: overview?.overdueTasks || 0, color: '#EF4444' },
    { name: 'Pendentes', value: (overview?.totalTasks || 0) - (overview?.completedTasks || 0) - (overview?.inProgressTasks || 0) - (overview?.overdueTasks || 0), color: '#64748B' },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Visão geral do seu workspace</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpiCards.map((card) => (
          <div key={card.label} className="p-4 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.color}`}>
                <card.icon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{card.value}</div>
                <div className="text-xs text-muted-foreground">{card.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Productivity Chart */}
        <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
          <h3 className="font-semibold mb-4">Produtividade Semanal</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={productivity || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="completed" name="Concluídas" fill="#22C55E" radius={[4, 4, 0, 0]} />
              <Bar dataKey="created" name="Criadas" fill="#5B5FEF" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Distribution Pie */}
        <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
          <h3 className="font-semibold mb-4">Distribuição de Tarefas</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Project Progress */}
      <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div className="flex items-center justify-between mb-4 gap-3">
          <div>
            <h3 className="font-semibold">Progresso dos Projetos</h3>
            {sortedProjectProgress.length > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {activeCount} ativo{activeCount !== 1 && 's'}
                {draftCount > 0 && (
                  <>
                    {' · '}
                    <span className="text-amber-600">{draftCount} rascunho{draftCount !== 1 && 's'}</span>
                  </>
                )}
                {sortedProjectProgress.length > activeCount + draftCount && (
                  <>
                    {' · '}
                    {sortedProjectProgress.length - activeCount - draftCount} outro{sortedProjectProgress.length - activeCount - draftCount !== 1 && 's'}
                  </>
                )}
              </p>
            )}
          </div>
          {sortedProjectProgress.length > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {sortedProjectProgress.length} no total
            </span>
          )}
        </div>
        <div className="space-y-4">
          {isLoadingProjects ? (
            <>
              {[1, 2, 3].map((i) => (
                <div key={`sk-${i}`} className="space-y-2">
                  <div className="h-3 w-1/3 rounded bg-muted animate-pulse" />
                  <div className="h-2 w-full rounded-full bg-muted animate-pulse" />
                </div>
              ))}
            </>
          ) : sortedProjectProgress.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
              Nenhum projeto criado ainda. Use a página Projetos para começar.
            </div>
          ) : (
            <>
              {visibleProjectProgress.map((project: any) => {
                const progress = typeof project.progress === 'number' ? project.progress : 0;
                const totalTasks = typeof project.totalTasks === 'number' ? project.totalTasks : 0;
                const completedTasks = typeof project.completedTasks === 'number' ? project.completedTasks : 0;
                const meta = statusMeta(project.status);
                const isDraft = (project.status || '').toUpperCase() === 'DRAFT';
                return (
                  <div
                    key={project.id}
                    className={`flex items-center gap-4 ${isDraft ? 'opacity-80' : ''}`}
                    title={
                      isDraft
                        ? `${project.name} (Rascunho — ative-o para que apareça nos KPIs e relatórios)`
                        : project.name
                    }
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: project.color || '#5B5FEF' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium truncate" title={project.name}>
                            {project.name}
                          </span>
                          <span
                            className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border ${meta.className}`}
                          >
                            {meta.label}
                          </span>
                        </div>
                        <span className="text-sm text-muted-foreground tabular-nums">
                          {progress}%
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isDraft ? 'bg-muted-foreground/40' : 'bg-primary'
                          }`}
                          style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                        />
                      </div>
                    </div>
                    <span
                      className="text-xs text-muted-foreground whitespace-nowrap tabular-nums"
                      title={`${completedTasks} concluídas de ${totalTasks} tarefas`}
                    >
                      {completedTasks}/{totalTasks}
                    </span>
                  </div>
                );
              })}

              {hasMoreProjects && (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAllProjects((v) => !v)}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors px-3 py-1.5 rounded-lg hover:bg-primary/10"
                  >
                    {showAllProjects ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5" />
                        Ver menos
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5" />
                        Ver mais ({sortedProjectProgress.length - PROJECT_PROGRESS_MAX_VISIBLE})
                      </>
                    )}
                  </button>
                </div>
              )}

              {draftCount > 0 && (
                <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>
                    <strong className="text-foreground">{draftCount}</strong> projeto{draftCount !== 1 && 's'} marcado{draftCount !== 1 && 's'} como Rascunho ainda não entra nos KPIs de produtividade. Novos projetos já nascem como <strong className="text-foreground">Ativos</strong> por padrão; defina-os como Ativos ou Concluídos na página Projetos quando quiser incluí-los nos relatórios.
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Workload */}
      <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
        <h3 className="font-semibold mb-4">Carga de Trabalho</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(workload || []).slice(0, 8).map((member: any) => (
            <div key={member.tenantUserId} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-primary">{member.name?.charAt(0)}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{member.name}</div>
                <div className="text-xs text-muted-foreground">{member.taskCount} tarefas</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
