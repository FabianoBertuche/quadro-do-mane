# Task 3 Report: OAuth API Endpoints

## Status

Implemented the AI OAuth controller and module wiring.

## Endpoints

- `POST /api/ai/oauth/start` starts the tenant-user OAuth attempt and returns only the authorization URL, attempt ID, and expiry.
- `POST /api/ai/oauth/complete` accepts `callbackUrl`, completes the authenticated tenant-user flow, and returns redacted connection metadata.
- `GET /api/ai/oauth/connections` lists only connections owned by the current tenant user.
- `POST /api/ai/oauth/:id/refresh` refreshes only an owned connection.
- `POST /api/ai/oauth/:id/disconnect` disconnects only an owned connection.

All routes use JWT authentication, tenant context, `PermissionGuard`, and `@RequirePermissions('ai.use')`. Mutation calls receive an actor containing both `tenantId` and `tenantUserId`; the list query applies both ownership predicates directly.

## Redaction

Public connection responses contain only `id`, `provider`, `email`, `scopes`, `expiresAt`, and `status`. Internal issuer subject, client ID, token ciphertexts, access/refresh/ID tokens, and verifier material are not returned.

## Verification

- Focused controller tests: `node -r ts-node/register --test src/modules/ai/ai-oauth.controller.spec.ts` (5 passed, 0 failed).
- API build: `npm run build` from `apps/api` (passed).
- Initial TDD red run failed because the controller did not yet exist; the focused suite passed after implementation.

## Scope

Changed only `ai-oauth.controller.ts`, `ai-oauth.controller.spec.ts`, `ai.module.ts`, and this report. Existing service/protocol/provider/UI files were not modified.

## Concerns

- The service’s connection view contains internal fields, so the controller intentionally projects it to the smaller public metadata contract.
- `callbackUrl` is typed at compile time in the controller; runtime URL parsing and OAuth validation remain owned by `AiOAuthService` and the protocol.
