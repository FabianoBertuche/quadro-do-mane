'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus, LayoutList, KanbanSquare, CalendarIcon } from 'lucide-react';
import { useState } from 'react';
import { TaskDetailModal } from '@/components/tasks/TaskDetailModal';
import { TaskFilterBar, type TaskFilters } from '@/components/tasks/TaskFilterBar';
import { TaskFormModal } from '@/components/tasks/TaskFormModal';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id });
  return <div ref={setNodeRef} className="space-y-2 p-2 rounded-2xl bg-muted/30 min-h-[200px]">{children}</div>;
}

function TaskCard({ task, isDragging, onClick }: { task: any; isDragging?: boolean; onClick?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status?.category !== 'done';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onDoubleClick={onClick}
      className={`p-3 rounded-xl bg-card border ${isOverdue ? 'border-red-500 shadow-red-100' : 'border-border'} shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-grab active:cursor-grabbing relative overflow-hidden`}
    >
      {isOverdue && (
        <div className="absolute top-0 right-0 px-2 py-0.5 bg-red-500 text-[8px] text-white font-bold rounded-bl-lg uppercase tracking-wider">
          Atrasada
        </div>
      )}
      <h4 className="text-sm font-medium mb-2">{task.title}</h4>
      <div className="flex items-center justify-between">
        {task.priority && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: task.priority.color + '20', color: task.priority.color }}>
            {task.priority.name}
          </span>
        )}
        {task.assignee && (
          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-[10px] font-semibold text-primary">{task.assignee.user?.name?.charAt(0)}</span>
          </div>
        )}
      </div>
      {task._count && (task._count.comments > 0 || task._count.checklists > 0 || task._count.attachments > 0) && (
        <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
          {task._count.comments > 0 && <span>💬 {task._count.comments}</span>}
          {task._count.checklists > 0 && <span>✅ {task._count.checklists}</span>}
          {task._count.attachments > 0 && <span>📎 {task._count.attachments}</span>}
        </div>
      )}
      {task.dueDate && (
        <div className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1 font-medium bg-muted/50 w-fit px-2 py-0.5 rounded-md">
          <CalendarIcon className="w-3 h-3" />
          {new Date(task.dueDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
        </div>
      )}
    </div>
  );
}

export default function KanbanPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams?.get('projectId') ?? null;
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
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

  const { data: tasks } = useQuery({
    queryKey: ['tasks', 'kanban', filters, projectId],
    queryFn: () => api.get('/tasks', { params: { ...filters, projectId } }).then((r) => r.data),
  });

  const { data: statuses } = useQuery({
    queryKey: ['statuses'],
    queryFn: () => api.get('/tasks/statuses').then((r) => r.data),
  });

  const moveMutation = useMutation({
    mutationFn: ({ taskId, statusId, kanbanPosition }: any) =>
      api.patch(`/tasks/${taskId}/move`, { statusId, kanbanPosition }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const getTasksByStatus = (statusId: string) =>
    (tasks || []).filter((t: any) => t.statusId === statusId).sort((a: any, b: any) => a.kanbanPosition - b.kanbanPosition);

  const handleDragStart = (event: DragStartEvent) => setActiveId(event.active.id as string);

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    if (taskId === overId) return;

    let targetStatusId = overId;
    let newPosition = Date.now();

    const activeTask = (tasks || []).find((t: any) => t.id === taskId);
    const isOverTask = (tasks || []).find((t: any) => t.id === overId);

    if (isOverTask) {
      targetStatusId = isOverTask.statusId;
      let columnTasks = getTasksByStatus(targetStatusId);

      const activeIndex = columnTasks.findIndex((t: any) => t.id === taskId);
      const overIndex = columnTasks.findIndex((t: any) => t.id === overId);

      if (activeIndex !== -1 && overIndex !== -1) {
        columnTasks = arrayMove(columnTasks, activeIndex, overIndex);
      } else {
        columnTasks = columnTasks.filter((t: any) => t.id !== taskId);
        columnTasks.splice(overIndex, 0, { id: taskId, statusId: targetStatusId, kanbanPosition: 0 });
      }

      const currentIndex = columnTasks.findIndex((t: any) => t.id === taskId);

      if (currentIndex === 0) {
        newPosition = (columnTasks[1]?.kanbanPosition || 2000) - 1000;
      } else if (currentIndex === columnTasks.length - 1) {
        newPosition = columnTasks[currentIndex - 1].kanbanPosition + 1000;
      } else {
        newPosition = (columnTasks[currentIndex - 1].kanbanPosition + columnTasks[currentIndex + 1].kanbanPosition) / 2;
      }
    } else {
      targetStatusId = overId;
      const columnTasks = getTasksByStatus(targetStatusId);
      if (columnTasks.length > 0) {
        newPosition = columnTasks[columnTasks.length - 1].kanbanPosition + 1000;
      } else {
        newPosition = 1000;
      }
    }

    moveMutation.mutate({ taskId, statusId: targetStatusId, kanbanPosition: newPosition });
  };

  const activeTask = activeId ? (tasks || []).find((t: any) => t.id === activeId) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Quadro Kanban</h1>
          <p className="text-muted-foreground mt-1">Arraste e solte para mover tarefas</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center p-1 bg-muted rounded-xl">
            <button
              onClick={() => router.push(projectId ? `/tasks?projectId=${projectId}` : '/tasks')}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg text-muted-foreground hover:text-foreground transition-colors"
            >
              <LayoutList className="w-4 h-4" /> Lista
            </button>
            <button
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-card text-foreground shadow-sm"
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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {(statuses || []).map((status: any) => {
            const columnTasks = getTasksByStatus(status.id);
            return (
              <div key={status.id} className="flex-shrink-0 w-72">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: status.color }} />
                  <h3 className="font-semibold text-sm">{status.name}</h3>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{columnTasks.length}</span>
                </div>
                <DroppableColumn id={status.id}>
                  <SortableContext items={columnTasks.map((t: any) => t.id)} strategy={verticalListSortingStrategy} id={status.id}>
                    {columnTasks.map((task: any) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        isDragging={task.id === activeId}
                        onClick={() => setSelectedTask(task)}
                      />
                    ))}
                  </SortableContext>
                </DroppableColumn>
              </div>
            );
          })}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="p-3 rounded-xl bg-card border-2 border-primary shadow-xl w-72">
              <h4 className="text-sm font-medium">{activeTask.title}</h4>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

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
          defaultEdit={true}
        />
      )}
    </div>
  );
}
