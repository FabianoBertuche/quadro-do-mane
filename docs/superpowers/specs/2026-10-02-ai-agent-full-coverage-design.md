# Cobertura integral do agente de IA — Design

**Data:** 2026-10-02
**Status:** aprovado
**Escopo desta spec:** Onda 0 + Onda 1 do programa de cobertura.

## Contexto

O agente de IA da plataforma é orientado a tools explícitas da API: não existe
proxy de browser, e o que o usuário consegue fazer numa tela depende de existir
uma tool correspondente registrada em `AiToolRegistryService`.

Um inventário cruzou as 21 páginas de `apps/web/src/app/(app)/` com as 14 tools
registradas. O agente cobre leitura de tarefas, projetos, pessoas, equipes,
agenda e rotinas, além de criar/atualizar/mover tarefa, criar evento e criar
rotina. Ficaram de fora commenting, checklists, anexos, exclusão, CRUD de
projeto e equipe, conclusão e edição de rotina, contatos, colaboradores,
e-mail, relatórios, auditoria e configuração de providers.

O objetivo é o agente alcançar **paridade com a UI mais os endpoints órfãos** —
endpoints que já existem na API e não têm botão na tela.

O volume estimado é de ~45 tools novas, o que torna uma spec única
inviável. O programa é entregue em ondas; esta spec cobre as duas primeiras.

## Decisões fechadas

| Tema | Decisão |
|---|---|
| Escopo | Paridade com a UI **e** endpoints órfãos |
| Ações sensíveis | Todas liberadas ao agente, com confirmação explícita na escrita |
| Anexos | `attach_task_file` baixa por URL; além disso, anexo no chat com leitura pelo agente |
| Tipos de anexo no chat | Texto/código + imagens (vision) + extração de PDF/DOCX/XLSX |
| Bugs de UI | Corrigir os quatro encontrados na auditoria |
| Arquitetura | Toolkits por domínio com exposição por permissão |
| Entrega | Ondas, cada uma com spec → plano → ciclo próprio |

## Mapa de ondas

| Onda | Conteúdo |
|---|---|
| 0 | Quatro correções de UI (web apenas) |
| 1 | Padrão de toolkit + núcleo de trabalho: comentários, checklists, anexos, exclusão de tarefa, CRUD de projeto e equipe |
| 2 | Rotinas e agenda: `complete_routine`, `update_routine`, editar/excluir evento, série, lembretes, log admin |
| 3 | Pessoas: contatos, colaboradores, perfil |
| 4 | E-mail: buscar, ler, responder, enviar |
| 5 | Insights e admin: dashboard, operacional, auditoria, providers de IA |
| 6 | Anexo no chat: schema, upload, extração, vision no provider, composer web |

As ondas 2 a 6 herdam o padrão de toolkit definido aqui e terão spec própria.

---

## Onda 0 — correções de UI

Quatro defeitos encontrados no inventário. Todos web, nenhum toca a API.

### 0.1 Rotas órfãs duplicadas

`apps/web/src/app/(app` e `apps/web/src/app/)` são diretórios distintos de
`(app)`. Eles compilam páginas quebradas de `daily-routine` no build de
produção e duplicam a rota `/daily-routine`.

Ação: apagar os dois diretórios. Verificação: `npm run build` e uma única
entrada de `/daily-routine` em `.next/app-path-routes-manifest.json`.

### 0.2 Filtro `statusCategory` do dashboard

O drill-down aceita `statusCategory` e o cliente o descarta. A construção da
query sai do componente para `apps/web/src/lib/task-filters.ts`, coberta por
spec — é a convenção do repositório (`task-form.spec.ts`, `ai-runtime.spec.ts`:
lógica em `lib`, componente fino).

### 0.3 Botão "Atualizar" do `/operational`

`onClick={() => {}}` não executa nada. Passa a chamar o refetch existente.
É wiring de uma linha, sem spec nova: coberto por build e verificação manual.

### 0.4 Checkboxes de notificação

Correção de uma premissa errada da auditoria: o endpoint **já existe**.
`notifications.controller.ts:40,50` expõe
`GET /notifications/notification-preferences` e
`PATCH /notifications/notification-preferences/:category`, e
`NotificationPreferencesService.updateByUser` já responde 409 quando a categoria
está travada pelo admin. A página nunca chamava.

Ação: ligar a página ao endpoint e respeitar `lockedByAdmin` — checkbox
desabilitado com aviso quando a empresa trava a categoria.

---

## Onda 1 — arquitetura do toolkit

### Premissa

Três fatos do código atual:

1. `ai.module.ts:116` mantém a lista de tools digitada no `inject` do registry.
   Com ~60 tools vira um arquivo impossível de revisar.
2. `ai.service.ts:113` envia `registry.list()` — todas as tools — em toda
   mensagem.
3. `task-tool.schemas.ts:5` define `Permission` como union hardcoded de 14
   códigos, enquanto `prisma/seed.ts:104-168` semeia mais de 60.

### Permissão como dado da tool

`AiTool` (`tools/ai-tool.port.ts:20`) ganha `permission?: PermissionCode`.
Cada tool declara a permissão uma vez; o `authorize()` passa a ser o
`requirePermission` genérico já existente (`task-tool.schemas.ts:69`), sem
repetição por tool.

### Exposição por permissão

`AiToolRegistryService` ganha:

- `listVisible(actor)` — tools cujo `permission` está em
  `actor.role.rolePermissions`. `ai.service.ts:113` passa a chamar isso em vez
  de `list()`. Um colaborador recebe ~15 tools em vez de ~60.
- resolução de chamada com checagem de visibilidade, para que uma tool
  escondida produz "indisponível para seu perfil" em vez de "ferramenta não
  disponível".

Isso **não** é a fronteira de segurança. `authorize()` continua rodando a cada
chamada (`ai.service.ts:198`) e de novo na confirmação — o caminho de negação
está coberto em `ai-security.spec.ts:211`. O gating existe para reduzir prompt e
evitar tool-call errada; `authorize()` é o limite.

### Código de permissão espelhando o seed

`Permission` union sai de `task-tool.schemas.ts` e vira
`apps/api/src/modules/ai/tools/permission-codes.ts`, derivado da lista de
`prisma/seed.ts:104-168`, com spec de paridade que falha se os dois divergirem.
Nenhuma tool nova precisa de cast, e nenhuma permissão nova é inventada.

### Toolkits por pasta

`tools/<dominio>/` — `tasks`, `projects`, `teams` nesta onda — cada um
exportando seu array de providers. `ai.module.ts` compõe por spread.

---

## Onda 1 — tools novas

18 tools. Permissões copiadas dos próprios controllers.

### tasks

| tool | permissão | serviço |
|---|---|---|
| `list_task_comments` | `tasks.view` | `TasksService.getComments` |
| `add_task_comment` | `tasks.comment` | `TasksService.addComment` |
| `delete_task_comment` | `tasks.comment` | `TasksService.removeComment` |
| `delete_task` | `tasks.delete` | `TasksService.remove` |
| `create_task_checklist` | `tasks.checklist_manage` | `TasksService.createChecklist` |
| `add_task_checklist_item` | `tasks.checklist_manage` | `TasksService.addChecklistItem` |
| `toggle_task_checklist_item` | `tasks.checklist_manage` | `TasksService.toggleChecklistItem` |
| `list_task_attachments` | `tasks.view` | `UploadService.getAttachments` |
| `attach_task_file` | `tasks.attachments_manage` | `AttachmentIntakeService` → `UploadService.uploadFile` |
| `delete_task_attachment` | `tasks.attachments_manage` | `TasksService.removeAttachment` |

### projects

| tool | permissão | serviço |
|---|---|---|
| `create_project` | `projects.create` | `ProjectsService.create` |
| `update_project` | `projects.edit` | `ProjectsService.update` |
| `delete_project` | `projects.delete` | `ProjectsService.remove` |
| `remove_project_member` | `projects.manage_members` | `ProjectsService.removeMember` |

### teams

| tool | permissão | serviço |
|---|---|---|
| `create_team` | `teams.create` | `TeamsService.create` |
| `update_team` | `teams.edit` | `TeamsService.update` |
| `delete_team` | `teams.delete` | `TeamsService.remove` |
| `remove_team_member` | `teams.manage_members` | `TeamsService.removeMember` |

Leitura executa direto; escrita vira proposta de confirmação.

### Consequência de permissão

`tasks.delete`, `projects.delete` e `teams.delete` estão somente no papel
`admin` — `prisma/seed.ts:202-235` não os concede a gestor nem a colaborador.
As tools de exclusão ficam, portanto, restritas a admin. Coerente com a
permissão, ainda que a cobertura pedida tenha sido total.

### Ajustes derivados

1. **`move_task` mais fiel.** `PATCH /tasks/:id/move` (`tasks.move`) recebe
   `statusId` e `kanbanPosition`; `PATCH /tasks/:id/status`
   (`tasks.change_status`) recebe só `statusId`. A tool atual usa
   `tasks.change_status` e ignora posição. Passa a aceitar `kanbanPosition`
   opcional e a declarar `tasks.move` quando informado.
2. **Permissão de anexo alinhada.** `upload.controller.ts` e
   `PATCH /tasks/:id/attachments/:attachmentId` exigem `tasks.edit`, mas o
   catálogo tem `tasks.attachments_manage`, concedida a gestor e colaborador
   (`seed.ts:213,220`). Os controllers passam a exigir
   `tasks.attachments_manage`, mais específica e sem quebrar papel semeado.

### Fora do escopo: `blocked` e `tags`

`Task.isBlocked`, `Task.blockedReason` e `TaskTagLink` existem no schema, mas
não aparecem em DTO nem em endpoint. Não são feature de UI nem endpoint órfão;
cobri-los exigiria inventar endpoint, o que é produto novo.

---

## Onda 1 — fluxo de dados, anexos e erros

### Nome antes de ID

Toda tool de escrita aceita `taskId` **ou** `taskName`, `projectId` **ou**
`projectName`, `memberName`, reaproveitando `resolveOne`, `resolveReadOne` e
`clarification` (`task-tool.schemas.ts:137-163`). Nome ambíguo devolve
`AiToolClarification` com os candidatos; `AiService` já persiste como
`needs_clarification` e a UI do chat já exibe.

Nos resumos de volta saem só nomes. ID fica para encadeamento interno.

### Anexo por URL

`UploadService.uploadFile` (`upload.service.ts:19`) recebe buffer do Multer, e
a tool não tem um. Novo
`apps/api/src/modules/upload/attachment-intake.service.ts`:

- aceita apenas `http:` e `https:`
- resolve o DNS e recusa loopback, rede privada e link-local: `127/8`, `10/8`,
  `172.16/12`, `192.168/16`, `169.254/16`, `::1`, `fc00::/7`. Não existe guarda
  SSRF no repositório hoje; ela é escrita e testada do zero, porque sem ela o
  agente vira proxy para a rede interna
- teto de 100 MB, o mesmo de `upload.controller.ts:59`, com timeout
- MIME validado contra a lista `ALLOWED_MIMES` já existente; content-type
  divergente do arquivo é rejeitado
- no máximo dois redirecionamentos, revalidando o destino a cada salto
- depois chama `UploadService.uploadFile`; gravação em disco e registro no banco
  não mudam
- o `fetch` é injetado, para teste não depender de rede

Sem URL válida, a tool devolve "não consegui baixar, envie o arquivo pela tela"
em vez de fingir sucesso.

### Erros

`BadRequest` com mensagem legível volta ao modelo como resultado da tool, e ele
se corrige. `Forbidden` não volta como texto: vira recusa na resposta, sem
revelar se o recurso existe. Tool escondida produz "indisponível para seu
perfil".

### Confirmação

Sem mudança: escrita cai em `AiActionProposal` com validade de cinco minutos
(`ai.service.ts:161`), o chat mostra o resumo, e `authorize()` roda de novo na
confirmação — perder o acesso entre pedir e confirmar bloqueia a ação.

---

## Onda 1 — testes

- `ai.module.spec.ts:88` compara `registryProvider.inject` com um array
  esperado. Com toolkits a comparação muda de forma: o teste é **reescrito**,
  não estendido.
- `tools/registry.spec.ts`: `listVisible` filtra por papel. Colaborador não vê
  `delete_task`; convidado recebe apenas leitura; gestor vê create/update e não
  vê delete.
- `tools/permission-codes.spec.ts`: `permission-codes.ts` bate exatamente com
  `prisma/seed.ts:104-168`.
- `upload/attachment-intake.spec.ts`: recusa `file://`, `localhost`,
  `127.0.0.1`, `10.0.0.1`, `169.254.169.254`, `::1`, redirecionamento para IP
  privado, tamanho acima de 100 MB e MIME fora da lista.
- Teste escrito antes da implementação em todos os casos.

Verificação: specs de tools e upload com
`node -r ts-node/register --test`, `npx tsc --noEmit`, e a suíte completa de AI
verde.

---

## Fora de escopo

- `isBlocked`, `blockedReason` e tags de tarefa: sem DTO e sem endpoint.
- Ondas 2 a 6, com spec própria.
- Botão "Atualizar" do `/operational` sem spec dedicado.
- Extração de PDF/DOCX/XLSX, que pertence à Onda 6.