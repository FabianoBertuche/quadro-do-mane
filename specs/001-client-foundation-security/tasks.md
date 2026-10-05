# Tasks: Fundação segura e paritária dos clientes

**Input**: [spec.md](spec.md), [plan.md](plan.md), [data-model.md](data-model.md), [contracts/README.md](contracts/README.md)  
**Tests**: Required. Each behavior task is RED → run and verify the expected failure → minimal GREEN code → run the focused Jest/RNTL test.  
**Contract version**: `1.1.0`; every cache entry must use the same `schemaVersion`.

## Phase 1: Test and canonical-contract foundation

**Purpose**: Add the exact runners, common types and generated contract before clients or routes change.

- [ ] T001 Add Jest scripts/dependencies to `packages/utils/package.json` and create `packages/utils/jest.config.js`; add one failing smoke test at `packages/utils/src/api-contract.spec.ts`, run `npm run test --workspace=packages/utils`, and verify Jest discovers it. Depends on: none.
- [ ] T002 [P] Add Jest scripts/dependencies to `apps/api/package.json` and create `apps/api/jest.config.js`; add one failing smoke test at `apps/api/src/common/guards/permission.guard.spec.ts`, run `npm run test --workspace=apps/api`, and verify Jest discovers it. Depends on: none.
- [ ] T003 [P] Add `jest`, `next/jest`, Testing Library dependencies and scripts to `apps/web/package.json`; create `apps/web/jest.config.js` and `apps/web/jest.setup.ts`; add one failing component smoke test at `apps/web/src/components/tasks/TaskDetailModal.spec.tsx`. Depends on: none.
- [ ] T004 [P] Add `jest-expo`, `@testing-library/react-native`, Jest scripts and setup to `apps/mobile/package.json`; create `apps/mobile/jest.config.js` and `apps/mobile/jest.setup.ts`; add one failing screen smoke test at `apps/mobile/src/app/notifications.spec.tsx`. Depends on: none.
- [ ] T005 Write failing shared-contract tests in `packages/utils/src/api-contract.spec.ts` for `CONTRACT_VERSION = '1.1.0'`, `ErrorResponse`, `Page`, all list envelopes and error code mapping. Implement them in `packages/utils/src/api-contract.ts` and export through `packages/utils/src/index.ts`; run the focused test. Depends on: T001.
- [ ] T006 Write failing tests in `apps/api/src/main.spec.ts` asserting OpenAPI `info.version` and `x-client-contract-version` are `1.1.0`, and that the proposed raw document route returns the same document. Modify `apps/api/src/main.ts` to publish `GET /api/openapi.json`; generate `apps/api/contracts/openapi/client-foundation-security.v1.1.0.json`. Depends on: T002, T005.
- [ ] T007 Write failing DTO/controller contract tests for `page`/`pageSize` and documented collection filters in `apps/api/src/modules/tasks/dto/filter-tasks.dto.spec.ts`, `apps/api/src/modules/projects/dto/filter-projects.dto.spec.ts`, `apps/api/src/modules/events/dto/filter-events.dto.spec.ts`, `apps/api/src/modules/daily-routine/dto/daily-routine.dto.spec.ts`, and `apps/api/src/modules/notifications/dto/filter-notifications.dto.spec.ts`; create the proposed filter DTO files where absent, update the named controllers/services to return page envelopes, and regenerate `apps/api/contracts/openapi/client-foundation-security.v1.1.0.json`. Depends on: T006.
- [ ] T008 Create failing fixture-validation tests in `apps/api/contracts/fixtures/client-foundation-security.v1.1.0.spec.ts` for every final endpoint/request/response/error/filter/page example in `contracts/README.md`; add `apps/api/contracts/fixtures/client-foundation-security.v1.1.0.json` and make the test validate it against the regenerated OpenAPI snapshot. Depends on: T007.

**Checkpoint**: Jest/RNTL run in all workspaces; OpenAPI snapshot, fixtures, list filters and error vocabulary are versioned at `1.1.0`.

---

## Phase 2: Authorization foundation (blocking)

**Purpose**: Derive active context and make permission plus resource visibility explicit before any feature module is changed.

- [ ] T009 Write failing tests in `apps/api/src/common/guards/permission.guard.spec.ts` proving an actor with `roleName: 'admin'` but without the required permission is denied, while an actor with the required permission is allowed. The RED test must fail against the existing `roleName === 'admin'` bypass. Depends on: T002.
- [ ] T010 Remove the global admin early-return from `apps/api/src/common/guards/permission.guard.ts`; make fallback role-permission lookup include the active tenant when resolving the role; run T009 and all guard tests. Depends on: T009.
- [ ] T011 Write failing tests in `apps/api/src/common/authorization/authorization-context.service.spec.ts` for missing tenant, inactive `TenantUser`, role from another tenant and valid active context. Create `apps/api/src/common/authorization/authorization-context.service.ts`, update `apps/api/src/common/interfaces/request-context.interface.ts`, `apps/api/src/common/guards/tenant-context.guard.ts`, `apps/api/src/common/guards/index.ts`, and `apps/api/src/app.module.ts`; run focused tests. Depends on: T010.
- [ ] T012 Write failing tests in `apps/api/src/common/authorization/resource-scope.service.spec.ts` for same-tenant active participant, project membership, event attendee and notification-recipient predicates plus the formal `admin`/`gestor` broad-visibility predicate. Create `apps/api/src/common/authorization/resource-scope.service.ts` and register it in the common module. Depends on: T011.

**Checkpoint**: There is no global administrative permission bypass; broad visibility can occur only in a documented, tenant-scoped service predicate after the guard allows the operation.

---

## Phase 3: User Story 1 - Tenant, participation, permission and attachment security (Priority: P1) 🎯 MVP

**Goal**: Protect tasks/upload, projects, events, routine and notifications with the matrix in `contracts/README.md`.

**Independent Test**: Fixtures with Tenant A, Tenant B, active/inactive users and permitted/unpermitted roles show one allowed same-tenant path and denied cross-tenant/participant paths for every operation.

### Tests for User Story 1

- [ ] T013 [P] [US1] Write failing task tests in `apps/api/src/modules/tasks/tasks.service.spec.ts` for cross-tenant detail/update/delete/move/status/priority/comment/checklist/attachment-delete and same-tenant relation validation. Depends on: T012.
- [ ] T014 [P] [US1] Write failing upload tests in `apps/api/src/modules/upload/upload.service.spec.ts` for foreign task, inactive/foreign uploader, missing `tasks.edit`, file-system write order, `Attachment` create failure cleanup and allowed same-tenant upload. Mock `fs.writeFileSync`, `fs.unlinkSync` and Prisma; assert denied cases call neither write nor `attachment.create`. Depends on: T012.
- [ ] T015 [P] [US1] Write failing tests in `apps/api/src/modules/projects/projects.service.spec.ts`, `apps/api/src/modules/events/events.service.spec.ts`, `apps/api/src/modules/daily-routine/daily-routine.service.spec.ts`, and `apps/api/src/modules/notifications/notifications.service.spec.ts` for their explicit authorization-matrix predicates. Include notification `(id, tenantId, tenantUserId)` and routine `America/Sao_Paulo` day. Depends on: T012.

### Implementation for User Story 1

- [ ] T016 [US1] Modify `apps/api/src/modules/tasks/tasks.controller.ts` and `apps/api/src/modules/tasks/tasks.service.ts` to pass `AuthorizationContext`, scope each query/target/relationship and make attachment deletion predicate on task, attachment and tenant. Run T013. Depends on: T013.
- [ ] T017 [US1] Modify `apps/api/src/modules/upload/upload.controller.ts` and `apps/api/src/modules/upload/upload.service.ts` so service receives actor context, validates active same-tenant visible task and uploader before `fs.writeFileSync`, creates `Attachment` only after write, and unlinks the just-written file if `attachment.create` fails. Run T014. Depends on: T014, T016.
- [ ] T018 [US1] Modify `apps/api/src/modules/projects/{projects.controller,projects.service}.ts`, `apps/api/src/modules/events/{events.controller,events.service}.ts`, `apps/api/src/modules/daily-routine/{daily-routine.controller,daily-routine.service}.ts`, and `apps/api/src/modules/notifications/{notifications.controller,notifications.service}.ts` to consume context and matrix predicates; run T015. Depends on: T015.
- [ ] T019 [US1] Run `npm run test --workspace=apps/api`; inspect every mocked query in the five module service tests to confirm tenant scope and ownership predicate, and rerun the OpenAPI fixture test. Depends on: T016, T017, T018.

**Checkpoint**: A forbidden or foreign attachment produces neither file nor `Attachment`; no admin operation crosses guard permission or tenant boundary.

---

## Phase 4: User Story 2 - Equivalent Web and Expo client policy (Priority: P2)

**Goal**: Normalize loading, error, refresh and retry behavior while forbidding automatic mutation replay.

**Independent Test**: The identical synthetic response sequences yield matching `ApiResult` and transport counts in `apps/web` and `apps/mobile`.

- [ ] T020 [P] [US2] Write failing shared-policy tests in `packages/utils/src/client-policy.spec.ts`: normalize `String(method ?? 'GET').toUpperCase()`; 401 replay succeeds once for lower-case Axios methods `'get'` and `'head'`; 401 does not replay `POST`, `PATCH`, `PUT`, `DELETE` or multipart upload; 403 does not refresh; transient read retry is explicit. Implement the minimal normalizer and method classifier in `packages/utils/src/client-policy.ts`. Depends on: T005.
- [ ] T021 [P] [US2] Write failing Web Axios interceptor tests in `apps/web/src/lib/client-policy.spec.ts` that pass real Axios-style `config.method: 'get'` and `'head'` through `apps/web/src/lib/api.ts`, then assert one replay after 401/refresh; assert zero replay for `POST /tasks`, `PATCH /tasks/:id`, `DELETE /tasks/:id` and `POST /upload/tasks/:taskId`. Depends on: T003, T020.
- [ ] T022 [P] [US2] Write failing Expo Axios interceptor tests in `apps/mobile/src/lib/client-policy.spec.ts` that pass real Axios-style `config.method: 'get'` and `'head'`, assert one replay after 401/refresh, and assert zero replay for the identical mutation/upload methods. Depends on: T004, T020.
- [ ] T023 [US2] Create `apps/web/src/lib/client-policy.ts`; modify `apps/web/src/lib/api.ts` to normalize `config.method` before replay, then modify `apps/web/src/providers/query-provider.tsx`, `apps/web/src/app/(app)/tasks/page.tsx`, `apps/web/src/app/(app)/projects/page.tsx`, `apps/web/src/app/(app)/calendar/page.tsx`, `apps/web/src/app/(app)/daily-routine/page.tsx`, `apps/web/src/components/tasks/TaskDetailModal.tsx`, and `apps/web/src/components/tasks/TaskFormModal.tsx` to use typed loading/error/new-intent states. Do not send target-only pagination filters until T008 is complete. Run T021 and `TaskDetailModal.spec.tsx`. Depends on: T008, T021.
- [ ] T024 [US2] Create `apps/mobile/src/lib/client-policy.ts`; modify `apps/mobile/src/lib/api.ts` to normalize `config.method` before replay, then modify `apps/mobile/src/lib/session.ts`, `apps/mobile/src/lib/auth.ts`, `apps/mobile/src/app/task/[id].tsx`, `apps/mobile/src/app/project/[id].tsx`, `apps/mobile/src/app/calendar.tsx`, `apps/mobile/src/app/routine.tsx`, `apps/mobile/src/app/notifications.tsx`, and `apps/mobile/src/components/ui.tsx` to use the same policy. Do not send target-only pagination filters until T008 is complete. Run T022 and `notifications.spec.tsx` with React Native Testing Library. Depends on: T008, T022.

**Checkpoint**: Web and Expo make exactly one post-refresh replay only for `GET`/`HEAD`; all other methods surface a user-controlled resend path.

---

## Phase 5: User Story 3 - Scoped, read-only offline cache (Priority: P3)

**Goal**: Cache only matching current-schema reads and block all offline mutation/upload transport.

- [ ] T025 [P] [US3] Write failing tests in `packages/utils/src/offline-cache.spec.ts` for `(tenantId, tenantUserId, queryKey, schemaVersion)` isolation, `schemaVersion: '1.1.0'` rejection, stale read and `America/Sao_Paulo` last-update formatting. Implement `packages/utils/src/offline-cache.ts` and `packages/utils/src/timezone.ts`; export via `packages/utils/src/index.ts`. Depends on: T005.
- [ ] T026 [P] [US3] Write failing Web tests in `apps/web/src/lib/offline-cache.spec.ts` that offline `GET /tasks` returns a stale matching cache entry and offline `POST /tasks`, `PATCH /tasks/:id`, `DELETE /tasks/:id`, `PATCH /notifications/:id/read`, and `POST /upload/tasks/:taskId` invoke Axios zero times. Depends on: T003, T020, T025.
- [ ] T027 [P] [US3] Write failing Expo tests in `apps/mobile/src/lib/offline-cache.spec.ts` for the identical read/write/upload cases using the Expo storage and connectivity adapters. Depends on: T004, T020, T025.
- [ ] T028 [US3] Create `apps/web/src/lib/offline-cache.ts`; modify `apps/web/src/lib/api.ts`, `apps/web/src/app/(app)/tasks/page.tsx`, `apps/web/src/app/(app)/projects/page.tsx`, `apps/web/src/app/(app)/calendar/page.tsx`, `apps/web/src/app/(app)/daily-routine/page.tsx`, `apps/web/src/components/tasks/TaskDetailModal.tsx`, and `apps/web/src/components/tasks/TaskFormModal.tsx` to show stale/last-updated state and disable mutations/upload offline. Run T026. Depends on: T026.
- [ ] T029 [US3] Create `apps/mobile/src/lib/offline-cache.ts`; modify `apps/mobile/src/lib/api.ts`, `apps/mobile/src/app/task/[id].tsx`, `apps/mobile/src/app/project/[id].tsx`, `apps/mobile/src/app/calendar.tsx`, `apps/mobile/src/app/routine.tsx`, `apps/mobile/src/app/notifications.tsx`, and `apps/mobile/src/components/ui.tsx` to show stale/last-updated state and disable mutations/upload offline. Run T027 with RNTL. Depends on: T027.

**Checkpoint**: Offline reads never cross scope/schema; offline mutation and attachment upload never reach transport.

---

## Phase 6: Verification

- [ ] T030 Map FR-001 through FR-016 and SC-001 through SC-007 from `specs/001-client-foundation-security/spec.md` to named Jest/RNTL tests, OpenAPI fixtures and quickstart steps; resolve any gap with a new RED test. Depends on: T019, T023, T024, T028, T029.
- [ ] T031 Run `npm run test --workspace=packages/utils`, `npm run test --workspace=apps/api`, `npm run test --workspace=apps/web`, and `npm run test --workspace=@quadro/mobile`; inspect output and fix only through another RED-GREEN cycle. Depends on: T030.
- [ ] T032 Run `npm run build --workspace=apps/api` and `npm run build --workspace=apps/web`, then execute the security, 401-method, upload and offline scenarios in `specs/001-client-foundation-security/quickstart.md`. Depends on: T031.

## Dependencies and parallel work

- T001–T004 can start in parallel because they create separate workspace configurations.
- T009–T012 block all resource work. T013–T015 are parallel test files; T016–T018 must not modify shared guard/context files concurrently.
- T021/T022 and T026/T027 are parallel client tests in different applications.
- Phase 5 starts only after T020 establishes the shared method-sensitive policy. Final verification waits for every selected story.
- `[P]` tasks have disjoint target files; do not parallelize two changes to the same config, controller, service or screen.

## Delivery strategy

1. Complete Phase 1 and Phase 2, then demo a denied admin-without-permission request and a generated `openapi.json` snapshot.
2. Complete US1 and demonstrate cross-tenant upload denial with no filesystem or `Attachment` side effect.
3. Complete US2 before US3 so all mutation paths pass through the common method-sensitive policy.
4. Complete only after T032 has fresh evidence; do not claim client parity from source inspection alone.
