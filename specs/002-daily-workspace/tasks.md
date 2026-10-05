# Tarefas — Daily Workspace

**Convenções:** cada tarefa começa pelo teste que falha, segue com implementação mínima e termina na verificação indicada. Não fazer commit nesta execução de planejamento. Caminhos são relativos à raiz do monorepo.

## Dependências e paralelismo

```text
T001 → T002 → T003 → T004 → T005 → T006
T001 → T007 → T008
T009 → T010 → T011 → T012
T006 + T010 → T013 → T014 → T015 → T016 → T017 → T018 → T019
T006 + T011 → T020 → T021 → T022 → T023 → T024 → T025 → T026
T014 + T021 + T019 + T026 → T027 → T028 → T029 → T030 → T031 → T032
```

**Paralelas após T001:** T002 (backend de tempo/projeção), T007 (contrato de filtros de tarefa), T009 (interface de cache).
**Paralelas após T006/T010/T011:** trilha Web T013–T019 e trilha Expo T020–T026. Não editar `apps/api/src/modules/daily-routine/daily-routine.service.ts` em paralelo com T003/T004.

## Fundação e backend

### T001 — Instalar e configurar runners de teste reproduzíveis

**Arquivos:** Modificar `apps/api/package.json`, `packages/utils/package.json`, `apps/web/package.json`, `apps/mobile/package.json`; Criar `apps/web/vitest.config.ts`, `apps/web/src/test/setup.ts`, `apps/mobile/jest.config.js`, `apps/mobile/src/test/setup.ts`, `docs/verification/daily-workspace-baseline.md`.

- [ ] Registrar em `docs/verification/daily-workspace-baseline.md` a saída inicial de `npm run test:events --workspace=api`, `npm run build --workspace=web` e `npx tsc --noEmit -p apps/mobile/tsconfig.json`.
- [ ] Adicionar em `apps/api/package.json` `"test:one": "node -r ts-node/register --test"` e `"test:daily-workspace": "node -r ts-node/register --test src/common/time/sao-paulo-day.spec.ts src/common/guards/daily-workspace-read.guard.spec.ts src/modules/daily-workspace/daily-workspace.service.spec.ts src/modules/daily-workspace/daily-workspace.controller.spec.ts src/modules/daily-workspace/daily-workspace.contract.spec.ts src/modules/daily-routine/daily-routine.service.spec.ts src/modules/tasks/tasks.service.spec.ts src/modules/tasks/tasks.controller.spec.ts"`.
- [ ] Adicionar em `packages/utils/package.json` (workspace real `utils`) `ts-node` em `devDependencies` e os scripts `"test:one": "node -r ts-node/register --test"`, `"test:daily-workspace": "node -r ts-node/register --test src/daily-workspace.spec.ts src/read-cache.spec.ts"` e `"typecheck": "tsc --noEmit -p tsconfig.json"`.
- [ ] Adicionar em `apps/web/package.json` `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom` e `fake-indexeddb` em `devDependencies`, com `"test:daily-workspace": "vitest run --config vitest.config.ts"` e `"typecheck": "tsc --noEmit"`; configurar `apps/web/vitest.config.ts` com `environment: 'jsdom'`, alias `@` para `./src` e `setupFiles: ['./src/test/setup.ts']`; em `apps/web/src/test/setup.ts`, importar `@testing-library/jest-dom/vitest` e `fake-indexeddb/auto`.
- [ ] Adicionar em `apps/mobile/package.json` `jest`, `jest-expo`, `@testing-library/react-native`, `@types/jest`, `cross-env`, `@react-native-async-storage/async-storage` e `@react-native-community/netinfo`, com `"test:daily-workspace": "cross-env EXPO_OS=android jest --runInBand --config jest.config.js && cross-env EXPO_OS=ios jest --runInBand --config jest.config.js"` e `"typecheck": "tsc --noEmit -p tsconfig.json"`; configurar `apps/mobile/jest.config.js` com `preset: 'jest-expo'` e `setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts']`; em `apps/mobile/src/test/setup.ts`, mockar AsyncStorage, NetInfo e `Platform.OS` pelo valor de `process.env.EXPO_OS`.
- [ ] Executar `npm install`, criar um spec sentinela mínimo por runner, executar os quatro scripts `test:daily-workspace` e registrar resultados; remover somente os sentinelas substituídos pelos primeiros specs reais em T002/T008/T009.

**Depende de:** nenhuma. **TDD:** instala os runners e confirma a execução antes de qualquer teste de produto.

### T002 — Criar utilitário de dia São Paulo testado

**Arquivos:** Criar `apps/api/src/common/time/sao-paulo-day.ts`, `apps/api/src/common/time/sao-paulo-day.spec.ts`; Modificar `apps/api/src/common/time/index.ts`.

- [ ] Escrever testes para `parseSaoPauloDate('2026-09-09')`, data ausente com relógio fixo, formato inválido e os instantes antes/depois de `2026-09-09T03:00:00.000Z`.
- [ ] Executar `npm run test:one --workspace=api -- src/common/time/sao-paulo-day.spec.ts` e confirmar falha por módulo ausente.
- [ ] Implementar `getSaoPauloDayRange(date?: string, now = new Date()): { referenceDate; rangeStart; rangeEnd }` com intervalo inclusivo/exclusivo.
- [ ] Exportar a função no índice local e executar o teste até PASS.

**Depende de:** T001. **Produz:** função usada por T003, T004 e T005.

### T003 — Corrigir rotina diária para data São Paulo

**Arquivos:** Modificar `apps/api/src/modules/daily-routine/daily-routine.service.ts`; Criar/Modificar `apps/api/src/modules/daily-routine/daily-routine.service.spec.ts`.

- [ ] Escrever teste que fixa o relógio em fronteira UTC e espera `DailyRoutineLog.date` da data São Paulo para leitura e conclusão.
- [ ] Executar o spec e confirmar a falha do comportamento UTC atual.
- [ ] Substituir as derivações `toISOString().split('T')` pelo utilitário de T002, injetando relógio quando necessário para teste determinístico.
- [ ] Executar `npm run test:one --workspace=api -- src/modules/daily-routine/daily-routine.service.spec.ts` até PASS sem alterar as regras de ordem sequencial.

**Depende de:** T002. **Produz:** rotina coerente com `referenceDate`.

### T004 — Definir DTO, tipos e serviço da projeção diária

**Arquivos:** Criar `apps/api/src/modules/daily-workspace/dto/daily-workspace-query.dto.ts`, `apps/api/src/modules/daily-workspace/daily-workspace.types.ts`, `apps/api/src/modules/daily-workspace/daily-workspace.service.ts`, `apps/api/src/modules/daily-workspace/daily-workspace.service.spec.ts`.

- [ ] Escrever testes de serviço para seções vazias, tarefa atribuída por ambos os vínculos sem duplicação, atrasada não concluída, evento que cruza o dia e capability sem permissão.
- [ ] Executar o spec e confirmar falha por serviço inexistente.
- [ ] Implementar `getWorkspace(input: { tenantId: string; tenantUserId: string; permissions: string[]; date?: string }): Promise<DailyWorkspace>` com consultas Prisma limitadas por tenant, `getSaoPauloDayRange`, capabilities completas de `projects.create`, `tasks.create/edit/delete/move/assign/change_status/change_priority/comment/checklist_manage` e anexos por `tasks.edit`.
- [ ] Implementar retorno de seção parcial somente para falhas recuperáveis documentadas e executar o spec até PASS.

**Depende de:** T002, T003. **Produz:** `DailyWorkspace` para T005/T006.

### T005 — Expor controller com guard OR explícito e módulo protegidos

**Arquivos:** Criar `apps/api/src/common/guards/daily-workspace-read.guard.ts`, `apps/api/src/common/guards/daily-workspace-read.guard.spec.ts`, `apps/api/src/modules/daily-workspace/daily-workspace.controller.ts`, `apps/api/src/modules/daily-workspace/daily-workspace.module.ts`, `apps/api/src/modules/daily-workspace/daily-workspace.controller.spec.ts`; Modificar `apps/api/src/app.module.ts`.

- [ ] Escrever `daily-workspace-read.guard.spec.ts` com `canActivate` falso para request sem usuário, sem permissões e permissões irrelevantes, e verdadeiro para cada uma de `tasks.view`, `calendar.view`, `daily_routine.view` isoladamente e combinadas.
- [ ] Escrever testes HTTP para 200 com cada permissão de leitura isolada, 400 de data inválida, 401, 403 sem leitura e payload do contrato.
- [ ] Executar o spec e confirmar que `GET /daily-workspace` ainda é 404.
- [ ] Implementar `DailyWorkspaceReadGuard` no caminho declarado, aplicando `AuthGuard('jwt')`, `TenantContextGuard` e esse guard no controller sem `PermissionGuard`/`@RequirePermissions`; delegar ao serviço de T004.
- [ ] Registrar o módulo no `AppModule` e executar testes de controller até PASS.

**Depende de:** T004. **Produz:** endpoint novo para T013/T020.

### T006 — Validar contrato e regressão backend

**Arquivos:** Criar `apps/api/src/modules/daily-workspace/daily-workspace.contract.spec.ts`; Modificar `apps/api/src/modules/events/events.service.spec.ts` somente se precisar de caso de fronteira existente.

- [ ] Escrever asserções de forma para todos os campos obrigatórios de `DailyWorkspace` e para `unavailableSections`.
- [ ] Executar contrato contra fixture de T004 e confirmar falha antes de corrigir omissões de forma.
- [ ] Ajustar tipos/serialização sem expor dados cross-tenant.
- [ ] Rodar todos os specs de `daily-workspace`, `daily-routine` e `events` até PASS.

**Depende de:** T005. **Produz:** contrato estável para clientes.

## Trabalho e cache compartilhado

### T007 — Cobrir filtros e detalhe de tarefas

**Arquivos:** Criar/Modificar `apps/api/src/modules/tasks/tasks.service.spec.ts`, `apps/api/src/modules/tasks/tasks.controller.spec.ts`; Modificar `apps/api/src/modules/tasks/tasks.service.ts`, `apps/api/src/modules/tasks/dto/filter-tasks.dto.ts` apenas se lacuna de contrato for demonstrada.

- [ ] Escrever testes de AND entre filtros, busca título/descrição, `myTasks=true` a partir da sessão, `assigneeTenantUserId` por responsável principal ou `TaskAssignee`, deduplicação por `Task.id`, tenant divergente e detalhe com todos os relacionamentos.
- [ ] Executar os specs e registrar qualquer falha de contrato existente.
- [ ] Implementar somente a lacuna comprovada, mantendo filtros/tenant no serviço e controller: `myTasks` e responsável devem gerar OR entre responsável principal e `assignees.some`, sem duplicar tarefas.
- [ ] Executar os specs até PASS e garantir 403 para `POST /tasks` sem `tasks.create` e `DELETE /tasks/:id` sem `tasks.delete`, além das mutações já cobertas.

**Depende de:** T001. **Produz:** comportamento confiável para T016/T023.

### T008 — Especificar DTOs compartilhados de tarefa

**Arquivos:** Criar `packages/utils/src/daily-workspace.ts`, `packages/utils/src/daily-workspace.spec.ts`; Modificar `packages/utils/src/index.ts`.

- [ ] Escrever teste de normalização de `TaskSummary`, `TaskDetail` e `TaskFilters`, incluindo contagens zero e listas vazias.
- [ ] Executar `npm run test:daily-workspace --workspace=utils` e confirmar falha inicial.
- [ ] Implementar tipos puros e funções `normalizeTaskFilters` e `taskCacheKey` sem dependência de React/React Native.
- [ ] Executar `npm run test:daily-workspace --workspace=utils` e `npx tsc --noEmit -p packages/utils/tsconfig.json` até PASS.

**Depende de:** T007. **Produz:** tipos para T015/T016/T022/T023.

### T009 — Criar contrato abstrato de cache e bloqueio offline

**Arquivos:** Criar `packages/utils/src/read-cache.ts`, `packages/utils/src/read-cache.spec.ts`; Modificar `packages/utils/src/index.ts`.

- [ ] Escrever testes para chave `rw:2026-09-09:v1`, rejeição de versão diferente, tenant/usuário/recurso/data, expiração, limpeza por contexto, limpeza em 401/403 e `OfflineReadOnlyError` em POST/PATCH/DELETE/upload.
- [ ] Executar spec e confirmar falha por export ausente.
- [ ] Implementar `ReadCacheEntry`, `buildReadCacheKey`, `isExpired`, `clearContext` e `assertReadOnlyWhenOffline(method, online)`.
- [ ] Executar spec até PASS.

**Depende de:** T001. **Produz:** contrato de cache para T010/T011.

### T010 — Implementar cache Web e interceptor offline

**Arquivos:** Criar `apps/web/src/lib/read-cache.ts`, `apps/web/src/lib/read-cache.spec.ts`; Modificar `apps/web/src/lib/api.ts`, `apps/web/src/lib/auth.ts`.

- [ ] Escrever testes com fake IndexedDB para cache HIT/MISS/TTL, chave de contrato, logout/troca de tenant, limpeza no interceptor 401/403 e rejeição local de mutação offline.
- [ ] Executar o spec e confirmar falha antes de criar o adaptador.
- [ ] Implementar adaptador IndexedDB conforme T009, interceptor para métodos mutáveis e invalidação após escrita 2xx.
- [ ] Executar testes e TypeScript Web até PASS.

**Depende de:** T009. **Produz:** cache Web para T013–T019.

### T011 — Implementar cache Expo e interceptor offline

**Arquivos:** Criar `apps/mobile/src/lib/read-cache.ts`, `apps/mobile/src/lib/read-cache.spec.ts`; Modificar `apps/mobile/src/lib/api.ts`, `apps/mobile/src/lib/auth.ts`.

- [ ] Escrever testes AsyncStorage/NetInfo mockados para chave, TTL, troca de tenant, limpeza no interceptor 401/403 e rejeição sem envio de mutação offline.
- [ ] Executar spec e confirmar falha do adaptador ausente.
- [ ] Implementar cache de payload GET sem tokens, conectar NetInfo/estado de conectividade e limpar contexto no logout.
- [ ] Executar testes e `npm run typecheck --workspace=@quadro/mobile` até PASS.

**Depende de:** T009. **Produz:** cache Expo para T020–T026.

### T012 — Criar clientes tipados do contrato diário

**Arquivos:** Criar `apps/web/src/lib/daily-workspace-api.ts`, `apps/web/src/lib/daily-workspace-api.spec.ts`, `apps/mobile/src/lib/daily-workspace-api.ts`, `apps/mobile/src/lib/daily-workspace-api.spec.ts`.

- [ ] Escrever testes que verificam query `date`, fallback cacheado, `savedAt` e não chamam rede offline em cache HIT.
- [ ] Executar ambos os specs e confirmar falha por módulos ausentes.
- [ ] Implementar funções `getDailyWorkspace(date?: string)` e `getAgenda(date?: string)` usando o cache específico de plataforma e o contrato T006.
- [ ] Executar os specs até PASS.

**Depende de:** T006, T010, T011. **Produz:** queries para as telas.

## Web

### T013 — Migrar Sidebar Web para a navegação principal por permissão

**Arquivos:** Modificar `apps/web/src/components/layout/sidebar.tsx`, `apps/web/src/app/(app)/layout.tsx`; Criar `apps/web/src/components/layout/sidebar.daily-workspace.spec.tsx`.

- [ ] Escrever teste de render para ordem Início/Trabalho/Agenda/Mais, item ativo, foco de teclado e itens Mais omitidos sem permissão.
- [ ] Executar o teste e confirmar falha contra a navegação Dashboard/Projetos/Tarefas atual.
- [ ] Migrar o array `navigation` de `sidebar.tsx` para Início (`/dashboard`), Trabalho (`/tasks`), Agenda (`/calendar`) e Mais; mover os destinos antigos para Mais, com permissões de `useAuthStore`, sem quebrar links profundos e mantendo `layout.tsx` como único montador da Sidebar.
- [ ] Executar teste e verificação de acessibilidade até PASS.

**Depende de:** T010. **Produz:** shell para T014–T019.

### T014 — Construir Início operacional Web

**Arquivos:** Criar `apps/web/src/components/daily-workspace/daily-workspace-panel.tsx`, `apps/web/src/components/daily-workspace/daily-workspace-panel.spec.tsx`; Modificar `apps/web/src/app/(app)/dashboard/page.tsx`.

- [ ] Escrever testes para seções, contagem, vazio, duplicação, estado parcial, atalhos por capability e banner cacheado.
- [ ] Executar testes e confirmar falha inicial.
- [ ] Implementar painel com query T012, links de detalhe e ações apenas online/autorizadas.
- [ ] Executar testes até PASS com leitor de tela verificando labels das seções.

**Depende de:** T012, T013. **Produz:** US1 Web.

### T015 — Construir Trabalho Web: busca e filtros

**Arquivos:** Modificar `apps/web/src/components/tasks/TaskFilterBar.tsx`, `apps/web/src/app/(app)/tasks/page.tsx`; Criar `apps/web/src/components/tasks/TaskFilterBar.daily-workspace.spec.tsx`.

- [ ] Escrever testes para combinação de filtros, termo preservado em falha e `myTasks` sem ID externo.
- [ ] Executar teste e confirmar falha contra os filtros atuais.
- [ ] Estender o formulário acessível existente, serialização por `normalizeTaskFilters`, `myTasks`/responsável e query com cache somente leitura.
- [ ] Executar teste até PASS.

**Depende de:** T008, T010, T013. **Produz:** lista Trabalho Web.

### T016 — Construir detalhe e ações de tarefa Web

**Arquivos:** Modificar `apps/web/src/components/tasks/TaskDetailModal.tsx`, `apps/web/src/components/tasks/TaskFormModal.tsx`, `apps/web/src/app/(app)/tasks/page.tsx`; Criar `apps/web/src/components/tasks/TaskDetailModal.daily-workspace.spec.tsx`.

- [ ] Escrever testes para exibição de responsáveis/anexos/checklists/comentários/subtarefas, ações por permissão e bloqueio offline antes da mutação.
- [ ] Executar teste e confirmar falha inicial.
- [ ] Implementar no modal existente detalhe usando `GET /tasks/:id`, criar/editar/excluir tarefa, status, prioridade, comentário, checklist e anexo condicionados pela matriz real, invalidação após mutação online e mensagens para 403/409/offline.
- [ ] Executar teste até PASS.

**Depende de:** T007, T008, T010, T015. **Produz:** US2 Web.

### T017 — Construir Agenda Web

**Arquivos:** Criar `apps/web/src/components/agenda/agenda-day.tsx`, `apps/web/src/components/agenda/agenda-day.spec.tsx`; Modificar `apps/web/src/app/(app)/calendar/page.tsx`.

- [ ] Escrever testes para ordenação, evento que cruza dia, lembrete separado, link de tarefa por `tasks.view`, banner offline e dispensa online.
- [ ] Executar teste e confirmar falha inicial.
- [ ] Implementar Agenda com cliente T012 e controles de lembrete condicionados à conectividade.
- [ ] Executar teste até PASS.

**Depende de:** T012, T013. **Produz:** US3 Web.

### T018 — Integrar atalhos e deep links Web

**Arquivos:** Modificar `apps/web/src/app/(app)/projects/[id]/page.tsx`, `apps/web/src/app/(app)/daily-routine/page.tsx`, `apps/web/src/components/layout/sidebar.tsx`; Criar `apps/web/src/app/(app)/navigation.integration.spec.tsx`.

- [ ] Escrever teste que percorre atalhos do Início para criar projeto/tarefa/evento/rotina somente quando permitido e preserva links profundos existentes.
- [ ] Executar teste e confirmar falha pelos destinos não registrados.
- [ ] Conectar destinos novos ao shell e às rotas existentes sem remover rotas legadas e aplicar gate offline nos atalhos mutáveis.
- [ ] Executar integração até PASS.

**Depende de:** T014, T016, T017. **Produz:** fluxos completos Web.

### T019 — Verificar paridade funcional Web

**Arquivos:** Criar `apps/web/src/app/(app)/daily-workspace.permissions.spec.tsx`, `apps/web/src/app/(app)/daily-workspace.offline.spec.tsx`.

- [ ] Escrever matriz de testes para usuário sem cada permissão, cache HIT/MISS, limpeza 401/403, erro de seção parcial e renderização do cache em até 500 ms com relógio/performance instrumentados.
- [ ] Executar specs e confirmar falhas dos comportamentos faltantes.
- [ ] Ajustar apenas estados de apresentação ou adaptadores da Web necessários para satisfazer os testes.
- [ ] Executar todos os testes Web Daily Workspace até PASS.

**Depende de:** T018. **Produz:** Gate 3 e 4 Web.

## Expo Android/iOS

### T020 — Remapear tabs Expo para a nova navegação

**Arquivos:** Criar `apps/mobile/src/app/(tabs)/agenda.tsx`; Modificar `apps/mobile/src/app/(tabs)/_layout.tsx`, `apps/mobile/src/app/(tabs)/more.tsx`; Criar `apps/mobile/src/app/(tabs)/navigation.spec.tsx`.

- [ ] Escrever teste para rótulos/ordem Início/Trabalho/Agenda/Mais, tab ativa e destinos Mais por permissão.
- [ ] Executar teste e confirmar falha pois Agenda/tab não existe.
- [ ] Implementar tabs e mover destinos antigos para Mais sem quebrar deep links de `calendar.tsx`, `projects.tsx` e detalhes.
- [ ] Executar teste e `npm run typecheck --workspace=@quadro/mobile` até PASS.

**Depende de:** T011. **Produz:** shell Expo.

### T021 — Construir Início operacional Expo

**Arquivos:** Criar `apps/mobile/src/components/daily-workspace/DailyWorkspacePanel.tsx`, `apps/mobile/src/components/daily-workspace/DailyWorkspacePanel.spec.tsx`; Modificar `apps/mobile/src/app/(tabs)/dashboard.tsx`.

- [ ] Escrever teste para as cinco seções, vazio, capabilities, link e banner “Dados salvos; somente leitura”.
- [ ] Executar teste e confirmar falha por componente ausente.
- [ ] Implementar painel com `daily-workspace-api`, layouts nativos e ações mutáveis desabilitadas offline.
- [ ] Executar teste até PASS em iOS/Android renderer compartilhado.

**Depende de:** T012, T020. **Produz:** US1 Expo.

### T022 — Construir Trabalho Expo: busca e filtros

**Arquivos:** Criar `apps/mobile/src/components/tasks/TaskFilters.tsx`, `apps/mobile/src/components/tasks/TaskFilters.spec.tsx`; Modificar `apps/mobile/src/app/(tabs)/tasks.tsx`.

- [ ] Escrever teste para busca, filtros combinados, limpar filtros e estado vazio sem perder consulta.
- [ ] Executar teste e confirmar falha inicial.
- [ ] Implementar filtros nativos usando tipos T008, query e cache read-only T011.
- [ ] Executar teste até PASS.

**Depende de:** T008, T011, T020. **Produz:** lista Trabalho Expo.

### T023 — Completar detalhe de tarefa Expo

**Arquivos:** Criar `apps/mobile/src/components/tasks/TaskDetailSections.tsx`, `apps/mobile/src/components/tasks/TaskDetailSections.spec.tsx`; Modificar `apps/mobile/src/app/task/[id].tsx`.

- [ ] Escrever teste para responsáveis, anexos, checklists, comentários, subtarefas, gates de permissão e erro offline sem request mutável.
- [ ] Executar teste e confirmar falha por seções/gates ausentes.
- [ ] Implementar seções e vincular ações existentes com invalidação online e erro offline tipado.
- [ ] Executar teste até PASS.

**Depende de:** T007, T008, T011, T022. **Produz:** US2 Expo.

### T024 — Construir Agenda Expo

**Arquivos:** Criar `apps/mobile/src/components/agenda/AgendaDay.tsx`, `apps/mobile/src/components/agenda/AgendaDay.spec.tsx`; Modificar `apps/mobile/src/app/(tabs)/agenda.tsx`, `apps/mobile/src/app/calendar.tsx`.

- [ ] Escrever teste para ordenação São Paulo, eventos de fronteira, lembretes, deep link de tarefa e dispensa online.
- [ ] Executar teste e confirmar falha inicial.
- [ ] Implementar componente de agenda e manter `calendar.tsx` como redirecionamento/deep link compatível.
- [ ] Executar teste até PASS.

**Depende de:** T012, T020. **Produz:** US3 Expo.

### T025 — Integrar atalhos e acessibilidade Expo

**Arquivos:** Modificar `apps/mobile/src/app/task-create.tsx`, `apps/mobile/src/app/event-create.tsx`, `apps/mobile/src/app/routine.tsx`; Criar `apps/mobile/src/app/daily-workspace.integration.spec.tsx`.

- [ ] Escrever teste que abre atalhos permitidos e confirma controles inacessíveis/rotulados sem permissão ou offline.
- [ ] Executar teste e confirmar falha dos links ou accessibilityLabel.
- [ ] Adicionar deep links, labels e gate de conectividade sem alterar autorização do backend.
- [ ] Executar integração até PASS.

**Depende de:** T021, T023, T024. **Produz:** fluxos completos Expo.

### T026 — Verificar cache e paridade Expo

**Arquivos:** Criar `apps/mobile/src/app/daily-workspace.offline.spec.tsx`, `apps/mobile/src/app/daily-workspace.permissions.spec.tsx`.

- [ ] Escrever testes de cache HIT/MISS, logout/troca de tenant, limpeza 401/403, zero mutações offline, matriz de permissões e conteúdo cacheado em até 500 ms nos perfis Android e iOS do Jest Expo.
- [ ] Executar specs e confirmar falhas de comportamento remanescentes.
- [ ] Corrigir apenas integração de apresentação/cache necessária para satisfazer os testes.
- [ ] Executar todos os testes mobile do Daily Workspace e `npm run typecheck --workspace=@quadro/mobile` até PASS.

**Depende de:** T025. **Produz:** Gate 3 e 4 Expo.

## Integração e verificação final

### T027 — Criar massa E2E Web e fluxo nativo Android/iOS

**Arquivos:** Criar `e2e/fixtures/daily-workspace.ts`, `e2e/daily-workspace.spec.ts`, `apps/mobile/src/app/daily-workspace.android-ios.integration.spec.tsx`; Modificar `playwright.config.ts` somente se o projeto Web ainda não estiver registrado.

- [ ] Escrever cenários Playwright para P1/P2/P3, borda temporal, deduplicação, usuário sem permissão e tenant alternado; escrever cenário Jest Expo parametrizado para plataformas Android e iOS com os mesmos rótulos, ordem, permissão, dia São Paulo e modo offline.
- [ ] Executar `npx playwright test e2e/daily-workspace.spec.ts` e confirmar falha inicial.
- [ ] Implementar fixtures com dois tenants e relógio controlado, sem depender de dados de produção.
- [ ] Executar Playwright e `npm run test:daily-workspace --workspace=@quadro/mobile` até PASS, registrando os dois perfis nativos.

**Depende de:** T019, T026. **Produz:** evidência SC-001, SC-002, SC-003, SC-005 e SC-006.

### T028 — Testar offline sem mutation em nível de transporte

**Arquivos:** Criar `e2e/daily-workspace-offline.spec.ts`, `apps/api/src/modules/daily-workspace/daily-workspace.performance.spec.ts`.

- [ ] Escrever teste que bloqueia rede após cache e intercepta POST/PATCH/DELETE/upload, esperando contagem zero; escrever teste de p95 com fixture de 100 itens; medir primeira renderização de cache por `performance.now()` em Web e nas suites Jest Expo Android/iOS, esperando no máximo 500 ms.
- [ ] Executar os testes e confirmar falha antes de ajustes finais.
- [ ] Ajustar cache/interceptor ou consulta Prisma apenas se os testes revelarem envio indevido, p95 superior a 1,5 s ou renderização cacheada superior a 500 ms.
- [ ] Executar todos os testes de transporte/performance até PASS e registrar p95 e as três medições de renderização em `docs/verification/daily-workspace-baseline.md`.

**Depende de:** T027. **Produz:** evidência SC-004 e NFR-001.

### T029 — Executar gates de regressão

**Arquivos:** Modificar `docs/verification/daily-workspace-baseline.md`.

- [ ] Rodar API unit/contract, Web tests, mobile tests, Playwright e os três builds do quickstart.
- [ ] Registrar comando, data, duração, resultado e qualquer falha preexistente.
- [ ] Corrigir somente regressões introduzidas pela feature usando teste vermelho antes da alteração.
- [ ] Reexecutar a suite afetada e a suite completa até PASS.

**Depende de:** T028. **Produz:** Gate 5 verificável.

### T030 — Revisar segurança, contrato e acessibilidade

**Arquivos:** Criar `docs/verification/daily-workspace-review.md`.

- [ ] Comparar resposta real de `/daily-workspace` com `specs/002-daily-workspace/contracts/README.md`.
- [ ] Revisar queries por `tenantId`, guards, limpeza de cache e ausência de token no armazenamento de payload.
- [ ] Rodar teclado/leitor de tela Web e accessibilityLabel Expo nos fluxos P1–P3; registrar resultado.
- [ ] Corrigir qualquer divergência com teste correspondente e revalidar.

**Depende de:** T029. **Produz:** Gates 1, 3 e 4 completos.

### T031 — Atualizar documentação de produto após verificação

**Arquivos:** Modificar `MOBILE_APP.md`, `FEATURES.md`, `README.md`.

- [ ] Escrever a atualização somente com capacidades que passaram T029/T030.
- [ ] Confirmar que documentação declara explicitamente cache somente leitura e dia São Paulo.
- [ ] Revisar links para Início/Trabalho/Agenda/Mais e permissões.
- [ ] Executar uma varredura por marcadores de trabalho pendente em `specs/002-daily-workspace` e `docs/verification`, resolvendo qualquer ocorrência nova.

**Depende de:** T030. **Produz:** documentação de entrega fiel.

### T032 — Handoff de implementação

**Arquivos:** Modificar `specs/002-daily-workspace/checklists/requirements.md` apenas para registrar evidências verificadas; Criar `docs/verification/daily-workspace-handoff.md`.

- [ ] Relacionar cada FR/SC às saídas de T029/T031 sem marcar requisito não executado como concluído.
- [ ] Confirmar que o diff não contém migration, fila de mutações ou escrita offline.
- [ ] Incluir no handoff links para comandos, relatórios e limitações remanescentes (se houver).
- [ ] Fazer revisão final do diff e entregar para revisão humana; não fazer commit automaticamente.

**Depende de:** T031. **Produz:** pacote de handoff auditável.
