# Task 1 Report: OAuth Persistence and Migration

## Files Changed

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/20260930100000_add_chatgpt_oauth/migration.sql`
- `apps/api/src/modules/ai/ai-oauth-persistence.spec.ts`

## Implementation

- Added `AiOAuthConnection`, scoped by `tenantId` and `tenantUserId`, with encrypted access, refresh, and ID-token ciphertext/IV/auth-tag fields.
- Added issuer, OpenAI subject, issued client ID, verified account metadata, scopes, expiry, stable external agent host ID, last-used timestamp, and revocation state.
- Added the unique connection identity `(tenantUserId, issuer, subject, clientId)` and tenant/user/expiry index.
- Added `AiOAuthAttempt` with hashed state, nonce, and PKCE verifier material; redirect URI, client ID, host ID, expiry, and nullable `consumedAt` for one-time use.
- Added tenant and tenant-user cascade relations and indexes for both models.
- Added migration tables, constraints, indexes, and foreign keys using existing PostgreSQL migration conventions.
- Regenerated Prisma Client.

## Tests and Commands

1. `node -r ts-node/register --test apps/api/src/modules/ai/ai-oauth-persistence.spec.ts`
   - Initial RED run failed because the migration file was absent (`ENOENT`), as expected.
   - Final: `3` tests passed, `0` failed.
2. `DATABASE_URL='postgresql://localhost:5432/monte_moria' npx prisma validate --schema apps/api/prisma/schema.prisma`
   - Passed: schema is valid.
3. `DATABASE_URL='postgresql://localhost:5432/monte_moria' npx prisma generate --schema apps/api/prisma/schema.prisma`
   - Passed: Prisma Client v5.22.0 generated.
4. `npm run build:api`
   - Passed: Nest API build completed successfully.
5. `git diff --check -- apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260930100000_add_chatgpt_oauth/migration.sql apps/api/src/modules/ai/ai-oauth-persistence.spec.ts`
   - Passed with no whitespace errors.

## Concerns

- The migration was not applied to a live database; verification used Prisma schema validation and SQL contract tests.
- The worktree contains unrelated pre-existing changes, which were not staged or modified for this task.

## Reviewer Fixes

- Changed both OAuth models to composite tenant-user relations: `(tenantId, tenantUserId)` references `(TenantUser.tenantId, TenantUser.id)`.
- Added `TenantUser @@unique([tenantId, id])` and the matching migration index so PostgreSQL can enforce the composite foreign keys.
- Kept `consumedAt` nullable for the initial state and added the claim-support index `[tenantId, tenantUserId, consumedAt, expiresAt]`; Task 2 can atomically claim with a conditional `updateMany` requiring `consumedAt IS NULL` and an unexpired attempt.
- Updated focused tests to assert nullable `consumedAt`, the claim index, composite relations, composite foreign keys, and the tenant-user unique index.

### Reviewer-Fix Commands and Outputs

1. `node -r ts-node/register --test apps/api/src/modules/ai/ai-oauth-persistence.spec.ts`
   - RED after strengthening tests: `3` tests failed on the missing composite relations/indexes.
   - Final: `3` tests passed, `0` failed.
2. `DATABASE_URL='postgresql://localhost:5432/monte_moria' npx prisma validate --schema apps/api/prisma/schema.prisma`
   - Passed: schema is valid.
3. `DATABASE_URL='postgresql://localhost:5432/monte_moria' npx prisma generate --schema apps/api/prisma/schema.prisma`
   - Passed: Prisma Client v5.22.0 generated.
4. `npm run build:api`
   - Passed: Nest API build completed successfully.
5. `git diff --check -- apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260930100000_add_chatgpt_oauth/migration.sql apps/api/src/modules/ai/ai-oauth-persistence.spec.ts`
   - Passed with no whitespace errors.

### Reviewer-Fix Concerns

- The migration was not applied to a live database; validation used Prisma schema validation and SQL contract tests.
- The worktree still contains unrelated pre-existing changes, which were not staged.
