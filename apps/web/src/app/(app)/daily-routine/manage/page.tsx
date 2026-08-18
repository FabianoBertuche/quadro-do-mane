'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Clock,
  AlertCircle,
  Pencil,
  Trash2,
  Plus,
  CheckCircle2,
  Circle,
  User,
  Save,
  X,
} from 'lucide-react';

interface TenantUserOption {
  id: string;
  user: { id: string; name: string; email: string };
  role?: { id: string; name: string } | null;
}

interface RoutineItem {
  id: string;
  title: string;
  description: string | null;
  scheduledTime: string;
  completedToday: boolean;
  assignedTenantUserId: string;
}

interface CreateRoutinePayload {
  title: string;
  description?: string;
  scheduledTime: string;
  assignedTenantUserId: string;
}

interface UpdateRoutinePayload {
  title: string;
  description?: string;
  scheduledTime: string;
}

const ROUTINE_QUERY_KEY = 'admin-routines';

export default function ManageRoutinesPage() {
  const queryClient = useQueryClient();

  const [selectedUserId, setSelectedUserId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<UpdateRoutinePayload>({
    title: '',
    description: '',
    scheduledTime: '',
  });
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    scheduledTime: '',
  });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch users list
  const { data: users, isLoading: usersLoading } = useQuery<TenantUserOption[]>({
    queryKey: ['users-list'],
    queryFn: () => api.get('/users').then((r) => r.data),
  });

  // Fetch routines for selected user
  const {
    data: routines,
    isLoading: routinesLoading,
    isError: routinesError,
  } = useQuery<RoutineItem[]>({
    queryKey: [ROUTINE_QUERY_KEY, selectedUserId],
    queryFn: () =>
      api.get(`/daily-routine/admin/user/${selectedUserId}`).then((r) => r.data),
    enabled: !!selectedUserId,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateRoutinePayload) => api.post('/daily-routine', data),
    onSuccess: () => {
      setError(null);
      setCreateForm({ title: '', description: '', scheduledTime: '' });
      queryClient.invalidateQueries({ queryKey: [ROUTINE_QUERY_KEY, selectedUserId] });
    },
    onError: (err: any) => {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Erro ao criar rotina. Por favor, tente novamente.';
      setError(Array.isArray(message) ? message.join(', ') : String(message));
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRoutinePayload }) =>
      api.patch(`/daily-routine/${id}`, data),
    onSuccess: () => {
      setError(null);
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: [ROUTINE_QUERY_KEY, selectedUserId] });
    },
    onError: (err: any) => {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Erro ao atualizar rotina. Por favor, tente novamente.';
      setError(Array.isArray(message) ? message.join(', ') : String(message));
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/daily-routine/${id}`),
    onSuccess: () => {
      setError(null);
      setDeleteConfirmId(null);
      queryClient.invalidateQueries({ queryKey: [ROUTINE_QUERY_KEY, selectedUserId] });
    },
    onError: (err: any) => {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Erro ao excluir rotina. Por favor, tente novamente.';
      setError(Array.isArray(message) ? message.join(', ') : String(message));
    },
  });

  const handleEditClick = (routine: RoutineItem) => {
    setEditingId(routine.id);
    setEditForm({
      title: routine.title,
      description: routine.description || '',
      scheduledTime: routine.scheduledTime,
    });
  };

  const handleSaveEdit = (id: string) => {
    if (!editForm.title.trim()) {
      setError('O título é obrigatório.');
      return;
    }
    if (!editForm.scheduledTime) {
      setError('O horário é obrigatório.');
      return;
    }

    updateMutation.mutate({
      id,
      data: {
        title: editForm.title.trim(),
        description: editForm.description?.trim() || undefined,
        scheduledTime: editForm.scheduledTime,
      },
    });
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!createForm.title.trim()) {
      setError('O título é obrigatório.');
      return;
    }
    if (!createForm.scheduledTime) {
      setError('O horário é obrigatório.');
      return;
    }
    if (!selectedUserId) {
      setError('Selecione um colaborador.');
      return;
    }

    createMutation.mutate({
      title: createForm.title.trim(),
      description: createForm.description.trim() || undefined,
      scheduledTime: createForm.scheduledTime,
      assignedTenantUserId: selectedUserId,
    });
  };

  const handleDeleteConfirm = (id: string) => {
    deleteMutation.mutate(id);
  };

  const getSelectedUserName = () => {
    const user = users?.find((u) => u.id === selectedUserId);
    return user ? user.user.name : '';
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gerenciar Rotinas</h1>
        <p className="text-muted-foreground mt-1">
          Crie, edite e gerencie rotinas diárias dos colaboradores
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-xs underline opacity-70 hover:opacity-100"
          >
            Fechar
          </button>
        </div>
      )}

      {/* User Selector */}
      <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Colaborador
        </label>
        <div className="relative mt-2">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <select
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-muted border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-sm appearance-none"
            value={selectedUserId}
            onChange={(e) => {
              setSelectedUserId(e.target.value);
              setEditingId(null);
              setError(null);
            }}
          >
            <option value="" disabled>
              {usersLoading ? 'Carregando colaboradores...' : 'Selecione um colaborador...'}
            </option>
            {users?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.user.name} — {u.user.email}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* No user selected state */}
      {!selectedUserId && (
        <div className="text-center py-12 border-2 border-dashed border-border rounded-2xl bg-muted/20">
          <User className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-muted-foreground">
            Selecione um colaborador para gerenciar suas rotinas
          </p>
        </div>
      )}

      {/* Main Content: Routine List + Create Form */}
      {selectedUserId && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left/Main: Routine List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Rotinas de {getSelectedUserName()}
              </h2>
              {routines && (
                <span className="text-sm text-muted-foreground">
                  {routines.length} rotina{routines.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {routinesLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : routinesError ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="w-12 h-12 text-destructive mb-4" />
                <h3 className="text-lg font-bold">Erro ao carregar rotinas</h3>
                <p className="text-muted-foreground mt-2">
                  Não foi possível obter a lista de rotinas deste colaborador.
                </p>
              </div>
            ) : routines && routines.length > 0 ? (
              <div className="grid gap-4">
                {routines.map((routine) => (
                  <div
                    key={routine.id}
                    className={`group relative p-5 rounded-2xl border transition-all duration-200 ${
                      editingId === routine.id
                        ? 'bg-card border-primary shadow-md'
                        : routine.completedToday
                          ? 'bg-muted/50 border-border opacity-60'
                          : 'bg-card border-border shadow-sm hover:shadow-md hover:border-primary/30'
                    }`}
                  >
                    {editingId === routine.id ? (
                      /* Inline Edit Mode */
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Título *
                          </label>
                          <input
                            type="text"
                            className="w-full px-3 py-2 rounded-xl bg-muted border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-sm"
                            value={editForm.title}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, title: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Descrição
                          </label>
                          <textarea
                            rows={2}
                            className="w-full px-3 py-2 rounded-xl bg-muted border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-sm resize-none"
                            value={editForm.description}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, description: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Horário *
                          </label>
                          <input
                            type="time"
                            className="w-full px-3 py-2 rounded-xl bg-muted border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-sm"
                            value={editForm.scheduledTime}
                            onChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                scheduledTime: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-2">
                          <button
                            onClick={() => setEditingId(null)}
                            disabled={updateMutation.isPending}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted border border-border font-medium text-sm hover:bg-muted/80 transition-colors disabled:opacity-60"
                          >
                            <X className="w-4 h-4" />
                            Cancelar
                          </button>
                          <button
                            onClick={() => handleSaveEdit(routine.id)}
                            disabled={updateMutation.isPending}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-60"
                          >
                            {updateMutation.isPending ? (
                              <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Save className="w-4 h-4" />
                            )}
                            Salvar
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* View Mode */
                      <div className="flex items-start gap-4">
                        {/* Completion indicator */}
                        <div className="mt-1">
                          {routine.completedToday ? (
                            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                          ) : (
                            <Circle className="w-6 h-6 text-muted-foreground" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3
                              className={`font-semibold transition-all ${
                                routine.completedToday
                                  ? 'line-through text-muted-foreground'
                                  : 'text-foreground'
                              }`}
                            >
                              {routine.title}
                            </h3>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                              <Clock className="w-3 h-3" />
                              <span>{routine.scheduledTime}</span>
                            </div>
                          </div>
                          {routine.description && (
                            <p
                              className={`text-sm mt-1 ${
                                routine.completedToday
                                  ? 'text-muted-foreground/60'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              {routine.description}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleEditClick(routine)}
                            disabled={deleteMutation.isPending}
                            className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-60"
                            title="Editar rotina"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(routine.id)}
                            disabled={deleteMutation.isPending}
                            className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-60"
                            title="Excluir rotina"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Loading overlay */}
                    {(updateMutation.isPending || deleteMutation.isPending) &&
                      (updateMutation.isPending || deleteMutation.isPending) && (
                        <div className="absolute inset-0 bg-muted/50 backdrop-blur-[1px] rounded-2xl flex items-center justify-center">
                          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 border-2 border-dashed border-border rounded-2xl bg-muted/20">
                <Clock className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Nenhuma rotina configurada para este colaborador
                </p>
              </div>
            )}
          </div>

          {/* Right/Sidebar: Create Form */}
          <div className="lg:col-span-1">
            <div className="p-6 rounded-2xl bg-card border border-border shadow-sm sticky top-6">
              <h3 className="text-lg font-semibold mb-4">Nova Rotina</h3>
              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Título *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Revisão de código"
                    className="w-full px-3 py-2 rounded-xl bg-muted border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-sm"
                    value={createForm.title}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, title: e.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Descrição
                  </label>
                  <textarea
                    placeholder="Detalhes da atividade..."
                    rows={3}
                    className="w-full px-3 py-2 rounded-xl bg-muted border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-sm resize-none"
                    value={createForm.description}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, description: e.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Horário *
                  </label>
                  <input
                    type="time"
                    className="w-full px-3 py-2 rounded-xl bg-muted border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-sm"
                    value={createForm.scheduledTime}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        scheduledTime: e.target.value,
                      }))
                    }
                  />
                </div>

                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {createMutation.isPending ? (
                    <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Criar Rotina
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md mx-4 p-6 rounded-2xl bg-card border border-border shadow-xl">
            <h3 className="text-lg font-bold mb-2">Confirmar exclusão</h3>
            <p className="text-muted-foreground text-sm mb-1">
              Tem certeza que deseja excluir esta rotina?
            </p>
            <p className="text-destructive/80 text-xs mb-6">
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2.5 rounded-xl bg-muted border border-border font-medium text-sm hover:bg-muted/80 transition-colors disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteConfirm(deleteConfirmId)}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-destructive text-destructive-foreground font-medium text-sm hover:bg-destructive/90 transition-colors disabled:opacity-60"
              >
                {deleteMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-destructive-foreground border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Excluir'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
