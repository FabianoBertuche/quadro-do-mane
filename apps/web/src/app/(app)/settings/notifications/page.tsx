'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Bell, Search } from 'lucide-react';
import { api } from '@/lib/api';
import {
  notificationCategories,
  notificationPushStatuses,
  type NotificationCategory,
  type NotificationDispatch,
  type NotificationPushStatus,
} from '@/types/notification';

type DispatchFilters = {
  category: NotificationCategory | '';
  pushStatus: NotificationPushStatus | '';
  tenantUserId: string;
};

const initialFilters: DispatchFilters = { category: '', pushStatus: '', tenantUserId: '' };

const safeFailureReason = (reason: string | null) => {
  if (!reason) return 'Sem falha registrada';

  return reason
    .replace(/ExponentPushToken\[[^\]]+\]/gi, '[token oculto]')
    .replace(/(?:ticket|device)[=:][^\s,;]+/gi, '$1 oculto')
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, 240);
};

const statusLabel: Record<NotificationPushStatus, string> = {
  PENDING: 'Pendente',
  SENT: 'Enviado',
  SKIPPED: 'Ignorado',
  FAILED: 'Falhou',
};

export default function NotificationDiagnosticsPage() {
  const [filters, setFilters] = useState<DispatchFilters>(initialFilters);
  const { data, isLoading, isError } = useQuery<NotificationDispatch[]>({
    queryKey: ['notification-dispatches', filters],
    queryFn: () =>
      api
        .get('/admin/notification-dispatches', {
          params: {
            ...(filters.category ? { category: filters.category } : {}),
            ...(filters.pushStatus ? { pushStatus: filters.pushStatus } : {}),
            ...(filters.tenantUserId.trim() ? { tenantUserId: filters.tenantUserId.trim() } : {}),
          },
        })
        .then((response) => response.data),
  });

  const dispatches = data ?? [];

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <div className="flex items-center gap-2">
          <Bell className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Diagnóstico de notificações</h1>
        </div>
        <p className="mt-1 text-muted-foreground">
          Investigue as entregas sem expor dados de dispositivos ou credenciais de push.
        </p>
      </div>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm" aria-labelledby="dispatch-filters">
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" />
          <h2 id="dispatch-filters" className="font-semibold">Filtros de entrega</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className="space-y-2 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Categoria</span>
            <select
              className="w-full rounded-xl border border-border bg-muted px-3 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={filters.category}
              onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value as DispatchFilters['category'] }))}
            >
              <option value="">Todas</option>
              {notificationCategories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
            <select
              className="w-full rounded-xl border border-border bg-muted px-3 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={filters.pushStatus}
              onChange={(event) => setFilters((current) => ({ ...current, pushStatus: event.target.value as DispatchFilters['pushStatus'] }))}
            >
              <option value="">Todos</option>
              {notificationPushStatuses.map((status) => <option key={status} value={status}>{statusLabel[status]}</option>)}
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Usuário</span>
            <input
              className="w-full rounded-xl border border-border bg-muted px-3 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="ID do destinatário"
              value={filters.tenantUserId}
              onChange={(event) => setFilters((current) => ({ ...current, tenantUserId: event.target.value }))}
            />
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm" aria-labelledby="dispatch-results">
        <div className="border-b border-border p-6">
          <h2 id="dispatch-results" className="font-semibold">Histórico de entregas</h2>
          <p className="mt-1 text-sm text-muted-foreground">Preferências e auditorias permanecem em uma área separada.</p>
        </div>
        {isLoading ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Carregando entregas...</p>
        ) : isError ? (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-red-600">
            <AlertTriangle className="h-4 w-4" /> Não foi possível carregar o diagnóstico.
          </div>
        ) : dispatches.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Nenhuma entrega encontrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-6 py-4 font-semibold text-muted-foreground">Categoria</th>
                  <th className="px-6 py-4 font-semibold text-muted-foreground">Tipo</th>
                  <th className="px-6 py-4 font-semibold text-muted-foreground">Status</th>
                  <th className="px-6 py-4 font-semibold text-muted-foreground">Data</th>
                  <th className="px-6 py-4 font-semibold text-muted-foreground">Motivo da falha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {dispatches.map((dispatch) => (
                  <tr key={dispatch.id}>
                    <td className="px-6 py-4 font-medium">{dispatch.category}</td>
                    <td className="px-6 py-4">{dispatch.type}</td>
                    <td className="px-6 py-4">{statusLabel[dispatch.pushStatus]}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-muted-foreground">
                      {new Date(dispatch.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="max-w-xs px-6 py-4 text-muted-foreground">{safeFailureReason(dispatch.failureReason)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
