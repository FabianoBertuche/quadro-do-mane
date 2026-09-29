import { describe, expect, it } from 'vitest';
import { DEFAULT_PROJECT_VIEW, projectChatRoute } from './project-view';

describe('project view navigation', () => {
  it('opens projects in Kanban by default', () => {
    expect(DEFAULT_PROJECT_VIEW).toBe('kanban');
  });

  it('builds the project-scoped AI chat route', () => {
    expect(projectChatRoute('project-42')).toBe('/project/project-42/chat');
  });
});
