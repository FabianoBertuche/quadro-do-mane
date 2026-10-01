# Task 2 Report: Authorized Read Tools

## Result

Implemented five read-only AI tools:

- `search_projects`
- `search_users`
- `search_teams`
- `search_calendar`
- `search_routines`

Each tool accepts the existing `{ tenantId, actorTenantUserId, args }` input, reuses `requirePermission`, validates tenant-scoped IDs and named targets, caps results at 50 records, returns explicit empty arrays, and emits only bounded summaries. E-mail addresses, tokens, descriptions/private notes, phone numbers, and other unrestricted domain fields are not returned. Dates from calendar results are serialized as ISO strings.

Ambiguous names return `{ needsClarification: true, field, matches }` without mutation. No tool calls Prisma or exposes a mutation path. Existing task tools were preserved.

## Commands and Results

### TDD red

Command:

```text
node -r ts-node/register --test src/modules/ai/tools/authorized-read-tools.spec.ts
```

Result: failed as expected before implementation because the five tool modules did not exist.

### Focused read-tool tests

Command:

```text
node -r ts-node/register --test src/modules/ai/tools/authorized-read-tools.spec.ts
```

Result: 7 tests passed, 0 failed.

### Required regression and security tests

Command:

```text
node -r ts-node/register --test src/modules/ai/tools/authorized-read-tools.spec.ts src/modules/ai/tools/task-tools.spec.ts src/modules/ai/ai-security.spec.ts
```

Result: 34 tests passed, 0 failed.

### API build

Command:

```text
npm run build
```

Result: successful exit.

### Diff whitespace check

Command:

```text
git diff --check -- <Task 2 files>
```

Result: clean.

## Limitations and Boundaries

- `DailyRoutineService` has no actor-aware read method. The tool therefore uses its existing `getRoutinesForUser(userId, tenantId)` method only after permission checking and tenant membership validation through `UsersService.findOne`; no direct Prisma access or service authorization change was added.
- `UsersService.findAll` and `TeamsService.findAll` are tenant-scoped but not actor-aware. The tools apply the existing permission check and redact their broad service responses. Narrower domain authorization remains a service-layer concern and was not broadened here.
- The new tools are not added to the runtime registry in this task. Registry/module wiring is deferred to the later approved plan task that owns tool registration; this keeps the Task 2 file scope intact.

## Review Findings Fixed

- Added `DailyRoutineService.getRoutinesForUserAuthorized`, which permits self reads and requires the existing `daily_routine.manage` permission or the `admin` role for another tenant user. `search_routines` delegates to this method and never reads Prisma directly.
- Added service-level nested relation limits for user teams, team members, and calendar attendees. Tool summaries also defensively cap nested names at 50 and redact contact fields.
- Read-name clarification results now contain actionable redacted descriptors: `{ id, name }` for every matching candidate.
- Read argument validation now rejects unknown fields, non-string/blank values, malformed dates, incomplete date ranges, and reversed ranges. Tool schemas declare explicit object properties, types, `additionalProperties: false`, and conditional calendar range requirements.
- Added regressions for cross-user routine denial, tenant-aware mock predicates, nested output caps/redaction, actionable clarifications, malformed arguments, and schema contracts.

## Review-Fix Verification

```text
node -r ts-node/register --test src/modules/ai/tools/authorized-read-tools.spec.ts src/modules/ai/tools/task-tools.spec.ts src/modules/ai/ai-security.spec.ts
```

Result: 38 tests passed, 0 failed.

```text
node -r ts-node/register --test src/modules/daily-routine/daily-routine.service.spec.ts src/modules/events/events.service.spec.ts src/modules/users/users.service.spec.ts src/modules/teams/teams.service.spec.ts
```

Result: 29 tests passed, 0 failed.

```text
npm run build
```

Result: successful exit.
