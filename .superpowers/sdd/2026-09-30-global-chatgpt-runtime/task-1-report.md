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
- Existing OAuth rows are not selected or copied into the runtime. The migration creates no runtime row, leaving the global runtime disconnected until a later runtime service explicitly connects an unambiguous global credential.

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

## Concerns

- Prisma validation requires `DATABASE_URL`; the supplied local URL was used only for schema validation and did not run a database migration.
- Runtime-row creation and global OAuth connection lifecycle intentionally remain for Task 2; this migration leaves all pre-existing tenant-user credentials unselected.
