# Notification Collaboration and Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the phase-1 dispatcher to collaboration, project/team, administrative, and security events without duplicate self-notifications.

**Architecture:** This plan consumes the phase-1 dispatcher and sends each recipient an independent delivery using a stable business occurrence key. Recipient collectors deduplicate tenant-user IDs and remove the actor before dispatching; producer services remain responsible only for discovering business changes and composing domain-specific copy/payload.

**Tech Stack:** NestJS, Prisma/PostgreSQL, React/Next.js, Expo Router, TypeScript, `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-28-notification-system-design.md`

## Global Constraints

- Complete `docs/superpowers/plans/2026-09-28-notification-foundation-operational.md` first.
- Use only `NotificationDispatcher.dispatch`; do not call `NotificationsService.create` or `PushService.sendToUser` from domain producers.
- Exclude the actor from every recipient list and deduplicate recipients before dispatching.
- Entity update occurrence keys use `update:<updatedAt ISO value>`; invitations use the immutable membership/invitation creation timestamp.
- Central entries are always created, even where a category disables push.
- Security login alerts occur only after an interactive credential login succeeds, never during access-token refresh.

---

## File Structure

- Existing task comments/tasks service: collaboration recipients and task-change events.
- Existing events service: invitations, update, and cancellation notifications.
- Existing projects, teams, and users services: membership/ownership/manager and administrative user state events.
- Existing auth service/controller: successful interactive login notification only.
- Existing web notification administration UI: dispatch inspection filters for added categories.

## Task 1: Notify Task Collaboration Events

**Files:**
- Modify: `apps/api/src/modules/tasks/tasks.service.ts`
- Create: `apps/api/src/modules/tasks/tasks.service.spec.ts`

**Interfaces:**
- Produces a private recipient collector returning `string[]` of unique tenant-user IDs excluding `actorTenantUserId`.
- Dispatch types: `task_comment_created`, `task_status_changed`, `task_completed`, `task_reopened`, `task_due_date_changed` in category `COLLABORATION`.

- [ ] **Step 1: Write failing recipient and event tests**

```ts
test('notifies creator and assignees of a comment but never its author', async () => {
  await tasks.addComment('tenant-1', 'task-1', 'author-1', 'Atualização');
  assert.deepEqual(dispatcher.dispatch.mock.calls.map(([input]) => input.tenantUserId).sort(), ['assignee-1', 'creator-1']);
});

test('uses the task update timestamp as the status-change occurrence key', async () => {
  await tasks.update('tenant-1', 'actor-1', 'task-1', { status: 'done' });
  assert.match(dispatcher.dispatch.mock.calls[0][0].occurrenceKey, /^update:/);
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `npm run test:tasks --workspace=apps/api`

Expected: FAIL because collaboration dispatches do not exist.

- [ ] **Step 3: Implement recipient collection and dispatches**

Load the task creator, single assignee, multiple assignees, and actor. Build a `Set`, delete the actor ID, and dispatch each recipient with `{ taskId, projectId, route: '/task/<id>' }`. Emit only when the persisted values actually changed; map completion/reopen from status transitions and emit a specific deadline event only when `dueDate` changes.

- [ ] **Step 4: Run collaboration tests**

Run: `npm run test:tasks --workspace=apps/api`

Expected: PASS.

- [ ] **Step 5: Commit task collaboration**

```bash
git add apps/api/src/modules/tasks
git commit -m "feat(api): notify task collaboration"
```

## Task 2: Notify Calendar Collaboration Events

**Files:**
- Modify: `apps/api/src/modules/events/events.service.ts`
- Modify: `apps/api/src/modules/events/events.service.spec.ts`

**Interfaces:**
- Dispatch types: `event_invited`, `event_updated`, `event_cancelled` in category `COLLABORATION`.
- Payload is `{ eventId, route: '/calendar' }`.

- [ ] **Step 1: Write failing invitation/update/cancellation tests**

```ts
test('notifies only newly added event participants', async () => {
  await events.update('tenant-1', 'actor-1', 'event-1', { participantIds: ['old-1', 'new-1'] });
  assert.deepEqual(dispatcher.dispatch.mock.calls.map(([input]) => input.tenantUserId), ['new-1']);
});

test('notifies existing recipients when an event is cancelled', async () => {
  await events.remove('tenant-1', 'actor-1', 'event-1');
  assert.equal(dispatcher.dispatch.mock.calls[0][0].type, 'event_cancelled');
});
```

- [ ] **Step 2: Run the event tests to verify they fail**

Run: `npm run test:events --workspace=apps/api`

Expected: FAIL because lifecycle notifications do not exist.

- [ ] **Step 3: Compare old and new event membership before writing**

For update, read the existing participant/responsible set before mutation, calculate newly added recipients for invitations, then notify existing participants and responsible user when relevant fields changed. For deletion, load recipients before deleting and use `occurrenceKey: update:<deleted event updatedAt>` so retries remain idempotent.

- [ ] **Step 4: Run calendar tests**

Run: `npm run test:events --workspace=apps/api`

Expected: PASS.

- [ ] **Step 5: Commit calendar collaboration**

```bash
git add apps/api/src/modules/events
git commit -m "feat(api): notify event collaboration"
```

## Task 3: Notify Project and Team Membership Changes

**Files:**
- Modify: `apps/api/src/modules/projects/projects.service.ts`
- Modify: `apps/api/src/modules/teams/teams.service.ts`
- Modify: `apps/api/src/modules/projects/projects.controller.ts`
- Modify: `apps/api/src/modules/teams/teams.controller.ts`
- Create: `apps/api/src/modules/projects/projects.service.spec.ts`
- Create: `apps/api/src/modules/teams/teams.service.spec.ts`

**Interfaces:**
- Dispatch category: `PROJECTS_TEAMS`.
- Dispatch types: `project_member_added`, `team_member_added`, `project_owner_changed`, `team_manager_changed`, `project_updated`.

- [ ] **Step 1: Write failing membership and owner-change tests**

```ts
test('notifies the member who was added to a project', async () => {
  await projects.addMember('tenant-1', 'project-1', 'member-1', 'actor-1');
  assert.equal(dispatcher.dispatch.mock.calls[0][0].tenantUserId, 'member-1');
});

test('does not notify the actor when they become the project owner', async () => {
  await projects.update('tenant-1', 'project-1', { ownerTenantUserId: 'owner-2' }, 'owner-2');
  assert.equal(dispatcher.dispatch.mock.calls.length, 0);
});
```

- [ ] **Step 2: Run project/team tests to verify they fail**

Run: `node -r ts-node/register --test apps/api/src/modules/projects/projects.service.spec.ts apps/api/src/modules/teams/teams.service.spec.ts`

Expected: FAIL because recipient dispatching does not exist.

- [ ] **Step 3: Implement changed-field notifications**

Add an `actorTenantUserId: string | undefined` argument to project/team mutating service methods and pass `@CurrentUser().tenantUserId` from their controllers. Capture old owner, manager, member IDs, and project fields before update. Dispatch direct membership/role changes to only the affected user. For name, description, dates, status, owner, or team changes, notify the resulting owner and current members after removing the actor; use project payload `{ projectId, route: '/project/<id>' }`.

- [ ] **Step 4: Run project/team tests**

Run: `node -r ts-node/register --test apps/api/src/modules/projects/projects.service.spec.ts apps/api/src/modules/teams/teams.service.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit project/team events**

```bash
git add apps/api/src/modules/projects apps/api/src/modules/teams
git commit -m "feat(api): notify project and team changes"
```

## Task 4: Notify Administrative User-State Changes

**Files:**
- Modify: `apps/api/src/modules/users/users.service.ts`
- Create: `apps/api/src/modules/users/users.service.spec.ts`

**Interfaces:**
- Dispatch category: `SECURITY`.
- Dispatch types: `user_invited`, `user_activated`, `user_suspended`, `user_role_changed`.

- [ ] **Step 1: Write failing user-state tests**

```ts
test('notifies an affected user when an administrator changes their role', async () => {
  const actor = { actorUserId: 'admin-user' } as ActorContext;
  await users.assignRole('tenant-1', 'user-1', { roleId: 'manager' }, actor);
  assert.deepEqual(dispatcher.dispatch.mock.calls[0][0], expect.objectContaining({
    tenantUserId: 'user-1', category: 'SECURITY', type: 'user_role_changed',
  }));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node -r ts-node/register --test apps/api/src/modules/users/users.service.spec.ts`

Expected: FAIL because the dispatcher is not injected.

- [ ] **Step 3: Add state-transition dispatches after successful mutations**

Inject the dispatcher, preserve existing audit/token-revocation behavior, and dispatch only after create/update succeeds. Use `entityType: 'tenant-user'`, `entityId: affectedTenantUserId`, and an immutable mutation timestamp occurrence key. Omit delivery if administrator and affected user are the same person.

- [ ] **Step 4: Run user tests**

Run: `node -r ts-node/register --test apps/api/src/modules/users/users.service.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit administrative user alerts**

```bash
git add apps/api/src/modules/users
git commit -m "feat(api): notify user state changes"
```

## Task 5: Notify Interactive Login and Password Changes

**Files:**
- Modify: `apps/api/src/modules/auth/auth.service.ts`
- Modify: `apps/api/src/modules/auth/auth.service.spec.ts`
- Modify: `apps/api/src/modules/users/users.service.ts`
- Modify: `apps/api/src/modules/users/users.service.spec.ts`

**Interfaces:**
- Dispatch types: `security_login` and `security_password_changed` in category `SECURITY`.
- `AuthService.refresh(...)` must never invoke the dispatcher.

- [ ] **Step 1: Write a failing interactive-login versus refresh test**

```ts
test('dispatches a security notice after credential login but not token refresh', async () => {
  await auth.login({ email: 'user@example.com', password: 'secret' });
  assert.equal(dispatcher.dispatch.mock.calls[0][0].type, 'security_login');
  dispatcher.dispatch.mockClear();
  await auth.refresh('refresh-token');
  assert.equal(dispatcher.dispatch.mock.calls.length, 0);
});
```

- [ ] **Step 2: Run auth tests to verify they fail**

Run: `npm run test:auth --workspace=apps/api`

Expected: FAIL because the login alert is absent.

- [ ] **Step 3: Dispatch after successful credential verification only**

Inject `NotificationDispatcher` into `AuthService`; in `login`, select the tenant user, await `issueTenantSession`, then dispatch with payload `{ route: '/notifications' }` before returning the session. Do not add a call in `refreshToken`, `selectTenant`, session restoration, or token validation paths. Dispatch password notification after the password write completes in `UsersService.changeMyPassword`.

- [ ] **Step 4: Run security tests**

Run: `npm run test:auth --workspace=apps/api && node -r ts-node/register --test apps/api/src/modules/users/users.service.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit security delivery**

```bash
git add apps/api/src/modules/auth apps/api/src/modules/users
git commit -m "feat(api): notify security events"
```

## Task 6: Complete Administration Diagnostics and Phase-2 Verification

**Files:**
- Modify: `apps/web/src/app/(app)/settings/notifications/page.tsx`
- Modify: `apps/web/src/types/notification.ts`
- Modify: `apps/api/src/modules/notifications/notification-preferences.service.spec.ts`

- [ ] **Step 1: Write a failing dispatch-filter service test**

```ts
test('passes category and failed status filters to dispatch diagnostics', async () => {
  await service.listDispatches('tenant-1', { category: 'SECURITY', pushStatus: 'FAILED' });
  assert.deepEqual(prisma.notificationDispatch.findMany.mock.calls[0][0].where, {
    tenantId: 'tenant-1', category: 'SECURITY', pushStatus: 'FAILED',
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm run test:notifications --workspace=apps/api`

Expected: FAIL until filtered dispatch diagnostics exist.

- [ ] **Step 3: Add dispatch diagnostics to the existing admin screen**

Use `GET /admin/notification-dispatches` to show category, type, status, timestamp, and safe failure reason. Support category/status/user filters, but never render Expo token or ticket values. Keep preference history and dispatch diagnostics visually separate.

- [ ] **Step 4: Run complete verification**

Run: `npm run test:notifications:all --workspace=apps/api && npm run test:auth --workspace=apps/api && npx tsc --noEmit -p apps/api/tsconfig.json && npx tsc --noEmit -p apps/web/tsconfig.json && npx tsc --noEmit -p apps/mobile/tsconfig.json`

Expected: PASS.

- [ ] **Step 5: Manually verify all recipient rules**

Verify a staging tenant for: actor exclusion, multi-assignee comment fan-out, new-event-participant-only invitation, cancellation notifications, project/team membership, owner/manager changes, role change, password change, credential login, and refresh silence. Confirm each disabled category still appears in the Central and that repeated mutation/job attempts preserve one dispatch per occurrence key.

- [ ] **Step 6: Commit final coverage**

```bash
git add apps/api apps/web apps/mobile
git commit -m "test: verify notification coverage"
```
