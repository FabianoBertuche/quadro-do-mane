'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, ScrollText, Filter, Globe2, User as UserIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { usePermission } from '@/lib/permissions';
import { AuditLogEntry } from '@/types/user';

// ────────────────────────────────────────────────────────────────────────
// Helpers visuais
// ────────────────────────────────────────────────────────────────────────

function actionBadgeClasses(action: string): string {
  const prefix = action.split('.')[0];
  switch (prefix) {
    case 'user':
      return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    case 'auth':
      return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
    case 'billing':
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    case 'settings':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    case 'audit':
      return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', {
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

function prettyJson(json?: string | null): string {
  if (!json) return '—';
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}

// ────────────────────────────────────────────────────────────────────────
// Página
// ────────────────────────────────────────────────────────────────────────

export default function AuditPage() {
  const canView = usePermission('audit.view');

  const [action, setAction] = useState('');
  const [actorUserId, setActorUserId] = useState('');
  const [take, setTake] = useState(100);

  const query = useQuery<AuditLogEntry[]>({
    queryKey: ['audit-log', { action, actorUserId, take }],
    queryFn: async () => {
      const params: Record<string, string> = { take: String(take) };
      if (action.trim()) params.action = action.trim();
      if (actorUserId.trim()) params.actorUserId = actorUserId.trim();
      const res = await api.get('/audit-log', { params });
      return res.data;
    },
    enabled: canView,
    refetchOnWindowFocus: false,
  });

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
            Auditoria
          </h1>
          <p className="text-muted-foreground mt-1">
            Eventos sensíveis do tenant atual — quem fez o quê, quando e de onde.
          </p>
        </div>
        <button
          onClick={() => query.refetch()}
          disabled={query.isFetching}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors shadow-lg shadow-primary/30"
        >
          <RefreshCw className={`w-4 h-4 ${query.isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1">
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            <Filter className="inline w-3 h-3 mr-1" />
            Ação (ex.: user.create)
          </label>
          <input
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="user.*, auth.login, ..."
            className="w-full px-3 py-2 rounded-xl bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            ID do ator
          </label>
          <input
            value={actorUserId}
            onChange={(e) => setActorUserId(e.target.value)}
            placeholder="uuid"
            className="w-full px-3 py-2 rounded-xl bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="w-32">
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Limite
          </label>
          <select
            value={take}
            onChange={(e) => setTake(parseInt(e.target.value, 10))}
            className="w-full px-3 py-2 rounded-xl bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
          </select>
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {query.isLoading ? (
          <div className="p-6 text-center text-muted-foreground">Carregando eventos...</div>
        ) : query.isError ? (
          <div className="p-6 text-center text-rose-600">
            Erro ao carregar auditoria. Verifique suas permissões.
          </div>
        ) : (query.data ?? []).length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            Nenhum evento encontrado com os filtros atuais.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Quando</th>
                  <th className="text-left px-4 py-3 font-medium">Ator</th>
                  <th className="text-left px-4 py-3 font-medium">Ação</th>
                  <th className="text-left px-4 py-3 font-medium">Alvo</th>
                  <th className="text-left px-4 py-3 font-medium">Origem</th>
                  <th className="text-left px-4 py-3 font-medium">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(query.data ?? []).map((ev) => (
                  <tr key={ev.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {formatDate(ev.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      {ev.actor ? (
                        <div className="flex items-center gap-2">
                          <UserIcon className="w-3.5 h-3.5 text-muted-foreground" />
                          <div className="flex flex-col">
                            <span className="font-medium">{ev.actor.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {ev.actor.email}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          {ev.actorUserId ?? 'sistema'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-medium ${actionBadgeClasses(ev.action)}`}
                      >
                        {ev.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {ev.targetType ? (
                        <span>
                          {ev.targetType}
                          {ev.targetId && (
                            <span className="text-muted-foreground"> · {ev.targetId.slice(0, 8)}…</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Globe2 className="w-3.5 h-3.5" />
                        <span>{ev.ipAddress ?? '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <pre className="text-[11px] font-mono bg-muted/50 rounded-md p-2 max-w-md overflow-auto">
                        {prettyJson(ev.metadataJson)}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}