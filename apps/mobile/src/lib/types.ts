/** Tipos compartilhados das entidades da API (paridade com o Prisma). */

export interface TaskStatus {
  id: string;
  name: string;
  slug: string;
  color?: string | null;
  position: number;
  category?: string | null;
  isDefault?: boolean;
}

export interface TaskPriority {
  id: string;
  name: string;
  level: number;
  color?: string | null;
}

export interface AssigneeInfo {
  id: string;
  name?: string | null;
  user?: { name?: string | null; avatarUrl?: string | null } | null;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  projectId?: string | null;
  statusId: string;
  priorityId?: string | null;
  assigneeTenantUserId?: string | null;
  dueDate?: string | null;
  startDate?: string | null;
  sortOrder?: number;
  status?: TaskStatus;
  priority?: TaskPriority | null;
  assignee?: AssigneeInfo | null;
  project?: { id: string; name: string; color?: string | null } | null;
  _count?: { comments: number; checklists: number; attachments: number; subTasks: number };
}

export interface Project {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  color?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  owner?: { id?: string; user?: { name?: string | null; avatarUrl?: string | null } | null } | null;
  team?: { id: string; name: string; color?: string | null } | null;
  _count?: { tasks: number; members: number };
}

export interface Team {
  id: string;
  name: string;
  description?: string | null;
  manager?: { id?: string; user?: { name?: string | null; email?: string | null; avatarUrl?: string | null } | null } | null;
  members?: unknown[];
  _count?: { members: number; projects: number };
}

export interface Collaborator {
  id: string;
  jobTitle?: string | null;
  department?: string | null;
  status?: string | null;
  role?: { name?: string | null } | null;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
    phone?: string | null;
    lastLoginAt?: string | null;
  };
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startAt: string;
  endAt: string;
  allDay?: boolean;
  createdBy?: { user?: { name?: string | null } | null } | null;
}

export interface Contact {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  position?: string | null;
}

export interface DashboardOverview {
  totalTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  overdueTasks: number;
  activeProjects: number;
  totalTeams: number;
  completionRate: number;
}

export interface TaskComment {
  id: string;
  content: string;
  createdAt: string;
  author?: { user?: { name?: string | null; avatarUrl?: string | null } | null } | null;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  ipAddress?: string | null;
  createdAt: string;
  actor?: { name?: string | null; email?: string | null } | null;
}

export interface RoutineItem {
  id: string;
  title: string;
  description?: string | null;
  scheduledTime?: string | null;
  isActive: boolean;
  logs?: { id: string; completedAt: string }[];
}

export interface EmailMessage {
  uid: number | string;
  subject: string;
  from?: string | null;
  fromAddress?: string | null;
  to?: string | null;
  date?: string | null;
  seen: boolean;
}
