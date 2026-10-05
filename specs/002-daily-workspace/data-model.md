# Modelo de dados — Daily Workspace

## Entidades persistidas reutilizadas

| Entidade | Campos relevantes | Uso no workspace |
|---|---|---|
| `Task` | `tenantId`, `parentTaskId`, `assigneeTenantUserId`, `statusId`, `dueDate`, `archivedAt` | trabalho, atraso e subtarefas |
| `TaskAssignee` | `taskId`, `tenantUserId`, `tenantId` | responsabilidades adicionais e deduplicação |
| `TaskStatus` | `tenantId`, `category` | excluir tarefas concluídas de atraso |
| `TaskChecklist` / `TaskChecklistItem` | `taskId`, `isDone`, `position` | detalhe e progresso |
| `TaskComment` | `taskId`, `authorTenantUserId`, `deletedAt` | conversa da tarefa |
| `Attachment` | `taskId`, `fileName`, `filePath`, `mimeType`, `fileSize` | anexos de tarefa |
| `Event` | `tenantId`, `startAt`, `endAt`, `assigneeTenantUserId`, `relatedTaskId` | agenda diária |
| `EventAttendee` | `eventId`, `tenantUserId` | visibilidade de compromissos |
| `EventReminderAction` | `eventId`, `tenantUserId`, `action`, `actionDate` | supressão por dia ou permanente |
| `DailyRoutineItem` / `DailyRoutineLog` | `assignedTenantUserId`, `scheduledTime`, `date`, `completedAt` | rotina e estado do dia |

Não há nova tabela ou migração nesta feature. Todas as consultas devem filtrar `tenantId`; relações de usuário devem validar o tenant antes de serem expostas.

## Projeção de API `DailyWorkspace`

```ts
type DailyWorkspace = {
  contractVersion: '2026-09-09';
  referenceDate: string;             // YYYY-MM-DD em America/Sao_Paulo
  timeZone: 'America/Sao_Paulo';
  rangeStart: string;                // ISO instantâneo inclusivo
  rangeEnd: string;                  // ISO instantâneo exclusivo
  generatedAt: string;               // ISO instantâneo
  sections: {
    overdue: TaskSummary[];
    assigned: TaskSummary[];
    routine: RoutineSummary[];
    appointments: AppointmentSummary[];
    reminders: ReminderSummary[];
  };
  unavailableSections: Array<'overdue' | 'assigned' | 'routine' | 'appointments' | 'reminders'>;
  capabilities: DailyWorkspaceCapabilities;
};

type TaskSummary = {
  id: string;
  title: string;
  project: { id: string; name: string; code: string | null };
  status: { id: string; name: string; category: string } | null;
  priority: { id: string; name: string; color: string | null } | null;
  dueDate: string | null;
  assignees: Array<{ id: string; name: string; avatarUrl: string | null }>;
  isBlocked: boolean;
  counts: { attachments: number; comments: number; checklists: number; subtasks: number };
};

type RoutineSummary = {
  id: string;
  title: string;
  description: string | null;
  scheduledTime: string;
  completedToday: boolean;
  blockedByPrevious: boolean;
};

type AppointmentSummary = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  type: string | null;
  relatedTaskId: string | null;
  relatedProjectId: string | null;
};

type ReminderSummary = {
  eventId: string;
  title: string;
  startAt: string;
  remindDaysBefore: number;
  canDismiss: boolean;
};

type DailyWorkspaceCapabilities = {
  projects: { create: boolean };
  tasks: {
    view: boolean; create: boolean; edit: boolean; delete: boolean; move: boolean;
    assign: boolean; changeStatus: boolean; changePriority: boolean; comment: boolean;
    checklistManage: boolean; attachmentsEdit: boolean;
  };
  calendar: { view: boolean; create: boolean; edit: boolean; delete: boolean; dismissReminders: boolean };
  dailyRoutine: { view: boolean; manage: boolean; complete: boolean };
};
```

### Invariantes da projeção

1. `referenceDate` é sempre uma data civil São Paulo e `rangeEnd` é exclusivo.
2. `assigned` é único por `Task.id`, mesmo que a tarefa tenha responsável principal e múltiplos registros de `TaskAssignee`.
3. `overdue` contém `dueDate < rangeStart`, tarefa não arquivada e `status.category !== 'done'`.
4. `appointments` inclui evento que intersecta `[rangeStart, rangeEnd)` e cuja visibilidade foi autorizada.
5. `unavailableSections` nunca omite uma falha: seção ausente deve ser lista vazia e estar marcada indisponível.

## Modelo local de cache de leitura

```ts
type ReadCacheEntry<T> = {
  key: string;
  version: 1;
  tenantId: string;
  tenantUserId: string;
  resource: 'daily-workspace' | 'tasks' | 'task-detail' | 'agenda';
  referenceDate?: string;
  savedAt: string;
  expiresAt: string;
  payload: T;
};
```

**Chave canônica:** `rw:2026-09-09:v1:{tenantId}:{tenantUserId}:{resource}:{referenceDate-or-id}`. O primeiro segmento é exatamente o `contractVersion` retornado pelo payload; o cliente rejeita entrada cuja versão não seja `2026-09-09`.

Regras de ciclo de vida:

- gravar somente após GET 2xx e validação do payload;
- 15 minutos para `daily-workspace` e `agenda`, 5 minutos para `tasks`, 30 minutos para `task-detail`;
- apagar por prefixo do contexto em logout, troca de tenant, e em qualquer resposta 401/403 do transporte antes de propagar o erro;
- invalidar recursos afetados após escrita online bem-sucedida;
- não armazenar token, cabeçalho de autorização, senha ou payload de respostas mutáveis.
