'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { usePermission } from '@/lib/permissions';
import { Plus, FolderKanban, Edit2, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';

// ────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────

function extractErrorMessage(err: any, fallback: string): string {
  const data = err?.response?.data;
  if (Array.isArray(data?.message)) return data.message.join(', ');
  if (typeof data?.message === 'string') return data.message;
  return fallback;
}

function permissionMessage(perm: string): string {
  return `Você não tem permissão para executar esta ação (faltam permissões do tipo "${perm}"). Fale com um administrador do tenant.`;
}

interface ToastState {
  kind: 'success' | 'error' | 'info';
  text: string;
}

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  const styles =
    toast.kind === 'success'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : toast.kind === 'info'
      ? 'bg-blue-50 text-blue-700 border-blue-200'
      : 'bg-rose-50 text-rose-700 border-rose-200';

  return (
    <div
      className={`fixed top-4 right-4 z-50 max-w-md pl-4 pr-10 py-3 rounded-xl shadow-lg text-sm font-medium border ${styles}`}
      role="status"
    >
      {toast.text}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 p-1 rounded-lg hover:bg-black/5"
        aria-label="Fechar"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Página
// ────────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const canCreate = usePermission('projects.create');
  const canEdit = usePermission('projects.edit');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: '',
    ownerTenantUserId: '',
    status: 'DRAFT',
  });
  const [toast, setToast] = useState<ToastState | null>(null);

  const queryClient = useQueryClient();

  // Lista de usuários para o dropdown de responsável. Se o usuário não tiver
  // users.view, a query falha silenciosamente (error=null) e `users` fica undefined.
  const usersQuery = useQuery<any[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
    retry: false,
  });

  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then((r) => r.data),
  });

  const users = usersQuery.data;
  const projects = projectsQuery.data ?? [];

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => {
      const payload: any = { ...data };
      const projectId = payload.id;
      delete payload.id;
      // `status` NÃO é enviado no create (o backend não aceita essa propriedade).
      // Só é usado no PATCH de edição.
      const isCreate = !projectId;
      if (isCreate) {
        delete payload.status;
      }
      if (!payload.ownerTenantUserId) delete payload.ownerTenantUserId;
      if (projectId) return api.patch(`/projects/${projectId}`, payload);
      return api.post('/projects', payload);
    },
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsModalOpen(false);
      setFormData({ id: '', name: '', description: '', ownerTenantUserId: '', status: 'DRAFT' });
      setToast({
        kind: 'success',
        text: vars.id ? 'Projeto atualizado com sucesso' : 'Projeto criado com sucesso',
      });
    },
    onError: (err: any) => {
      if (err?.response?.status === 403) {
        setToast({ kind: 'error', text: permissionMessage('projects.create ou projects.edit') });
      } else if (err?.response?.status === 401) {
        setToast({ kind: 'error', text: 'Sua sessão expirou. Faça login novamente.' });
      } else {
        setToast({
          kind: 'error',
          text: extractErrorMessage(err, 'Não foi possível salvar o projeto.'),
        });
      }
    },
  });

  const handleEdit = (e: React.MouseEvent, project: any) => {
    e.preventDefault();
    e.stopPropagation();
    setFormData({
      id: project.id,
      name: project.name,
      description: project.description || '',
      ownerTenantUserId: project.ownerTenantUserId || '',
      status: project.status || 'DRAFT',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setToast({ kind: 'error', text: 'O nome do projeto é obrigatório.' });
      return;
    }
    createMutation.mutate(formData);
  };

  const openCreateModal = () => {
    setFormData({ id: '', name: '', description: '', ownerTenantUserId: '', status: 'DRAFT' });
    setIsModalOpen(true);
  };

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-slate-100 text-slate-700',
    ACTIVE: 'bg-emerald-100 text-emerald-700',
    ON_HOLD: 'bg-amber-100 text-amber-700',
    COMPLETED: 'bg-blue-100 text-blue-700',
    CANCELLED: 'bg-red-100 text-red-700',
    ARCHIVED: 'bg-gray-100 text-gray-700',
  };

  // Bloqueio silencioso da query users (ex: usuário sem users.view).
  const usersBlocked = usersQuery.isError;

  return (
    <div className="space-y-6">
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projetos</h1>
          <p className="text-muted-foreground mt-1">Gerencie seus projetos e entregas</p>
        </div>
        {canCreate && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-600 transition-colors shadow-lg shadow-primary/30"
          >
            <Plus className="w-4 h-4" /> Novo Projeto
          </button>
        )}
      </div>

      {projectsQuery.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-2xl">
          {canCreate
            ? 'Nenhum projeto ainda. Clique em "Novo Projeto" para começar.'
            : 'Você ainda não faz parte de nenhum projeto.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project: any) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <div className="p-5 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: (project.color || '#5B5FEF') + '20' }}
                    >
                      <FolderKanban
                        className="w-5 h-5"
                        style={{ color: project.color || '#5B5FEF' }}
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold group-hover:text-primary transition-colors">
                        {project.name}
                      </h3>
                      {project.code && (
                        <span className="text-xs text-muted-foreground">{project.code}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canEdit && (
                      <button
                        onClick={(e) => handleEdit(e, project)}
                        className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                        title="Editar projeto"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    <span
                      className={`px-2 py-1 rounded-lg text-xs font-medium ${
                        statusColors[project.status] || ''
                      }`}
                    >
                      {project.status}
                    </span>
                  </div>
                </div>
                {project.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {project.description}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">
                      {project._count?.tasks || 0} tarefas
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-20 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${project.progressPercent || 0}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {project.progressPercent || 0}%
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={formData.id ? 'Editar Projeto' : 'Novo Projeto'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Nome do Projeto <span className="text-rose-500">*</span>
            </label>
            <input
              required
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Ex: Implantação 2026"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Descrição (opcional)
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              placeholder="Descreva sobre o projeto..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Responsável pelo Projeto
            </label>
            {usersBlocked ? (
              <div className="px-4 py-2.5 rounded-xl bg-muted/40 border border-dashed border-border text-xs text-muted-foreground italic">
                Não foi possível carregar a lista de usuários (sem permissão users.view).
                O projeto pode ser criado sem responsável definido e atribuído depois.
              </div>
            ) : (
              <select
                value={formData.ownerTenantUserId}
                onChange={(e) =>
                  setFormData({ ...formData, ownerTenantUserId: e.target.value })
                }
                className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Sem responsável definido</option>
                {(users ?? []).map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {u.user?.name}
                    {u.role?.name ? ` (${u.role.name})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
          {formData.id && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Status do Projeto
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="DRAFT">Rascunho</option>
                <option value="ACTIVE">Ativo</option>
                <option value="ON_HOLD">Pausado</option>
                <option value="COMPLETED">Concluído</option>
                <option value="CANCELLED">Cancelado</option>
                <option value="ARCHIVED">Arquivado</option>
              </select>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-border text-foreground hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-6 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors shadow-md shadow-primary/30"
            >
              {createMutation.isPending
                ? 'Salvando...'
                : formData.id
                ? 'Salvar Configurações'
                : 'Criar Projeto'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
