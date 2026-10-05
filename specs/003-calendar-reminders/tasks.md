# Tarefas — Calendário e lembretes

**Convenções:** executar cada tarefa na ordem. “RED” significa teste novo que falha pela ausência/comportamento incorreto; só então escrever a implementação mínima e confirmar “GREEN”. Não fazer commit nesta execução de planejamento. Caminhos são relativos à raiz do monorepo. O contrato de referência é [`contracts/README.md`](contracts/README.md).

## Dependências e paralelismo

```text
T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009 → T010
                  └───────────────────────────────────────→ T011 → T012 → T013 → T017 → T018
                                                          └→ T014 → T015 → T016 ──────┘
```

Após T010, Web (T011–T013) e Expo (T014–T016) podem ocorrer em paralelo. Não editar `apps/api/src/modules/events/events.service.ts` em paralelo. T017 depende das duas trilhas; T018 depende de T017.

## Fundação compartilhada

### T001 — Instalar e validar runners de teste de calendário

**Arquivos:** Modificar `apps/api/package.json`, `apps/web/package.json`, `apps/mobile/package.json`, `packages/utils/package.json`; Criar `apps/web/vitest.config.ts`, `apps/web/src/test/setup.ts`, `apps/mobile/jest.config.js`, `apps/mobile/src/test/setup.ts`, `packages/utils/vitest.config.ts`.

**Depende de:** nenhuma. **Produz:** scripts usados por todas as tarefas posteriores.

- [ ] Registrar em `specs/003-calendar-reminders/quickstart.md` a saída inicial de `npm --workspace=api run test:events`, `npm --workspace=web run build` e `npm --workspace=@quadro/mobile run lint`; não alterar falha preexistente não relacionada.
- [ ] Adicionar ao Web as devDependencies `vitest@^2`, `jsdom@^25`, `@testing-library/react@^16`, `@testing-library/jest-dom@^6`, `@testing-library/user-event@^14`, com `test:calendar: "vitest run src/components/calendar src/lib/calendar-api.spec.ts"`; configurar ambiente jsdom e import de `@testing-library/jest-dom/vitest` em setup.
- [ ] Adicionar ao Expo `jest@^29`, `jest-expo@~57.0.0`, `@testing-library/react-native@^13`, `test:calendar: "jest --runInBand --testPathPattern=calendar|push"` e `typecheck: "tsc --noEmit"`; configurar `preset: 'jest-expo'`, alias `@/` e setup sem notificações reais.
- [ ] Adicionar ao utils Vitest 2, config node e `test:calendar: "vitest run src/calendar-*.spec.ts"`; no API adicionar `test:calendar: "node -r ts-node/register --test src/modules/events/events.service.spec.ts src/modules/events/events.controller.spec.ts src/modules/events/calendar-contract.spec.ts"`.
- [ ] Executar `npm install`; criar um spec sentinela mínimo por runner e executar cada `test:calendar` até alcançar o runner (RED permitido apenas pela feature ainda ausente, não por configuração); remover sentinelas se não forem parte de T002/T011/T014.

### T002 — Definir contrato compartilhado e cache `calendar:v2`

**Arquivos:** Criar `packages/utils/src/calendar-contract.ts`, `packages/utils/src/calendar-contract.spec.ts`, `packages/utils/src/calendar-cache.ts`, `packages/utils/src/calendar-cache.spec.ts`; Modificar `packages/utils/src/index.ts`.

**Depende de:** T001. **Consome:** versão e entidades de `data-model.md`. **Produz:** `CALENDAR_CONTRACT_VERSION`, `CalendarEventPage`, `CalendarEventDetail`, `CalendarMutationResult`, `CalendarReadCache`, `calendarCacheKey`, `assertCalendarReadOnlyWhenOffline`.

- [ ] RED: testar que `calendarCacheKey` muda para viewer, target, resource, cursor/intervalo ou `schemaVersion`, e que `assertCalendarReadOnlyWhenOffline('PATCH', false)` lança `OfflineReadOnlyError` antes de chamar um transporte falso.
- [ ] Rodar `npm --workspace=utils run test:calendar`; confirmar falha por módulo/export ausente.
- [ ] GREEN: implementar tipos puros e chave exatamente `calendar:v2:2026-09-09:{tenantId}:{viewer}:{target}:{resource}:{fingerprint}`, TTLs 10/30/5 minutos e bloqueio de `POST`, `PATCH`, `DELETE` offline; exportar no índice.
- [ ] Rodar o mesmo comando e `npx tsc --noEmit -p packages/utils/tsconfig.json` se esse arquivo existir; se não existir, registrar a lacuna e validar por `npm --workspace=utils run test:calendar` sem inventar um compilador diferente.

### T003 — Implementar limites São Paulo, interseção e cursor estáveis

**Arquivos:** Criar `packages/utils/src/calendar-time.ts`, `packages/utils/src/calendar-time.spec.ts`; Criar `apps/api/src/common/calendar/calendar-time.ts`, `apps/api/src/common/calendar/calendar-time.spec.ts`.

**Depende de:** T002. **Produz:** `getCalendarRange(view, anchorDate)`, `intersectsRange`, `toSaoPauloDateKey`, `encodeCalendarCursor`, `decodeCalendarCursor`.

- [ ] RED: escrever testes com `2026-09-09T02:59:59.999Z` e `2026-09-09T03:00:00.000Z`, mês/semana/dia, evento que cruza meia-noite e cursor com `startAt,endAt,id`; testar rejeição de cursor cujo fingerprint difere da consulta.
- [ ] Executar `npm --workspace=utils run test:calendar` e `npm --workspace=api run test:calendar`; confirmar falha porque os helpers não existem.
- [ ] GREEN: usar `Intl.DateTimeFormat` com `America/Sao_Paulo`, intervalo `[start,end)`, comparação de instantes e cursor base64url assinado/validado pelo fingerprint da consulta (sem expor tenant ou id bruto como autoridade).
- [ ] Executar ambos os runners; remover qualquer uso novo de offset `-03:00` fixo dos helpers.

## API: contrato, autorização e persistência

### T004 — Migrar lista para envelope paginado e visibilidade pessoal

**Arquivos:** Criar `apps/api/src/common/calendar/calendar-contract.ts`, `apps/api/src/modules/events/dto/calendar-events-query.dto.ts`, `apps/api/src/modules/events/events.controller.spec.ts`, `apps/api/src/modules/events/calendar-contract.spec.ts`; Modificar `apps/api/src/modules/events/events.controller.ts`, `apps/api/src/modules/events/events.service.ts`.

**Depende de:** T003. **Produz:** `EventsService.listCalendarEvents(context, query): Promise<CalendarEventPage>` e `CalendarActorContext`.

- [ ] RED: no service, cobrir criador/responsável/participante, não envolvido, outro tenant, admin com alvo ativo, admin sem `calendar.view`, não-admin com alvo diverso, 101 registros/cursor e evento que intersecta a janela; no controller, cobrir 200 envelope, 400 range/cursor, 401, 403, 404 do alvo e 406 de versão.
- [ ] Rodar `npm --workspace=api run test:calendar`; confirmar falha porque `GET /events` ainda retorna array e/ou aceita a visibilidade anterior.
- [ ] GREEN: validar query, derivar usuário-alvo pela matriz, paginar por `(startAt,endAt,id)`, filtrar sempre `tenantId` e `OR` de criador/responsável/attendee do alvo. Responder com `contractVersion`, `timeZone`, range e cursor. Normalizar somente os parâmetros legados documentados no contrato durante a migração.
- [ ] Rodar `npm --workspace=api run test:calendar`; conferir que o controller declara explicitamente a rota/ordem de `reminders` antes de `:id`.

### T005 — Proteger detalhe pelo mesmo predicado e capabilities não autoritativas

**Arquivos:** Modificar `apps/api/src/modules/events/events.controller.ts`, `apps/api/src/modules/events/events.service.ts`, `apps/api/src/modules/events/events.service.spec.ts`, `apps/api/src/modules/events/events.controller.spec.ts`.

**Depende de:** T004. **Produz:** `EventsService.getCalendarEvent(context, id, targetTenantUserId): Promise<CalendarEventDetail>`.

- [ ] RED: testar detalhe permitido para cada tipo de envolvimento, 403 quando evento existe no mesmo tenant mas é invisível, 404 para id/tenant inexistente, admin mirando usuário selecionado e `can` retornado sem liberar endpoint direto.
- [ ] Executar `npm --workspace=api run test:calendar`; confirmar falha pelo `findOne(tenantId,id)` atual que não recebe ator.
- [ ] GREEN: substituir o uso público de `findOne` por consulta que aplica `tenantId`, alvo e predicado; preservar helper interno separado somente onde precisa de existência no tenant. Construir `can` a partir das permissões do contexto, mas manter guards do controller como autoridade.
- [ ] Executar o runner e testar diretamente `PATCH`/`DELETE` com permission ausente para comprovar que capability de UI não é bypass.

### T006 — Criar/editar ocorrência com recorrência e vínculos válidos

**Arquivos:** Modificar `apps/api/src/modules/events/dto/create-event.dto.ts`, `apps/api/src/modules/events/dto/update-event.dto.ts`, `apps/api/src/modules/events/events.controller.ts`, `apps/api/src/modules/events/events.service.ts`, `apps/api/src/modules/events/events.service.spec.ts`.

**Depende de:** T005. **Produz:** `createCalendarEvent(context,input)` e `updateCalendarOccurrence(context,id,input)`.

- [ ] RED: testar evento único, série semanal, limite 365/422 sem transação parcial, duração inválida, responsável/participante inativo ou cross-tenant, projeto/tarefa cross-tenant, criador/responsável deduplicados e alteração de datas de uma ocorrência que não altera irmã.
- [ ] Rodar `npm --workspace=api run test:calendar`; confirmar falha para atualização de data de ocorrência recorrente e/ou corpo `recurrence` novo.
- [ ] GREEN: adaptar DTOs ao corpo aninhado documentado, preservar adaptador de corpo plano transitório, validar todas as relações antes da transação, expandir no horário civil São Paulo até 365 e retornar os envelopes 201/200 de contrato.
- [ ] Rodar runner; confirmar que uma mutação com vínculo inválido não deixa `Event` nem `EventAttendee` parcialmente gravado.

### T007 — Adicionar atualização e exclusão de série com escopo formal

**Arquivos:** Criar `apps/api/src/modules/events/dto/update-event-series.dto.ts`; Modificar `apps/api/src/modules/events/events.controller.ts`, `apps/api/src/modules/events/events.service.ts`, `apps/api/src/modules/events/events.service.spec.ts`, `apps/api/src/modules/events/events.controller.spec.ts`.

**Depende de:** T006. **Produz:** `updateCalendarSeries(context,seriesId,input)` e respostas versionadas de exclusão.

- [ ] RED: testar `PATCH /events/series/:seriesId` autorizada, série de outro tenant, série invisível, campos de agenda/recorrência rejeitados com 422, propagação de título/participantes/vínculos para todas as irmãs e nenhum evento de outro `seriesId`; testar delete de ocorrência versus delete de série e remoção de ações dependentes.
- [ ] Executar `npm --workspace=api run test:calendar`; confirmar 404 para PATCH novo antes de implementá-lo.
- [ ] GREEN: declarar `@Patch('series/:seriesId')` antes de `@Patch(':id')` e mover `@Delete('series/:seriesId')` antes de `@Delete(':id')`; validar escopo e relações uma vez, aplicar `updateMany` limitado por `tenantId,seriesId`, substituir attendees por ocorrência em transação e devolver `updatedCount`. Atualizar deletes com envelope `contractVersion` e predicado do ator.
- [ ] Executar runner; confirmar que `seriesId` não pode selecionar registros de outro tenant e que o cliente precisa confirmar antes de chamar DELETE (testes de UI em T013/T016).

### T008 — Normalizar lembrete pessoal, dispensa e consulta

**Arquivos:** Modificar `apps/api/src/modules/events/events.controller.ts`, `apps/api/src/modules/events/events.service.ts`, `apps/api/src/modules/events/events.service.spec.ts`, `apps/api/src/modules/events/events.controller.spec.ts`.

**Depende de:** T007. **Produz:** `listPersonalReminders(context,limit)`, `dismissPersonalReminder(context,eventId,scope)`.

- [ ] RED: testar dois destinatários no mesmo evento, `DISMISS_DAY` no início de dia São Paulo, `DISMISS_FOREVER`, participante não envolvido, limite inválido e resposta com deep link mínimo; uma dispensa de A não deve alterar a consulta de B.
- [ ] Executar `npm --workspace=api run test:calendar`; confirmar falha pela resposta atual não versionada/sem `occurrenceId`/deep link.
- [ ] GREEN: reutilizar `EventReminderAction` sempre com `tenantId` e destinatário do contexto, usar helper São Paulo de T003 e responder contrato de lembrete. Manter `POST .../dismiss-day` e `dismiss-forever` sem ids de destinatário no corpo.
- [ ] Rodar runner e conferir que 404/403 seguem a distinção contratual sem revelar evento de outro tenant.

### T009 — Tornar job de push idempotente e conectar payload de deep link

**Arquivos:** Criar `apps/api/src/modules/events/events-reminder-push.spec.ts`; Modificar `apps/api/src/modules/events/events.service.ts`, `apps/api/src/modules/push/push.service.ts`, `apps/api/src/modules/admin/send-event-reminders.controller.ts`.

**Depende de:** T008. **Produz:** `sendCalendarReminderPushes(now)` e payload `EventReminderPushV1`.

- [ ] RED: com relógio fixo, testar envio por ocorrência/destinatário/dia, não reenvio em segunda execução, supressão individual dia/permanente, dois dispositivos do mesmo usuário, erro do provedor contado mas sem falhar o job e payload exatamente `{version,type,occurrenceId,eventId,deepLink}`.
- [ ] Rodar `npm --workspace=api run test:calendar`; confirmar falha no payload atual sem versão/deep link ou na métrica agregada.
- [ ] GREEN: criar registro `SEND` idempotente antes do envio (tratar conflito como duplicate), buscar dispositivos somente do destinatário/tenant, enviar payload mínimo e retornar `{checkedAt,sent,skippedDismissed,skippedDuplicate,failed}`. Não registrar token/payload inteiro em log.
- [ ] Executar runner; conferir que o endpoint admin continua protegido pelo segredo e não aceita requisição de cliente comum.

### T010 — Congelar contrato API e regressões de segurança

**Arquivos:** Modificar `apps/api/src/modules/events/calendar-contract.spec.ts`, `apps/api/src/modules/events/events.service.spec.ts`, `apps/api/src/modules/events/events.controller.spec.ts`; Criar `apps/api/src/modules/events/calendar-authorization.spec.ts` e `apps/api/src/modules/events/calendar-volume.spec.ts`; atualizar `apps/api/package.json` para incluí-los no `test:calendar`.

**Depende de:** T009. **Produz:** gate API para FR-001–FR-016.

- [ ] RED: transformar a matriz inteira de `contracts/README.md` em testes tabelados (operação × permission × creator/assignee/attendee/outsider × admin/alvo × tenant), e testar shape/error code de todas as rotas.
- [ ] Executar `npm --workspace=api run test:calendar`; corrigir somente falhas de implementação, não enfraquecer testes para acomodar endpoint legado não documentado.
- [ ] GREEN: ajustar serializadores/guards/serviços ao contrato e validar plano de consulta em fixture de 10.000 eventos; adicionar migration/index somente se medição documentar falta de índice, incluindo migration em `apps/api/prisma/migrations/<timestamp>_calendar_query_indexes/migration.sql` e schema correspondente.
- [ ] Executar `npm --workspace=api run test:calendar` e `npm --workspace=api run build`; registrar contagem de testes e saída no quickstart/artefato de verificação da implementação.

## Web

### T011 — Criar adaptador Web de contrato, cache e links

**Arquivos:** Criar `apps/web/src/lib/calendar-api.ts`, `apps/web/src/lib/calendar-api.spec.ts`, `apps/web/src/lib/calendar-cache.ts`, `apps/web/src/lib/calendar-cache.spec.ts`, `apps/web/src/lib/calendar-deep-link.ts`, `apps/web/src/lib/calendar-deep-link.spec.ts`; Modificar `apps/web/src/lib/api.ts`, `apps/web/src/lib/auth.ts` se necessário para hooks de limpeza.

**Depende de:** T002, T010. **Produz:** `getCalendarPage`, `getCalendarEvent`, `mutateCalendarEvent`, `getPersonalReminders`, `calendarWebCache` e `eventWebHref`.

- [ ] RED: testar query/headers de contrato, envelope paginado, chave isolada para alvo admin, HIT/MISS/TTL IndexedDB, limpeza em logout/troca de tenant/401/403, invalidação depois de 2xx e `OfflineReadOnlyError` antes do mock Axios.
- [ ] Executar `npm --workspace=web run test:calendar`; confirmar que o antigo cliente espera array e não possui cache versionado.
- [ ] GREEN: implementar adaptador tipado com `Accept-Calendar-Contract`, armazenamento sem token, e URLs `/calendar/events/{id}`; conectar interceptador/handler de sessão já existente sem repetir mutação após 401.
- [ ] Rodar runner e `npm --workspace=web run build`; não guardar dados de push fora de ids/deep link.

### T012 — Construir Web mensal/semanal/diário/lista para grande volume

**Arquivos:** Criar `apps/web/src/components/calendar/CalendarShell.tsx`, `CalendarShell.spec.tsx`, `CalendarViews.tsx`, `CalendarViews.spec.tsx`, `CalendarOfflineBanner.tsx`; Modificar `apps/web/src/app/(app)/calendar/page.tsx`.

**Depende de:** T003, T011. **Produz:** `CalendarShell` com `view: 'month' | 'week' | 'day' | 'list'` e carregamento incremental.

- [ ] RED: testar todas as abas, navegação por âncora, ordenação e interseção São Paulo, 101 itens com controle “carregar mais”, contagem de overflow acessível, seletor admin só quando autorizado, loading/vazio/400/403/404 e banner offline com `savedAt`.
- [ ] Rodar `npm --workspace=web run test:calendar`; confirmar falha por tela atual exclusivamente mensal e resposta array.
- [ ] GREEN: trocar a página por shell que usa o adaptador T011; renderizar componentes por visão sem filtrar segurança no cliente, preservar alvo/query/cursor e oferecer lista acessível como rota de escape de sobreposição.
- [ ] Executar runner e build; verificar por teste que a UI não envia `tenantUserId` externo para não-admin.

### T013 — Construir detalhe, formulário e ações Web

**Arquivos:** Criar `apps/web/src/components/calendar/EventDetailModal.tsx`, `EventDetailModal.spec.tsx`, `EventFormModal.tsx`, `EventFormModal.spec.tsx`, `EventDeleteConfirm.tsx`, `EventDeleteConfirm.spec.tsx`; Criar `apps/web/src/app/(app)/calendar/events/[id]/page.tsx`; Modificar `apps/web/src/app/(app)/calendar/page.tsx`.

**Depende de:** T012. **Produz:** detalhe por modal e rota, criação/edição de ocorrência/série e deep link Web.

- [ ] RED: testar mostrar responsável, participantes, projeto/tarefa, recorrência e lembrete; seleção “esta ocorrência”/“toda a série”; confirmação de delete; validação de fim posterior; erros 403/404/422; ação mutável desabilitada/bloqueada offline; deep link abre detalhe correto.
- [ ] Rodar `npm --workspace=web run test:calendar`; confirmar falha por detalhe atual somente leitura e formulário sem edição/exclusão.
- [ ] GREEN: implementar formulário com body de contrato, busca de usuários/vínculos pelos endpoints existentes autorizados, modal/route compartilhando componente e invalidação de cache/query após 2xx. Não adicionar endpoint de usuários/projetos/tarefas sem colocá-lo em mudança contratual aprovada.
- [ ] Executar runner e build; confirmar com teste que selecionar “série” nunca usa `PATCH /events/:id` ou `DELETE /events/:id`.

## Expo Android/iOS

### T014 — Criar adaptador Expo de contrato e cache somente leitura

**Arquivos:** Criar `apps/mobile/src/lib/calendar-api.ts`, `apps/mobile/src/lib/calendar-api.spec.ts`, `apps/mobile/src/lib/calendar-cache.ts`, `apps/mobile/src/lib/calendar-cache.spec.ts`; Modificar `apps/mobile/src/lib/api.ts`, `apps/mobile/src/lib/auth.ts`/`session.ts` somente para limpeza de contexto existente.

**Depende de:** T002, T010. **Produz:** adaptador Expo com AsyncStorage, `getCalendarPage`, `getCalendarEvent`, mutações e erro offline tipado.

- [ ] RED: testar header/shape do contrato, cache AsyncStorage segregado por viewer/alvo, TTL/limpeza, fallback offline de página/detalhe, cache MISS e bloqueio de POST/PATCH/DELETE antes do mock Axios.
- [ ] Executar `npm --workspace=@quadro/mobile run test:calendar`; confirmar falha por módulo ausente.
- [ ] GREEN: implementar cache sem tokens e sem mutações, interceptar só por adaptador de calendário, invalidar contextos após escrita online e expor estado `savedAt` formatável em São Paulo.
- [ ] Rodar runner e `npm --workspace=@quadro/mobile run typecheck`.

### T015 — Construir telas Expo para mês/semana/dia/lista e detalhe

**Arquivos:** Criar `apps/mobile/src/components/calendar/CalendarScreen.tsx`, `CalendarScreen.spec.tsx`, `CalendarViews.tsx`, `CalendarViews.spec.tsx`, `EventDetailScreen.tsx`, `EventDetailScreen.spec.tsx`; Criar `apps/mobile/src/app/calendar/[id].tsx`; Modificar `apps/mobile/src/app/calendar.tsx`, `apps/mobile/src/app/_layout.tsx` se a rota precisar de configuração.

**Depende de:** T003, T014. **Produz:** calendário Expo e destino de detalhe `/calendar/[id]`.

- [ ] RED: testar quatro modos, mudança de intervalo, evento cruzando dia, lista paginada/carregar mais, overflow acessível, admin selector condicionado, loading/vazio/erro, banner offline e navegação `router.push('/calendar/{id}')`.
- [ ] Rodar `npm --workspace=@quadro/mobile run test:calendar`; confirmar falha pela tela SectionList única atual.
- [ ] GREEN: substituir `calendar.tsx` por shell usando componentes, `useFocusEffect` e adaptador T014; manter rolagem nativa/virtualização e não renderizar mais de uma página inteira quando cursor não foi solicitado.
- [ ] Executar runner e typecheck; conferir labels de acessibilidade em alternadores, cards, overflow e carregar mais.

### T016 — Adicionar formulário, escopo de série e deep link de push Expo

**Arquivos:** Criar `apps/mobile/src/components/calendar/EventForm.tsx`, `EventForm.spec.tsx`, `EventDeleteConfirm.tsx`, `EventDeleteConfirm.spec.tsx`; Modificar `apps/mobile/src/app/event-create.tsx`, `apps/mobile/src/app/calendar/[id].tsx`, `apps/mobile/src/lib/push.ts`, `apps/mobile/src/app/_layout.tsx`.

**Depende de:** T015. **Produz:** criar/editar/excluir ocorrência/série e listener de resposta de notificação hidratado.

- [ ] RED: testar criação única/série, edição de ocorrência/série com rotas corretas, confirmação DELETE, validação de data/vínculo, erro 403/404/422, offline sem request e `NotificationResponse` de payload v1 navegando para id correto depois da hidratação da sessão.
- [ ] Rodar `npm --workspace=@quadro/mobile run test:calendar`; confirmar falha pelo listener atual que apenas abre o app.
- [ ] GREEN: compartilhar form nativo entre criar/editar, usar `Alert`/modal de confirmação, limpar cache depois de 2xx e instalar listener único que valida `version/type/occurrenceId`, aguarda `useAuthStore`/sessão e chama Expo Router. Não renderizar dados do payload como detalhe.
- [ ] Executar runner e typecheck; testar que payload inválido não navega nem lança exceção.

## Paridade e verificação

### T017 — Executar matriz de paridade, autorização e offline entre clientes

**Arquivos:** Criar `apps/web/src/components/calendar/calendar-parity.spec.tsx`, `apps/mobile/src/components/calendar/calendar-parity.spec.tsx`, `apps/api/src/modules/events/calendar-parity.fixture.ts`; Modificar somente adaptadores/telas diretamente demonstrados pelos testes.

**Depende de:** T013, T016. **Produz:** testes comuns de FR-002–FR-019.

- [ ] RED: criar fixture canônica com evento único, série, sobreposição, fronteira, 101 itens, dois destinatários e admin; em cada cliente testar as mesmas decisões de view/ordem/erro/permissão/offline/deep link.
- [ ] Rodar `npm --workspace=web run test:calendar` e `npm --workspace=@quadro/mobile run test:calendar`; identificar divergências de comportamento, não diferenças visuais nativas.
- [ ] GREEN: ajustar somente mapeamento/estado/cache/navegação necessário para que ambos consumam mesma fixture e semântica; não ocultar falha de API com filtro local.
- [ ] Reexecutar ambos os runners e `npm --workspace=api run test:calendar`; registrar resultado da matriz para SC-002–SC-008.

### T018 — Verificação final de contrato, build e cenário manual

**Arquivos:** Criar `specs/003-calendar-reminders/verification.md` na execução de implementação; não modificar produção nesta tarefa.

**Depende de:** T017.

- [ ] Reler `spec.md`, `contracts/README.md` e a matriz de cobertura do `plan.md`; marcar FR-001 a FR-020 e SC-001 a SC-008 com o arquivo/teste que as evidencia.
- [ ] Executar, nesta ordem, `npm --workspace=utils run test:calendar`, `npm --workspace=api run test:calendar`, `npm --workspace=web run test:calendar`, `npm --workspace=@quadro/mobile run test:calendar`, `npm --workspace=api run build`, `npm --workspace=web run build`, `npm --workspace=@quadro/mobile run typecheck`.
- [ ] Executar o cenário manual do `quickstart.md` em Web, Android e iOS, incluindo logout/troca de tenant offline e toque de notificação com dispositivo de teste; registrar ambiente, horário e resultado em `verification.md` sem tokens/PII.
- [ ] Fazer scan de contrato: `rg -n "(/events|/push-devices|send-event-reminders)" apps packages` e comparar cada uso com `contracts/README.md`; documentar e corrigir qualquer consumidor que espere a lista legada sem envelope.
