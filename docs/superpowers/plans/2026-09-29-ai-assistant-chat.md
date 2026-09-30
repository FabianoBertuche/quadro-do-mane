# AI Assistant Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a provider-independent, tenant-safe AI assistant with text/voice chat, explicit command confirmation, and task-management tools, starting with OpenAI and Android.

**Architecture:** The API owns provider calls, conversation persistence, context retrieval, speech processing, permission checks, and typed tools. Mobile is a client of those APIs and owns the WhatsApp-style recording gesture, text/voice output selector, message history, and action confirmation UI. OpenAI is isolated behind `AiProvider`, `SpeechToTextProvider`, and `TextToSpeechProvider` interfaces; future providers and external knowledge sources implement those contracts without changing the domain or clients.

**Tech Stack:** NestJS, Prisma/PostgreSQL, class-validator, existing JWT/tenant/permission guards, OpenAI HTTP SDK, React Native/Expo SDK 57, `expo-audio`, React Query, Vitest/Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-29-ai-assistant-chat-design.md`

## Global Constraints

- The backend is the only component allowed to call AI providers.
- Commands that change data always require explicit user confirmation.
- Every AI route and tool is scoped by JWT, tenant, user, and domain permission.
- The model receives no SQL, credentials, provider tokens, or data from another tenant.
- MVP tools are `search_tasks`, `create_task`, `update_task`, and `move_task`.
- Audio files are temporary in the MVP and are removed after transcription or synthesis.
- Streaming, wake word, destructive commands, bulk changes, external connectors, documents, and RAG are out of scope.
- Do not run production migrations automatically; use `prisma migrate deploy` only as an explicit deployment operation.

---

### Task 1: Add AI persistence, permission, and configuration

**Files:**
- Modify: `apps/api/prisma/schema.prisma` near `Tenant`, `User`, and audit models
- Create: `apps/api/prisma/migrations/20260929_add_ai_assistant/migration.sql`
- Modify: `apps/api/src/common/config/env.validation.ts`
- Modify: `apps/api/src/modules/roles/roles.service.ts`
- Modify: `apps/api/prisma/seed.ts`
- Test: `apps/api/src/modules/ai/ai-persistence.spec.ts`

**Interfaces:**
- Produces Prisma models `AiConversation`, `AiMessage`, and `AiActionProposal` with tenant/user relations and indexes.
- Produces `OPENAI_API_KEY`, optional `OPENAI_MODEL`, `OPENAI_STT_MODEL`, and `OPENAI_TTS_MODEL` configuration values.
- Produces the `ai.use` permission code for role checks and role creation defaults.

- [ ] **Step 1: Write the failing persistence contract test**

Create a Node test that asserts the Prisma schema contains the three AI model names, the proposal statuses, and the `ai.use` permission seed/default. The test must fail before the schema and permission are added.

- [ ] **Step 2: Run the test to verify RED**

Run: `node -r ts-node/register --test src/modules/ai/ai-persistence.spec.ts` from `apps/api`.

Expected: FAIL because the AI models, statuses, and permission do not exist.

- [ ] **Step 3: Add Prisma models and migration**

Add fields sufficient for tenant-safe history:

```prisma
model AiConversation {
  id              String              @id @default(uuid())
  tenantId        String              @map("tenant_id")
  ownerTenantUserId String            @map("owner_tenant_user_id")
  contextProjectId String?            @map("context_project_id")
  title           String?
  createdAt       DateTime            @default(now()) @map("created_at")
  updatedAt       DateTime            @updatedAt @map("updated_at")
  tenant          Tenant              @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  owner           TenantUser          @relation(fields: [ownerTenantUserId], references: [id], onDelete: Cascade)
  messages        AiMessage[]
  proposals       AiActionProposal[]
  @@index([tenantId, ownerTenantUserId, updatedAt])
  @@map("ai_conversations")
}

model AiMessage {
  id             String          @id @default(uuid())
  tenantId       String          @map("tenant_id")
  conversationId String          @map("conversation_id")
  role           String
  format         String          @default("TEXT")
  content        String?
  audioObjectKey String?         @map("audio_object_key")
  providerMetaJson String?       @map("provider_meta_json")
  createdAt      DateTime        @default(now()) @map("created_at")
  tenant         Tenant          @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  conversation   AiConversation  @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  @@index([tenantId, conversationId, createdAt])
  @@map("ai_messages")
}

model AiActionProposal {
  id             String          @id @default(uuid())
  tenantId       String          @map("tenant_id")
  conversationId String          @map("conversation_id")
  createdByTenantUserId String   @map("created_by_tenant_user_id")
  toolName       String          @map("tool_name")
  argumentsJson  String          @map("arguments_json")
  status         String          @default("PENDING")
  summary        String
  expiresAt      DateTime        @map("expires_at")
  resultJson     String?         @map("result_json")
  createdAt      DateTime        @default(now()) @map("created_at")
  updatedAt      DateTime        @updatedAt @map("updated_at")
  tenant         Tenant          @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  conversation   AiConversation  @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  @@index([tenantId, createdByTenantUserId, status])
  @@map("ai_action_proposals")
}
```

Add the corresponding arrays to `Tenant` and `TenantUser`, generate Prisma client, and create the migration SQL without applying it to production.

- [ ] **Step 4: Add configuration validation and permission seed**

Add optional provider configuration to `EnvSchema`; `OPENAI_API_KEY` must be required only when the AI module is enabled by an explicit `AI_ENABLED=true` flag so existing environments can boot before rollout. Add `ai.use` to the permission seed/default role permissions and keep provider values out of logs.

- [ ] **Step 5: Run the contract test and Prisma validation**

Run: `node -r ts-node/register --test src/modules/ai/ai-persistence.spec.ts`, `npx prisma validate --schema apps/api/prisma/schema.prisma`, and `npx prisma generate --schema apps/api/prisma/schema.prisma`.

Expected: PASS without applying a database migration.

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma apps/api/src/common/config/env.validation.ts apps/api/src/modules/roles/roles.service.ts apps/api/prisma/seed.ts apps/api/src/modules/ai/ai-persistence.spec.ts
git commit -m "feat(api): add AI assistant persistence and permission"
```

### Task 2: Implement provider ports and OpenAI adapters

**Files:**
- Create: `apps/api/src/modules/ai/ports/ai-provider.port.ts`
- Create: `apps/api/src/modules/ai/ports/speech-to-text.port.ts`
- Create: `apps/api/src/modules/ai/ports/text-to-speech.port.ts`
- Create: `apps/api/src/modules/ai/ports/knowledge-source.port.ts`
- Create: `apps/api/src/modules/ai/providers/openai.provider.ts`
- Create: `apps/api/src/modules/ai/providers/openai-speech-to-text.provider.ts`
- Create: `apps/api/src/modules/ai/providers/openai-text-to-speech.provider.ts`
- Create: `apps/api/src/modules/ai/providers/fake-ai.provider.ts`
- Test: `apps/api/src/modules/ai/providers/*.spec.ts`
- Modify: `apps/api/package.json` and root lockfile

**Interfaces:**
- `AiProvider.complete(input: AiCompletionInput): Promise<AiCompletionResult>`.
- `SpeechToTextProvider.transcribe(input: { buffer: Buffer; mimeType: string }): Promise<{ text: string }>`.
- `TextToSpeechProvider.synthesize(input: { text: string; voice: string }): Promise<{ audio: Buffer; mimeType: string }>`.
- `AiKnowledgeSource.search(input: { tenantId: string; actorTenantUserId: string; query: string }): Promise<AiContextItem[]>` for future external sources; the MVP implementation uses structured app queries.
- Tool calls use `{ name: string; arguments: Record<string, unknown> }`; provider adapters never execute tools.

- [ ] **Step 1: Write failing port/adapter tests**

Test that the fake provider returns deterministic text and tool calls, OpenAI adapter maps provider responses into the stable result type, malformed tool arguments fail validation, and provider errors do not expose API keys or raw audio tokens.

- [ ] **Step 2: Run RED**

Run: `node -r ts-node/register --test src/modules/ai/providers/*.spec.ts`.

Expected: FAIL because ports and adapters do not exist.

- [ ] **Step 3: Add the smallest provider contracts and fake**

Define the TypeScript interfaces and fake implementation first. Keep the fake usable by orchestrator tests without network access.

- [ ] **Step 4: Add OpenAI text, transcription, and synthesis adapters**

Run `npm install openai --workspace=api`, use `ConfigService` for model/API-key values, inject the OpenAI client through a factory, set bounded request timeouts, and map only safe response metadata. Return provider-independent types to callers.

- [ ] **Step 5: Run GREEN and build**

Run: `node -r ts-node/register --test src/modules/ai/providers/*.spec.ts` and `npm run build --workspace=api`.

Expected: PASS; tests must use the fake or mocked HTTP boundary and never require a live API key.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/ai apps/api/package.json
git commit -m "feat(api): add swappable AI provider ports"
```

### Task 3: Add context retrieval, conversation API, and tool registry

**Files:**
- Create: `apps/api/src/modules/ai/ai.module.ts`
- Create: `apps/api/src/modules/ai/ai.controller.ts`
- Create: `apps/api/src/modules/ai/ai.service.ts`
- Create: `apps/api/src/modules/ai/ai-context.service.ts`
- Create: `apps/api/src/modules/ai/ai-audit.service.ts`
- Create: `apps/api/src/modules/ai/tools/ai-tool.port.ts`
- Create: `apps/api/src/modules/ai/tools/ai-tool-registry.service.ts`
- Create: `apps/api/src/modules/ai/dto/send-ai-message.dto.ts`
- Create: `apps/api/src/modules/ai/dto/confirm-ai-action.dto.ts`
- Create: `apps/api/src/modules/ai/dto/list-ai-conversations.dto.ts`
- Test: `apps/api/src/modules/ai/ai.service.spec.ts`
- Test: `apps/api/src/modules/ai/ai-context.service.spec.ts`
- Test: `apps/api/src/modules/ai/ai.controller.spec.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/modules/tasks/tasks.module.ts`
- Modify: `apps/api/src/modules/projects/projects.module.ts`

**Interfaces:**
- `POST /ai/conversations`: creates a conversation and returns `{ id, contextProjectId }`.
- `GET /ai/conversations`: returns the authenticated user's tenant-scoped conversations.
- `GET /ai/conversations/:id/messages`: returns paginated messages and pending proposals.
- `POST /ai/conversations/:id/messages`: accepts `{ text?, responseMode: 'TEXT'|'AUDIO', contextProjectId? }` and returns `{ message, assistantMessage?, proposal? }`.
- `POST /ai/action-proposals/:id/confirm`: revalidates and executes a pending proposal.
- `POST /ai/action-proposals/:id/cancel`: cancels a pending proposal owned by the user.
- `AiTool.execute(input: { tenantId: string; actorTenantUserId: string; args: unknown }): Promise<unknown>`.
- `AiContextService.buildContext(input: { tenantId: string; actorTenantUserId: string; projectId?: string; query: string }): Promise<AiContext>`.

- [ ] **Step 1: Write failing service/controller tests**

Cover conversation ownership, tenant isolation, project context filtering, provider text response, tool-call proposal creation, expired proposal rejection, confirmation revalidation, cancellation, and permission guard metadata. Use the fake provider and mocked Prisma/service boundaries.

- [ ] **Step 2: Run RED**

Run: `node -r ts-node/register --test src/modules/ai/ai.service.spec.ts src/modules/ai/ai-context.service.spec.ts src/modules/ai/ai.controller.spec.ts`.

Expected: FAIL because the AI module and routes do not exist.

- [ ] **Step 3: Implement conversation persistence and context**

Use Prisma only through `AiService`/`AiContextService`, always include `tenantId` and owner filters, cap history/context sizes, and return a clear “no access/no result” context instead of leaking absent records.

- [ ] **Step 4: Implement tool registry and proposal lifecycle**

Normalize provider tool calls, validate arguments with DTOs, create expiring proposals, and ensure confirm/cancel can only target the current tenant/user. Confirm must reload current data and permission state before execution.

- [ ] **Step 5: Register module and permissions**

Import `AiModule` in `AppModule`, export `TasksService`/`ProjectsService` dependencies as needed, and protect all routes with `AuthGuard('jwt')`, `TenantContextGuard`, `PermissionGuard`, and `@RequirePermissions('ai.use')`.

- [ ] **Step 6: Run GREEN and API tests**

Run the AI tests, `npm run test:notifications:all --workspace=api`, `npx tsc --noEmit -p apps/api/tsconfig.json`, and `npm run build --workspace=apps/api`.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/ai apps/api/src/app.module.ts apps/api/src/modules/tasks/tasks.module.ts apps/api/src/modules/projects/projects.module.ts
git commit -m "feat(api): add tenant-safe AI conversations"
```

### Task 4: Implement task tools with existing domain services

**Files:**
- Create: `apps/api/src/modules/ai/tools/search-tasks.tool.ts`
- Create: `apps/api/src/modules/ai/tools/create-task.tool.ts`
- Create: `apps/api/src/modules/ai/tools/update-task.tool.ts`
- Create: `apps/api/src/modules/ai/tools/move-task.tool.ts`
- Create: `apps/api/src/modules/ai/tools/task-tool.schemas.ts`
- Test: `apps/api/src/modules/ai/tools/*.spec.ts`
- Modify: `apps/api/src/modules/tasks/tasks.service.ts` only where an existing service method lacks a safe actor-aware call required by a tool

**Interfaces:**
- `create_task` requires `title` and a tenant-resolvable project; optional fields are `description`, `assigneeName|assigneeTenantUserId`, `statusName|statusId`, `priorityName|priorityId`, `startDate`, and `dueDate`.
- `update_task` requires `taskId` and a non-empty patch of supported fields.
- `move_task` requires `taskId` and a tenant-resolvable target status.
- `search_tasks` returns bounded task summaries, never passwords, tokens, or unrestricted user records.

- [ ] **Step 1: Write failing tool tests**

Test exact name resolution for project/user/status, ambiguous name rejection with a clarification response, cross-tenant ID rejection, permission rejection, task creation through `TasksService.create`, status changes through `TasksService.changeStatus`, and activity/notification preservation through the service call.

- [ ] **Step 2: Run RED**

Run: `node -r ts-node/register --test src/modules/ai/tools/*.spec.ts`.

Expected: FAIL because no task tools are registered.

- [ ] **Step 3: Implement schemas and resolvers**

Use strict DTO/schema validation, resolve human names only within the current tenant, reject ambiguous matches instead of guessing, and return a structured clarification result the orchestrator can present.

- [ ] **Step 4: Implement tools through domain services**

Inject `TasksService`, `ProjectsService`, and the necessary users/status services. Pass the authenticated actor tenant-user ID to domain methods so notifications and audit/activity behavior remain unchanged.

- [ ] **Step 5: Run GREEN and full API verification**

Run tool tests, the existing task tests, `npm run test:notifications:all --workspace=api`, API typecheck, and API build.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/ai/tools apps/api/src/modules/tasks/tasks.service.ts
git commit -m "feat(api): add AI task tools"
```

### Task 5: Add audio message endpoints and temporary media handling

**Files:**
- Create: `apps/api/src/modules/ai/ai-audio.controller.ts`
- Create: `apps/api/src/modules/ai/ai-audio.service.ts`
- Create: `apps/api/src/modules/ai/dto/send-ai-audio.dto.ts`
- Create: `apps/api/src/modules/ai/media/temporary-audio.service.ts`
- Test: `apps/api/src/modules/ai/ai-audio.service.spec.ts`
- Modify: `apps/api/src/modules/ai/ai.module.ts`

**Interfaces:**
- `POST /ai/conversations/:id/audio` accepts multipart audio plus `responseMode` and returns the same response envelope as text messages.
- `GET /ai/audio/:id` returns an authenticated, short-lived audio download only for the owning tenant/user conversation.
- `AiAudioService.handleMessage(input: { conversationId: string; actor: RequestUser; buffer: Buffer; mimeType: string; responseMode: 'TEXT'|'AUDIO' }): Promise<AiMessageResponse>`.

- [ ] **Step 1: Write failing audio tests**

Cover accepted MIME/size limits, rejected oversized or unsupported files, transcription provider errors, synthesized response cleanup, conversation ownership, and absence of provider tokens/audio buffers in logs.

- [ ] **Step 2: Run RED**

Run: `node -r ts-node/register --test src/modules/ai/ai-audio.service.spec.ts`.

Expected: FAIL because audio endpoints and temporary media handling do not exist.

- [ ] **Step 3: Implement multipart handling and STT/TTS orchestration**

Reuse the existing upload configuration where possible, enforce a fixed byte/duration limit before provider calls, pass audio to `SpeechToTextProvider`, persist only the transcription, and generate a temporary response through `TextToSpeechProvider` when requested.

- [ ] **Step 4: Implement authenticated temporary download and cleanup**

Return opaque media IDs rather than provider URLs, verify tenant/user ownership on download, and delete temporary objects after the configured retention window.

- [ ] **Step 5: Run GREEN and API verification**

Run audio tests, all AI tests, API typecheck, API build, and the existing upload tests.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/ai
git commit -m "feat(api): add AI voice message processing"
```

### Task 6: Build the mobile global AI chat

**Files:**
- Create: `apps/mobile/src/app/ai-chat.tsx`
- Create: `apps/mobile/src/lib/ai-chat.ts`
- Create: `apps/mobile/src/lib/ai-chat.spec.ts`
- Create: `apps/mobile/src/components/ai/ChatMessage.tsx`
- Create: `apps/mobile/src/components/ai/ActionProposalCard.tsx`
- Create: `apps/mobile/src/components/ai/VoiceRecorder.tsx`
- Modify: `apps/mobile/src/app/project/[id]/chat.tsx` to redirect/open the global chat with `contextProjectId`
- Modify: `apps/mobile/src/app/_layout.tsx`
- Modify: `apps/mobile/src/app/(tabs)/_layout.tsx` or dashboard entry point
- Modify: `apps/mobile/package.json` via `npx expo install expo-audio`

**Interfaces:**
- `createConversation(contextProjectId?: string): Promise<AiConversation>`.
- `sendTextMessage(input: { conversationId: string; text: string; responseMode: 'TEXT'|'AUDIO' }): Promise<AiMessageResponse>`.
- `sendAudioMessage(input: { conversationId: string; uri: string; mimeType: string; responseMode: 'TEXT'|'AUDIO' }): Promise<AiMessageResponse>`.
- `confirmAction(proposalId: string): Promise<AiActionResult>` and `cancelAction(proposalId: string): Promise<void>`.
- `VoiceRecorder` emits `recording`, `locked`, `cancelled`, and `submitted` states; release submits unless the gesture was cancelled.

- [ ] **Step 1: Write failing pure gesture and response-mode tests**

Test press-and-hold starts recording, release submits, upward drag locks recording, cancel discards audio, response mode persists per conversation, and proposal cards expose confirm/cancel transitions. Keep tests independent of native audio modules.

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/lib/ai-chat.spec.ts` from `apps/mobile`.

Expected: FAIL because the chat state helpers and route do not exist.

- [ ] **Step 3: Install and configure audio support**

Run `npx expo install expo-audio`, request microphone permission only when the user starts recording, configure Android microphone permission through Expo config, and keep playback URLs short-lived.

- [ ] **Step 4: Implement API client and state machine**

Implement typed API calls, conversation loading, paginated history, pending/processing/error states, optimistic user messages, and proposal confirmation/cancellation. Do not embed provider names or credentials in mobile code.

- [ ] **Step 5: Implement the composer and WhatsApp gesture**

Use a gesture handler with a vertical lock threshold, explicit cancel zone, haptic/visual recording state, text input, microphone button, and `Texto|Voz` selector. Disable send while a request is pending and show transcription failures clearly.

- [ ] **Step 6: Implement message/audio rendering**

Render text and audio messages, download/play synthesized audio through the temporary API endpoint, stop playback when leaving the screen, and render `ActionProposalCard` with explicit Confirmar/Cancelar buttons.

- [ ] **Step 7: Wire global and project-context entry points**

Register `/ai-chat` in the root stack, add a global navigation entry, and change `/project/:id/chat` to open the same screen with `contextProjectId` instead of maintaining a separate chat implementation.

- [ ] **Step 8: Run GREEN and mobile verification**

Run: `npx vitest run`, `npx tsc --noEmit -p tsconfig.json`, and ESLint on all new/modified mobile files. Verify the Expo config includes microphone permission and no provider secrets.

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/package.json apps/mobile/src/app apps/mobile/src/components/ai apps/mobile/src/lib/ai-chat.ts apps/mobile/src/lib/ai-chat.spec.ts
git commit -m "feat(mobile): add global AI chat with voice input"
```

### Task 7: Add audit, limits, and end-to-end verification

**Files:**
- Modify: `apps/api/src/modules/ai/ai-audit.service.ts`
- Modify: `apps/api/src/modules/ai/ai.service.ts`
- Create: `apps/api/src/modules/ai/ai-security.spec.ts`
- Modify: `docs/superpowers/specs/2026-09-29-ai-assistant-chat-design.md` only if implementation decisions materially change the approved design
- Test: API and mobile suites

**Interfaces:**
- Every provider call has a bounded timeout and a safe error mapping.
- Every proposal has a server-side expiry and revalidation path.
- Every AI mutation produces both AI audit information and existing domain activity/audit effects.

- [ ] **Step 1: Write security regression tests**

Test cross-tenant conversation/message/proposal access, stale permission denial at confirmation, expired proposal denial, oversized request rejection, provider timeout mapping, redaction of provider tokens, and per-user rate/cost limit behavior.

- [ ] **Step 2: Run RED**

Run the focused security suite and record each expected failure before implementation.

- [ ] **Step 3: Implement limits and redaction**

Add configurable message length, audio size/duration, history size, request timeout, and per-user/tenant rate limits. Log only provider name, model, duration, and safe status; never raw prompts containing secrets, access tokens, or provider error payloads.

- [ ] **Step 4: Run complete verification**

From `apps/api`, run:

```bash
node -r ts-node/register --test src/modules/ai/*.spec.ts src/modules/ai/providers/*.spec.ts src/modules/ai/tools/*.spec.ts
```

From the repository root, run:

```bash
npm run test:notifications:all --workspace=api
npx tsc --noEmit -p apps/api/tsconfig.json
npm run build --workspace=apps/api
```

From `apps/mobile`, run:

```bash
npx vitest run
npx tsc --noEmit -p tsconfig.json
npx expo config --type public
```

Expected: all AI/API/mobile tests pass, API build succeeds, mobile typecheck succeeds, and the Expo config contains no provider secret.

- [ ] **Step 5: Verify manual flows**

Verify text question, project-context question, voice transcription, text response, voice response playback, ambiguous assignee clarification, create-task proposal, confirmation, cancellation, expired proposal, permission denial, and network/provider failure.

- [ ] **Step 6: Commit final verification changes**

```bash
git add apps/api/src/modules/ai docs/superpowers/specs/2026-09-29-ai-assistant-chat-design.md
git commit -m "test: harden AI assistant security boundaries"
```

## Etapa 1 Web e Correções Residuais

### Task 8: Close final mobile/API review findings

**Files:**
- Modify: `apps/api/src/modules/ai/dto/send-ai-message.dto.ts`
- Modify: `apps/mobile/src/components/ai/ActionProposalCard.tsx`
- Modify: `apps/mobile/src/app/ai-chat.tsx`
- Modify: `apps/mobile/src/lib/ai-chat.ts`
- Test: existing AI API tests and `apps/mobile/src/lib/ai-chat.spec.ts`

**Interfaces:**
- `inputFormat` accepts only `TEXT` or `AUDIO`, with server-derived format preferred over client claims.
- Clarification proposals remain visually `PENDING` and keep the clarification/confirmation controls available.
- Global chat selection never falls back to a project-scoped conversation unless `contextProjectId` is explicitly supplied.

- [ ] **Step 1: Write failing regression tests**

Add API tests for invalid `inputFormat` and mobile helper tests for clarification status and global/project conversation selection.

- [ ] **Step 2: Run RED**

Run the focused API and mobile tests and confirm each new assertion fails against the current implementation.

- [ ] **Step 3: Implement minimal fixes**

Add enum validation/normalization in the DTO, preserve `PENDING` in `ActionProposalCard`, and separate global conversation lookup from project-context lookup in the mobile client.

- [ ] **Step 4: Run GREEN**

Run the focused API tests, `npx vitest run` from `apps/mobile`, and both typechecks.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/ai apps/mobile/src/components/ai apps/mobile/src/app/ai-chat.tsx apps/mobile/src/lib/ai-chat.ts
git commit -m "fix(ai): close residual chat review findings"
```

### Task 9: Implement web text and command chat

**Files:**
- Create: `apps/web/src/app/(app)/ai-chat/page.tsx`
- Create: `apps/web/src/components/ai/AiChatMessage.tsx`
- Create: `apps/web/src/components/ai/AiActionProposalCard.tsx`
- Create: `apps/web/src/lib/ai-chat.ts`
- Create: `apps/web/src/lib/ai-chat.test.ts`
- Modify: `apps/web/src/components/layout/sidebar.tsx`
- Modify: `apps/web/src/app/(app)/projects/[id]/page.tsx`

**Interfaces:**
- `listConversations(): Promise<AiConversation[]>`.
- `createConversation(contextProjectId?: string): Promise<AiConversation>`.
- `listMessages(conversationId: string): Promise<AiMessagePage>`.
- `sendTextMessage(input: { conversationId: string; text: string; responseMode: 'TEXT' }): Promise<AiMessageResponse>`.
- `confirmAction(proposalId: string): Promise<AiActionResult>` and `cancelAction(proposalId: string): Promise<void>`.

- [ ] **Step 1: Write failing web client tests**

Test API helper request shapes, strict response-mode values, global conversation selection, explicit project context, and proposal confirm/cancel state transitions. Use the existing Axios client boundary; do not call an AI provider from the browser.

- [ ] **Step 2: Run RED**

Run: `npx tsx --test src/lib/ai-chat.test.ts` from `apps/web` and confirm the missing client/helper failure.

- [ ] **Step 3: Implement the typed web API client**

Create the helper functions using `api`, map the server response envelope to stable client types, and keep global conversation lookup separate from project-scoped lookup.

- [ ] **Step 4: Build the chat page**

Render a conversation selector, message history, text composer, loading/error states, assistant/user message styling, clarification messages, and action cards with explicit Confirmar/Cancelar buttons. On success, invalidate or refetch messages and task/project queries where relevant.

- [ ] **Step 5: Add navigation and project context entry**

Add an `Assistente IA` sidebar link to `/ai-chat`. Add a project-detail link to `/ai-chat?contextProjectId=<id>`; never silently carry project context into a global conversation.

- [ ] **Step 6: Run GREEN and web verification**

Run `npx tsx --test src/lib/ai-chat.test.ts`, `npx tsc --noEmit`, and `npm run build --workspace=apps/web`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/'(app)'/ai-chat apps/web/src/components/ai apps/web/src/lib/ai-chat.ts apps/web/src/lib/ai-chat.test.ts apps/web/src/components/layout/sidebar.tsx apps/web/src/app/'(app)'/projects/'[id]'/page.tsx
git commit -m "feat(web): add text AI assistant chat"
```

### Task 10: Verify web-first rollout

**Files:**
- Modify: `docs/superpowers/specs/2026-09-29-ai-assistant-chat-design.md` only for verified implementation deviations
- Test: API, mobile, and web suites

- [ ] **Step 1: Run complete automated verification**

Run API AI tests, notification tests, API typecheck/build, mobile Vitest/typecheck, web helper tests, web typecheck/build, and `git diff --check`.

- [ ] **Step 2: Manually verify web text flows**

Verify global chat, project-context chat, conversation reuse, question with returned task data, ambiguous assignee clarification, task proposal confirmation, cancellation, permission denial, session refresh, and provider/API error display.

- [ ] **Step 3: Commit verification-only changes**

```bash
git add docs/superpowers/specs/2026-09-29-ai-assistant-chat-design.md
git commit -m "test: verify web-first AI chat rollout"
```
