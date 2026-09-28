/**
 * Resolve para qual coluna uma tarefa deve ser movida via drag-and-drop.
 *
 * Lógica pura — sem imports de React Native.
 */
type UniqueIdentifier = string | number;

export interface KanbanTask {
  id: string;
  statusId: string;
}

export interface KanbanDropResult {
  taskId: string;
  targetStatusId: string;
}

/**
 * Dado o id do item arrastado (Drivable) e o id do alvo (Droppable coluna),
 * retorna a mudança a aplicar ou null quando não há movimento.
 */
export function resolveKanbanDrop(
  activeId: UniqueIdentifier | null,
  overId: UniqueIdentifier | null,
  tasks: KanbanTask[],
): KanbanDropResult | null {
  if (activeId == null || overId == null) return null;
  const activeStr = String(activeId);
  const overStr = String(overId);
  const task = tasks.find((t) => t.id === activeStr);
  if (!task) return null;
  if (task.statusId === overStr) return null;
  return { taskId: task.id, targetStatusId: overStr };
}
