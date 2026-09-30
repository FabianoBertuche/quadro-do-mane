# Task 2 Report: Global OAuth and Model Catalog

## Implemented

- Added `AiServerRuntimeService` as the server-only singleton runtime facade.
  - `getRuntime()` returns only provider, connection state, and selected model metadata.
  - `listModels()` obtains the global OAuth credential, calls `GET https://api.openai.com/v1/models` with `Authorization: Bearer <token>`, and returns only `visibility === "list"` entries in provider order as `{ slug, displayName }`.
  - Catalog cache stores only that redacted metadata. It invalidates when the runtime connection ID or connection update timestamp changes.
  - `selectModel()` validates against the catalog before persisting the global slug/display name. Unavailable catalogs and unknown slugs return fixed safe Portuguese errors.
- Added `fetchOpenAiModels()` to the OAuth protocol boundary. Raw response data and provider response text are not exposed to callers.
- Changed OAuth service connection lifecycle to use `AiServerRuntime`.
  - Authorization still records the initiating user on the short-lived attempt, but uses the global connection client ID.
  - Completion creates or updates a global (`tenantId`/`tenantUserId` null) encrypted credential and attaches it to the singleton runtime.
  - Provider-auth resolution accepts no actor and refreshes the global expired credential.
  - Refresh/disconnect operate without tenant ownership filters; disconnect clears the runtime connection and selected model metadata.
- Registered `AiServerRuntimeService` in `AiModule`.

## Tests

Initial RED verification:

```text
node -r ts-node/register --test src/modules/ai/ai-server-runtime.service.spec.ts
TS2307: Cannot find module './ai-server-runtime.service'
```

Final verification:

```text
node -r ts-node/register --test src/modules/ai/ai-server-runtime.service.spec.ts src/modules/ai/ai-oauth.service.spec.ts src/modules/ai/ai.module.spec.ts
23 passed, 0 failed

npm run build
nest build exited 0

git diff --check
exited 0
```

Coverage includes global OAuth resolution without actor identity, expired global token refresh, bearer catalog request, `visibility=list` filtering and order, cache invalidation on connection change, unavailable/unknown-model errors, global encrypted-token persistence, disconnect, and runtime token redaction.

## Scope And Concerns

- The existing OAuth connections route now exposes only the singleton global connection as redacted metadata; Task 4 still owns the dedicated runtime endpoint.
- The provider atomic chat-flow remains unchanged for Task 3. Its existing actor argument is tolerated by the now-global `resolveProviderAuth()` signature but provider model selection is not wired until that task.
- Existing unrelated worktree modifications were not touched or included.

## Review Remediation

- Refresh and disconnect now require the supplied ID to equal the singleton runtime's `oauthConnectionId`. Legacy or personal connection IDs fail before any credential mutation and cannot clear runtime state.
- `GET /ai/oauth/connections` now reads only `AiServerRuntime.global.oauthConnection` and returns its existing redacted metadata shape. It no longer queries actor-owned legacy OAuth rows.
- Global credential attachment, model selection, and disconnect execute inside a Prisma transaction that locks the singleton row with `SELECT ... FOR UPDATE`. Concurrent authorization completions serialize: the first creates and attaches the credential; later completions update that same attached credential rather than attach a competing row.
- OAuth connect/disconnect actions audit safe provider/status metadata through `AiAuditService`. Runtime model selection accepts the authenticated actor for the corresponding safe audit entry when invoked by its controller.
- Added regression coverage for legacy-ID rejection, global listing, same-ID catalog cache invalidation on `updatedAt`, singleton row locking, concurrent attachment serialization, and safe connection audit metadata.

Review verification:

```text
node -r ts-node/register --test src/modules/ai/ai-oauth.service.spec.ts src/modules/ai/ai-oauth.controller.spec.ts src/modules/ai/ai-server-runtime.service.spec.ts
32 passed, 0 failed

npm run build
nest build exited 0

git diff --check
exited 0
```
