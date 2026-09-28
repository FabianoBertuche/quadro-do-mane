# Notification Foundation and Operational Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a durable notification dispatcher, user/admin push preferences, automatic operational alerts, Expo receipt handling, and mobile configuration required for reliable notifications.

**Architecture:** Domain services call one `NotificationDispatcher`, which atomically writes the idempotency ledger and the existing in-app `Notification`; it only attempts Expo push after that transaction. A Nest scheduler runs every five minutes in `America/Sao_Paulo`, delegates candidate selection to domain services, and relies on the unique ledger key to make execution safe across restarts and replicas.

**Tech Stack:** NestJS, Prisma/PostgreSQL, `@nestjs/schedule`, Expo Push SDK, React/Next.js, Expo Router, TanStack Query, TypeScript, `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-28-notification-system-design.md`

## Global Constraints

- Change only `apps/api/prisma/schema.prisma`; the root `schema.prisma` is not the API migration source.
- Every eligible event creates an in-app Central entry; category preference controls only push.
- Categories are exactly `TASKS`, `CALENDAR`, `ROUTINE`, `COLLABORATION`, `PROJECTS_TEAMS`, and `SECURITY`.
- A locked preference returns HTTP 409 for self-service changes and is displayed as `Gerenciada pela empresa`.
- Dispatcher deduplication key is exactly `(tenantUserId, type, entityId, occurrenceKey)`.
- Scheduler runs every five minutes with timezone `America/Sao_Paulo`; daily task alerts occur at 08:00 local time.
- Push errors never roll back the business operation or Central entry; logs must not include Expo tokens.
- Expo token registration passes an explicit EAS `projectId`; production EAS defines `EXPO_PUBLIC_API_URL=https://montemoria.com/api`.

---

## File Structure

- `apps/api/prisma/schema.prisma` and a new migration: notification enums, preferences/audit, dispatch ledger, and per-device Expo receipts.
- `apps/api/src/modules/notifications/notification-dispatcher.service.ts`: transaction, idempotency, Central persistence, preference resolution, and push orchestration.
- `apps/api/src/modules/notifications/notification-preferences.service.ts`: default/effective preference policy and immutable preference audit.
- `apps/api/src/modules/notifications/notification-scheduler.service.ts`: five-minute orchestration only; domain-specific candidate queries remain in their services.
- `apps/api/src/modules/push/expo-receipts.service.ts`: ticket receipt polling and invalid-device removal.
- Existing Events, Tasks, and DailyRoutine services: candidate queries and replacement of direct push calls.
- Existing notifications/admin controllers plus `apps/web/src/app/(app)/settings/notifications/page.tsx`: self-service and administrative APIs/UI.
- `apps/mobile/src/lib/notification-navigation.ts`: one validated payload-to-route mapping shared by the Central and push response handlers.

## Task 1: Persist Notification Policy and Delivery State

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260928190000_add_notification_delivery/migration.sql`
- Modify: `apps/api/package.json`
- Test: `apps/api/src/modules/notifications/notification-preferences.service.spec.ts`

**Interfaces:**
- Produces Prisma enums `NotificationCategory`, `NotificationPreferenceSource`, `NotificationPushStatus` and models `NotificationPreference`, `NotificationPreferenceAudit`, `NotificationDispatch`, `NotificationPushReceipt`.
- Produces `NotificationPreference` unique key `@@unique([tenantUserId, category])` and dispatch unique key `@@unique([tenantUserId, type, entityId, occurrenceKey])`.

- [ ] **Step 1: Write the failing preference-default test**

```ts
test('returns enabled defaults for every category when no row exists', async () => {
  const service = new NotificationPreferencesService(prisma as any);
  assert.deepEqual(await service.listForUser('tenant-1', 'user-1'), [
    { category: 'TASKS', pushEnabled: true, lockedByAdmin: false },
    { category: 'CALENDAR', pushEnabled: true, lockedByAdmin: false },
    { category: 'ROUTINE', pushEnabled: true, lockedByAdmin: false },
    { category: 'COLLABORATION', pushEnabled: true, lockedByAdmin: false },
    { category: 'PROJECTS_TEAMS', pushEnabled: true, lockedByAdmin: false },
    { category: 'SECURITY', pushEnabled: true, lockedByAdmin: false },
  ]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:notifications --workspace=apps/api`

Expected: FAIL because `NotificationPreferencesService` does not exist.

- [ ] **Step 3: Add the Prisma schema and migration**

Add the enums and models with these required fields:

```prisma
model NotificationDispatch {
  id            String                 @id @default(uuid())
  tenantId      String
  tenantUserId  String
  category      NotificationCategory
  type          String
  entityType    String
  entityId      String
  occurrenceKey String
  notificationId String?               @unique
  pushStatus    NotificationPushStatus @default(PENDING)
  failureReason String?
  createdAt     DateTime               @default(now())
  sentAt        DateTime?
  @@unique([tenantUserId, type, entityId, occurrenceKey])
  @@index([tenantId, pushStatus])
}
```

Add relations on `Tenant`, `TenantUser`, `Notification`, and `PushDevice`; add `NotificationPushReceipt` with `dispatchId`, `pushDeviceId`, `expoTicketId`, `status`, `errorCode`, and `checkedAt`. Generate SQL with `npx prisma migrate dev --name add_notification_delivery --schema prisma/schema.prisma`, then inspect the generated migration before retaining it. Add `@nestjs/schedule` to `apps/api/package.json`.

- [ ] **Step 4: Generate Prisma Client and type-check the API**

Run: `npx prisma generate --schema apps/api/prisma/schema.prisma && npx tsc --noEmit -p apps/api/tsconfig.json`

Expected: PASS.

- [ ] **Step 5: Commit the persistence foundation**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations apps/api/package.json package-lock.json
git commit -m "feat(api): add notification delivery ledger"
```

## Task 2: Implement Preferences, Audit, and the Central Dispatcher

**Files:**
- Create: `apps/api/src/modules/notifications/notification-preferences.service.ts`
- Create: `apps/api/src/modules/notifications/notification-dispatcher.service.ts`
- Create: `apps/api/src/modules/notifications/notification-dispatcher.service.spec.ts`
- Modify: `apps/api/src/modules/notifications/notifications.module.ts`
- Modify: `apps/api/src/modules/notifications/notifications.service.ts`
- Modify: `apps/api/package.json`
- Test: `apps/api/src/modules/notifications/notification-preferences.service.spec.ts`

**Interfaces:**
- Consumes the Prisma models from Task 1 and `PushService.sendToUser` from Task 3.
- Produces:

```ts
type DispatchInput = {
  tenantId: string; tenantUserId: string; category: NotificationCategory;
  type: string; title: string; message: string; payload?: Record<string, unknown>;
  entityType: string; entityId: string; occurrenceKey: string;
};
dispatch(input: DispatchInput): Promise<NotificationDispatch>;
```

- [ ] **Step 1: Add tests for lock policy and transactional deduplication**

```ts
test('rejects a self-service update when the category is locked', async () => {
  prisma.notificationPreference.findUnique.mockResolvedValue({ lockedByAdmin: true });
  await assert.rejects(
    () => preferences.updateByUser('tenant-1', 'user-1', 'TASKS', false),
    { status: 409 },
  );
});

test('returns the existing delivery without creating a second Central entry', async () => {
  prisma.$transaction.mockRejectedValue({ code: 'P2002' });
  prisma.notificationDispatch.findUnique.mockResolvedValue({ id: 'dispatch-1' });
  assert.equal((await dispatcher.dispatch(input)).id, 'dispatch-1');
  assert.equal(push.sendToUser.mock.calls.length, 0);
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `node -r ts-node/register --test apps/api/src/modules/notifications/notification-*.spec.ts`

Expected: FAIL because services and test script are absent.

- [ ] **Step 3: Implement preference policy and audit**

Define the six-category constant once in `notification-preferences.service.ts`. `listForUser` merges stored rows with enabled/unlocked defaults. `updateByUser` rejects `lockedByAdmin`, upserts the value, and creates `NotificationPreferenceAudit` with source `USER`. `updateByAdmin` upserts `pushEnabled` plus lock, records source `ADMIN`, and retains the admin-set state after later unlock. Correct `NotificationsService.markAsRead` to query by `{ id, tenantId, tenantUserId }` before updating.

- [ ] **Step 4: Implement the dispatcher transaction and post-commit push**

Within `prisma.$transaction`, create the dispatch and `Notification` with `payloadJson: JSON.stringify(input.payload ?? {})`, then connect the dispatch. Catch Prisma `P2002` and return the existing dispatch. After the transaction, resolve the effective preference; when disabled, update status to `SKIPPED`; otherwise call `PushService.sendToUser`, persist each ticket receipt, and mark `SENT` or `FAILED`. Catch all push failures and persist only a safe error message.

- [ ] **Step 5: Run notification unit tests**

Run: `npm run test:notifications --workspace=apps/api`

Expected: PASS, including default, lock, audit, idempotency, disabled push, and push-failure cases.

- [ ] **Step 6: Commit dispatcher and preference policy**

```bash
git add apps/api/src/modules/notifications apps/api/package.json
git commit -m "feat(api): centralize notification delivery"
```

## Task 3: Persist Expo Tickets and Process Receipts

**Files:**
- Modify: `apps/api/src/modules/push/push.service.ts`
- Create: `apps/api/src/modules/push/expo-receipts.service.ts`
- Create: `apps/api/src/modules/push/push.service.spec.ts`
- Create: `apps/api/src/modules/push/expo-receipts.service.spec.ts`
- Modify: `apps/api/src/modules/push/push.module.ts`
- Modify: `apps/api/package.json`

**Interfaces:**
- `PushService.sendToUser(tenantUserId, message)` returns `Promise<Array<{ pushDeviceId: string; expoTicketId: string }>>`.
- `ExpoReceiptsService.processPending(): Promise<{ checked: number; devicesRemoved: number; failed: number }>`.

- [ ] **Step 1: Write failing ticket and invalid-device tests**

```ts
test('associates every Expo ticket with its PushDevice', async () => {
  const tickets = await service.sendToUser('user-1', { title: 'Título' });
  assert.deepEqual(tickets, [{ pushDeviceId: 'device-1', expoTicketId: 'ticket-1' }]);
});

test('removes only the device reported as DeviceNotRegistered', async () => {
  await receipts.processPending();
  assert.deepEqual(prisma.pushDevice.delete.mock.calls[0][0], { where: { id: 'device-1' } });
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `npm run test:push --workspace=apps/api`

Expected: FAIL because ticket return values and receipt processor do not exist.

- [ ] **Step 3: Return safe ticket metadata from PushService**

Keep Expo chunking. Pair each accepted Expo ticket with the originating `PushDevice.id`; never return or log the token. A chunk-level failure returns an empty result for that chunk and is logged with tenant-user/device IDs only.

- [ ] **Step 4: Implement receipt polling**

Load receipts with `status = 'PENDING'`, query Expo in chunks, update receipt status and `checkedAt`, delete the exact `PushDevice` on `DeviceNotRegistered`, and update the parent dispatch to `FAILED` if every receipt fails. Export `ExpoReceiptsService` from `PushModule`.

- [ ] **Step 5: Run the push test suite**

Run: `npm run test:push --workspace=apps/api`

Expected: PASS.

- [ ] **Step 6: Commit receipt handling**

```bash
git add apps/api/src/modules/push apps/api/package.json
git commit -m "feat(api): process Expo push receipts"
```

## Task 4: Add Scheduler and Calendar Delivery

**Files:**
- Modify: `apps/api/src/app.module.ts`
- Create: `apps/api/src/modules/notifications/notification-scheduler.service.ts`
- Create: `apps/api/src/modules/notifications/notification-scheduler.service.spec.ts`
- Modify: `apps/api/src/modules/events/events.service.ts`
- Modify: `apps/api/src/modules/events/events.service.spec.ts`
- Modify: `apps/api/src/modules/admin/send-event-reminders.controller.ts`

**Interfaces:**
- `NotificationSchedulerService.run(now = new Date()): Promise<void>` is callable by tests and decorated with `@Cron(CronExpression.EVERY_5_MINUTES, { timeZone: 'America/Sao_Paulo' })`.
- `EventsService.sendDailyReminderPushes(now)` dispatches `CALENDAR` deliveries rather than calling PushService directly.

- [ ] **Step 1: Write the failing scheduler and event idempotency tests**

```ts
test('runs all notification work from one five-minute scheduler tick', async () => {
  await scheduler.run(new Date('2026-09-28T11:00:00.000Z'));
  assert.equal(events.sendDailyReminderPushes.mock.calls.length, 1);
  assert.equal(receipts.processPending.mock.calls.length, 1);
});

test('creates a calendar Central entry through the dispatcher', async () => {
  await service.sendDailyReminderPushes(new Date('2026-09-28T11:00:00.000Z'));
  assert.equal(dispatcher.dispatch.mock.calls[0][0].category, 'CALENDAR');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:notifications:all --workspace=apps/api`

Expected: FAIL because scheduler and dispatcher integration do not exist.

- [ ] **Step 3: Wire ScheduleModule and scheduler**

Add `ScheduleModule.forRoot()` in `AppModule`. Inject Events, Tasks, DailyRoutine, and ExpoReceipts services into the scheduler and make `run` call all five work units. Catch/log each work unit separately so one category cannot prevent receipt processing.

- [ ] **Step 4: Replace calendar direct push with dispatches**

Preserve `EventReminderAction` as the event-specific daily selection guard, but pass each recipient through `NotificationDispatcher.dispatch` using `entityType: 'event'`, `entityId: event.id`, and `occurrenceKey: YYYY-MM-DD`. Include `{ eventId: event.id, route: '/calendar' }` payload. Keep `POST /admin/send-event-reminders` as a protected manual fallback to this same method.

- [ ] **Step 5: Run calendar and scheduler tests**

Run: `npm run test:notifications:all --workspace=apps/api`

Expected: PASS.

- [ ] **Step 6: Commit automatic calendar alerts**

```bash
git add apps/api/src/app.module.ts apps/api/src/modules/events apps/api/src/modules/notifications apps/api/src/modules/admin
git commit -m "feat(api): schedule calendar notifications"
```

## Task 5: Deliver Task and Routine Operational Alerts

**Files:**
- Modify: `apps/api/src/modules/tasks/tasks.service.ts`
- Create: `apps/api/src/modules/tasks/tasks.service.spec.ts`
- Modify: `apps/api/src/modules/daily-routine/daily-routine.service.ts`
- Create: `apps/api/src/modules/daily-routine/daily-routine.service.spec.ts`
- Modify: `apps/api/src/modules/notifications/notification-scheduler.service.ts`

**Interfaces:**
- `TasksService.sendScheduledNotifications(now): Promise<void>` sends one-day-before and overdue candidates.
- `DailyRoutineService.sendScheduledNotifications(now): Promise<void>` sends scheduled and 30-minute-pending candidates.

- [ ] **Step 1: Write failing candidate-window tests**

```ts
test('alerts an overdue task once per Sao Paulo day', async () => {
  await tasks.sendScheduledNotifications(new Date('2026-09-28T11:00:00.000Z'));
  assert.deepEqual(dispatcher.dispatch.mock.calls[0][0], {
    category: 'TASKS', type: 'task_overdue', entityType: 'task',
    entityId: 'task-1', occurrenceKey: '2026-09-28', tenantId: 'tenant-1', tenantUserId: 'user-1',
    title: 'Tarefa atrasada', message: '...', payload: { taskId: 'task-1', route: '/task/task-1' },
  });
});

test('sends the routine pending reminder only 30 minutes after scheduledTime', async () => {
  await routines.sendScheduledNotifications(new Date('2026-09-28T11:30:00.000Z'));
  assert.equal(dispatcher.dispatch.mock.calls[0][0].occurrenceKey, 'pending:11:00:2026-09-28');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:tasks --workspace=apps/api && npm run test:routines --workspace=apps/api`

Expected: FAIL because scheduled methods do not exist.

- [ ] **Step 3: Replace assignment pushes and add task candidate queries**

Inject `NotificationDispatcher` into `TasksService`. Replace assignment/reassignment `notification.create` plus `push.sendToUser` blocks with a `TASKS` dispatch using `occurrenceKey: assignment:<task.updatedAt.toISOString()>` and `{ taskId, projectId, route }` payload. Add two queries excluding archived/done tasks: due exactly one local day ahead at 08:00, and due before local day start at 08:00. Exclude the actor where an actor exists.

- [ ] **Step 4: Add routine local-time candidates**

Use `America/Sao_Paulo` date/time calculation rather than `toISOString().split('T')[0]` for scheduler candidates. Select active items with `scheduledTime`, omit completed `DailyRoutineLog`s, and dispatch `routine_scheduled` at the configured minute and `routine_pending` exactly 30 minutes later using the required occurrence keys.

- [ ] **Step 5: Invoke both services from the scheduler and run tests**

Run: `npm run test:notifications:all --workspace=apps/api`

Expected: PASS for assignment, upcoming, overdue, scheduled routine, and pending routine cases.

- [ ] **Step 6: Commit operational notification coverage**

```bash
git add apps/api/src/modules/tasks apps/api/src/modules/daily-routine apps/api/src/modules/notifications
git commit -m "feat(api): notify task deadlines and routines"
```

## Task 6: Expose Preference and Dispatch Administration APIs

**Files:**
- Create: `apps/api/src/modules/notifications/dto/update-notification-preference.dto.ts`
- Create: `apps/api/src/modules/notifications/dto/update-admin-notification-preference.dto.ts`
- Create: `apps/api/src/modules/admin/notification-admin.controller.ts`
- Modify: `apps/api/src/modules/notifications/notifications.controller.ts`
- Modify: `apps/api/src/modules/admin/admin.module.ts`
- Test: `apps/api/src/modules/notifications/notification-preferences.service.spec.ts`

**Interfaces:**
- User APIs: `GET /notification-preferences`, `PATCH /notification-preferences/:category`.
- Admin APIs: `GET /admin/notification-preferences`, `PATCH /admin/notification-preferences/:tenantUserId/:category`, `GET /admin/notification-preferences/:tenantUserId/history`, `GET /admin/notification-dispatches`.

- [ ] **Step 1: Add failing controller/service assertions**

```ts
test('admin update records source ADMIN and lock state', async () => {
  await service.updateByAdmin('tenant-1', 'admin-1', 'user-1', 'TASKS', false, true);
  assert.equal(prisma.notificationPreferenceAudit.create.mock.calls[0][0].data.source, 'ADMIN');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:notifications --workspace=apps/api`

Expected: FAIL until the administrative update exists.

- [ ] **Step 3: Add guarded DTO-backed endpoints**

Use the existing JWT, tenant-context, and permission guard pattern. Require `notifications.view` for self-service reads and `notifications.manage` for all admin routes. Validate category with the Prisma enum. Return 409 from the self-service endpoint when locked. Filter dispatches by category/status/tenant user without exposing token data.

- [ ] **Step 4: Run notification tests and API type-check**

Run: `npm run test:notifications --workspace=apps/api && npx tsc --noEmit -p apps/api/tsconfig.json`

Expected: PASS.

- [ ] **Step 5: Commit notification APIs**

```bash
git add apps/api/src/modules/notifications apps/api/src/modules/admin
git commit -m "feat(api): manage notification preferences"
```

## Task 7: Build Preference Interfaces and Reliable Mobile Routing

**Files:**
- Modify: `apps/web/src/app/(app)/settings/page.tsx`
- Create: `apps/web/src/app/(app)/settings/notifications/page.tsx`
- Create: `apps/web/src/types/notification.ts`
- Modify: `apps/mobile/src/app/(tabs)/more.tsx`
- Create: `apps/mobile/src/app/notification-preferences.tsx`
- Modify: `apps/mobile/src/app/notifications.tsx`
- Modify: `apps/mobile/src/lib/types.ts`
- Create: `apps/mobile/src/lib/notification-navigation.ts`
- Modify: `apps/mobile/src/lib/push.ts`
- Modify: `apps/mobile/src/app/_layout.tsx`
- Modify: `apps/mobile/eas.json`
- Test: `apps/mobile/src/lib/notification-navigation.spec.ts`

**Interfaces:**
- `resolveNotificationRoute(payload: unknown): string | null` accepts only `/task/<id>`, `/project/<id>`, and `/calendar`.
- Web preference type: `{ category, pushEnabled, lockedByAdmin }`.

- [ ] **Step 1: Write a failing mobile payload-route test**

```ts
test('maps an accepted task payload to its Expo Router route', () => {
  assert.equal(resolveNotificationRoute({ taskId: 'task-1' }), '/task/task-1');
});

test('rejects an arbitrary route from notification payload', () => {
  assert.equal(resolveNotificationRoute({ route: 'https://example.com' }), null);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run apps/mobile/src/lib/notification-navigation.spec.ts`

Expected: FAIL because the resolver does not exist.

- [ ] **Step 3: Implement web self-service and admin settings**

Replace static settings checkboxes with TanStack Query `GET /notification-preferences` and mutation invalidation. Disable locked controls and render `Gerenciada pela empresa`. Create the nested admin page with user/category/state filters, remote enabled/lock controls, and a history panel backed by the four admin APIs; follow the collaborators page permission/feedback patterns.

- [ ] **Step 4: Implement mobile preference and Central navigation**

Add `payloadJson` to `AppNotification`; parse it through `resolveNotificationRoute`. On Central item press, mark it read then `router.push(route)` only when a valid route exists. Create and register `notification-preferences.tsx`, then link it from Mais; the screen shows lock state and 409 feedback.

- [ ] **Step 5: Make Expo registration and response routing deterministic**

Pass `Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId` to `getExpoPushTokenAsync({ projectId })`. Register response and cold-start handlers only after a session/tenant exists, use the shared route resolver, and re-register after tenant user changes. Add the production `EXPO_PUBLIC_API_URL` environment value matching preview.

- [ ] **Step 6: Run mobile tests and static validation**

Run: `npx vitest run apps/mobile/src/lib/notification-navigation.spec.ts && npx tsc --noEmit -p apps/mobile/tsconfig.json && npx expo config --type public --config apps/mobile/app.config.js`

Expected: PASS.

- [ ] **Step 7: Commit client notification controls**

```bash
git add apps/web/src apps/mobile/src apps/mobile/eas.json
git commit -m "feat(clients): manage and open notifications"
```

## Task 8: Validate the Phase-1 Delivery

**Files:**
- Modify if needed: affected test files only.

- [ ] **Step 1: Apply migration to a disposable database and inspect tables**

Run: `npx prisma migrate deploy --schema apps/api/prisma/schema.prisma && npx prisma validate --schema apps/api/prisma/schema.prisma`

Expected: migration applies and schema validates.

- [ ] **Step 2: Run all focused automated checks**

Run: `npm run test:notifications:all --workspace=apps/api && npx tsc --noEmit -p apps/api/tsconfig.json && npx tsc --noEmit -p apps/mobile/tsconfig.json`

Expected: PASS.

- [ ] **Step 3: Perform manual acceptance checks**

Verify in a staging tenant: locked category returns 409 and disabled push still creates a Central item; execute scheduler twice with the same `now` and observe one dispatch; send an invalid-device receipt and observe only that device removed; verify event, routine, due-tomorrow, and overdue notifications navigate to the valid route on Android.

- [ ] **Step 4: Commit any verification-only fixes**

```bash
git add apps/api apps/mobile apps/web
git commit -m "test: verify notification foundation"
```
