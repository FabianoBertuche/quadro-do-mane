# Implementation Plan: Fundação segura e paritária dos clientes

**Branch**: `001-client-foundation-security` | **Date**: 2026-09-09 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/001-client-foundation-security/spec.md`

## Summary

Implementar contrato OpenAPI `1.1.0` para API/Nest, Web/Next e Expo; aplicar autorização por tenant, participação e permissão sem bypass de administrador; e oferecer cache offline somente leitura. Após 401, somente `GET`/`HEAD` podem ser repetidos uma vez; toda mutação, inclusive upload, exige nova intenção explícita.

## Technical Context

**Language/Version**: TypeScript 5.3 (API/Web), TypeScript ~6.0 (Expo)  
**Primary Dependencies**: NestJS 10, Prisma 5/PostgreSQL, Swagger/OpenAPI, Next.js 14/React 18, Expo 57/React Native 0.86/React 19, Axios, Zustand, TanStack React Query  
**Storage**: PostgreSQL oficial; diretório `uploads/<tenantId>` para bytes de anexo; cache local de leituras segregado por usuário/tenant/schema  
**Testing**: Jest 29 para `packages/utils`, API Nest e Next; Jest 29 + `@testing-library/react-native` para Expo; sem rede real  
**Target Platform**: Node.js, navegadores modernos e iOS/Android/Web via Expo  
**Project Type**: Monorepo Web + API + mobile  
**Performance Goals**: No máximo um refresh por operação original; replay pós-refresh apenas uma vez para `GET`/`HEAD`; bloqueio offline de mutação ocorre antes de transporte  
**Constraints**: `schemaVersion: '1.1.0'`; sem fila, sincronização ou replay de mutações; `America/Sao_Paulo` para data de rotina e exibição de cache  
**Scale/Scope**: Tarefas e anexos, projetos, eventos, rotina diária e notificações

## Constitution Check

| Gate | Status | Evidence / action |
|---|---|---|
| Monorepo boundaries | PASS | Código comum puro em `packages/utils`; Nest em `apps/api`; adaptadores em cada cliente. |
| Security first | PASS | Contexto vem da sessão; `PermissionGuard` remove bypass `roleName === 'admin'`; exceções de visibilidade estão só na matriz por recurso. |
| Test-first | PASS | Toda tarefa funcional começa com teste Jest/RNTL vermelho e uma execução que confirme a falha. |
| Offline integrity | PASS | POST/PATCH/PUT/DELETE/multipart bloqueados antes de Axios; sem fila nem replay. |
| Time-zone clarity | PASS | Chaves de rotina e rótulo de `lastUpdatedAt` usam `America/Sao_Paulo`. |

**Re-check after Phase 1 design**: PASS. `Attachment` já existe no Prisma; a mudança só adiciona validação, compensação de arquivo e contrato, sem novo datastore oficial.

## Project Structure

```text
apps/
├── api/
│   ├── jest.config.js                         # create
│   ├── contracts/{openapi,fixtures}/           # create
│   └── src/
│       ├── main.ts
│       ├── common/{authorization,guards,interfaces}/
│       └── modules/{tasks,projects,events,daily-routine,notifications,upload}/
├── web/
│   ├── jest.config.js                          # create
│   ├── jest.setup.ts                           # create
│   └── src/{app,components,lib,providers}/
└── mobile/
    ├── jest.config.js                          # create
    ├── jest.setup.ts                           # create
    └── src/{app,components,lib}/
packages/
└── utils/
    ├── jest.config.js                          # create
    └── src/{api-contract,client-policy,offline-cache,timezone}.ts
```

## Phase 0: decisions carried forward

1. `apps/api/src/main.ts` publishes `GET /api/openapi.json`; DTO/controller metadata generates OpenAPI `1.1.0`. Its tracked snapshot and fixtures are `apps/api/contracts/openapi/client-foundation-security.v1.1.0.json` and `apps/api/contracts/fixtures/client-foundation-security.v1.1.0.json`.
2. `packages/utils/src/api-contract.ts` exports the contract version, error/result types, pagination shapes and cache schema version. `CachedReadModel.schemaVersion` must equal the contract version.
3. `packages/utils/src/client-policy.ts` normalizes Axios method values with `String(method ?? 'GET').toUpperCase()` before deciding replay. Only normalized `GET` or `HEAD` may replay once after refresh; refresh completion never replays any other method.
4. The guard checks a permission for every active role. `admin`/`gestor` broad visibility is evaluated only inside the resource predicate listed in [contracts/README.md](contracts/README.md), after permission check and within the active tenant.
5. `apps/api/src/modules/upload/upload.service.ts` resolves task/uploader scope before `fs.writeFileSync`; if `attachment.create` fails, it removes only the file it just wrote.
6. Pagination, target-only filters and list envelopes are not live-client assumptions: T007 implements them and regenerates OpenAPI, T008 validates final fixtures, and only then T023/T024 may send or parse them in Web/Expo.

## File-level implementation map

| Area | Create | Modify | Responsibility |
|---|---|---|---|
| Contract/test infrastructure | `packages/utils/jest.config.js`, `apps/api/jest.config.js`, `apps/web/jest.config.js`, `apps/web/jest.setup.ts`, `apps/mobile/jest.config.js`, `apps/mobile/jest.setup.ts` | `packages/utils/package.json`, `apps/api/package.json`, `apps/web/package.json`, `apps/mobile/package.json` | Use Jest; configure `next/jest` in Web and `jest-expo` plus React Native Testing Library in Expo. |
| OpenAPI/error contract | `apps/api/contracts/openapi/client-foundation-security.v1.1.0.json`, `apps/api/contracts/fixtures/client-foundation-security.v1.1.0.json`, `apps/api/src/common/filters/api-error.filter.ts` | `apps/api/src/main.ts`, existing controller DTOs in `tasks/dto`, `projects/dto`, `events/dto`, `daily-routine/dto` | Serve/generate snapshot, normalized `ErrorResponse`, response metadata, page/filter DTOs. |
| Shared policy/cache | `packages/utils/src/{api-contract,client-policy,offline-cache,timezone}.ts` and adjacent `*.spec.ts` | `packages/utils/src/index.ts` | Contract `1.1.0`, method-sensitive replay, São Paulo helpers and scope-keyed cache. |
| API authorization | `apps/api/src/common/authorization/{authorization-context,resource-scope}.service.ts` and `*.spec.ts` | `apps/api/src/common/guards/{tenant-context,permission}.guard.ts`, `apps/api/src/common/interfaces/request-context.interface.ts`, `apps/api/src/app.module.ts` | Active tenant user, formal broad-visibility helper and no global admin allow path. |
| Tasks/upload | `apps/api/src/modules/tasks/tasks.service.spec.ts`, `apps/api/src/modules/upload/upload.service.spec.ts` | `apps/api/src/modules/tasks/{tasks.controller,tasks.service}.ts`, `apps/api/src/modules/upload/{upload.controller,upload.service}.ts` | Validate resource scope before task attachment write/create/delete. |
| Other API resources | `apps/api/src/modules/{projects,events,daily-routine,notifications}/*.service.spec.ts` | Existing matching `*.controller.ts`, `*.service.ts`, and current `dto/` files | Scope, formal visibility and relationships; T007 alone implements target filters/page envelopes before client adoption. |
| Web client | `apps/web/src/lib/{client-policy,offline-cache}.ts` plus `*.spec.ts`, `apps/web/src/components/tasks/TaskDetailModal.spec.tsx` | `apps/web/src/lib/api.ts`, `apps/web/src/providers/query-provider.tsx`, `apps/web/src/app/(app)/{tasks,projects,calendar,daily-routine}/page.tsx`, `apps/web/src/components/tasks/{TaskDetailModal,TaskFormModal}.tsx` | Axios policy, cache, error/loading UI, upload and offline mutation block. |
| Expo client | `apps/mobile/src/lib/{client-policy,offline-cache}.ts` plus `*.spec.ts`, `apps/mobile/src/app/notifications.spec.tsx` | `apps/mobile/src/lib/{api,session,auth}.ts`, `apps/mobile/src/app/{task/[id],project/[id],calendar,routine,notifications}.tsx`, `apps/mobile/src/components/ui.tsx` | Same policy via Expo storage/connectivity and RNTL-tested UI. |

## Implementation gates

1. **OpenAPI gate**: snapshot, fixtures and every method/path/request/response/error/filter/page item in `contracts/README.md` agree at `1.1.0`.
2. **Authorization gate**: focused tests prove allowed/denied outcomes for all resources and upload; denied upload writes neither bytes nor `Attachment`; an admin without a required permission is denied by `permission.guard.ts`.
3. **Replay gate**: focused Web and Expo Axios tests pass lower-case `config.method: 'get'` and `'head'`, observe one replay only after normalization to `GET`/`HEAD`, and observe zero replay for every mutation/multipart request.
4. **Offline gate**: focused Web/RNTL tests observe zero Axios transport for offline mutations/uploads; cached reads require matching `tenantId`, `tenantUserId`, `queryKey` and `schemaVersion: '1.1.0'`.
5. **Regression gate**: Jest suites for all four workspaces plus API/Web builds and [quickstart.md](quickstart.md) pass with fresh output.

## Complexity Tracking

No exception is needed. OpenAPI uses the existing Swagger dependency; Jest/RNTL are test dependencies only; the existing three runtime applications remain unchanged in number.
