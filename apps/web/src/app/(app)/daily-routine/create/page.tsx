'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { ArrowLeft, AlertCircle, User, Clock, FileText, Type } from 'lucide-react';

interface TenantUserOption {
  id: string;
  user: { id: string; name: string; email: string };
  role: { id: string; name: string } | null;
}

interface CreateRoutinePayload {
  title: string;
  description?: string;
  scheduledTime: string;
  assignedTenantUserId?: string;
}

export default function CreateRoutinePage() {
  const router = useRouter();
  const role = useAuthStore((s) => s.role);
  const canManage = role === 'admin' || role === 'gestor';

  const [form, setForm] = useState({
    title: '',
    description: '',
    scheduledTime: '',
    assignedTenantUserId: '',
  });
  const [error, setError] = useState<string | null>(null);

  const { data: users, isLoading: usersLoading } = useQuery<TenantUserOption[]>({
    queryKey: ['users-list'],
    queryFn: () => api.get('/users').then((r) => r.data),
  });

  const mutation = useMutation({
    mutationFn: (data: CreateRoutinePayload) => api.post('/daily-routine', data),
    onSuccess: () => {
      router.push('/daily-routine');
    },
    onError: (err: any) => {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Erro ao criar rotina. Por favor, tente novamente.';
      setError(Array.isArray(message) ? message.join(', ') : String(message));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.title.trim()) {
      setError('O título é obrigatório.');
      return;
    }
    if (!form.scheduledTime) {
      setError('O horário é obrigatório.');
      return;
    }
    if (canManage && !form.assignedTenantUserId) {
      setError('Selecione um colaborador.');
      return;
    }

    mutation.mutate({
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      scheduledTime: form.scheduledTime,
      ...(canManage && form.assignedTenantUserId ? { assignedTenantUserId: form.assignedTenantUserId } : {}),
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/daily-routine"
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-muted hover:bg-muted/80 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nova Rotina</h1>
          <p className="text-muted-foreground mt-1">Crie um novo item na rotina diária.</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error */}
        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              className="ml-auto text-xs underline opacity-70 hover:opacity-100"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Title */}
        <div className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Título *
            </label>
            <div className="relative">
              <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Ex: Revisão de código"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-muted border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-sm"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Descrição
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <textarea
                placeholder="Detalhes da atividade..."
                rows={3}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-muted border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-sm resize-none"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>

          {/* Scheduled Time */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Horário *
            </label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="time"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-muted border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-sm"
                value={form.scheduledTime}
                onChange={(e) => setForm((f) => ({ ...f, scheduledTime: e.target.value }))}
              />
            </div>
          </div>

          {/* Assigned User */}
          {canManage && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Colaborador *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <select
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-muted border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-sm appearance-none"
                  value={form.assignedTenantUserId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, assignedTenantUserId: e.target.value }))
                  }
                >
                  <option value="">
                    {usersLoading ? 'Carregando...' : 'Selecione um colaborador'}
                  </option>
                  {users?.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.user.name}{u.role ? ` — ${u.role.name}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href="/daily-routine"
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-muted-foreground bg-muted hover:bg-muted/80 transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="relative flex items-center justify-center px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed min-w-[120px]"
          >
            {mutation.isPending ? (
              <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            ) : (
              'Criar Rotina'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
