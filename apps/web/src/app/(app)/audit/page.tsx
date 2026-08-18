'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ScrollText,
  RefreshCw,
  Filter,
  User as UserIcon,
  Globe2,
  LogIn,
  LogOut,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Activity,
  Shield,
  Calendar,
  Search,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { api } from '@/lib/api';
import { usePermission } from '@/lib/permissions';

// ────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────

interface UnifiedEntry {
  id: string;
  type: 'audit' | 'activity' | 'login';
  timestamp: string;
  action: string;
  actorName: string | null;
  actorEmail: string | null;
  actorAvatar: string | null;
  targetType: string | null;
  targetId: string | null;
  ipAddress: string | null;
  metadata: string | null;
}

interface UserOption {
  id: string;
  user: { id: string; name: string; email: string };
  role: { id: string; name: string } | null;
}

// ────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────

function typeBadge(type: UnifiedEntry['type']) {
  switch (type) {
    case 'login':
      return {
        icon: LogIn,
        label: 'Login',
        classes: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
      };
    case 'audit':
      return {
        icon: Shield,
        label: 'Auditoria',
        classes: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      };
    case 'activity':
      return {
        icon: Activity,
        label: 'Atividade',
        classes: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
      };
  }
}

function actionColor(action: string): string {
  const prefix = action.split('.')[0];
  if (action.includes('failed') || action.includes('error') || action.includes('delete'))
    return 'text-red-500';
  if (action.includes('create') || action.includes('success') || action.includes('login'))
    return 'text-emerald-500';
  if (action.includes('update') || action.includes('edit') || action.includes('change'))
    return 'text-amber-500';
  return 'text-muted-foreground';
}

function formatAction(action: string): string {
  return action
    .replace(/\./g, ' › ')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
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

function prettyJson(json?: string | null): string {
  if (!json) return '—';
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}


// ────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────

export default function AuditPage() {
  const canView = usePermission('audit.view');

  // Filters
  const [typeFilter, setTypeFilter] = useState('');
  const [userId, setUserId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [actionSearch, setActionSearch] = useState('');
  const [take, setTake] = useState(200);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Users dropdown
  const { data: users } = useQuery<UserOption[]>({
    queryKey: ['users-list'],
    queryFn: () => api.get('/users').then((r) => r.data),
  });

  // Main query — unified timeline
  const query = useQuery<UnifiedEntry[]>({
    queryKey: ['audit-timeline', { typeFilter, userId, startDate, endDate, actionSearch, take }],
    queryFn: async () => {
      const params: Record<string, string> = { take: String(take) };
      if (userId) params.actorUserId = userId;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (actionSearch) params.action = actionSearch;
      const res = await api.get('/audit-log/timeline', { params });
      return res.data;
    },
    enabled: canView,
    refetchOnWindowFocus: false,
  });

  // Client-side type filter — exclude operational activities (shown on dedicated dashboard)
  const filteredData = useMemo(() => {
    if (!query.data) return [];
    // Exclude operational activities — shown on the dedicated Operational Dashboard
    let data = query.data.filter((e) => e.type !== 'activity');
    if (typeFilter) {
      data = data.filter((e) => e.type === typeFilter);
    }
    return data;
  }, [query.data, typeFilter]);

  if (!canView) {
    return (
      <div className="text-center py-20">
        <ScrollText className="w-12 h-12 mx-auto text-muted-foreground" />
        <h1 className="mt-4 text-xl font-semibold">Sem permissão</h1>
        <p className="text-muted-foreground mt-2">
          Seu usuário não tem a permissão <code>audit.view</code>. Procure um administrador.
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
            <ScrollText className="w-6 h-6" />
            Painel de Atividades
          </h1>
          <p className="text-muted-foreground mt-1">
            Histórico completo de ações do sistema — logins, mudanças e eventos.
          </p>
        </div>
        <button
          onClick={() => query.refetch()}
          disabled={query.isFetching}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-lg shadow-primary/30"
        >
          <RefreshCw className={`w-4 h-4 ${query.isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Filters */}
      <div className="p-5 rounded-2xl bg-card border border-border shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <Filter className="w-3.5 h-3.5" />
          Filtros
        </div>

        {/* Row 1: Type tabs + User */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex gap-1 p-1 bg-muted rounded-xl">
            {[
              { value: '', label: 'Tudo' },
              { value: 'login', label: 'Logins' },
              { value: 'audit', label: 'Auditoria' },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setTypeFilter(tab.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  typeFilter === tab.value
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1">
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <select
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-muted border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-sm appearance-none"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              >
                <option value="">Todos os usuários</option>
                {users?.map((u) => (
                  <option key={u.id} value={u.user.id}>
                    {u.user.name}{u.role ? ` — ${u.role.name}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Row 2: Dates + Action search + Limit */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
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
          <div className="flex-1 space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              <Search className="inline w-3 h-3 mr-1" />
              Ação
            </label>
            <select
              className="w-full px-3 py-2 rounded-xl bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-primary text-sm appearance-none"
              value={actionSearch}
              onChange={(e) => setActionSearch(e.target.value)}
            >
              <option value="">Todas as ações</option>
              <optgroup label="Autenticação">
                <option value="auth.login">auth.login — Login</option>
                <option value="REFRESH_TOKEN_REUSE_DETECTED">REFRESH_TOKEN — Token comprometido</option>
              </optgroup>
              <optgroup label="Usuários">
                <option value="user.create">user.create — Criar usuário</option>
                <option value="user.update">user.update — Atualizar usuário</option>
                <option value="user.role_change">user.role_change — Mudança de cargo</option>
                <option value="user.password_change">user.password_change — Mudança de senha</option>
              </optgroup>
            </select>
          </div>
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

        {/* Active filters summary */}
        {(userId || startDate || endDate || actionSearch || typeFilter) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium">Filtros ativos:</span>
            {typeFilter && (
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                {typeFilter === 'login' ? 'Logins' : typeFilter === 'audit' ? 'Auditoria' : 'Atividades'}
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
            {actionSearch && (
              <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                Ação: {actionSearch}
              </span>
            )}
            <button
              onClick={() => {
                setTypeFilter('');
                setUserId('');
                setStartDate('');
                setEndDate('');
                setActionSearch('');
              }}
              className="ml-auto text-destructive hover:underline"
            >
              Limpar tudo
            </button>
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm text-center">
          <div className="text-2xl font-bold text-foreground">
            {filteredData.filter((e) => e.type === 'login').length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Logins</div>
        </div>
        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm text-center">
          <div className="text-2xl font-bold text-foreground">
            {filteredData.filter((e) => e.type === 'audit').length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Eventos de Auditoria</div>
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
        {query.isLoading ? (
          <div className="p-12 text-center text-muted-foreground">
            <div className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Carregando atividades...
            </div>
          </div>
        ) : query.isError ? (
          <div className="p-12 text-center text-destructive">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
            Erro ao carregar atividades. Verifique suas permissões.
          </div>
        ) : filteredData.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
            Nenhuma atividade encontrada com os filtros atuais.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredData.map((entry) => {
              const badge = typeBadge(entry.type);
              const Icon = badge.icon;
              const isExpanded = expandedId === entry.id;

              return (
                <div
                  key={entry.id}
                  className="hover:bg-muted/30 transition-colors"
                >
                  {/* Main row */}
                  <div
                    className="flex items-center gap-4 px-5 py-3.5 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  >
                    {/* Type badge */}
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-semibold shrink-0 ${badge.classes}`}>
                      <Icon className="w-3 h-3" />
                      {badge.label}
                    </div>

                    {/* Actor */}
                    <div className="flex items-center gap-2 min-w-[180px] shrink-0">
                      {entry.actorAvatar ? (
                        <img src={entry.actorAvatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                          <UserIcon className="w-3 h-3 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">
                          {entry.actorName ?? 'Sistema'}
                        </div>
                        {entry.actorEmail && (
                          <div className="text-[10px] text-muted-foreground truncate">
                            {entry.actorEmail}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action */}
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm font-medium ${actionColor(entry.action)}`}>
                        {formatAction(entry.action)}
                      </span>
                      {entry.targetType && (
                        <span className="text-xs text-muted-foreground ml-2">
                          → {entry.targetType}
                          {entry.targetId && ` · ${entry.targetId.slice(0, 8)}…`}
                        </span>
                      )}
                    </div>

                    {/* Timestamp */}
                    <div className="text-right shrink-0">
                      <div className="text-xs tabular-nums text-muted-foreground">
                        {formatDate(entry.timestamp)}
                      </div>
                      <div className="text-[10px] text-muted-foreground/60">
                        {formatRelative(entry.timestamp)}
                      </div>
                    </div>

                    {/* Expand icon */}
                    <div className="shrink-0">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-5 pb-4 pt-1 border-t border-border/50">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                        <div>
                          <span className="text-muted-foreground font-medium">IP</span>
                          <div className="mt-1 flex items-center gap-1.5">
                            <Globe2 className="w-3 h-3 text-muted-foreground" />
                            {entry.ipAddress ?? '—'}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground font-medium">Tipo</span>
                          <div className="mt-1">{entry.targetType ?? '—'}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground font-medium">ID do Alvo</span>
                          <div className="mt-1 font-mono text-[10px] break-all">
                            {entry.targetId ?? '—'}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground font-medium">ID do Evento</span>
                          <div className="mt-1 font-mono text-[10px] break-all">
                            {entry.id}
                          </div>
                        </div>
                      </div>
                      {entry.metadata && (
                        <div className="mt-3">
                          <span className="text-xs text-muted-foreground font-medium">Metadata</span>
                          <pre className="mt-1 text-[11px] font-mono bg-muted/50 rounded-lg p-3 overflow-auto max-h-40 border border-border/50">
                            {prettyJson(entry.metadata)}
                          </pre>
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
