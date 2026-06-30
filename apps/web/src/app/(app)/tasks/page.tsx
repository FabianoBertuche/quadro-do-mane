'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus, LayoutList, KanbanSquare, Edit2, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';

export default function TasksPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams.get('projectId');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    title: '',
    projectId: projectId || '',
    statusId: '',
    priorityId: '',
    assigneeTenantUserId: '',
    startDate: '',
    dueDate: '',
  });

  const handleEditTask = (task: any) => {
    setFormData({
      id: task.id,
      title: task.title,
      projectId: task.projectId || projectId || '',
      statusId: task.statusId || '',
      priorityId: task.priorityId || '',
      assigneeTenantUserId: task.assigneeTenantUserId || '',
      startDate: task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : '',
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
    });
    setIsModalOpen(true);
  };

  const queryClient = useQueryClient();

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
  });
  const { data: statuses } = useQuery({
    queryKey: ['statuses'],
    queryFn: () => api.get('/tasks/statuses').then((r) => r.data),
  });
  const { data: priorities } = useQuery({
    queryKey: ['priorities'],
    queryFn: () => api.get('/tasks/priorities').then((r) => r.data),
  });

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => api.get('/tasks', { params: { projectId } }).then((r) => r.data),
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
      setIsModalOpen(false);
      setFormData({
        id: '',
        title: '',
        projectId: projectId || '',
        statusId: '',
        priorityId: '',
        assigneeTenantUserId: '',
        startDate: '',
        dueDate: '',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const priorityColors: Record<string, string> = {
    Baixa: 'text-slate-500',
    Normal: 'text-blue-500',
    Alta: 'text-amber-500',
    Urgente: 'text-red-500',
  };

  const groupedTasks = (tasks || []).reduce((acc: any, task: any) => {
    const pName = task.project?.name || 'Sem Projeto';
    if (!acc[pName]) acc[pName] = [];
    acc[pName].push(task);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tarefas</h1>
          <p className="text-muted-foreground mt-1">Visualize e gerencie suas tarefas</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center p-1 bg-muted rounded-xl">
            <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-card text-foreground shadow-sm">
              <LayoutList className="w-4 h-4" /> Lista
            </button>
            <button
              onClick={() => router.push(projectId ? `/tasks/kanban?projectId=${projectId}` : '/tasks/kanban')}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg text-muted-foreground hover:text-foreground transition-colors"
            >
              <KanbanSquare className="w-4 h-4" /> Kanban
            </button>
          </div>

          <button
            onClick={() => {
              setFormData({
                id: '',
                title: '',
                projectId: projectId || '',
                statusId: '',
                priorityId: '',
                assigneeTenantUserId: '',
                startDate: '',
                dueDate: '',
              });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-600 transition-colors shadow-lg shadow-primary/30"
          >
            <Plus className="w-4 h-4" /> Nova Tarefa
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Tarefa</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Prioridade</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Responsável</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Prazo</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-border">
                  <td colSpan={6} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                </tr>
              ))
            ) : Object.keys(groupedTasks).length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma tarefa encontrada.</td></tr>
            ) : (
              Object.entries(groupedTasks).map(([projectName, projectTasks]: any) => (
                <React.Fragment key={projectName}>
                  <tr className="bg-muted/50 border-b border-border">
                    <td colSpan={6} className="px-4 py-2 font-semibold text-sm">
                      {projectName}
                    </td>
                  </tr>
                  {projectTasks.map((task: any) => (
                    <tr key={task.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-medium text-sm">{task.title}</span>
                      </td>
                      <td className="px-4 py-3">
                        {task.status && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: task.status.color }} />
                            {task.status.name}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {task.priority && (
                          <span className={`text-xs font-medium ${priorityColors[task.priority.name] || ''}`}>
                            {task.priority.name}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {task.assignee && (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                              <span className="text-[10px] font-semibold text-primary">{task.assignee.user?.name?.charAt(0)}</span>
                            </div>
                            <span className="text-xs">{task.assignee.user?.name}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {task.dueDate ? new Date(task.dueDate).toLocaleDateString('pt-BR') : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditTask(task)}
                            className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                            title="Editar Tarefa"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nova Tarefa">
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
          {!projectId && (
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
              {(users || []).map((u: any) => (
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
    </div>
  );
}
