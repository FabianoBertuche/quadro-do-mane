# Pesquisa e decisões — Daily Workspace

## Decisão 1 — Compor o painel no backend

**Decisão:** criar `GET /daily-workspace` como uma projeção de leitura no NestJS, em vez de fazer cinco requisições independentes em cada cliente.

**Motivo:** o servidor já tem o contexto de tenant, `tenantUserId`, permissões e Prisma. Ele pode calcular uma única fronteira de dia São Paulo e deduplicar responsabilidades principal/adicional antes de enviar dados. Também permite indisponibilidade por seção sem quebrar a tela inteira.

**Alternativas rejeitadas:**

- Clientes chamarem `/tasks`, `/daily-routine`, `/events` e `/events/reminders` em paralelo: aumenta divergência de fuso, duplicação de regras e falhas parciais diferentes entre Web e Expo.
- Novo modelo materializado no banco: adiciona manutenção e latência de atualização sem necessidade; o painel é uma projeção atual do domínio existente.

**Consequência:** o endpoint é somente leitura e os endpoints granulares existentes continuam como contrato de detalhe e mutação.

## Decisão 1A — Guard de leitura agregada é OR e isolado

**Decisão:** criar `apps/api/src/common/guards/daily-workspace-read.guard.ts` com a classe `DailyWorkspaceReadGuard`, injetando `PrismaService`. Ela aceita admin; para os demais, aceita quando `request.user.permissions` contém ao menos uma de `tasks.view`, `calendar.view` ou `daily_routine.view`. Se o snapshot JWT não satisfaz o OR, ela replica o fallback do `PermissionGuard`: consulta `rolePermission.findMany({ where: { roleId: user.roleId } })`; se vazio, resolve `role.findFirst({ where: { name: user.roleName } })` e consulta novamente pelo UUID encontrado. Os códigos retornados substituem `request.user.permissions` antes da decisão OR. Sem usuário/permissões, falha de banco ou nenhum código elegível, responde 403. O controller `DailyWorkspaceController` aplica `AuthGuard('jwt')`, `TenantContextGuard` e esse guard, sem aplicar `PermissionGuard` a essa rota.

**Motivo:** o guard atual de permissões atende endpoints que exigem capacidades cumulativas e não deve ser presumido como OR. Isolar a semântica deixa o contrato auditável e não altera as rotas existentes.

**Teste obrigatório:** `apps/api/src/common/guards/daily-workspace-read.guard.spec.ts` cobre zero permissões, cada uma das três permissões isoladamente, permissões combinadas, request sem usuário/permissões, JWT desatualado sem permissão elegível cuja consulta atual ao banco devolve `calendar.view` (permite e atualiza o snapshot) e banco atual sem permissão elegível (403).

## Decisão 2 — Data canônica em America/Sao_Paulo

**Decisão:** a API aceita `date=YYYY-MM-DD` e a interpreta como data civil São Paulo; sem parâmetro, usa o dia atual naquele fuso. Retorna `referenceDate`, `rangeStart` e `rangeEnd` ISO para auditoria do cliente.

**Motivo:** o uso atual de `new Date()` e de `toISOString().split('T')` pode divergir para pessoas em outros fusos ou perto da meia-noite UTC.

**Alternativas rejeitadas:** confiar no relógio/fuso do dispositivo ou enviar instantes UTC de cada cliente. Ambas produzem resultados diferentes entre Web, Android e iOS.

**Consequência:** adicionar Luxon (ou `date-fns-tz`, conforme dependência já aprovada) somente no backend/utility compartilhada; cobrir fronteiras do dia com relógio fixo.

## Decisão 3 — Paridade por contrato e fluxo, não por pixels

**Decisão:** definir os mesmos rótulos, seções, estados e permissões para Next.js e Expo, permitindo layout responsivo nativo em cada plataforma.

**Motivo:** Web e mobile têm padrões de interação distintos; tentar compartilhar tela visual reduziria usabilidade, enquanto compartilhar tipos, cliente HTTP, regras e casos E2E preserva comportamento.

**Alternativa rejeitada:** manter tabs antigas (Dashboard/Tarefas/Projetos/Mais) e somente adicionar links internos. Não atende à navegação aprovada e dificulta descoberta.

## Decisão 4 — Cache offline de leitura, sem fila

**Decisão:** implementar um `ReadCache` com TTL e metadados de sincronização. Web usa IndexedDB; Expo usa AsyncStorage para payload não sensível. Tokens continuam no mecanismo seguro existente. Em offline, somente GET cacheado é servido.

**Motivo:** satisfaz consulta em campo com baixo risco de conflitos e sem guardar credenciais no cache de conteúdo.

**Alternativas rejeitadas:** Service Worker com mutations em fila e sincronização posterior; exige resolução de conflito, revalidação de permissão e semântica de upload, explicitamente fora de escopo.

**Consequência:** adaptador bloqueia métodos mutáveis antes do transporte, interfaces desabilitam ações e invalida depois de qualquer escrita online exitosa.

## Decisão 4A — Runners de teste declarados antes das telas

**Decisão:** manter `node:test` + `ts-node/register` para API e utils, pois já há o runner real `test:events`. Adotar Vitest + jsdom para Next e Jest + `jest-expo` apenas para unidade/componente Expo. Usar Detox para fluxos e tempo em emuladores Android/iOS reais. As dependências e configurações são adicionadas pela T001 antes do primeiro spec de cada cliente.

**Configurações e scripts que passam a existir:**

- API: `apps/api/package.json` ganha `test:daily-workspace` com `node -r ts-node/register --test` e os specs explicitamente listados.
- Utils (nome real do workspace: `utils`): criar `packages/utils/tsconfig.json`, estendendo `../../tsconfig.json`, com `rootDir: './src'`, `outDir: './dist'`, `noEmit: true` e `include: ['src/**/*.ts']`; `packages/utils/package.json` ganha `ts-node`, `test:daily-workspace` e `typecheck`.
- Consumo de utils: API, Web e Expo declaram `"utils": "workspace:*"` em seus `package.json` e importam de `utils`. API adiciona o path `"utils": ["../../packages/utils/src"]` em `apps/api/tsconfig.json`; Next já transpila `utils` em `apps/web/next.config.js`; Metro já observa o workspace e resolve o `node_modules` raiz em `apps/mobile/metro.config.js`. `packages/utils/src/index.ts` reexporta `daily-workspace.ts` e `read-cache.ts`.
- Next: `apps/web/package.json` ganha `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom` e `fake-indexeddb`; `apps/web/vitest.config.ts` usa ambiente jsdom/alias `@`, `apps/web/src/test/setup.ts` carrega matchers, e `test:daily-workspace` executa `vitest run --config vitest.config.ts`.
- Expo unidade/componente: `apps/mobile/package.json` ganha `jest`, `jest-expo`, `@testing-library/react-native`, `@types/jest`, `@react-native-async-storage/async-storage` e `@react-native-community/netinfo`; `apps/mobile/jest.config.js` usa `jest-expo`, `apps/mobile/src/test/setup.ts` contém mocks de AsyncStorage/NetInfo, e `test:daily-workspace` executa Jest uma vez.
- Expo emulador/performance: `apps/mobile/package.json` ganha `detox`; `apps/mobile/.detoxrc.js`, `apps/mobile/e2e/jest.config.js` e `apps/mobile/e2e/daily-workspace.e2e.ts` configuram builds e testes `android.emu.debug` e `ios.sim.debug`. Os scripts `build:e2e:android`, `test:e2e:android`, `build:e2e:ios` e `test:e2e:ios` executam Detox. O teste mede no host monotônico o intervalo até `testID="daily-workspace-content-ready"` estar visível no emulador, com timeout/assert de 500 ms.

**Motivo:** lint/build não substituem testes de componente; os runners resolvem TypeScript, DOM nulo e APIs nativas mockadas de maneira reproduzível.

## Decisão 5 — Autorização em duas camadas

**Decisão:** os clientes recebem permissões da sessão para compor visibilidade, mas qualquer operação continua pelos `RequirePermissions` e `PermissionGuard` da API.

**Motivo:** menus seguros e UX clara sem confiar no cliente para decisão de acesso.

**Alternativa rejeitada:** inferir autorização pelo papel textual (`admin`, `gestor`) em telas novas. Falha para papéis customizados e contradiz o modelo de permissões.

## Decisão 6 — Sem mudanças de banco na primeira entrega

**Decisão:** reusar `Task`, `TaskAssignee`, `TaskChecklist`, `TaskChecklistItem`, `TaskComment`, `Attachment`, `Event`, `EventAttendee`, `EventReminderAction`, `DailyRoutineItem` e `DailyRoutineLog`.

**Motivo:** todos os dados necessários existem. A agregação é uma projeção e o cache é local ao cliente.

**Condição de reavaliação:** se p95 de `/daily-workspace` exceder 1,5 s após índices/consultas otimizados, medir plano de consulta antes de considerar tabela de snapshot.
