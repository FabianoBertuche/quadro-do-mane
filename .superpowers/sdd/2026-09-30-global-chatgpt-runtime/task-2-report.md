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

## Auth-To-Runtime Switch Fix

- `resolveProviderAuth()` now returns the resolved global connection ID and `updatedAt` version as internal auth metadata after recording usage.
- Before fetching or tagging a catalog, the runtime service reloads the singleton and verifies that its connection ID/version still match the credential that resolved authorization. A switch in that window returns the same safe retry error before a model-catalog request is made.
- Regression coverage switches from connection A to B inside `resolveProviderAuth()` and verifies catalog fetch is not attempted.

Verification for this fix:

```text
node -r ts-node/register --test src/modules/ai/ai-server-runtime.service.spec.ts src/modules/ai/ai-oauth.service.spec.ts src/modules/ai/ai-oauth.controller.spec.ts
35 passed, 0 failed

npm run build
nest build exited 0

git diff --check
exited 0
```

## Stale Catalog Race Fix

- Model selection now retains the runtime connection ID and connection `updatedAt` value that produced its catalog entry.
- After acquiring the singleton row lock, selection reloads the runtime and compares that connection key before writing. A disconnect/reconnect or credential update during catalog fetch returns the safe retry message `A conexão do ChatGPT foi alterada. Atualize a lista de modelos e tente novamente.` and leaves selected-model metadata unchanged.
- Regression coverage simulates the connection switch inside the model-catalog request before selection acquires the lock.

Verification for this fix:

```text
node -r ts-node/register --test src/modules/ai/ai-server-runtime.service.spec.ts src/modules/ai/ai-oauth.service.spec.ts src/modules/ai/ai-oauth.controller.spec.ts
33 passed, 0 failed

npm run build
nest build exited 0
```

## Post-Auth Catalog Version Fix

- Catalog identity is now captured only after `resolveProviderAuth()` completes its `lastUsedAt` update and the runtime is reloaded.
- Cached catalogs retain a pre-auth fast path when their current runtime key still matches, avoiding unnecessary credential usage updates.
- A normal authenticated selection no longer falsely rejects because its own OAuth use updated the connection timestamp; disconnect/reconnect and credential-replacement changes after catalog identity capture still reject safely.

Verification for this fix:

```text
node -r ts-node/register --test src/modules/ai/ai-server-runtime.service.spec.ts src/modules/ai/ai-oauth.service.spec.ts src/modules/ai/ai-oauth.controller.spec.ts
34 passed, 0 failed

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

## In-Flight Catalog Connection Switch Fix

- Closed the remaining TOCTOU window in `catalogForCurrentRuntime()`: the connection key was validated only before `fetchOpenAiModels()`, so a disconnect/reconnect during the in-flight catalog request returned connection A's models and cached them even though connection B was already current.
- The resolved-key comparison is now a shared `connectionChanged(auth, runtime)` predicate applied at both fences: before the catalog request and again after it returns. A switch during the request returns `A conexão do ChatGPT foi alterada. Atualize a lista de modelos e tente novamente.` before any cache write.
- The cache write is fenced: the catalog is stored only after the post-fetch re-read confirms the auth's connection ID/version is still current, so it can never be cached under a known-stale key.
- Provider fetch failures still surface `Catálogo de modelos indisponível`; the fetch was moved out of the cache-write try block so the new fence is not swallowed into the generic unavailable error.
- Regression coverage switches from connection A to B inside the in-flight catalog request and asserts the call rejects, then asserts the next listing refetches under connection B and serves only B's models from cache.

Verification for this fix:

```text
node -r ts-node/register --test src/modules/ai/ai-server-runtime.service.spec.ts src/modules/ai/ai-oauth.service.spec.ts src/modules/ai/ai.module.spec.ts src/modules/ai/ai-oauth.controller.spec.ts src/modules/ai/ai.controller.spec.ts
40 passed, 0 failed

npm run build
nest build exited 0

git diff --check
exited 0
```

## OAuth e2e scope fix (2026-09-30)

- Added aiServerRuntime mock (upsert/findUnique/update) to ai-oauth.e2e.spec.ts and rewired aiOAuthConnection mock methods to match AiOAuthService's global runtime model (create/update/findFirst/updateMany with runtime-scoped semantics). The runtimeView tracks global connection ID and selected model state so the e2e passes.
- Verification: node -r ts-node/register --test apps/api/src/modules/ai/ai-oauth.e2e.spec.ts apps/api/src/modules/ai/ai-server-runtime.service.spec.ts apps/api/src/modules/ai/ai-oauth.service.spec.ts apps/api/src/modules/ai/ai.module.spec.ts apps/api/src/modules/ai/ai-oauth.controller.spec.ts apps/api/src/modules/ai/ai.controller.spec.ts (41 passed, 0 failed). npm run build (exit 0). git diff --check (exit 0). Commit 169a88b.
