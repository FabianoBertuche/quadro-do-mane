# Task 1: Global Runtime Persistence Report

## Scope

- Added the `AiServerRuntime` Prisma model for the server-wide runtime record.
- Made `AiOAuthConnection` tenant and tenant-user ownership nullable so an encrypted OAuth credential can be global.
- Added migration `20260930120000_add_ai_server_runtime`.
- Added focused persistence contract coverage.

## Persistence Design

- `AiServerRuntime.id` defaults to `global`; the migration adds a database check constraint so no other runtime ID is valid.
- The runtime optionally references one OAuth connection. The foreign key uses `ON DELETE SET NULL`, preserving the runtime and model selection when a connection is removed.
- The OAuth connection reference is unique, so one connection cannot be assigned to multiple runtime rows.
- The existing encrypted token fields, issuer, and subject fields remain unchanged.
- Existing OAuth rows are not selected or copied into the runtime. The migration inserts one disconnected `global` runtime row with no OAuth connection reference.

## Test-First Evidence

- Added `ai-server-runtime-persistence.spec.ts` before schema or migration changes.
- Initial focused test run failed with `missing Prisma model AiServerRuntime`, required OAuth ownership still non-nullable, and `missing AI server runtime migration`.
- After the minimal schema and migration implementation, the focused test passed: 3 tests, 0 failures.

## Verification

- `node -r ts-node/register --test src/modules/ai/ai-server-runtime-persistence.spec.ts`: 3 passed, 0 failed.
- `DATABASE_URL='postgresql://localhost:5432/monte_moria' npx prisma validate`: valid schema.
- `npx prisma generate`: Prisma Client generated successfully.
- `npm run build`: Nest API build succeeded.
- `git diff --check`: no output.

## Review Follow-Up

- The migration now inserts the disconnected singleton runtime row with `id = 'global'` and no OAuth connection, so the database always starts with the one allowed runtime record.
- The migration adds `ai_oauth_connections_ownership_pair_check`, requiring `tenant_id` and `tenant_user_id` to be either both `NULL` for global credentials or both non-`NULL` for tenant-owned credentials.
- Updated OAuth persistence coverage for optional global ownership and added focused SQL assertions for the ownership check and disconnected singleton insert.
- The follow-up tests first failed because those SQL clauses were absent, then passed after the migration change: runtime 3/3 and OAuth 4/4.

## Concerns

- Prisma validation requires `DATABASE_URL`; the supplied local URL was used only for schema validation and did not run a database migration.
- Global OAuth connection lifecycle remains for Task 2; this migration leaves all pre-existing tenant-user credentials unselected.
