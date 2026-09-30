# Task 4 Report: Provider Abstraction and Responses API

## Status

Implemented and committed in `88f84fb` (`feat(api): integrate OpenAI Responses provider`).

## Implementation

- Extended `AiProvider.complete` with an optional actor-scoped `AiProviderAuth` while preserving `AiCompletionResult`.
- Added `OpenAiResponsesProvider` using native `fetch` against `POST https://api.openai.com/v1/responses`.
- Requests use `store: false`, `stream: true`, the configured model, current message/tool shapes, and bearer authentication.
- Added SSE normalization for text deltas, function-call argument deltas/completed output, completed responses, failed responses, and incomplete responses.
- Added safe provider and transport errors. OpenAI `x-request-id` is retained in safe failure messages without exposing response bodies, prompts, or credentials.
- Added exactly one retry for OAuth 401 responses after invoking the auth refresh callback. Other status codes are not retried.
- API-key fallback is used only when `AI_ENABLED` is true and `OPENAI_API_KEY` is configured.
- Added `AiOAuthService.resolveProviderAuth`, scoped by `tenantId` and `tenantUserId`, including expiry refresh, encrypted token decryption, last-used tracking, and a refresh callback for the provider retry.
- Wired `AiService` to resolve credentials from the authenticated actor before provider calls.
- Switched the enabled AI module provider to the Responses adapter. Existing tool validation, proposal persistence/confirmation, tenant ownership, and audit behavior remain in `AiService`.

## Tests

Fresh verification:

```text
node -r ts-node/register --test src/modules/ai/providers/openai-responses.provider.spec.ts src/modules/ai/ai.service.spec.ts src/modules/ai/ai-security.spec.ts src/modules/ai/ai-oauth.service.spec.ts
42 tests passed, 0 failed

npm run build
exit 0
```

## Concerns

- The existing `AiProvider` contract returns one normalized completion, so the native SSE response is buffered and normalized before returning; no controller/UI streaming contract was introduced.
- The legacy `OpenAiProvider` remains for compatibility with its existing focused tests and is no longer selected by `AiModule` for text AI requests.

## Review Fixes

- Added the `AI_OAUTH_SERVICE` token and `useExisting: AiOAuthService` module alias. `AiService` now injects that token explicitly, avoiding erased type-only dependency metadata; the module metadata test catches missing or undefined runtime wiring.
- Added `AiStreamingProvider.stream()` as an async iterable of normalized text/tool/completion events. `complete()` consumes the same incremental parser and retains the existing `Promise<AiCompletionResult>` contract.
- Streams now require `response.completed` with status `completed`, or terminate with an explicit safe failed/incomplete error. EOF, malformed JSON, and interrupted partial streams are rejected.
- Added `response.function_call_arguments.done` parsing and merging with argument deltas and completed output.
- Added regression coverage for disabled API-key fallback and the second OAuth 401, which is not retried.

## Review-Fix Verification

```text
node -r ts-node/register --test src/modules/ai/providers/*.spec.ts src/modules/ai/ai.service.spec.ts src/modules/ai/ai-security.spec.ts src/modules/ai/ai-oauth.service.spec.ts src/modules/ai/ai.module.spec.ts
56 tests passed, 0 failed

npm run build
exit 0
```

## Streaming Retry Fix

- Updated `OpenAiResponsesProvider.stream()` to resolve OAuth 401 responses with the same one-refresh/one-retry policy as `complete()` before yielding any events.
- A second 401 is returned as a safe provider error; non-401 statuses are never retried.
- Added streaming retry and non-401 no-retry regression tests.

## Streaming Retry Verification

```text
node -r ts-node/register --test src/modules/ai/providers/*.spec.ts src/modules/ai/ai.service.spec.ts src/modules/ai/ai-security.spec.ts src/modules/ai/ai-oauth.service.spec.ts src/modules/ai/ai.module.spec.ts
58 tests passed, 0 failed

npm run build
exit 0
```
