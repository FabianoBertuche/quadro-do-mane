# Contratos de integração — Calendário e lembretes

**Versão canônica:** `2026-09-09`. Base: `/api`. O cliente envia `Accept-Calendar-Contract: 2026-09-09`; a API responde `X-Calendar-Contract: 2026-09-09` e inclui `contractVersion` em cada envelope de leitura. Implementação deve rejeitar versão incompatível com `406 CALENDAR_CONTRACT_UNSUPPORTED`.

## Matriz de autorização e visibilidade

| Operação | Permissão | Visibilidade / predicado | Regra admin | FR |
|---|---|---|---|---|
| Listar calendário | `calendar.view` | eventos do usuário-alvo como criador, responsável ou participante, no tenant | pode escolher alvo ativo do tenant; não pode ver união global | FR-003, FR-004, FR-005, FR-012 |
| Detalhar ocorrência | `calendar.view` | mesma regra do usuário-alvo para o evento | somente via alvo selecionado formalmente | FR-005, FR-006 |
| Criar único/série | `calendar.create` | gravar somente tenant ativo; vínculos internos | não ignora validação/vínculo | FR-005, FR-007–FR-009 |
| Editar ocorrência | `calendar.edit` | evento visível ao ator e no tenant | seleção para leitura não delega edição do calendário alheio | FR-005, FR-010 |
| Editar série | `calendar.edit` | todas as ocorrências do `seriesId` no tenant e visíveis ao ator | mesma regra; sem bypass | FR-005, FR-010 |
| Excluir ocorrência/série | `calendar.delete` | evento/série no tenant e visível ao ator | mesma regra; sem bypass | FR-005, FR-011 |
| Listar/dispensar lembrete | `calendar.view` | somente destinatário autenticado envolvido | não pode dispensar por outra pessoa | FR-005, FR-014 |
| Registrar/remover dispositivo | sessão autenticada + tenant ativo | somente `PushDevice` do próprio `tenantUserId`/tenant | sem operação em dispositivo alheio | FR-015 |

**Sem bypass:** todos os caminhos passam por JWT, `TenantContextGuard`, `PermissionGuard` quando listado e pelo predicado no serviço. Ser `admin` sem `calendar.view` resulta 403. `tenantUserId` externo ao tenant resulta 404; usuário ativo no tenant solicitado por não-admin resulta 403.

## 1. Lista paginada — mudança de contrato existente

### `GET /events?startAt=ISO&endAt=ISO&limit=1..100&cursor=opaque&tenantUserId=UUID?`

**Status:** evolução incompatível da resposta atual `GET /events?startDate&endDate`. Os parâmetros legados `startDate`/`endDate` serão aceitos somente durante a migração e normalizados para `startAt`/`endAt`; a resposta já é o envelope novo. Atualizar Web, Expo e consumidores internos na mesma entrega.

**Request:** `startAt` e `endAt` são obrigatórios, ISO UTC, `endAt > startAt`; `limit` padrão 100; `cursor` só pode ser cursor emitido para a mesma consulta (tenant, alvo, intervalo, ordenação); `tenantUserId` é omitido para o próprio usuário.

**Response 200:** `CalendarEventPage` de [`../data-model.md`](../data-model.md).

**Errors:** 400 `CALENDAR_RANGE_INVALID` ou `CALENDAR_CURSOR_INVALID`; 401 `UNAUTHENTICATED`; 403 `CALENDAR_VIEW_FORBIDDEN`; 404 `CALENDAR_TARGET_NOT_FOUND`; 406 `CALENDAR_CONTRACT_UNSUPPORTED`.

**FR:** FR-001–FR-005, FR-012–FR-013.

## 2. Detalhe — mudança de autorização existente

### `GET /events/:id?tenantUserId=UUID?`

**Status:** rota existente com resposta enriquecida (`CalendarEventDetail`) e novo predicado de visibilidade. Não pode mais retornar evento do tenant ao ator não envolvido só por conhecer o id.

**Request:** `tenantUserId` segue a matriz; id é UUID da ocorrência.

**Response 200:** `CalendarEventDetail`.

**Errors:** 400 `CALENDAR_TARGET_INVALID`; 401 `UNAUTHENTICATED`; 403 `CALENDAR_EVENT_FORBIDDEN`; 404 `CALENDAR_EVENT_NOT_FOUND`; 406 `CALENDAR_CONTRACT_UNSUPPORTED`.

**FR:** FR-001, FR-004–FR-006, FR-017.

## 3. Criar evento/serie — mudança de corpo existente

### `POST /events`

**Status:** rota existente. O corpo legado de recorrência plana continua aceito apenas pelo adaptador de transição e é convertido para `recurrence`; clientes novos enviam o corpo abaixo.

**Request 201:**

```json
{
  "title": "Planejamento", "startAt": "2026-09-10T12:00:00.000Z", "endAt": "2026-09-10T13:00:00.000Z",
  "allDay": false, "assigneeTenantUserId": "uuid", "attendeeIds": ["uuid"],
  "relatedProjectId": "uuid", "relatedTaskId": "uuid", "remindDaysBefore": 2,
  "recurrence": { "rule": "WEEKLY", "interval": 1, "unit": "week", "endsAt": "2026-12-31T02:59:59.999Z" }
}
```

**Response 201:** único: `{ "contractVersion":"2026-09-09", "item": CalendarEventDetail }`; série: `{ "contractVersion":"2026-09-09", "seriesId":"uuid", "createdCount":12, "occurrenceIds":["uuid"] }`.

**Errors:** 400 `CALENDAR_INPUT_INVALID`, `CALENDAR_RELATION_INVALID`; 401; 403 `CALENDAR_CREATE_FORBIDDEN`; 422 `CALENDAR_SERIES_LIMIT_EXCEEDED`; 406.

**FR:** FR-001, FR-005, FR-007–FR-009, FR-013.

## 4. Atualizar ocorrência — mudança de semântica existente

### `PATCH /events/:id`

**Status:** rota existente. Passa a aceitar alteração de `startAt`/`endAt` em uma ocorrência de série; nunca propaga. Corpo é `Partial<UpsertOccurrenceInput>`; ao enviar `attendeeIds`, a lista substitui participantes e o servidor reinsere criador/responsável únicos.

**Response 200:** `{ "contractVersion":"2026-09-09", "item": CalendarEventDetail }`.

**Errors:** 400 `CALENDAR_INPUT_INVALID`/`CALENDAR_RELATION_INVALID`; 401; 403 `CALENDAR_EDIT_FORBIDDEN`/`CALENDAR_EVENT_FORBIDDEN`; 404; 406.

**FR:** FR-005, FR-008–FR-010, FR-017.

## 5. Atualizar série — endpoint novo

### `PATCH /events/series/:seriesId`

**Status:** **novo**. `seriesId` é UUID. Corpo é `UpdateSeriesInput` de [`../data-model.md`](../data-model.md); `startAt`, `endAt`, `recurrence`, `recurrenceRule`, `recurrenceInterval`, `recurrenceUnit` e `recurrenceEndAt` são rejeitados.

**Response 200:** `{ "contractVersion":"2026-09-09", "seriesId":"uuid", "updatedCount":12, "items":[CalendarEventDetail] }` (itens podem ser limitados a 100; `updatedCount` é autoritativo).

**Errors:** 400 `CALENDAR_RELATION_INVALID`; 401; 403 `CALENDAR_EDIT_FORBIDDEN`/`CALENDAR_SERIES_FORBIDDEN`; 404 `CALENDAR_SERIES_NOT_FOUND`; 422 `CALENDAR_SERIES_SCHEDULE_RECREATE_REQUIRED`; 406.

**FR:** FR-001, FR-005, FR-008–FR-010.

## 6. Excluir ocorrência e série

### `DELETE /events/:id` *(existente)* / `DELETE /events/series/:seriesId` *(existente, resposta alterada)*

**Request:** sem corpo; cliente exige confirmação local. A ordem de rota deve manter `/events/series/:seriesId` antes de `/:id` no controller.

**Response 200:** ocorrência `{ "contractVersion":"2026-09-09", "deletedId":"uuid" }`; série `{ "contractVersion":"2026-09-09", "seriesId":"uuid", "deletedCount":12 }`.

**Errors:** 401; 403 `CALENDAR_DELETE_FORBIDDEN`/`CALENDAR_EVENT_FORBIDDEN`; 404 `CALENDAR_EVENT_NOT_FOUND`/`CALENDAR_SERIES_NOT_FOUND`; 406.

**FR:** FR-005, FR-006, FR-011, FR-017.

## 7. Lembretes pessoais

### `GET /events/reminders?limit=1..100` *(existente, resposta alterada)*

**Response 200:** `{ "contractVersion":"2026-09-09", "timeZone":"America/Sao_Paulo", "items":[{ "occurrenceId":"uuid", "eventId":"uuid", "title":"Planejamento", "startAt":"ISO", "daysBefore":2, "deepLink":"/calendar/uuid", "canDismiss":true }] }`.

**Errors:** 400 `CALENDAR_LIMIT_INVALID`; 401; 403 `CALENDAR_VIEW_FORBIDDEN`; 406.

### `POST /events/:id/reminders/dismiss-day` / `POST /events/:id/reminders/dismiss-forever` *(existentes)*

**Response 200:** `{ "contractVersion":"2026-09-09", "occurrenceId":"uuid", "dismissed":"day" | "forever" }`.

**Errors:** 401; 403 `CALENDAR_REMINDER_FORBIDDEN`; 404 `CALENDAR_REMINDER_NOT_FOUND`; 406. Ação sempre usa `tenantUserId` autenticado, nunca id no corpo.

**FR:** FR-001, FR-005, FR-014–FR-017.

## 8. Dispositivo e push

### `POST /push-devices` / `DELETE /push-devices/:token` *(existentes, contrato de payload documentado)*

`POST` recebe `{ "expoPushToken":"ExponentPushToken[...]", "platform":"ios" | "android" }` e responde `{ "success":true, "registered":true }`. A remoção só pode afetar token do usuário autenticado. 401 em sessão inválida; 400 para token/plataforma inválidos.

**Novo contrato interno de push:** `{ "version":1, "type":"event-reminder", "occurrenceId":"uuid", "eventId":"uuid", "deepLink":"/calendar/uuid" }`. O worker/job não é endpoint público de cliente: `POST /admin/send-event-reminders` continua autenticado pelo segredo de cron e deve devolver somente contagens agregadas `{ checkedAt, sent, skippedDismissed, skippedDuplicate, failed }`.

**FR:** FR-015–FR-016.

## Política offline transversal

Somente `GET /events`, `GET /events/:id` e `GET /events/reminders` podem servir entrada de `CalendarReadCache` válida. POST, PATCH e DELETE acima são bloqueados localmente por `OfflineReadOnlyError` antes de Axios/fetch; nenhuma rota recebe replay, fila ou corpo persistido. Este comportamento cumpre FR-017–FR-019 e a fundação 001.
