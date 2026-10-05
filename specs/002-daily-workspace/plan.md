# Plano de implementação — Daily Workspace

**Spec fonte:** [`spec.md`](spec.md)
**Contratos:** [`contracts/README.md`](contracts/README.md)
**Modelo:** [`data-model.md`](data-model.md)

## Contexto técnico

| Área | Escolha |
|---|---|
| Backend | NestJS, Prisma/PostgreSQL, guards JWT/tenant/permissão existentes |
| Web | Next.js, TypeScript, TanStack Query, Tailwind |
| Mobile | Expo/React Native, Expo Router, TypeScript |
| Tempo | `America/Sao_Paulo`, utilitário de intervalo único no backend |
| Offline | adaptadores IndexedDB (Web) e AsyncStorage (Expo), somente GET |
| Testes API/utils | `node:test` + `ts-node/register` |
| Testes Web | Vitest + jsdom + Testing Library |
| Testes Expo de unidade | Jest + `jest-expo` + React Native Testing Library |
| Testes Expo emulador/performance | Detox em Android Emulator e iOS Simulator reais |

## Arquitetura proposta

1. `DailyWorkspaceService` monta a projeção diária por tenant e usuário autenticado. Ele compartilha a função de fronteira de data com a rotina diária, consulta somente o tenant atual, une responsável principal e `TaskAssignee` sem duplicar `Task.id`, e devolve capabilities derivadas da sessão.
2. Clientes consomem o contrato comum por `daily-workspace-api.ts`, renderizam seus layouts próprios e recebem um `ReadCache` injetável. O transporte rejeita mutações em modo offline antes da rede.
3. A navegação remapeia rotas existentes para Início/Trabalho/Agenda/Mais sem remover deep links de projetos, detalhes, notificações ou áreas administrativas.

## Estrutura de arquivos planejada

| Arquivo | Responsabilidade |
|---|---|
| `apps/api/src/common/time/sao-paulo-day.ts` | validar data civil e calcular intervalo do dia |
| `apps/api/src/common/guards/daily-workspace-read.guard.ts` | autorização OR de leitura agregada |
| `apps/api/src/modules/daily-workspace/daily-workspace.service.ts` | projeção, deduplicação e capabilities |
| `apps/api/src/modules/daily-workspace/daily-workspace.controller.ts` | contrato GET protegido |
| `apps/api/src/modules/daily-workspace/*.spec.ts` | unidade e contrato backend |
| `apps/api/src/modules/daily-routine/daily-routine.service.ts` | substituir data UTC pela data São Paulo |
| `apps/web/vitest.config.ts` / `apps/web/src/test/setup.ts` | runner jsdom, alias e setup de testes Web |
| `apps/web/src/lib/read-cache.ts` | cache IndexedDB, limpeza 401/403 e offline gate |
| `apps/web/src/lib/daily-workspace-api.ts` | tipo e query do contrato diário |
| `apps/web/src/app/(app)/dashboard/page.tsx` | Início operacional (rota `/dashboard`) |
| `apps/web/src/app/(app)/tasks/page.tsx` | Trabalho, busca e filtros |
| `apps/web/src/app/(app)/calendar/page.tsx` | Agenda diária |
| `apps/web/src/components/layout/sidebar.tsx` | migração da Sidebar para Início/Trabalho/Agenda/Mais |
| `apps/mobile/jest.config.js` / `apps/mobile/src/test/setup.ts` | runner Expo e mocks de APIs nativas |
| `apps/mobile/.detoxrc.js` / `apps/mobile/e2e/jest.config.js` | builds Detox Android/iOS e runner de emulador |
| `apps/mobile/e2e/daily-workspace.e2e.ts` | fluxo nativo e métrica real de conteúdo cacheado |
| `apps/mobile/src/lib/read-cache.ts` | AsyncStorage cacheado, limpeza 401/403 e offline gate |
| `apps/mobile/src/lib/daily-workspace-api.ts` | tipos/consulta compartilhada mobile |
| `apps/mobile/src/app/(tabs)/dashboard.tsx` | Início operacional móvel |
| `apps/mobile/src/app/(tabs)/tasks.tsx` | Trabalho móvel |
| `apps/mobile/src/app/(tabs)/agenda.tsx` | Agenda móvel |
| `apps/mobile/src/app/(tabs)/_layout.tsx` | tabs Início/Trabalho/Agenda/Mais |
| `e2e/daily-workspace.spec.ts` | fluxos Web e permissões/offline |

### Migração da Sidebar Web

O entrypoint existente é `apps/web/src/components/layout/sidebar.tsx`, montado por `apps/web/src/app/(app)/layout.tsx`; não será criado um segundo componente de navegação concorrente. A migração substitui o array `navigation` atual por quatro destinos de nível principal: `/dashboard` → Início, `/tasks` → Trabalho, `/calendar` → Agenda e uma entrada Mais. Mais agrupa projetos, equipes, colaboradores, rotinas, contatos, e-mail, auditoria, atividades e configurações, filtrados pela permissão real. Links profundos atuais, incluindo `/projects/[id]`, `/daily-routine/*` e `/calendar`, continuam resolvendo; o destaque ativo deve considerar esses prefixos.

### Configuração executável dos testes

T001 adiciona scripts reais, não aliases hipotéticos: API `test:one`/`test:daily-workspace` usam `node -r ts-node/register --test`; o nome de workspace a usar nos comandos é exatamente `utils` e `packages/utils/tsconfig.json` existe. API, Web e Expo declaram `utils` como `workspace:*`; a API resolve-o pelo path explícito de `apps/api/tsconfig.json`, Next pelo `transpilePackages: ['utils', 'ui']` já presente, e Expo pelo `watchFolders`/`nodeModulesPaths` já presentes em `apps/mobile/metro.config.js`. Web usa `vitest run --config vitest.config.ts`; Jest Expo cobre apenas unidade e componente. Detox mede Android/iOS em emuladores reais.

```ts
// apps/web/vitest.config.ts
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'] },
});
```

```js
// apps/mobile/jest.config.js — somente unidade/componente
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
};
```

```ts
// apps/mobile/src/test/setup.ts — sem simular plataforma
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(async () => ({ isConnected: true, isInternetReachable: true })),
  addEventListener: jest.fn(() => jest.fn()),
}));
```

```js
// apps/mobile/.detoxrc.js
module.exports = {
  testRunner: { args: { $0: 'jest', config: 'e2e/jest.config.js' }, jest: { setupTimeout: 120000 } },
  apps: {
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      build: 'cd android && ./gradlew app:assembleDebug app:assembleAndroidTest -DtestBuildType=debug',
    },
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/QuadroDoMane.app',
      build: 'xcodebuild -workspace ios/QuadroDoMane.xcworkspace -scheme QuadroDoMane -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build',
    },
  },
  devices: {
    android: { type: 'android.emulator', device: { avdName: 'Pixel_5_API_35' } },
    ios: { type: 'ios.simulator', device: { type: 'iPhone 15' } },
  },
  configurations: {
    'android.emu.debug': { device: 'android', app: 'android.debug' },
    'ios.sim.debug': { device: 'ios', app: 'ios.debug' },
  },
};
```

T001 também adiciona `ios.bundleIdentifier: 'com.quadrodomane.app'` a `apps/mobile/app.config.js` antes de `expo prebuild`. T027 executa `npx expo prebuild --platform all --clean --no-install`, confirma os nomes `QuadroDoMane` gerados e executa `detox build/test -c android.emu.debug` e `detox build/test -c ios.sim.debug`. O E2E cronometra `Date.now()` antes de abrir a visão cacheada e exige que `by.id('daily-workspace-content-ready')` fique visível em no máximo 500 ms; isso é medição no emulador, não no Jest.

## Gates obrigatórios

### Gate 0 — Contrato e escopo

- Confirmar que não há migration ou fila offline no diff.
- Confirmar tipos de `DailyWorkspace` contra `contracts/README.md`.
- Confirmar que `DailyWorkspaceReadGuard` é o único guard de permissão da rota agregada, executa OR explícito e reproduz o fallback de banco `roleId` → `roleName` do `PermissionGuard` para JWT desatualado.
- Confirmar que qualquer dependência de fuso é escolhida e licenciada antes de instalação.

### Gate 1 — Segurança e tenant

- Cada método do serviço recebe tenant e usuário provenientes de `CurrentUser`.
- Consultas de tarefa, evento e rotina preservam `tenantId` e regras de visibilidade.
- Testar 401/403 e limpeza de cache na mudança de autorização/sessão.

### Gate 2 — Tempo e consistência

- Testes fixam relógio antes/depois de `03:00:00Z` e afirmam a data São Paulo.
- Testar evento que cruza a meia-noite e tarefa vencida/concluída.
- Testar deduplicação entre `Task.assigneeTenantUserId` e `TaskAssignee`.
- Testar `myTasks` e filtro por responsável contra os dois vínculos, retornando cada tarefa uma vez.

### Gate 3 — UX e paridade

- Validar as quatro entradas, ordem e rótulos em Web e Expo.
- Validar que ações e destinos ocultos não aparecem sem a permissão correspondente.
- Validar loading, vazio, erro, seção parcial e acessibilidade da Web.

### Gate 4 — Offline somente leitura

- Cortar a rede após cache 2xx e verificar conteúdo, timestamp e banner.
- Interceptar transporte e provar zero POST/PATCH/DELETE/upload offline.
- Verificar que logout/troca de tenant e respostas 401/403 removem as entradas do contexto anterior.
- Medir primeira renderização de cache em até 500 ms em Web e em runs Detox de Android Emulator/iOS Simulator reais.

### Gate 5 — Regressão e entrega

- Executar testes de unidade/API, Web, mobile, Playwright e builds descritos no quickstart.
- Revisar diff para não alterar contratos não relacionados nem dados de produção.
- Atualizar `MOBILE_APP.md` somente após a implementação ser verificada.

## Sequência

1. Estabelecer tipos, tempo São Paulo e contrato backend com testes vermelhos primeiro.
2. Implementar projeção diária e corrigir rotina para mesma regra de data.
3. Criar adaptadores de cache/gate offline e testes isolados Web/mobile.
4. Construir as três experiências verticais (Início, Trabalho, Agenda/navegação), guardadas por permission.
5. Executar E2E de paridade, permissões, fuso e offline; só então aceitar a entrega.

## Cobertura de requisito

| Requisito | Tarefas |
|---|---|
| FR-001 | T002–T006, T014, T017, T021, T024, T027 |
| FR-002 a FR-005 | T004–T006, T014, T021, T018, T025 |
| FR-006 a FR-008 | T007–T008, T015, T022 |
| FR-009 a FR-011 | T007, T016, T023, T027 |
| FR-012 a FR-015 | T004–T006, T013, T017–T019, T020, T024–T026 |
| FR-016 a FR-019 | T009–T012, T014, T017, T021, T024, T026, T028 |
| FR-020 | T013–T019, T020–T026, T030 |
| NFR-001 | T004, T028 |
| NFR-002 | T019, T026, T028 |
| NFR-003 a NFR-004 | T005–T012, T019, T026, T029–T030 |
| SC-001 a SC-006 | T027–T030 |
| SC-007 | T019, T026, T028 |
