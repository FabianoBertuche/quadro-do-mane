import { describe, expect, it } from 'vitest';
import { resolveKanbanDrop, type KanbanTask } from './kanban-dnd';

const tasks: KanbanTask[] = [
  { id: 't1', statusId: 's1' },
  { id: 't2', statusId: 's1' },
  { id: 't3', statusId: 's2' },
];

describe('resolveKanbanDrop', () => {
  it('retorna null quando activeId é nulo', () => {
    expect(resolveKanbanDrop(null, 's2', tasks)).toBeNull();
  });

  it('retorna null quando overId é nulo (solta fora de qualquer coluna)', () => {
    expect(resolveKanbanDrop('t1', null, tasks)).toBeNull();
  });

  it('retorna null quando activeId não pertence a nenhuma tarefa', () => {
    expect(resolveKanbanDrop('t-inexistente', 's2', tasks)).toBeNull();
  });

  it('retorna null quando solta na mesma coluna de origem', () => {
    expect(resolveKanbanDrop('t1', 's1', tasks)).toBeNull();
  });

  it('retorna taskId e targetStatusId quando move para outra coluna', () => {
    expect(resolveKanbanDrop('t1', 's2', tasks)).toEqual({
      taskId: 't1',
      targetStatusId: 's2',
    });
  });

  it('resolve corretamente com ids numéricos (UniqueIdentifier)', () => {
    const numericTasks: KanbanTask[] = [
      { id: '10', statusId: '20' },
    ];
    expect(resolveKanbanDrop(10, 30, numericTasks)).toEqual({
      taskId: '10',
      targetStatusId: '30',
    });
  });
});
