# Sign in with ChatGPT Plan Usage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure Sign in with ChatGPT plan authorization using a copy/paste callback and route AI inference through OAuth-backed Responses API requests.

**Architecture:** Add a tenant-user-scoped OAuth connection service and controller that owns dynamic registration, PKCE, callback completion, token refresh, and revocation. Refactor provider selection so each AI request resolves the active user's OAuth credential, while retaining API-key fallback and the existing tool/proposal pipeline.

**Tech Stack:** NestJS, Prisma/PostgreSQL, OpenAI Node SDK or HTTPS Responses API, Next.js/React, existing AES-256-GCM `EncryptionService`, Node test runner with `ts-node`.

**Spec:** `docs/superpowers/specs/2026-09-30-chatgpt-plan-oauth-design.md`

## Global Constraints

- Use `dynamic_agent_client` only for first registration; save and reuse the issued `oaiapp_...` client ID.
- Use `http://127.0.0.1:<port>/auth/callback`; do not substitute `localhost`.
- Request `openid profile email offline_access resource.invoke chatgpt.tokens.use.direct` and `resource=https://api.openai.com/v1`.
- Use `POST https://api.openai.com/v1/responses`, `store: false`, and streaming for OAuth plan usage.
- Encrypt OAuth credentials with the existing `EncryptionService`; never send tokens to the browser.
- Preserve tenant/user ownership, `ai.use`, confirmation-required tools, audit events, and API-key fallback.

---

### Task 1: OAuth persistence and migration

**Files:**
- Create: `apps/api/prisma/migrations/<timestamp>_add_chatgpt_oauth/migration.sql`
- Modify: `apps/api/prisma/schema.prisma`
- Test: `apps/api/src/modules/ai/ai-oauth-persistence.spec.ts`

**Interfaces:**
- Produces `AiOAuthConnection` and `AiOAuthAttempt` Prisma models scoped to tenant user.

- [ ] Write tests asserting encrypted token fields, unique connection identity, one-time attempt state, expiry, and tenant/user indexes.
- [ ] Run `node -r ts-node/register --test apps/api/src/modules/ai/ai-oauth-persistence.spec.ts`; verify it fails because models/migration are absent.
- [ ] Add models with encrypted access/refresh/ID-token fields, issued client ID, OpenAI subject, scopes, expiry, host ID, revocation state, and attempt fields for state hash, PKCE verifier hash, redirect URI, and expiry.
- [ ] Add the migration and regenerate Prisma client.
- [ ] Run the persistence test and `npm run build:api`.

### Task 2: OAuth protocol service

**Files:**
- Create: `apps/api/src/modules/ai/ai-oauth.service.ts`
- Create: `apps/api/src/modules/ai/ai-oauth.protocol.ts`
- Modify: `apps/api/src/common/config/env.validation.ts`
- Test: `apps/api/src/modules/ai/ai-oauth.service.spec.ts`

**Interfaces:**
- `startAuthorization(actor): Promise<{ authorizationUrl: string; attemptId: string; expiresAt: string }>`
- `completeAuthorization(actor, callbackUrl: string): Promise<AiOAuthConnectionView>`
- `refreshConnection(actor, connectionId): Promise<void>`
- `disconnectConnection(actor, connectionId): Promise<void>`
- Protocol helpers build authorization URL, exchange form data, validate callback state, and validate JWKS-backed ID tokens.

- [ ] Write failing tests for state mismatch, PKCE mismatch, callback client ID mismatch, missing `chatgpt.tokens.use.direct`, invalid issuer/audience/nonce, dynamic client ID capture, encrypted persistence, and safe connection output.
- [ ] Run the focused test and verify expected failures.
- [ ] Implement authorization-attempt creation with cryptographically random state/nonce/verifier, S256 challenge, stable host ID, 10-minute expiry, and issued-client reuse.
- [ ] Implement callback parsing and form-encoded token exchange with no client secret, then verify ID token against OpenAI JWKS and validate granted scopes.
- [ ] Encrypt all token values before persistence and redact tokens from logs/errors.
- [ ] Implement serialized refresh with replacement refresh-token persistence and revocation using OpenID configuration.
- [ ] Run focused tests and API typecheck.

### Task 3: OAuth API endpoints

**Files:**
- Create: `apps/api/src/modules/ai/ai-oauth.controller.ts`
- Modify: `apps/api/src/modules/ai/ai.module.ts`
- Test: `apps/api/src/modules/ai/ai-oauth.controller.spec.ts`

**Interfaces:**
- `POST /api/ai/oauth/start`
- `POST /api/ai/oauth/complete` with `{ callbackUrl: string }`
- `GET /api/ai/oauth/connections`
- `POST /api/ai/oauth/:id/refresh`
- `POST /api/ai/oauth/:id/disconnect`

- [ ] Write failing controller tests for JWT, tenant, `ai.use`, response redaction, and ownership boundary.
- [ ] Run the focused tests and verify failure.
- [ ] Add guarded endpoints using `CurrentUser`, `TenantContextGuard`, `PermissionGuard`, and `@RequirePermissions('ai.use')`.
- [ ] Return only connection metadata: provider, email, scopes, expiresAt, status, and ID; never tokens or verifier material.
- [ ] Run controller tests and API build.

### Task 4: Provider abstraction and Responses API

**Files:**
- Create: `apps/api/src/modules/ai/providers/openai-responses.provider.ts`
- Modify: `apps/api/src/modules/ai/ports/ai-provider.port.ts`
- Modify: `apps/api/src/modules/ai/ai.service.ts`
- Modify: `apps/api/src/modules/ai/ai.module.ts`
- Test: `apps/api/src/modules/ai/providers/openai-responses.provider.spec.ts`

**Interfaces:**
- `AiProvider.complete(input, auth): Promise<AiCompletionResult>` where `auth` resolves an OAuth access token or API-key fallback.
- Provider must normalize text deltas and function-call events into existing `text` and `toolCalls`.

- [ ] Write failing tests for Responses request shape, bearer OAuth token, `store:false`, streaming completion, function-call parsing, incomplete response, and safe provider errors.
- [ ] Run focused provider tests and verify failure.
- [ ] Implement Responses API adapter using `https://api.openai.com/v1/responses`; use available model from the connection or configured fallback.
- [ ] Add token resolver that loads/refreshes the active connection for the actor and falls back to API key only when explicitly configured.
- [ ] Preserve existing tool validation and proposal persistence; retry once after a refreshable 401.
- [ ] Run provider, AI security, and API test suites.

### Task 5: Web connection UI

**Files:**
- Modify: `apps/web/src/lib/ai-chat.ts`
- Create: `apps/web/src/lib/ai-oauth.ts`
- Modify: `apps/web/src/app/(app)/ai-chat/page.tsx`
- Create: `apps/web/src/components/ai/AiOAuthConnectionCard.tsx`
- Test: `apps/web/src/lib/ai-oauth.spec.ts`

**Interfaces:**
- `startChatGptAuthorization()` returns URL and expiry.
- `completeChatGptAuthorization(callbackUrl)` submits the pasted callback URL.
- `listChatGptConnections()` returns redacted connection views.

- [ ] Write failing client tests for URL display, callback submission, redacted metadata, and error mapping for denied/expired/scope-insufficient authorization.
- [ ] Run the focused web test and verify failure.
- [ ] Implement API client functions and an accessible card with `Continuar com ChatGPT`, copy/open URL controls, full callback URL textarea, connection status, reconnect, and disconnect.
- [ ] Integrate the card into the AI chat empty/error state without blocking conversation history when an API-key fallback is active.
- [ ] Run web tests, typecheck, and build.

### Task 6: End-to-end verification and deployment

**Files:**
- Modify: `.env.example`
- Modify: `.env.docker`
- Create: `docs/runbooks/chatgpt-oauth.md`
- Test: `apps/api/src/modules/ai/ai-oauth.e2e.spec.ts`

- [ ] Add environment documentation for `CHATGPT_OAUTH_AGENT_NAME`, `CHATGPT_OAUTH_HOST_ID`, `CHATGPT_OAUTH_CALLBACK_PORT`, and provider fallback settings without committing secrets.
- [ ] Write an integration test covering start, callback validation, connection listing, and provider token resolution with mocked OpenAI endpoints.
- [ ] Run the integration test and verify it fails before wiring is complete.
- [ ] Complete the runbook with OpenAI client setup, copy/paste callback steps, token revocation, scope errors, and ChatGPT usage limits.
- [ ] Run all AI tests, `npm run build:api`, `npm run build:web`, `git diff --check`, and authenticated manual verification.
- [ ] Apply the migration through the normal deploy flow, rebuild API/web, and verify containers, route health, OAuth metadata redaction, and one text request.
