# Task 4 Report

## Scope

Implemented the four authorized assistant action tools described by Task 4:

- `create_calendar_event`
- `create_routine`
- `add_team_member`
- `add_project_member`

The tools are registered in `AiModule` alongside the existing task tools. `EventsModule`,
`DailyRoutineModule`, and `TeamsModule` are imported so Nest resolves the concrete domain
services used by the new providers. Existing task registrations were retained.

## Authorization and boundaries

- Every tool calls the shared `requirePermission` helper with the existing permission code:
  `calendar.create`, `daily_routine.manage`, `teams.manage_members`, or
  `projects.manage_members`.
- User, project, team, and participant references are resolved through tenant-scoped
  domain service methods. Cross-tenant IDs are rejected before delegation.
- Name resolution is exact and ambiguous names return the existing strict clarification
  contract: `{ needsClarification: true, field, matches: [{ id, name }] }`.
- Missing event dates, participants, routine assignees, teams, projects, or membership
  targets return structured clarification and do not create a proposal through the tool.
- Calendar timestamps require an explicit timezone or `Z`; routines require an explicit
  `HH:mm` schedule. The tools do not infer a timezone or silently choose a participant.
- Argument schemas use `additionalProperties: false` and contain only fields accepted by
  their underlying domain DTOs plus explicit assistant resolution fields.

## Delegation and side effects

- Calendar creation delegates to `EventsService.create(tenantId, actorTenantUserId, dto)`.
- Routine creation delegates to `DailyRoutineService.create(dto, actorContext)` with the
  tenant and actor identity preserved.
- Team membership delegates to `TeamsService.addMember(tenantId, teamId, userId, actor)`.
- Project membership delegates to `ProjectsService.addMember(tenantId, projectId, userId,
  role, actor)`.

No tool imports Prisma or writes database tables directly. Existing domain activity,
audit, and notification behavior therefore remains the execution path.

## Tests

`domain-action-tools.spec.ts` covers:

- Permission denial.
- Missing date, participant, routine assignee, and membership target clarification.
- Cross-tenant collaborator rejection.
- Duplicate collaborator-name clarification.
- Successful delegation with tenant and actor identity preserved.

The focused test was first run red because the four production modules did not exist. It
was then run green with 8 passing tests. Final verification also included the API build,
the existing AI module tests, the existing AI tool tests, and `git diff --check`.

## Verification commands

```text
node -r ts-node/register --test src/modules/ai/tools/domain-action-tools.spec.ts
npm run build
node -r ts-node/register --test src/modules/ai/ai.module.spec.ts
node -r ts-node/register --test src/modules/ai/tools/task-tools.spec.ts src/modules/ai/tools/authorized-read-tools.spec.ts
git diff --check
```

All commands completed successfully at the final verification point.

## Intended files

- `apps/api/src/modules/ai/tools/create-calendar-event.tool.ts`
- `apps/api/src/modules/ai/tools/create-routine.tool.ts`
- `apps/api/src/modules/ai/tools/add-team-member.tool.ts`
- `apps/api/src/modules/ai/tools/add-project-member.tool.ts`
- `apps/api/src/modules/ai/tools/domain-action-tools.spec.ts`
- `apps/api/src/modules/ai/tools/task-tool.schemas.ts`
- `apps/api/src/modules/ai/ai.module.ts`
- `.superpowers/sdd/2026-10-01-ai-authorized-system-context/task-4-report.md`

Unrelated worktree changes were not modified or staged.
