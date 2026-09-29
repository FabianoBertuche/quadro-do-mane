export type ProjectView = 'list' | 'kanban';

export const DEFAULT_PROJECT_VIEW: ProjectView = 'kanban';

export function projectChatRoute(projectId: string): `/project/${string}/chat` {
  return `/project/${projectId}/chat`;
}
