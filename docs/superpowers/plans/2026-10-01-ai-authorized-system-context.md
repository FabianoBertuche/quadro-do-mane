# Contexto Autorizado do Assistente Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o assistente consulte dados acessíveis ao usuário autenticado em todo o tenant atual, reconheça o usuário pelo nome/tratamento e execute mudanças somente através das permissões, confirmações, auditorias e atividades existentes.

**Architecture:** O `AiService` adicionará identidade mínima e política de acesso ao contexto global, sem e-mail nem snapshot integral do banco. Consultas serão ferramentas read-only que recebem o ator do request e reutilizam serviços de domínio; escritas continuarão como propostas confirmáveis e serão delegadas aos serviços existentes. O limite futuro para outros bancos será uma fronteira de conectores separada, não parte deste trabalho.

**Tech Stack:** NestJS, Prisma, TypeScript, `AiToolRegistryService`, `AiContextService`, serviços de domínio existentes, OpenAI Responses tools, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-01-ai-authorized-system-context-design.md`

## Global Constraints

- O usuário deve acessar somente dados permitidos no tenant atual, respeitando proprietário, membro, equipe, papel e permissões existentes.
- E-mail não será enviado ao modelo.
- Emanuel Barsotini recebe o tratamento `pai`; Alexandre Bergamasco recebe `Coronel` quando sua conta estiver associada; os demais usam o nome cadastrado.
- O chat global não fica restrito a um projeto selecionado.
- O modelo nunca acessa Prisma, serviços internos ou credenciais diretamente.
- Escritas exigem proposta e confirmação; alterações usam serviços de domínio e geram auditoria/atividade existente.
- Ambiguidade de projeto, tarefa, rotina, evento ou colaborador gera esclarecimento sem proposta nem mutação.
- Não adicionar dependências externas sem necessidade.

---

### Task 1: Identidade autenticada e contexto global

**Files:**
- Create: `apps/api/src/modules/ai/ai-identity.service.ts`
- Test: `apps/api/src/modules/ai/ai-identity.service.spec.ts`
- Modify: `apps/api/src/modules/ai/ai.service.ts`
- Modify: `apps/api/src/modules/ai/ai-context.service.ts`
- Modify: `apps/api/src/modules/ai/ai.module.ts`
- Test: `apps/api/src/modules/ai/ai.service.spec.ts`

**Interfaces:**
- `AiIdentityContextService.resolve(input: { tenantId: string; tenantUserId: string }): Promise<{ name: string; address: string }>`
- `AiContextService.buildContext(input)` continues accepting `tenantId`, `actorTenantUserId`, optional `projectId` and `query`, and adds the identity summary supplied by `AiService`.
- `AiService.sendMessage()` passes `{ name, address }` into the system context and never includes `email`.

- [ ] **Step 1: Write failing identity tests.** Cover normal name fallback, exact normalized `Emanuel Barsotini -> pai`, exact normalized `Alexandre Bergamasco -> Coronel`, tenant-user lookup scoped by both `tenantId` and `tenantUserId`, missing user failure, and output shape without e-mail.
- [ ] **Step 2: Run the focused identity test.** Run `node -r ts-node/register --test src/modules/ai/ai-identity.service.spec.ts`; expected initial failure because the service does not exist.
- [ ] **Step 3: Implement the minimal identity service.** Query `tenantUser.findFirst({ where: { id: tenantUserId, tenantId }, select: { user: { select: { name: true } } } })`; normalize only for matching; return the database name for all non-special users. Keep the mapping in the service and do not infer authorization from the treatment.
- [ ] **Step 4: Add identity to the prompt context.** Inject the service into `AiService`, resolve it before provider completion, and prepend a short Portuguese system section such as `Usuário autenticado: ${name}. Tratamento: ${address}. Use este tratamento apenas para se dirigir ao usuário atual.` Do not include e-mail or raw tenant IDs in model-visible text.
- [ ] **Step 5: Make global context independent of project selection.** Preserve the optional project as prioritization only; when it is absent, query all projects/tasks visible through the existing `ProjectsService.findAll`/visibility rules rather than treating the conversation as project-scoped.
- [ ] **Step 6: Run focused AI service/context tests and commit.** Run `node -r ts-node/register --test src/modules/ai/ai-identity.service.spec.ts src/modules/ai/ai-context.service.spec.ts src/modules/ai/ai.service.spec.ts`; commit `feat(ai): add authenticated assistant identity context`.

### Task 2: Authorized read tools for existing tenant data

**Files:**
- Create: `apps/api/src/modules/ai/tools/search-projects.tool.ts`
- Create: `apps/api/src/modules/ai/tools/search-users.tool.ts`
- Create: `apps/api/src/modules/ai/tools/search-teams.tool.ts`
- Create: `apps/api/src/modules/ai/tools/search-calendar.tool.ts`
- Create: `apps/api/src/modules/ai/tools/search-routines.tool.ts`
- Test: `apps/api/src/modules/ai/tools/authorized-read-tools.spec.ts`
- Modify: `apps/api/src/modules/ai/tools/ai-tool.port.ts`
- Modify: `apps/api/src/modules/ai/tools/task-tool.schemas.ts`

**Interfaces:**
- Every read tool implements `AiTool` and receives `{ tenantId, actorTenantUserId, args }`.
- Every tool returns bounded redacted summaries and may return `{ needsClarification: true, field, matches }` without mutating.
- Read permission codes: `projects.view`, `users.view`, `teams.view`, `calendar.view`, `daily_routine.view`, resolved through the same role/permission data used by existing tools.

- [ ] **Step 1: Write failing authorization tests.** For each tool, assert allowed tenant-scoped results, denied permission, cross-tenant IDs rejected, bounded output without e-mail/tokens/private fields, and ambiguous names returning structured clarification.
- [ ] **Step 2: Run the focused tool test.** Run `node -r ts-node/register --test src/modules/ai/tools/authorized-read-tools.spec.ts`; expected failure because the tools do not exist.
- [ ] **Step 3: Implement project/user/team tools through domain services.** Use `ProjectsService.findAll(tenantId, actorTenantUserId, roleName)`, `UsersService.findAll(tenantId)` with e-mail removed from output, and `TeamsService.findAll(tenantId)` with member/manager e-mails removed. Resolve actor role using `UsersService.findOne` and reuse `requirePermission`.
- [ ] **Step 4: Implement calendar/routine read tools through existing services.** Use `EventsService.findAll(tenantId, actorTenantUserId, roleName, startDate, endDate, requestedTenantUserId)` and `DailyRoutineService` read methods only after validating the requested user belongs to the current tenant and the actor has `daily_routine.view`; never broaden a service query with raw model access.
- [ ] **Step 5: Enforce limits and redaction.** Cap each result at 50 items, select only IDs/names/status/dates/relationships needed for answers, serialize dates safely, and return explicit empty results. Do not expose e-mail even when the domain service includes it.
- [ ] **Step 6: Run read-tool tests and commit.** Run the focused file plus existing `task-tools.spec.ts` and `ai-security.spec.ts`; commit `feat(ai): add permission-aware tenant read tools`.

### Task 3: Global project/task disambiguation and write proposals

**Files:**
- Modify: `apps/api/src/modules/ai/tools/task-tool.schemas.ts`
- Modify: `apps/api/src/modules/ai/tools/create-task.tool.ts`
- Modify: `apps/api/src/modules/ai/tools/update-task.tool.ts`
- Modify: `apps/api/src/modules/ai/tools/move-task.tool.ts`
- Test: `apps/api/src/modules/ai/tools/task-tools.spec.ts`
- Modify: `apps/api/src/modules/ai/ai.service.ts`
- Test: `apps/api/src/modules/ai/ai.service.spec.ts`

**Interfaces:**
- Existing task write tools keep `authorize(input)` and `execute(input)`; they may return clarification objects but must not mutate before all references resolve.
- `AiService` persists clarification tool results as pending conversation messages only; it creates `AiActionProposal` rows only for validated, actionable tool calls.

- [ ] **Step 1: Add failing tests for no-project global chat.** Assert `search_tasks` can search all visible projects when no `contextProjectId` exists, while a project outside visibility is never returned.
- [ ] **Step 2: Add failing tests for write ambiguity.** Cover task creation with missing project, duplicate project name, duplicate assignee, ambiguous status, and unresolved collaborator. Assert a structured clarification and zero proposal/write calls.
- [ ] **Step 3: Run task tool tests to verify RED.** Run `node -r ts-node/register --test src/modules/ai/tools/task-tools.spec.ts src/modules/ai/ai.service.spec.ts` and confirm the new expectations fail before implementation.
- [ ] **Step 4: Implement strict resolution.** Require project for task creation, resolve names only within visible lists, return clarification for multiple matches, and reject unresolved IDs/names with safe errors. Never select the first match silently.
- [ ] **Step 5: Preserve atomic proposal persistence.** Ensure tool validation and clarification detection occur before the transaction; actionable proposals and messages remain in the existing one-transaction path with no partial rows.
- [ ] **Step 6: Run security/task suites and commit.** Run all AI tool/security/service specs; commit `fix(ai): require explicit targets for assistant actions`.

### Task 4: Calendar, routine, collaborator, and project-member actions

**Files:**
- Create: `apps/api/src/modules/ai/tools/create-calendar-event.tool.ts`
- Create: `apps/api/src/modules/ai/tools/create-routine.tool.ts`
- Create: `apps/api/src/modules/ai/tools/add-team-member.tool.ts`
- Create: `apps/api/src/modules/ai/tools/add-project-member.tool.ts`
- Test: `apps/api/src/modules/ai/tools/domain-action-tools.spec.ts`
- Modify: `apps/api/src/modules/ai/ai.module.ts`
- Modify: `apps/api/src/modules/ai/tools/ai-tool-registry.service.ts`

**Interfaces:**
- Each action implements `AiTool` and delegates execution to the existing domain service, carrying `tenantId` and `actorTenantUserId`.
- Permission codes: calendar `calendar.create`/`calendar.edit`, routine `daily_routine.manage`, team membership `teams.manage_members`, project membership `projects.manage_members`.
- Each action returns a clarification result when target/project/user/date/participant is incomplete or ambiguous.

- [ ] **Step 1: Write failing action tests.** Cover permission denial, cross-tenant collaborator rejection, missing project/event/routine target, duplicate collaborator names, and successful delegation with actor identity preserved.
- [ ] **Step 2: Run the focused action test to verify RED.** Run `node -r ts-node/register --test src/modules/ai/tools/domain-action-tools.spec.ts`; expected failure because the tools are not registered.
- [ ] **Step 3: Implement action argument schemas.** Use `additionalProperties: false`, require explicit fields that the underlying DTO requires, parse dates without timezone guessing, and return clarification instead of guessing missing participants or schedules.
- [ ] **Step 4: Implement authorization and delegation.** Reuse `requirePermission`, `UsersService.findOne/findAll`, `ProjectsService.findOne/findAll`, `EventsService`, `DailyRoutineService`, `TeamsService`, and project membership methods. Do not call Prisma directly from tools.
- [ ] **Step 5: Register tools in `AiModule`.** Import `EventsModule`, `DailyRoutineModule`, and the modules exposing team/project services; inject concrete services into factories/classes. Keep existing task tool registrations and provider behavior intact.
- [ ] **Step 6: Verify audit/activity behavior.** Assert domain service calls receive the actor and that existing `ActivityLogService`/`AuditLogService` paths execute; no tool may create/update/delete directly. Commit `feat(ai): add authorized calendar routine and membership actions`.

### Task 5: Registry, provider contract, and end-to-end authorization coverage

**Files:**
- Modify: `apps/api/src/modules/ai/ai.module.ts`
- Modify: `apps/api/src/modules/ai/ai.service.ts`
- Test: `apps/api/src/modules/ai/ai.module.spec.ts`
- Test: `apps/api/src/modules/ai/ai-oauth.e2e.spec.ts`
- Test: `apps/api/src/modules/ai/ai-runtime.http.e2e.spec.ts`

- [ ] **Step 1: Add failing registry tests.** Assert all read/action tools are registered, tool schemas reject unknown arguments, and OAuth Responses receives the expanded tool definitions.
- [ ] **Step 2: Run module/integration tests to verify RED.** Run the focused module and e2e specs before wiring.
- [ ] **Step 3: Wire dependencies explicitly.** Keep `AiToolRegistryService` constructed from concrete tools and domain services; avoid a generic container or unrestricted service locator. Preserve `AiService` actor propagation for every tool call.
- [ ] **Step 4: Add end-to-end authorization scenarios.** Exercise a global conversation without project context, query visible data, reject cross-tenant/unauthorized queries, create a clarification for ambiguity, create a confirmed proposal, execute through the domain service, and assert audit/activity records.
- [ ] **Step 5: Verify no e-mail or credentials cross the provider boundary.** Assert serialized completion input contains identity name/treatment but not e-mail, access tokens, raw Prisma rows, or secrets.
- [ ] **Step 6: Run the full API suite and commit.** Run all AI, security, module-wiring and integration tests; commit `test(ai): verify authorized global assistant context`.

### Task 6: Documentation, deployment, and final security verification

**Files:**
- Create: `docs/runbooks/ai-authorized-context.md`
- Modify: `docs/runbooks/ai-runtime.md`
- Modify: `docs/runbooks/chatgpt-oauth.md`
- Modify: `.env.example`
- Modify: `.env.docker`

- [ ] **Step 1: Document the access boundary.** Explain tenant/permission filtering, no e-mail, name treatments, global chat behavior, clarification questions, proposal confirmation, audit/activity guarantees, and the future external-database boundary.
- [ ] **Step 2: Document operations and recovery.** Include catalog/runtime checks, OAuth disconnect/reconnect, model selection, failed action recovery, and the requirement to apply migrations before rebuilding containers.
- [ ] **Step 3: Run final security checks.** Search changed files and generated provider payloads for `email`, access-token fields, refresh tokens, raw Prisma serialization, cross-tenant query paths, and direct mutation calls from tools.
- [ ] **Step 4: Run final verification.** Run all API AI/security/integration tests, API build/typecheck, web client tests/typecheck/build, Prisma migrate status through the active Docker network, and `git diff --check`.
- [ ] **Step 5: Deploy safely.** Apply pending migrations, rebuild API/web images, restart only after migration success, verify health, unauthenticated `401` behavior, admin route authorization, and a redacted runtime response. Do not claim live provider validation without a connected account.
- [ ] **Step 6: Commit documentation and record status.** Commit `docs(ai): document authorized assistant context` and record any environmental blocker without changing unrelated worktree files.
