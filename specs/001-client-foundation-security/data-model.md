# Data Model: Fundação segura e paritária dos clientes

## Existing authoritative entities

| Entity | Identity and relevant fields | Security invariant |
|---|---|---|
| `Tenant` | `id`, `status` | É a fronteira obrigatória de todas as consultas e mutações corporativas. |
| `User` | `id`, `isActive` | Identidade global; não autoriza por si só uma ação em tenant. |
| `TenantUser` | `id`, `tenantId`, `userId`, `roleId`, `isActive`, `status` | É a identidade operacional. O ator, responsável ou destinatário deve ser uma participação ativa do tenant. |
| `Role` / `Permission` | `roleId`, `code` | Define autorização por capacidade; papel de outro tenant não concede acesso. |
| `Project` | `id`, `tenantId`, `ownerTenantUserId`, `teamId`, `archivedAt` | O projeto sempre pertence a um tenant; visibilidade adicional pode exigir proprietário, equipe, membro ou tarefa atribuída. |
| `ProjectMember` | `projectId`, `tenantId`, `tenantUserId`, `roleInProject` | Vínculo direto que deve ter tenant coerente com o projeto e participação ativa. |
| `Task` | `id`, `tenantId`, `projectId`, `assigneeTenantUserId`, `reporterTenantUserId`, `teamId`, `archivedAt` | Tarefa, projeto, responsáveis, status, prioridade e equipe devem pertencer ao mesmo tenant. |
| `TaskAssignee` | `taskId`, `tenantId`, `tenantUserId` | Cada atribuição é única por tarefa/pessoa e não pode cruzar tenant. |
| `Attachment` | `id`, `tenantId`, `taskId`, `projectId`, `uploadedByTenantUserId`, `filePath` | Antes de escrever bytes ou criar o registro, tarefa/projeto e pessoa enviadora devem ser validados no tenant; uma falha posterior remove bytes recém-criados. |
| `Event` | `id`, `tenantId`, `createdByTenantUserId`, `assigneeTenantUserId`, `relatedProjectId`, `relatedTaskId`, `startAt`, `endAt` | Criador, responsável, projeto e tarefa relacionados pertencem ao tenant do evento. |
| `EventAttendee` | `eventId`, `tenantId`, `tenantUserId` | Participante deve ser uma participação ativa do tenant do evento. |
| `DailyRoutineItem` | `id`, `tenantId`, `assignedTenantUserId`, `createdById` | Criador e pessoa atribuída pertencem ao mesmo tenant e estão ativos. |
| `DailyRoutineLog` | `routineItemId`, `tenantId`, `tenantUserId`, `date` | A chave diária é `YYYY-MM-DD` em `America/Sao_Paulo`; o log só existe para item e pessoa do mesmo tenant. |
| `Notification` | `id`, `tenantId`, `tenantUserId`, `isRead`, `readAt` | Somente o destinatário pode listar, contar ou alterar sua leitura. |

## Derived authorization context

`AuthorizationContext` é informação derivada de autenticação, não um registro gravado pelo cliente:

| Field | Meaning | Rule |
|---|---|---|
| `userId` | Pessoa autenticada | Usado somente para auditar e localizar a participação. |
| `tenantId` | Tenant ativo | Determina o filtro obrigatório de todos os recursos. |
| `tenantUserId` | Participação ativa no tenant | Identifica ator, propriedade, destinatário e participações. |
| `roleId` / `roleName` | Papel no tenant ativo | Permite regras de visibilidade ampliada apenas no mesmo tenant. |
| `permissions` | Capacidades efetivas | Toda operação protegida exige a capacidade correspondente. |

Validation rules:

1. `tenantId` e `tenantUserId` são derivados da sessão, não de payload, parâmetro de busca ou corpo da requisição.
2. A participação deve estar ativa antes de qualquer operação.
3. Todo `find`, `update`, `delete`, vínculo ou agregação começa pelo escopo `tenantId`.
4. Relações informadas em criação/edição são verificadas contra o mesmo `tenantId`; quando houver participação, o vínculo exigido também é verificado.
5. Para `Notification`, o escopo inclui obrigatoriamente `tenantUserId` do ator.

## Read-only cache model

`CachedReadModel` é uma estrutura local do cliente, não uma tabela compartilhada:

| Field | Type / example | Rule |
|---|---|---|
| `scopeKey` | `tenantId:tenantUserId` | Separa contas e tenants no mesmo dispositivo. |
| `queryKey` | `tasks:list:filters-hash` | Identifica uma leitura elegível e seus filtros. |
| `payload` | resposta canônica serializada | Não contém credenciais, tokens de sessão ou dados de outro escopo. |
| `lastUpdatedAt` | instante UTC | Exibido convertido para `America/Sao_Paulo`. |
| `schemaVersion` | `'1.1.0'`, a versão do contrato canônico | Invalida cache incompatível sem tentativa de migração implícita. |

Lifecycle:

1. Uma leitura bem-sucedida em rede substitui a entrada do mesmo `scopeKey`, `queryKey` e `schemaVersion`, que corresponde exatamente à versão OpenAPI canônica `1.1.0` publicada.
2. Uma leitura offline retorna a entrada existente marcada `offline: true` e `stale: true`.
3. Falta de entrada produz estado `offline-unavailable`.
4. Nenhuma mutação cria, atualiza ou enfileira uma entrada por estar offline.
5. Logout, troca de tenant ou mudança de usuário remove do estado ativo a referência ao cache do escopo anterior; o cliente nunca o consulta sob outro `scopeKey`.

## Relationships and cardinality

```text
User 1 --- * TenantUser * --- 1 Tenant
TenantUser * --- * Project via ProjectMember
Tenant 1 --- * Project 1 --- * Task
TenantUser 1 --- * Task (assignee/reporter) and Task * --- * TenantUser via TaskAssignee
Tenant 1 --- * Event * --- * TenantUser via EventAttendee
TenantUser 1 --- * DailyRoutineItem 1 --- * DailyRoutineLog
TenantUser 1 --- * Notification
```

## State transitions

| Entity / state | Allowed transition | Preconditions |
|---|---|---|
| Session | valid → refresh attempted → valid or unauthenticated | No more than one refresh for an original operation. |
| Notification | unread → read | Actor `tenantUserId` equals notification recipient and tenant matches. |
| Routine log | absent → completed for a local business date | Item, assignee and actor satisfy tenant and permission rules; date is in `America/Sao_Paulo`. |
| Cached read | absent/stale → current | Successful eligible read in the matching user/tenant scope. |
| Cached read | current → offline stale | Connectivity unavailable; no mutation changes it. |
