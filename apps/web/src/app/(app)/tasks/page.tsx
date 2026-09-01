'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus, LayoutList, KanbanSquare, Eye, Edit2 } from 'lucide-react';
import React, { useState } from 'react';
import { TaskDetailModal } from '@/components/tasks/TaskDetailModal';
import { TaskFilterBar, type TaskFilters } from '@/components/tasks/TaskFilterBar';
import { TaskFormModal } from '@/components/tasks/TaskFormModal';

export default function TasksPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams?.get('projectId') ?? null;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [filters, setFilters] = useState<TaskFilters>({});

  const handleEditTask = (task: any) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const handleNewTask = () => {
    setEditingTask(null);
    setIsModalOpen(true);
  };

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks', filters, projectId],
    queryFn: () => api.get('/tasks', { params: { ...filters, projectId } }).then((r) => r.data),
  });

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
            onClick={handleNewTask}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-600 transition-colors shadow-lg shadow-primary/30"
          >
            <Plus className="w-4 h-4" /> Nova Tarefa
          </button>
        </div>
      </div>

      <TaskFilterBar
        filters={filters}
        onFiltersChange={setFilters}
        totalTasks={tasks?.length || 0}
        filteredCount={tasks?.length || 0}
      />

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
                    <tr
                      key={task.id}
                      className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setSelectedTask(task)}
                    >
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
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditTask(task);
                            }}
                            className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                            title="Editar Tarefa"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTask(task);
                            }}
                            className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                            title="Ver Detalhes"
                          >
                            <Eye className="w-4 h-4" />
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

      <TaskFormModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingTask(null); }}
        initialData={editingTask ? {
          id: editingTask.id,
          title: editingTask.title,
          projectId: editingTask.projectId,
          statusId: editingTask.statusId,
          priorityId: editingTask.priorityId,
          assigneeTenantUserId: editingTask.assigneeTenantUserId,
          startDate: editingTask.startDate,
          dueDate: editingTask.dueDate,
        } : undefined}
        defaultProjectId={projectId}
      />

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
}
