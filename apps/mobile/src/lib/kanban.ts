import type { Task, TaskStatus } from './types';

export function groupTasksByStatus(tasks: Task[], statuses: TaskStatus[]): Map<string, Task[]> {
  const map = new Map<string, Task[]>();
  for (const status of statuses) map.set(status.id, []);
  for (const task of tasks) {
    if (!map.has(task.statusId)) map.set(task.statusId, []);
    map.get(task.statusId)!.push(task);
  }
  return map;
}
