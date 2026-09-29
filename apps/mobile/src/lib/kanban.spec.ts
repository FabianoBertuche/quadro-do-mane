import { describe, expect, it } from 'vitest';
import { groupTasksByStatus } from './kanban';
import type { Task, TaskStatus } from './types';

const statuses: TaskStatus[] = [
  { id: 'todo', name: 'A fazer', slug: 'todo', position: 0 },
  { id: 'done', name: 'Concluída', slug: 'done', position: 1 },
];

const task = (id: string, statusId: string): Task => ({
  id,
  title: id,
  statusId,
});

describe('groupTasksByStatus', () => {
  it('initializes status columns and groups tasks, including unknown statuses', () => {
    expect(
      groupTasksByStatus(
        [task('first', 'todo'), task('orphan', 'blocked'), task('last', 'todo')],
        statuses,
      ),
    ).toEqual(
      new Map([
        ['todo', [task('first', 'todo'), task('last', 'todo')]],
        ['done', []],
        ['blocked', [task('orphan', 'blocked')]],
      ]),
    );
  });
});
