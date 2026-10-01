# Task 6 Report: Integration, Documentation, and Deployment

Date: 2026-10-01

## Status

Implementation and documentation complete. No live OAuth or OpenAI request
was made. The integration coverage uses a native HTTP router harness because
this workspace does not include `@nestjs/testing` or `supertest`; it exercises
the real controllers, production DTO pipe behavior, real
`TenantContextGuard`/`PermissionGuard` behavior and metadata, response
redaction, global model selection, and settings admin access. Its explicitly
named `testAuthAdapter` fixture accepts only test credentials; it does not
validate JWTs, register Passport, or exercise production `AuthGuard('jwt')` and
the Nest application bootstrap/middleware pipeline. The chat path uses the
real `AiService` with a selected runtime model and a rollback-capable
transaction mock.

## Changes

- Extended `apps/api/src/modules/ai/ai-oauth.e2e.spec.ts` with a mocked
  end-to-end contract covering one global OAuth bearer, catalog request,
  `visibility=list` filtering, provider order, global model selection, real
  `AiService` model propagation, and no partial rows after a transaction write
  failure.
- Added `apps/api/src/modules/ai/ai-runtime.http.e2e.spec.ts` as the HTTP
  fallback contract harness; it covers runtime auth/permission/DTO/redaction
  and the administrator-only settings provider route.
- Updated `.env.example` and `.env.docker` to state that `AI_ENABLED` gates
  only API-key fallback and added an empty, non-secret `OPENAI_API_KEY` slot to
  the Docker example.
- Updated `docs/runbooks/chatgpt-oauth.md` for global account semantics,
  catalog caching/refresh, administrator settings migration, permissions,
  disconnect/recovery, and safe deployment.
- Added `docs/runbooks/ai-runtime.md` with the runtime contract, permissions,
  catalog behavior, recovery, atomic persistence, and deployment procedure.

## Verification

All commands below were run from the stated workspace and no live provider
credentials were required.

- Focused API integration: `node -r ts-node/register --test src/modules/ai/ai-oauth.e2e.spec.ts src/modules/ai/ai-runtime.http.e2e.spec.ts` from `apps/api`: **4/4 passed**.
- Full AI suite: `node -r ts-node/register --test src/modules/ai/*.spec.ts src/modules/ai/providers/*.spec.ts src/modules/ai/tools/*.spec.ts src/modules/ai/media/*.spec.ts` from `apps/api`: **172/172 passed**.
- API build: `npm run build` from `apps/api`: **passed**.
- API typecheck: `npx tsc --noEmit` from `apps/api`: **passed**.
- Web tests: `TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","jsx":"react-jsx"}' node -r ts-node/register --test src/lib/ai-runtime.spec.ts src/lib/ai-oauth.spec.ts src/components/ai/AiModelCombobox.spec.ts src/lib/ai-chat.test.ts` from `apps/web`: **20/20 passed**.
- Web typecheck: `npx tsc --noEmit` from `apps/web`, after the Next build generated route types: **passed**.
- Web build: `npm run build` from `apps/web`: **passed**. Next reported cache snapshot warnings but completed successfully.
- Prisma client generation: `npm run generate` from `apps/api`: **passed**.
- Formatting check: `git diff --check`: **passed**.

## Deployment and Container Status

- `docker compose -f docker-compose.prod.yml ps` showed the existing API and
  Postgres containers healthy and the web container running. Caddy was also
  running.
- The migration image built successfully with
  `docker compose -f docker-compose.prod.yml run --build --rm migrate`, but
  migration execution was blocked by `P1001`: configured database host
  `mm-postgres:5432` was unreachable in this shared workspace.
- A direct host shell Prisma deploy was also attempted and stopped before
  connection because `DATABASE_URL` is not exported in the shell. No tracked
  environment file was modified to inject it.
- The migration service was not able to reach the database, so no migration
  was applied and no application containers were restarted.
- Existing API health was healthy. Existing Postgres health was healthy.
- Existing web root returned `308` through the local Caddy setup. This differs
  from the runbook's documented `200`/login-redirect expectation but confirms
  the existing web proxy is responding.
- The running API image predates the current worktree: internal requests to
  `/api/ai/runtime` and `/api/settings/ai/providers` returned `404`, not a
  redacted response or authorization status. Rebuilding/restarting shared API
  and web containers was intentionally not performed because migration and
  database host configuration were not safe to complete in this workspace.
- No connected account was available for a live catalog check. The mocked
  integration test and focused runtime/provider tests verify catalog ordering,
  filtering, redaction, and request propagation without network calls.

## Commit Scope

Only the Task 6 files and this report should be committed. Pre-existing
changes shown by `git status` in other API, planning, SDD, and worktree files
were not staged or modified by this task.
