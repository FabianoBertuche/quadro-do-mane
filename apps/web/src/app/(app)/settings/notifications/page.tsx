'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

/** Retorno de `GET /notifications/notification-preferences`. */
type NotificationPreference = {
  category: NotificationCategory;
  pushEnabled: boolean;
  lockedByAdmin: boolean;
};

const initialFilters: DispatchFilters = { category: '', pushStatus: '', tenantUserId: '' };

const preferenceLabel: Record<NotificationCategory, string> = {
  TASKS: 'Tarefas',
  CALENDAR: 'Calendário',
  ROUTINE: 'Rotinas diárias',
  COLLABORATION: 'Colaboração',
  PROJECTS_TEAMS: 'Projetos e equipes',
  SECURITY: 'Segurança',
};

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
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<DispatchFilters>(initialFilters);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
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

  const {
    data: preferences = [],
    isLoading: isLoadingPreferences,
    isError: isPreferencesError,
  } = useQuery<NotificationPreference[]>({
    queryKey: ['notification-preferences'],
    queryFn: () =>
      api.get('/notifications/notification-preferences').then((response) => response.data),
  });

  const updatePreference = useMutation({
    mutationFn: ({ category, pushEnabled }: { category: NotificationCategory; pushEnabled: boolean }) =>
      api.patch(`/notifications/notification-preferences/${category}`, { pushEnabled }),
    onSuccess: () => {
      setPreferencesError(null);
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
    },
    onError: (error: any) => {
      setPreferencesError(
        error?.response?.data?.message ??
          (error?.response?.status === 409
            ? 'Esta categoria é gerenciada pela empresa e não pode ser alterada.'
            : 'Não foi possível salvar a preferência de notificação.'),
      );
      // O lock pode ter sido aplicado pela empresa entre a leitura e o envio:
      // quem tem a palavra final sobre o estado é o servidor.
      if (error?.response?.status === 409) {
        queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      }
    },
  });

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

      <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm" aria-labelledby="notification-preferences">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <h2 id="notification-preferences" className="font-semibold">Minhas preferências</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Os alertas sempre chegam à Central de Notificações. O que você desliga aqui é apenas o envio por push ao dispositivo.
        </p>
        {preferencesError && (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{preferencesError}</span>
            <button
              type="button"
              className="ml-auto text-xs underline opacity-70 hover:opacity-100"
              onClick={() => setPreferencesError(null)}
            >
              Fechar
            </button>
          </div>
        )}
        {isLoadingPreferences ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Carregando preferências...</p>
        ) : isPreferencesError ? (
          <p className="flex items-center justify-center gap-2 py-4 text-sm text-red-600">
            <AlertTriangle className="h-4 w-4" /> Não foi possível carregar suas preferências.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {preferences.map((preference) => (
              <li key={preference.category} className="flex items-center gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">
                    {preferenceLabel[preference.category] ?? preference.category}
                  </div>
                  {preference.lockedByAdmin && (
                    <p className="mt-0.5 text-xs text-amber-600">
                      Categoria gerenciada pela empresa — a alteração está bloqueada.
                    </p>
                  )}
                </div>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={preference.pushEnabled}
                    disabled={preference.lockedByAdmin || updatePreference.isPending}
                    onChange={(event) =>
                      updatePreference.mutate({
                        category: preference.category,
                        pushEnabled: event.target.checked,
                      })
                    }
                  />
                  Push
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

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
          <p className="mt-1 text-sm text-muted-foreground">O histórico abaixo é somente leitura.</p>
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
