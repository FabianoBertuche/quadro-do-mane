'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import React, { useState, useEffect } from 'react';

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: {
    id?: string;
    title?: string;
    projectId?: string;
    statusId?: string;
    priorityId?: string;
    assigneeTenantUserId?: string;
    startDate?: string;
    dueDate?: string;
  };
  defaultProjectId?: string | null;
}

export function TaskFormModal({ isOpen, onClose, initialData, defaultProjectId }: TaskFormModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    id: '',
    title: '',
    projectId: defaultProjectId || '',
    statusId: '',
    priorityId: '',
    assigneeTenantUserId: '',
    startDate: '',
    dueDate: '',
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData?.id) {
        setFormData({
          id: initialData.id || '',
          title: initialData.title || '',
          projectId: initialData.projectId || defaultProjectId || '',
          statusId: initialData.statusId || '',
          priorityId: initialData.priorityId || '',
          assigneeTenantUserId: initialData.assigneeTenantUserId || '',
          startDate: initialData.startDate ? new Date(initialData.startDate).toISOString().split('T')[0] : '',
          dueDate: initialData.dueDate ? new Date(initialData.dueDate).toISOString().split('T')[0] : '',
        });
      } else {
        setFormData({
          id: '',
          title: '',
          projectId: defaultProjectId || '',
          statusId: '',
          priorityId: '',
          assigneeTenantUserId: '',
          startDate: '',
          dueDate: '',
        });
      }
    }
  }, [isOpen, initialData, defaultProjectId]);

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users?active=true').then((r) => r.data),
    enabled: isOpen,
  });

  const { data: statuses } = useQuery({
    queryKey: ['statuses'],
    queryFn: () => api.get('/tasks/statuses').then((r) => r.data),
    enabled: isOpen,
  });

  const { data: priorities } = useQuery({
    queryKey: ['priorities'],
    queryFn: () => api.get('/tasks/priorities').then((r) => r.data),
    enabled: isOpen,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => {
      const payload: any = { ...data };
      const taskId = payload.id;
      delete payload.id;

      if (!payload.statusId) delete payload.statusId;

      payload.priorityId = payload.priorityId || (taskId ? null : undefined);
      payload.assigneeTenantUserId = payload.assigneeTenantUserId || (taskId ? null : undefined);
      payload.projectId = payload.projectId || (taskId ? null : undefined);
      payload.startDate = payload.startDate ? new Date(payload.startDate).toISOString() : (taskId ? null : undefined);
      payload.dueDate = payload.dueDate ? new Date(payload.dueDate).toISOString() : (taskId ? null : undefined);

      Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

      if (taskId) {
        return api.patch(`/tasks/${taskId}`, payload);
      }
      return api.post('/tasks', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={formData.id ? `Editar: ${formData.title}` : 'Nova Tarefa'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Título da Tarefa</label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Ex: Atualizar layout da página home"
          />
        </div>
        {!defaultProjectId && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Projeto (opcional)</label>
            <input
              type="text"
              value={formData.projectId}
              onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="ID do projeto"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Status</label>
            <select
              value={formData.statusId}
              onChange={(e) => setFormData({ ...formData, statusId: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Status padrão</option>
              {(statuses || []).map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Prioridade</label>
            <select
              value={formData.priorityId}
              onChange={(e) => setFormData({ ...formData, priorityId: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Sem prioridade</option>
              {(priorities || []).map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Responsável</label>
          <select
            value={formData.assigneeTenantUserId}
            onChange={(e) => setFormData({ ...formData, assigneeTenantUserId: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Nenhum responsável</option>
            {(users || []).filter((u: any) => u.isActive !== false).map((u: any) => (
              <option key={u.id} value={u.id}>
                {u.user?.name} {u.role?.name ? `(${u.role.name})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Data Inicial Prevista</label>
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Prazo de Entrega</label>
            <input
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="flex justify-between pt-2 items-center">
          {formData.id && (
            <span className="text-xs text-muted-foreground mr-auto">Deixe vazio para limpar status ou responsável.</span>
          )}
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="px-6 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors shadow-md shadow-primary/30 ml-auto"
          >
            {createMutation.isPending ? 'Salvando...' : formData.id ? 'Salvar Alterações' : 'Criar Tarefa'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
