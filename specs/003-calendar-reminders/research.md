# Pesquisa e decisões — Calendário e lembretes

## Decisão 1 — Uma consulta paginada por intervalo, não uma carga anual

**Decisão:** evoluir `GET /events` para resposta envelope `CalendarEventPage` com `startAt`, `endAt`, `cursor` e `limit`; o cursor é opaco e a ordenação é `startAt ASC, endAt ASC, id ASC`.

**Motivo:** as quatro visões têm intervalos diferentes e podem conter muitos eventos. Cursor evita truncamento invisível, página ilimitada e divergência de ordenação entre Web e Expo.

**Alternativas rejeitadas:** trazer todos os eventos do tenant para filtrar no cliente; e offset paginado. A primeira escala mal e vaza volume desnecessário; a segunda muda resultados quando eventos são inseridos durante a navegação.

**Consequência:** esta é uma mudança de contrato do endpoint existente e todos os consumidores devem migrar juntos conforme `contracts/README.md`; a lista antiga de array não permanece como resposta alternativa.

## Decisão 2 — Visibilidade pelo usuário-alvo, com exceção administrativa formal

**Decisão:** `EventsService` recebe contexto de ator (`tenantId`, `tenantUserId`, `roleName`, permissões) e, opcionalmente, um usuário-alvo. Apenas `roleName === 'admin'` com `calendar.view` pode usar alvo diverso; o serviço valida que o alvo está ativo no mesmo tenant e consulta criador/responsável/participante desse alvo.

**Motivo:** a regra solicitada é “somente eventos do usuário”; o administrador seleciona uma pessoa, não recebe uma lista transversal de todos os eventos.

**Alternativas rejeitadas:** aceitar `tenantUserId` de qualquer pessoa com `calendar.view`; ou deixar admin ignorar permissões. Ambas violam a fundação 001.

**Consequência:** o `findOne` atual, que filtra somente `id`/`tenantId`, deve mudar para usar o mesmo predicado e devolver 403 quando o evento existe no tenant mas está invisível ao ator.

## Decisão 3 — Série materializada e alteração de escopo explícita

**Decisão:** preservar `Event` materializado e `seriesId` existente. `PATCH /events/:id` edita somente ocorrência; o novo `PATCH /events/series/:seriesId` edita campos compartilhados de todas as ocorrências. Mudança de grade (regra, intervalo, unidade, fim, ou reposicionamento de ocorrências) exige exclusão/recriação confirmada.

**Motivo:** a implementação já materializa ocorrências e tem exclusão de série. Introduzir tabela mestre/exceções agora aumenta migração e semântica sem ser necessária para a paridade solicitada.

**Alternativas rejeitadas:** converter a série a uma regra mestre RFC 5545; ou fazer `PATCH /events/:id` propagar por inferência. A primeira é escopo adicional; a segunda é perigosa e pouco clara ao usuário.

**Consequência:** o endpoint novo é versionado, e `UpdateEventDto` de ocorrência passa a aceitar datas; a restrição existente de datas em série deve ser removida somente para a ocorrência, nunca usada para propagação implícita.

## Decisão 4 — Horário civil São Paulo e cálculo seguro de recorrência

**Decisão:** criar utilitário puro em `packages/utils/src/calendar-time.ts` que deriva limites de mês/semana/dia/lista e representa a chave civil com `Intl.DateTimeFormat(..., { timeZone: 'America/Sao_Paulo' })`. O backend usa a mesma lógica (ou cópia testada enquanto o pacote não for consumível pelo Nest) para recorrência e deduplicação diária de push.

**Motivo:** somar 86.400.000 ms ou usar offset fixo `-03:00` pode falhar em transições históricas e perde o requisito de horário civil.

**Alternativas rejeitadas:** relógio/fuso do dispositivo; offsets fixos; cálculo UTC para dias locais. Todos podem exibir data diferente entre Web, Android e iOS.

**Consequência:** `dayBoundary` atual do serviço de eventos e a conversão manual do calendário Web devem ser substituídos. Testes fixam instantes antes/depois da virada local.

## Decisão 5 — Lembrete por ocorrência e destinatário

**Decisão:** reaproveitar `EventReminderAction`, mas normalizar `actionDate` ao início do dia São Paulo e tratar `(eventId, tenantUserId, action, actionDate)` como a chave de dispensa/deduplicação. Criador, responsável e participantes únicos são destinatários; cada um recebe sua própria consulta e ação.

**Motivo:** a tabela e os campos já existem e suportam o isolamento exigido sem schema adicional.

**Alternativas rejeitadas:** uma flag de dispensa em `Event`; e um lembrete por série. Ambas compartilhariam estado entre pessoas ou ocorreriam no lugar errado quando a série tem ocorrências.

**Consequência:** o job verifica ativo e dispensa por destinatário antes de registrar `SEND`; grava o envio antes do provedor para evitar duplicação concorrente, com idempotência no banco.

## Decisão 6 — Deep link versionado e mínimo

**Decisão:** payload do push é `{ version: 1, type: 'event-reminder', occurrenceId, eventId, deepLink }`, onde `deepLink` é `/calendar/{occurrenceId}` no Expo e o adaptador Web mapeia para `/calendar/events/{occurrenceId}`. O servidor não coloca título, pessoa, tenant, token ou agenda completa no dado de navegação.

**Motivo:** ids mínimos permitem retomar a intenção e refazer autorização pelo endpoint de detalhe; dados em push podem ser vistos por serviços/dispositivos.

**Alternativas rejeitadas:** serializar o evento no payload; listener que apenas abre o app. A primeira expõe dados; a segunda não cumpre a jornada.

**Consequência:** `apps/mobile/src/lib/push.ts` deve registrar o listener uma vez e encaminhar para Expo Router depois de a sessão estar hidratada; Web suporta URL direta no route segment correspondente.

## Decisão 7 — Cache de leitura específico e incompatível por versão

**Decisão:** usar entrada `calendar:v2` para a resposta envelope do contrato 2026-09-09, distinta do cache de agenda de 002. A chave inclui versão de contrato, tenant, usuário-alvo, modo de visão, limites e cursor; TTL de 10 minutos para páginas e 30 minutos para detalhe.

**Motivo:** a resposta de `GET /events` muda de array para envelope e a visibilidade pode variar pelo usuário-alvo. Reutilizar chave antiga pode expor formato/dados incorretos.

**Alternativas rejeitadas:** cache global por mês; cache sem versão; armazenar mutações offline. Violam segregação ou integridade de 001.

**Consequência:** mudança de contrato invalida prefixos `calendar:v1` e a UI mostra “Dados salvos; somente leitura” com `savedAt` São Paulo.

## Decisão 8 — Runners coerentes com o monorepo atual

**Decisão:** manter Node `--test` + `ts-node/register` para serviços Nest existentes; adicionar `test:calendar` explícito no API. Adicionar Vitest 2, jsdom e Testing Library React ao Web; adicionar Jest 29, `jest-expo` 57 e Testing Library React Native ao Expo. Configurações ficam, respectivamente, em `apps/web/vitest.config.ts`, `apps/web/src/test/setup.ts`, `apps/mobile/jest.config.js` e `apps/mobile/src/test/setup.ts`.

**Motivo:** API já possui teste Node; componentes DOM precisam jsdom; renderização React Native exige ambiente Expo/Jest em vez de DOM artificial.

**Alternativas rejeitadas:** declarar testes sem runner; usar o mesmo runner DOM para Expo. Isso não testa navegação/notificação nativas de forma confiável.

**Consequência:** os scripts e dependências listados no plano são parte da primeira tarefa e devem ser instalados antes da implementação TDD.
