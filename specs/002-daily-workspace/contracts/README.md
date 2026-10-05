# Contratos de integração — Daily Workspace

Base atual: `/api`. O endpoint novo segue o estilo do controller Nest existente; se a API for versionada no deployment, o proxy pode publicar o mesmo contrato sob `/api/v1`.

## 1. Workspace diário agregado (novo)

### `GET /daily-workspace?date=YYYY-MM-DD`

**Guard de leitura (OR explícito):** `apps/api/src/common/guards/daily-workspace-read.guard.ts` exporta `DailyWorkspaceReadGuard` e injeta `PrismaService`. O controller aplica `@UseGuards(AuthGuard('jwt'), TenantContextGuard, DailyWorkspaceReadGuard)` e não aplica `PermissionGuard` nesta rota. Admin passa; os demais passam somente por `tasks.view || calendar.view || daily_routine.view`. Quando o snapshot JWT não satisfaz o OR, o guard executa a mesma sequência do `PermissionGuard`: `rolePermission.findMany` por `user.roleId`, fallback de `role.findFirst` por `user.roleName` se vazio, nova consulta por UUID e substituição de `request.user.permissions` pelos códigos atuais. Se o banco não devolver permissão elegível, responde 403. `apps/api/src/common/guards/daily-workspace-read.guard.spec.ts` testa cada permissão isolada, combinadas, conjunto vazio, request sem sessão e JWT desatualado cuja consulta ao banco passa/falha. Se o usuário não possuir a permissão de uma seção, essa seção volta vazia e a capability correspondente é `false`.

**Parâmetros:**

| Nome | Obrigatório | Regra |
|---|---:|---|
| `date` | não | data ISO civil `YYYY-MM-DD`; padrão: hoje em `America/Sao_Paulo` |

**Resposta 200:** objeto `DailyWorkspace` definido em [`../data-model.md`](../data-model.md). Exemplos de campos obrigatórios:

```json
{
  "contractVersion": "2026-09-09",
  "referenceDate": "2026-09-09",
  "timeZone": "America/Sao_Paulo",
  "rangeStart": "2026-09-09T03:00:00.000Z",
  "rangeEnd": "2026-09-10T03:00:00.000Z",
  "generatedAt": "2026-09-09T13:30:00.000Z",
  "sections": { "overdue": [], "assigned": [], "routine": [], "appointments": [], "reminders": [] },
  "unavailableSections": [],
  "capabilities": { "projects": { "create": true }, "tasks": { "view": true, "create": true, "edit": true, "delete": false, "move": true, "assign": true, "changeStatus": true, "changePriority": true, "comment": true, "checklistManage": true, "attachmentsEdit": true }, "calendar": { "view": true, "create": true, "edit": true, "delete": true, "dismissReminders": true }, "dailyRoutine": { "view": true, "manage": false, "complete": true } }
}
```

**Erros:** 400 (`date` inválida), 401 (sessão inválida), 403 (nenhuma permissão de leitura), 500 (falha sem recuperação por seção). Falha recuperável por seção retorna 200 e lista o identificador em `unavailableSections`.

## 2. Consultas de tarefas (existentes)

### `GET /tasks`

**Permissão:** `tasks.view`.
**Query suportada:** `projectId`, `statusId`, `assigneeTenantUserId`, `priorityId`, `teamId`, `tagId`, `overdue`, `completed`, `myTasks`, `blocked`, `search`, `startDateFrom`, `startDateTo`, `dueDateFrom`, `dueDateTo`.

Os filtros são combinados por AND, exceto a busca que procura título ou descrição. `myTasks=true` deve prevalecer sobre identificação enviada pelo cliente e usar o usuário da sessão. Tanto `myTasks=true` quanto `assigneeTenantUserId` correspondem a `Task.assigneeTenantUserId` **ou** a `TaskAssignee.tenantUserId`; a consulta deve retornar cada `Task.id` uma única vez. A resposta contém tarefa, status, prioridade, responsável principal, projeto, tags e contagens.

### `GET /tasks/:id`

**Permissão:** `tasks.view`. Retorna detalhe com `assignees`, `checklists.items`, `comments` não excluídos, `attachments`, `subTasks`, projeto e metadados da tarefa. 404 se não houver tarefa no tenant.

### Escritas existentes usadas no detalhe

| Operação/rota | Permissão real atual | Uso |
|---|---|---|
| `POST /tasks` | `tasks.create` | criar tarefa |
| `PATCH /tasks/:id` | `tasks.edit` | editar campos e responsável |
| `DELETE /tasks/:id` | `tasks.delete` | excluir tarefa |
| `PATCH /tasks/:id/status` | `tasks.change_status` | mudar status |
| `PATCH /tasks/:id/priority` | `tasks.change_priority` | mudar prioridade |
| `PATCH /tasks/:id/move` | `tasks.move` | mover no kanban |
| `POST /tasks/:id/comments` | `tasks.comment` | criar comentário `{ "content": "..." }` |
| `POST /tasks/:id/checklists` | `tasks.checklist_manage` | criar checklist `{ "title": "..." }` |
| `POST /tasks/checklists/:id/items` | `tasks.checklist_manage` | criar item `{ "content": "..." }` |
| `PATCH /tasks/checklist-items/:id/toggle` | `tasks.checklist_manage` | alternar item |
| `POST /upload/tasks/:taskId` | `tasks.edit` | enviar anexo |
| `DELETE /tasks/:id/attachments/:attachmentId` | `tasks.edit` | remover anexo |

Clientes offline não podem chamar nenhuma rota desta tabela.

### Matriz de atalhos e capabilities

| Operação de UI | Capability | Permissão real |
|---|---|---|
| Criar projeto | `projects.create` | `projects.create` |
| Criar tarefa | `tasks.create` | `tasks.create` |
| Editar/atribuir tarefa | `tasks.edit` / `tasks.assign` | `tasks.edit` (a rota atual de atribuição é `PATCH /tasks/:id`) |
| Excluir tarefa | `tasks.delete` | `tasks.delete` |
| Alterar status | `tasks.changeStatus` | `tasks.change_status` |
| Alterar prioridade | `tasks.changePriority` | `tasks.change_priority` |
| Enviar/remover anexo | `tasks.attachmentsEdit` | `tasks.edit` |
| Criar evento | `calendar.create` | `calendar.create` |
| Criar/gerir rotina | `dailyRoutine.manage` | `daily_routine.manage` |

`tasks.assign` permanece uma capability informativa da sessão, mas não libera por si só a UI de atribuição enquanto o controller atual requer `tasks.edit`; trocar essa rota para `tasks.assign` é uma alteração coordenada de contrato fora desta feature.

## 3. Agenda e lembretes (existentes)

### `GET /events?startDate=ISO&endDate=ISO`

**Permissão:** `calendar.view`. O cliente sempre envia as fronteiras São Paulo retornadas pelo workspace. A API filtra visibilidade por criador, responsável ou participante. Usuário não admin não pode consultar calendário de outro colaborador via `tenantUserId`.

### `GET /events/reminders`

**Permissão:** `calendar.view`. Retorna lembretes ativos elegíveis ao usuário.

### `POST /events/:id/reminders/dismiss-day` e `POST /events/:id/reminders/dismiss-forever`

**Permissão:** `calendar.view`; somente online. Uma ação bem-sucedida invalida `daily-workspace` e `agenda` do contexto atual.

## 4. Rotina diária (existente)

| Rota | Permissão | Contrato relevante |
|---|---|---|
| `GET /daily-routine` | `daily_routine.view` | itens do usuário com `completedToday` |
| `PATCH /daily-routine/:id/complete` | `daily_routine.complete` | marca o item atual; 409 se ordem sequencial bloqueia ou já concluiu |
| `POST /daily-routine` | `daily_routine.manage` | cria rotina; aceita `assignedTenantUserId` opcional |

Enquanto a implementação existente usa data UTC em rotina, a feature deve corrigir a projeção e o serviço para a mesma data São Paulo do workspace antes de expor o painel.

## Política offline transversal

O cliente acrescenta `X-Client-Read-Cache: hit` apenas para telemetria opcional de GET servido do cache; ele nunca envia uma resposta cacheada ao servidor. A chave é `rw:2026-09-09:v1:{tenantId}:{tenantUserId}:{resource}:{referenceDate-or-id}` e entradas com outra versão são descartadas. Ao detectar offline, POST/PATCH/DELETE/upload falham localmente com erro tipado `OfflineReadOnlyError` antes de Axios/fetch. Respostas 401/403 apagam todas as entradas do contexto atual antes de propagar o erro. Não existe endpoint de sync nem corpo de mutação persistido.
