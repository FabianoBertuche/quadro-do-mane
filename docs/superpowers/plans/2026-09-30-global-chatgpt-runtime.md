# Global ChatGPT Runtime Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use one server-wide ChatGPT OAuth connection and model selection for all Monte Moria chats, with live OpenAI catalog selection and no partial chat persistence.

**Architecture:** A singleton server runtime record owns the selected model and encrypted global OAuth connection. A server-only runtime service lists account-authorized models and feeds the Responses provider; chat and settings consume redacted runtime metadata through guarded APIs.

**Tech Stack:** NestJS, Prisma/PostgreSQL, OpenAI Responses API, Node fetch, Next.js/React, TanStack Query, existing AES-256-GCM encryption.

**Spec:** `docs/superpowers/specs/2026-09-30-global-chatgpt-runtime-design.md`

## Global Constraints

- Use one server-wide ChatGPT OAuth connection and selected model for every user and tenant.
- Fetch `GET https://api.openai.com/v1/models` with the encrypted global OAuth token; return only `visibility === "list"` in server order as `slug` and `display_name`.
- Use the selected `slug` in every `POST /v1/responses` request with `store: false` and `stream: true`.
- OAuth must work when `AI_ENABLED=false`; API-key fallback is allowed only when `AI_ENABLED=true` and `OPENAI_API_KEY` exists.
- Never expose OAuth credentials, raw model-catalog responses, or provider errors to the frontend.
- Provider/tool failures must not persist user messages, assistant messages, or proposals.
- During homologation, chat connection/model controls use `ai.use`; settings provider status is administrator-only and future providers are `Em breve` only.

---

### Task 1: Global runtime persistence

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_add_ai_server_runtime/migration.sql`
- Create: `apps/api/src/modules/ai/ai-server-runtime-persistence.spec.ts`

**Interfaces:**
- Produces `AiServerRuntime` singleton with `oauthConnectionId`, `selectedModelSlug`, `selectedModelDisplayName`, and timestamps.
- OAuth connection may be global without tenant/user ownership while preserving encrypted token fields and issued identity.

- [ ] Write failing schema/migration tests asserting one singleton runtime row, nullable global OAuth ownership, selected model fields, foreign-key behavior, and indexes.
- [ ] Run `node -r ts-node/register --test src/modules/ai/ai-server-runtime-persistence.spec.ts`; verify failure because the runtime model/migration is absent.
- [ ] Add the Prisma model and migration. Migrate existing valid OAuth connection data only when unambiguous; otherwise leave runtime disconnected rather than selecting a user connection implicitly.
- [ ] Regenerate Prisma client and run schema validation.
- [ ] Run the persistence test and `npm run build` from `apps/api`.

### Task 2: Global OAuth and model-catalog service

**Files:**
- Create: `apps/api/src/modules/ai/ai-server-runtime.service.ts`
- Modify: `apps/api/src/modules/ai/ai-oauth.service.ts`
- Modify: `apps/api/src/modules/ai/ai-oauth.protocol.ts`
- Modify: `apps/api/src/modules/ai/ai.module.ts`
- Test: `apps/api/src/modules/ai/ai-server-runtime.service.spec.ts`

**Interfaces:**
- `getRuntime(): Promise<AiServerRuntimeView>`
- `listModels(): Promise<Array<{ slug: string; displayName: string }>>`
- `selectModel(slug: string): Promise<AiServerRuntimeView>`
- `resolveProviderAuth(): Promise<AiProviderAuth | undefined>`
- OAuth start/complete/refresh/disconnect act on global connection during homologation.

- [ ] Write failing tests for global OAuth connection resolution without actor identity, expired-token refresh, GET `/v1/models` bearer request, visibility filtering/order, model cache invalidation, unavailable catalog, model selection rejection for unknown slug, and token redaction.
- [ ] Run the focused tests and verify expected failures.
- [ ] Implement global connection creation/selection and retain encrypted credentials with the runtime record.
- [ ] Implement model listing via `GET /v1/models`, filter `visibility === 'list'`, map `slug`/`display_name`, cache only redacted catalog metadata, and invalidate it on connection changes.
- [ ] Implement selection validation and global persistence of slug/display name.
- [ ] Run focused OAuth/runtime tests and API build.

### Task 3: Provider selection and atomic chat persistence

**Files:**
- Modify: `apps/api/src/modules/ai/ai.module.ts`
- Modify: `apps/api/src/modules/ai/ai.service.ts`
- Modify: `apps/api/src/modules/ai/providers/openai-responses.provider.ts`
- Modify: `apps/api/src/modules/ai/ports/ai-provider.port.ts`
- Test: `apps/api/src/modules/ai/ai.service.spec.ts`
- Test: `apps/api/src/modules/ai/providers/openai-responses.provider.spec.ts`

**Interfaces:**
- Provider completion input receives `model: string` resolved from global runtime.
- `AiService.sendMessage()` performs tool validation and all message/proposal writes inside one Prisma transaction after a successful provider completion.

- [ ] Write failing tests showing a global OAuth connection selects `OpenAiResponsesProvider` while `AI_ENABLED=false`, Responses requests use the saved model slug, API-key fallback remains gated, and a fake provider is not used in OAuth mode.
- [ ] Write failing tests showing malformed/unknown tool calls and provider failures leave no user message, assistant message, or proposal persisted.
- [ ] Run focused provider/service tests and verify failure.
- [ ] Make the module always supply the Responses provider; resolve OAuth first, then use explicit API-key fallback, otherwise return a recoverable unconfigured-provider error.
- [ ] Move provider execution/tool normalization before persistence; validate every normalized tool call, then execute all user message, assistant message, and proposal writes in one transaction.
- [ ] Pass the globally selected model to all Responses requests and preserve response streaming/error metadata.
- [ ] Run provider, security, OAuth/runtime, and service test suites plus API build.

### Task 4: Runtime and settings APIs

**Files:**
- Create: `apps/api/src/modules/ai/ai-server-runtime.controller.ts`
- Create: `apps/api/src/modules/settings/ai-provider-settings.controller.ts`
- Modify: `apps/api/src/modules/ai/ai.module.ts`
- Modify: `apps/api/src/modules/settings/settings.module.ts`
- Test: `apps/api/src/modules/ai/ai-server-runtime.controller.spec.ts`
- Test: `apps/api/src/modules/settings/ai-provider-settings.controller.spec.ts`

**Interfaces:**
- `GET /api/ai/runtime` returns `{ connectionStatus, provider, selectedModel, models }`.
- `POST /api/ai/runtime/model` accepts `{ slug: string }` and returns runtime view.
- `GET /api/settings/ai/providers` returns ChatGPT status and disabled `coming_soon` providers.

- [ ] Write failing controller tests for authenticated `ai.use` runtime access, model payload validation, response redaction, and administrator-only settings provider status.
- [ ] Run focused controller tests and verify failure.
- [ ] Implement runtime endpoints for homologation and DTO validation for model selection.
- [ ] Implement settings provider endpoint using existing administrator guard/permission conventions; return fixed `coming_soon` descriptors without credentials or connect actions.
- [ ] Run focused controller tests and API build.

### Task 5: Chat model combobox and provider settings UI

**Files:**
- Create: `apps/web/src/lib/ai-runtime.ts`
- Create: `apps/web/src/components/ai/AiModelCombobox.tsx`
- Modify: `apps/web/src/app/(app)/ai-chat/page.tsx`
- Create: `apps/web/src/app/(app)/settings/ai-providers/page.tsx`
- Create: `apps/web/src/components/settings/AiProviderSettings.tsx`
- Test: `apps/web/src/lib/ai-runtime.spec.ts`

**Interfaces:**
- `getAiRuntime()` returns redacted runtime metadata and model choices.
- `selectAiRuntimeModel(slug)` updates the global selected model.
- Model combobox displays `displayName` and supporting `slug` in OpenAI server order.

- [ ] Write failing web-client tests for runtime parsing/redaction, model selection payload, unavailable catalog, and safe error mapping.
- [ ] Run focused web tests and verify failure.
- [ ] Implement runtime API client and accessible searchable combobox. Disable selection while save is pending and show the global impact in copy.
- [ ] Integrate runtime status/model selector in chat without blocking message history. Retain the temporary ChatGPT connection card.
- [ ] Add an admin settings page with ChatGPT status and disabled `Em breve` cards for future providers; reuse connection/status UI where possible.
- [ ] Run web tests, `npx tsc --noEmit`, and `npm run build` from `apps/web`.

### Task 6: Integration, documentation, and deployment

**Files:**
- Modify: `apps/api/src/modules/ai/ai-oauth.e2e.spec.ts`
- Modify: `.env.example`
- Modify: `.env.docker`
- Modify: `docs/runbooks/chatgpt-oauth.md`
- Create: `docs/runbooks/ai-runtime.md`

- [ ] Write failing integration coverage for global OAuth connection, model catalog request/filter/order, global selection, Responses model propagation, and no partial chat rows after provider/tool failure.
- [ ] Run the focused integration test and verify failure.
- [ ] Document that `AI_ENABLED` gates only API-key fallback, the global ChatGPT account affects all users, model catalog refresh behavior, admin settings migration, and recovery steps.
- [ ] Run all AI tests, API build, web tests/typecheck/build, Prisma migration deploy/status, and `git diff --check`.
- [ ] Rebuild/restart API and web containers; verify health, redacted runtime endpoint behavior, settings route authorization, and catalog/model request with a connected account when available.
