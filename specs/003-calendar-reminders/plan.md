# Calendário paritário e lembretes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar calendário pessoal paginado e paritário em Web/Expo, com gestão segura de ocorrência/série, lembretes individuais, push/deep link e cache offline somente leitura.

**Architecture:** O NestJS aplica o contrato `2026-09-09`, o contexto de tenant, a matriz de permissão e o predicado de visibilidade antes de qualquer consulta/mutação. `packages/utils` concentra tipos puros de contrato, tempo São Paulo, cursor e cache; Next e Expo consomem esses tipos por adaptadores de rede/cache/navegação próprios. A série permanece materializada em `Event`; `seriesId` seleciona o escopo da atualização ou exclusão.

**Tech Stack:** TypeScript 5.3, NestJS 10, Prisma 5/PostgreSQL, Next.js 14/React 18/TanStack Query, Expo 57/React Native 0.86, Expo Router/Notifications, Vitest 2/jsdom/Testing Library React, Jest 29/jest-expo/Testing Library React Native, Node `--test` + ts-node.

**Spec:** [`spec.md`](spec.md) | **Contract:** [`contracts/README.md`](contracts/README.md) | **Data model:** [`data-model.md`](data-model.md)

## Global Constraints

- Contrato canônico `2026-09-09`; toda mudança de endpoint existente segue `contracts/README.md` e não mantém resposta alternativa não documentada.
- Todos os limites civis, recorrência e deduplicação diária usam `America/Sao_Paulo`; não usar offset `-03:00` fixo ou `toISOString().split('T')` para dia civil.
- Servidor é autoritativo para tenant, papel, permissões e predicado de visibilidade; UI somente espelha capability.
- `admin` só seleciona usuário se também tiver `calendar.view`; não atravessa tenant, nem confere permissão de edição/exclusão.
- Sem alterações offline, fila, replay automático de mutação ou payload sensível em cache/push.
- Limite de série: 365 ocorrências. Listas: cursor opaco e `limit` 1..100.
- Usar TDD: cada comportamento começa em RED confirmado, recebe implementação mínima GREEN e termina no runner declarado.

---

## Constitution Check

| Gate | Status | Evidência / ação |
|---|---|---|
| Limites do monorepo | PASS | API em `apps/api`, cliente Web em `apps/web`, Expo em `apps/mobile`, tipos puros em `packages/utils`. |
| Fundação 001 preservada | PASS | Guards e cache read-only são extensão explícita, sem bypass administrativo. |
| Dependência de 002 | PASS | invalida `daily-workspace`/agenda e conserva rotas existentes até consumidores migrarem. |
| TDD e runners reais | PASS | T001 instala/configura runners; cada tarefa subsequente especifica RED/GREEN. |
| Segurança de notificação | PASS | payload mínimo versionado; autorização refeita no detalhe. |

## Project Structure

```text
apps/
├── api/src/
│   ├── common/calendar/{calendar-contract,calendar-time}.ts
│   └── modules/events/{events.controller,events.service,events.service.spec,events.controller.spec}.ts
├── web/
│   ├── src/lib/{calendar-api,calendar-cache,calendar-deep-link}.ts
│   ├── src/components/calendar/{CalendarShell,CalendarViews,EventDetailModal,EventFormModal}.tsx
│   └── src/app/(app)/calendar/{page.tsx,events/[id]/page.tsx}
└── mobile/
    ├── src/lib/{calendar-api,calendar-cache,push}.ts
    ├── src/components/calendar/{CalendarScreen,CalendarViews,EventDetailScreen,EventForm}.tsx
    └── src/app/{calendar.tsx,calendar/[id].tsx,event-create.tsx}
packages/utils/src/
├── calendar-contract.ts
├── calendar-time.ts
├── calendar-cache.ts
└── index.ts
```

**Structure decision:** a página Web e tela Expo existentes de calendário são substituídas por shells finos; componentes puros ficam em diretórios novos para evitar ampliar arquivos de tela. O `PATCH /events/series/:seriesId` é adicionado antes de `PATCH /events/:id` no controller, eliminando ambiguidade de rota.

## Configuration and runner changes (T001)

| Workspace | Dependências de desenvolvimento | Arquivos/configuração | Script final |
|---|---|---|---|
| `apps/api` | nenhuma adicional; usa `ts-node` existente | `apps/api/package.json` | `test:calendar`: `node -r ts-node/register --test src/modules/events/events.service.spec.ts src/modules/events/events.controller.spec.ts src/modules/events/calendar-contract.spec.ts` |
| `apps/web` | `vitest@^2`, `jsdom@^25`, `@testing-library/react@^16`, `@testing-library/jest-dom@^6`, `@testing-library/user-event@^14` | `vitest.config.ts`, `src/test/setup.ts`, `package.json` | `test:calendar`: `vitest run src/components/calendar src/lib/calendar-api.spec.ts` |
| `apps/mobile` | `jest@^29`, `jest-expo@~57.0.0`, `@testing-library/react-native@^13` | `jest.config.js`, `src/test/setup.ts`, `package.json` | `test:calendar`: `jest --runInBand --testPathPattern=calendar|push` and `typecheck`: `tsc --noEmit` |
| `packages/utils` | `vitest@^2` | `vitest.config.ts`, `package.json` | `test:calendar`: `vitest run src/calendar-*.spec.ts` |

The executor must run `npm install` after manifest edits and must not claim runner success until each listed script exits zero. If version resolution conflicts with Expo 57, use `npx expo install jest-expo @testing-library/react-native` and record the resolved compatible version in the task change rather than mixing Jest major versions.

## File-level implementation map

| Area | Create | Modify | Responsibility |
|---|---|---|---|
| Shared types/time/cache | `packages/utils/src/calendar-contract.ts`, `calendar-time.ts`, `calendar-cache.ts` plus specs | `packages/utils/src/index.ts`, `package.json` | Contract parsing, São Paulo interval/format, cache key/version/invalidation policy. |
| API contract and security | `apps/api/src/common/calendar/calendar-contract.ts`, `calendar-time.ts`; event controller/contract specs | `events.controller.ts`, `events.service.ts`, create/update DTOs, `events.module.ts`, `push.service.ts`, admin controller | Cursor, actor/target predicate, occurrence/series mutation, reminders and deep-link payload. |
| API persistence | migration only if measured | `apps/api/prisma/schema.prisma` only if migration required | Add query indexes only after explain evidence; no master series table. |
| Web | calendar lib/component specs | existing calendar page; new `events/[id]/page.tsx`; `apps/web/src/lib/api.ts` only for cache interceptor hook | Views, forms, details, deep links and offline banner. |
| Expo | calendar/push specs and components | `calendar.tsx`, new `calendar/[id].tsx`, `event-create.tsx`, `_layout.tsx`, `lib/push.ts` | Native views, detail route, form, notification response and offline UI. |

## Implementation phases

### Phase 1 — Baseline, shared contracts and time

1. Add/verify runners (T001), then define `CalendarEventPage`, inputs, error codes and cache key in `packages/utils` (T002).
2. Implement São Paulo range/cursor pure helpers with fixed-clock tests (T003).
3. Upgrade API list/detail security and contract envelope (T004–T005).

### Phase 2 — Mutations, recurrence, reminders and push

1. Implement occurrence and series scope plus relationship validation (T006–T007).
2. Normalize personal reminder read/dismiss and job idempotency/deep link (T008–T009).
3. Run API contract/regression suite (T010).

### Phase 3 — Client parity

1. Web cache/API and four views/detail/forms (T011–T013).
2. Expo cache/API, routes, views/detail/forms and notification handling (T014–T016).
3. Shared parity matrix, security/offline and final build/type checks (T017–T018).

## Dependency graph and safe parallelism

```text
T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009 → T010
                  └───────────────────────────────────────→ T011 → T012 → T013 → T017 → T018
                                                          └→ T014 → T015 → T016 ──────┘
```

After T010, T011–T013 (Web) and T014–T016 (Expo) may run in parallel because their files do not overlap. Do not run T004–T009 in parallel: they all change `apps/api/src/modules/events/events.service.ts`. Do not parallelize T017 before both client tracks complete.

## Requirement coverage

| Requirement | Tasks |
|---|---|
| FR-001, FR-012 | T002, T004, T005, T010, T017 |
| FR-002, FR-013 | T003, T004, T012, T015, T017 |
| FR-003–FR-006 | T004, T005, T010, T017 |
| FR-007–FR-011 | T006, T007, T010, T013, T016 |
| FR-014–FR-016 | T008, T009, T013, T016, T017 |
| FR-017–FR-019 | T002, T011, T014, T017 |
| FR-020, SC-001–SC-008 | T001, T003–T010, T013, T016–T018 |
