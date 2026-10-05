# API Contract: Client Foundation Security

## Canonical source and version

**Canonical source**: Nest Swagger/OpenAPI generated from controllers and DTOs, served at the proposed `GET /api/openapi.json`. This is a proposed change to `apps/api/src/main.ts`; it does not claim the endpoint exists today.  
**Contract version**: `1.1.0` (`info.version` and `x-client-contract-version`).  
**Repository snapshot and fixtures**: proposed files `apps/api/contracts/openapi/client-foundation-security.v1.1.0.json` and `apps/api/contracts/fixtures/client-foundation-security.v1.1.0.json` are generated/validated against the running document. Web, Expo and the offline `schemaVersion` consume `1.1.0`.

The OpenAPI document is authoritative for JSON schemas; this README is the required human-readable operation, authorization and FR traceability matrix. Any DTO/controller change that modifies a listed request or response must increment the compatible contract version and regenerate both files.

## Transport and common schemas

- Base URL: `/api`; session establishes `AuthorizationContext`. Business requests never use a client-supplied `tenantId` as authority.
- All timestamp fields are ISO 8601 instants. `DailyRoutineLog.date` is `YYYY-MM-DD` in `America/Sao_Paulo`.
- A successful single-resource response is its OpenAPI schema (`Task`, `Project`, `Event`, `DailyRoutineItem`, `Notification`, `Attachment`, or action result). A list response is `items` plus `page` only after the listed pagination change is implemented; legacy array-only responses are migrated atomically with client adapters.

```ts
type Page = { page: number; pageSize: number; total: number };

type ErrorResponse = {
  contractVersion: '1.1.0';
  status: 400 | 401 | 403 | 404 | 409 | 422 | 500 | 502 | 503 | 504;
  code:
    | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION'
    | 'CONFLICT' | 'TRANSIENT' | 'OFFLINE';
  message: string;
  fieldErrors?: Array<{ field: string; message: string }>;
  requestId: string;
};

type ApiResult<T> =
  | { ok: true; data: T; source: 'network' | 'cache'; stale: boolean; lastUpdatedAt?: string; schemaVersion: '1.1.0' }
  | { ok: false; error: ErrorResponse; retryable: boolean };
```

`ErrorResponse` is the proposed normalized Nest exception output. DTO validation maps to `VALIDATION`/422, missing session to 401, failed permission/visibility to 403, absent in-scope resource to 404, and duplicate routine completion to 409. A 403 contains no protected resource metadata.

## Uniform client policy

| Trigger | Result | Session action | Original operation action |
|---|---|---|---|
| 401 for `GET` or `HEAD` | `UNAUTHENTICATED` until recovery | Normalize Axios `config.method` with `String(method ?? 'GET').toUpperCase()`, then coordinate at most one refresh per original request | Replay exactly once only after refresh succeeds **only when normalized method is `GET` or `HEAD`**. |
| 401 for `POST`, `PATCH`, `PUT`, `DELETE`, multipart upload | `UNAUTHENTICATED` | Coordinate at most one refresh | **Never replay**; surface “send again” control that requires new user intent. |
| 403 | `FORBIDDEN` | Preserve session; no refresh | Never replay. |
| network/timeout/5xx on `GET`/`HEAD` | `TRANSIENT` | No refresh unless actual 401 | Offer explicit user retry only. |
| network/timeout/5xx on mutation | `TRANSIENT` | No automatic retry | Require new user intent. |
| offline read | cached `ApiResult` or `OFFLINE` | N/A | Read only cached same-scope entry. |
| offline mutation/upload | `OFFLINE` | N/A | Block before Axios/transport; no optimistic change or queue. |

## Request filters and pagination

This is the **target `1.1.0` contract after T008**. It is not a claim that these filters, page envelope or parameters are live in the current API. Until T008 and its OpenAPI fixture validation complete, clients use only the currently documented endpoint parameters and current response shape.

| Collection | Query schema | Default / limits | Contract response |
|---|---|---|---|
| `GET /tasks` | Current `FilterTasksDto`: `projectId`, `statusId`, `priorityId`, `assigneeTenantUserId`, `teamId`, `search`, `overdue`, `completed`, `myTasks`, `blocked`; plus proposed `page`, `pageSize` | `page=1`; `pageSize=50`, maximum 100 | `TaskListResponse { items: Task[], page: Page }` |
| `GET /projects` | Proposed `status`, `ownerTenantUserId`, `teamId`, `search`, `page`, `pageSize` | `page=1`; `pageSize=50`, maximum 100 | `ProjectListResponse { items: Project[], page: Page }` |
| `GET /events` | Existing `startDate`, `endDate`, `tenantUserId`; plus proposed `page`, `pageSize` | bounded start/end range; `pageSize=50`, maximum 100 | `EventListResponse { items: Event[], page: Page }` |
| `GET /daily-routine/admin/logs` | Existing `userId`, `routineItemId`, `startDate`, `endDate`; plus proposed `page`, `pageSize` | dates use `America/Sao_Paulo`; `pageSize=50`, maximum 100 | `RoutineLogListResponse { items: DailyRoutineLog[], page: Page, efficiency }` |
| `GET /notifications` | Proposed `unread`, `before`, `page`, `pageSize` | `pageSize=50`, maximum 100 | `NotificationListResponse { items: Notification[], page: Page }` |

T005 establishes shared schemas, T006 publishes the base OpenAPI route, T007 implements DTOs/controllers/services for filters and page envelopes and regenerates the snapshot, T008 validates the final fixtures, and T023/T024 adapt Web/Expo clients. Clients must not send a target-only query field or parse a page envelope before T007, T008 and the corresponding client task have completed.

## Authorization matrix

All rows require active `AuthorizationContext` and the listed permission. `Same tenant` means every target and relationship predicate includes actor `tenantId`. **Admin exception**: an actor whose active role is `admin` or `gestor` may use only a row marked `Broad tenant visibility`; it still must have the listed permission and never bypasses the guard or tenant predicate. `PermissionGuard` must not contain a global `roleName === 'admin'` allow path.

| Operation | Permission | Visibility / ownership predicate | Admin exception |
|---|---|---|---|
| Task list/statuses/priorities/tags | `tasks.view` | Same tenant; non-broad actors see task/project metadata only when owner, project member, team member, assignee or reporter per resource policy | Broad tenant visibility for list/reference metadata only. |
| Task detail/comments | `tasks.view` | Same tenant and same task visibility predicate | Broad tenant visibility. |
| Create task | `tasks.create` | Same-tenant project; referenced status, priority, team, assignee, reporter and assignees are active in tenant; actor may create only in visible project | None beyond normal project visibility. |
| Update/delete/move/status/priority task | matching `tasks.edit`, `tasks.delete`, `tasks.move`, `tasks.change_status`, `tasks.change_priority` | Target visible in same tenant; all new relationships same tenant | Broad tenant visibility only; no cross-tenant relation. |
| Add/delete task comment; checklist/create/add/toggle; delete attachment | `tasks.comment`, `tasks.checklist_manage`, `tasks.edit` | Parent task/checklist/comment/attachment visible and same tenant; comment author rule remains enforced by service | Broad tenant visibility does not override author-specific delete rule. |
| Upload task attachment | `tasks.edit` | Task visible and same tenant; uploader is active actor; validate before bytes and `Attachment` write | Broad tenant visibility after `tasks.edit`; still same tenant. |
| Project list/detail | `projects.view` | Same tenant; non-broad actor is owner, project member, team member or has an assigned active task | Broad tenant visibility. |
| Create/update/archive project | matching `projects.create`, `projects.edit`, `projects.delete` | Same-tenant owner/team and target project visible | Broad tenant visibility after permission. |
| Add/remove project member | `projects.manage_members` | Project visible/same tenant; membership target is active same-tenant `TenantUser` | Broad tenant visibility after permission. |
| Event list/detail/reminders/dismiss | `calendar.view` | Same tenant; non-broad actor is creator, assignee or attendee, unless an event is explicitly tenant-visible | Broad tenant visibility. |
| Create/update/delete event or series | matching `calendar.create`, `calendar.edit`, `calendar.delete` | Same-tenant event, creator, assignee, attendee, project and task; target visible | Broad tenant visibility after permission. |
| Routine own list/complete | `daily_routine.view` / `daily_routine.complete` | Item/log same tenant and assigned to actor; complete uses São Paulo business day | `daily_routine.manage` may complete in tenant only if it also has required complete capability where policy requires both. |
| Routine create/update/delete and admin list/logs/efficiency/user | `daily_routine.manage` | Every item/log/user filter includes same tenant; assignee active same-tenant user | This is the formal manager operation; no other bypass. |
| Notification list/unread count/read/read-all | `notifications.view` | Predicate includes `tenantId` and actor `tenantUserId`; read-one uses `(id, tenantId, tenantUserId)` | None; even admin cannot read another recipient’s notification. |

## Endpoint matrix

`Response` names refer to OpenAPI components added/generated from existing DTOs and response decorators. All rows may return the common errors `401, 403, 404, 422, 500`; rows add `409` where noted. “FR” is the traceability target in [spec.md](../spec.md).

| Method and endpoint | Request | Success response | Additional errors | FR |
|---|---|---|---|---|
| `GET /tasks` | task filters + proposed pagination | `TaskListResponse` | — | FR-001, FR-002, FR-003, FR-004, FR-015, FR-016 |
| `GET /tasks/statuses` | none | `TaskStatus[]` | — | FR-001, FR-003, FR-004, FR-015 |
| `GET /tasks/priorities` | none | `TaskPriority[]` | — | FR-001, FR-003, FR-004, FR-015 |
| `GET /tasks/tags` | none | `TaskTag[]` | — | FR-001, FR-003, FR-004, FR-015 |
| `GET /tasks/:id` | path `id` | `Task` | — | FR-002, FR-003, FR-004, FR-015, FR-016 |
| `GET /tasks/:id/comments` | path `id` | `TaskComment[]` | — | FR-002, FR-003, FR-004, FR-015 |
| `POST /tasks` | `CreateTaskDto` | `Task` | 422 | FR-001, FR-003, FR-005, FR-015 |
| `PATCH /tasks/:id` | `UpdateTaskDto` | `Task` | 422 | FR-003, FR-004, FR-005, FR-015 |
| `DELETE /tasks/:id` | path `id` | archive action result | — | FR-003, FR-004, FR-015 |
| `PATCH /tasks/:id/move` | `MoveTaskDto` | `Task` | 422 | FR-003, FR-004, FR-015 |
| `PATCH /tasks/:id/status` | `{ statusId }` | `Task` | 422 | FR-003, FR-004, FR-015 |
| `PATCH /tasks/:id/priority` | `{ priorityId }` | `Task` | 422 | FR-003, FR-004, FR-015 |
| `POST /tasks/:id/comments` | `{ content }` | `TaskComment` | 422 | FR-003, FR-004, FR-015 |
| `DELETE /tasks/comments/:commentId` | path `commentId` | delete action result | — | FR-003, FR-004, FR-015 |
| `DELETE /tasks/:id/attachments/:attachmentId` | paths `id`, `attachmentId` | delete action result | — | FR-003, FR-004, FR-014, FR-015 |
| `POST /tasks/:id/checklists` | `{ title }` | `TaskChecklist` | 422 | FR-003, FR-004, FR-015 |
| `POST /tasks/checklists/:checklistId/items` | `{ content }` | `TaskChecklistItem` | 422 | FR-003, FR-004, FR-015 |
| `PATCH /tasks/checklist-items/:itemId/toggle` | path `itemId` | `TaskChecklistItem` | — | FR-003, FR-004, FR-015 |
| `POST /upload/tasks/:taskId` | multipart `file`; allowed mime; ≤100 MB | `Attachment` | 400, 422 | FR-003, FR-004, FR-014, FR-015 |
| `GET /projects` | proposed filters + pagination | `ProjectListResponse` | — | FR-001, FR-003, FR-004, FR-015, FR-016 |
| `GET /projects/:id` | path `id` | `Project` | — | FR-002, FR-003, FR-004, FR-015, FR-016 |
| `POST /projects` | `CreateProjectDto` | `Project` | 422 | FR-003, FR-005, FR-015 |
| `PATCH /projects/:id` | `UpdateProjectDto` | `Project` | 422 | FR-003, FR-004, FR-005, FR-015 |
| `DELETE /projects/:id` | path `id` | archive action result | — | FR-003, FR-004, FR-015 |
| `POST /projects/:id/members` | `{ tenantUserId, roleInProject? }` | `ProjectMember` | 422 | FR-003, FR-004, FR-005, FR-015 |
| `DELETE /projects/:id/members/:tenantUserId` | paths | delete action result | — | FR-003, FR-004, FR-015 |
| `GET /events` | `startDate`, `endDate`, `tenantUserId?`, proposed pagination | `EventListResponse` | 422 | FR-001, FR-003, FR-004, FR-015, FR-016 |
| `GET /events/reminders` | none | `EventReminder[]` | — | FR-003, FR-004, FR-015 |
| `POST /events/:id/reminders/dismiss-day` | path `id` | `EventReminderAction` | 409 | FR-003, FR-004, FR-015 |
| `POST /events/:id/reminders/dismiss-forever` | path `id` | `EventReminderAction` | 409 | FR-003, FR-004, FR-015 |
| `GET /events/:id` | path `id` | `Event` | — | FR-002, FR-003, FR-004, FR-015 |
| `POST /events` | `CreateEventDto` | `Event` | 422 | FR-003, FR-005, FR-015 |
| `PATCH /events/:id` | `UpdateEventDto` | `Event` | 422 | FR-003, FR-004, FR-005, FR-015 |
| `DELETE /events/:id` | path `id` | delete action result | — | FR-003, FR-004, FR-015 |
| `DELETE /events/series/:seriesId` | path `seriesId` | delete action result | — | FR-003, FR-004, FR-015 |
| `GET /daily-routine` | none | `DailyRoutineItem[]` | — | FR-002, FR-003, FR-004, FR-015 |
| `POST /daily-routine` | `CreateRoutineDto` | `DailyRoutineItem` | 422 | FR-003, FR-005, FR-015 |
| `PATCH /daily-routine/:id/complete` | `CompleteRoutineDto` | `DailyRoutineLog` | 409, 422 | FR-003, FR-004, FR-015 |
| `GET /daily-routine/admin/efficiency` | `AdminFilterDto` | `{ percentage }` | 422 | FR-003, FR-004, FR-015, FR-016 |
| `GET /daily-routine/admin/logs` | filters + pagination | `RoutineLogListResponse` | 422 | FR-003, FR-004, FR-015, FR-016 |
| `GET /daily-routine/admin/user/:userId` | path `userId` | `DailyRoutineItem[]` | — | FR-003, FR-004, FR-015, FR-016 |
| `PATCH /daily-routine/:id` | `UpdateRoutineDto` | `DailyRoutineItem` | 422 | FR-003, FR-004, FR-005, FR-015 |
| `DELETE /daily-routine/:id` | path `id` | delete action result | — | FR-003, FR-004, FR-015 |
| `GET /notifications` | proposed filters + pagination | `NotificationListResponse` | — | FR-002, FR-003, FR-004, FR-006, FR-015 |
| `GET /notifications/unread-count` | none | `{ count }` | — | FR-002, FR-003, FR-004, FR-006, FR-015 |
| `PATCH /notifications/:id/read` | path `id` | `Notification` | — | FR-003, FR-004, FR-006, FR-015 |
| `PATCH /notifications/read-all` | none | `{ count }` | — | FR-003, FR-004, FR-006, FR-015 |

## Offline eligibility

| Operation class | Offline behavior |
|---|---|
| Cached `GET`/`HEAD` in matching `(tenantId, tenantUserId, queryKey, schemaVersion)` | Return `ApiResult` with `source: 'cache'`, `stale: true`, and `lastUpdatedAt` rendered in `America/Sao_Paulo`. |
| Uncached `GET`/`HEAD` | Return `OFFLINE`; never fabricate a success-shaped empty result. |
| `POST`, `PATCH`, `PUT`, `DELETE`, multipart upload | Return `OFFLINE` before transport; no optimistic state, retry schedule or outbound queue. |
