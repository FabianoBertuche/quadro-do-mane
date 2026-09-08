# Módulo Calendário / Eventos

> Documento de registro das atividades do módulo de calendário.
> Última atualização: **08/09/2026**

---

## 1. Visão Geral

O módulo de calendário permite criar e gerenciar eventos e compromissos com:
suporte a **responsável**, **participantes**, **eventos recorrentes** e
**lembretes** com notificação push no celular e exibição no dashboard.

Arquitetura: Backend NestJS (`/events`), Frontend Web (grid mensal customizado)
e App Android (lista por data + criação de eventos).

---

## 2. O que foi implementado

### 2.1 Backend — API (NestJS)

**Arquivo:** `apps/api/src/modules/events/`

| Método | Rotas | Permissão |
|--------|-------|-----------|
| `findAll` | `GET /events?startDate&endDate` | `calendar.view` |
| `findOne` | `GET /events/:id` | `calendar.view` |
| `findReminders` | `GET /events/reminders` | `calendar.view` |
| `dismissReminderDay` | `POST /events/:id/reminders/dismiss-day` | `calendar.view` |
| `dismissReminderForever` | `POST /events/:id/reminders/dismiss-forever` | `calendar.view` |
| `create` | `POST /events` | `calendar.create` |
| `update` | `PATCH /events/:id` | `calendar.edit` |
| `remove` | `DELETE /events/:id` | `calendar.delete` |
| `removeSeries` | `DELETE /events/series/:seriesId` | `calendar.delete` |

**Funcionalidades do service (`events.service.ts`):**
- CRUD completo de eventos.
- **Expansão de eventos recorrentes** na criação, com limite máximo de **365 ocorrências** por série (evita explodir o banco). A data fim é obrigatória e cada ocorrência recebe um `seriesId` (UUID) comum.
- **Cron diário** (`sendDailyReminderPushes`) que envia push notifications para usuários com eventos próximos, respeitando `remindDaysBefore`.
- **Sistema de dispensa de lembretes**: por dia (`dismiss-day`) ou para sempre (`dismiss-forever`), registrado em `EventReminderAction`.
- `update` bloqueia alterações de recorrência em séries já existentes.

**DTOs:**
- `CreateEventDto`: `title`, `description?`, `type?`, `startAt`, `endAt`, `allDay?`, `relatedProjectId?`, `relatedTaskId?`, `assigneeTenantUserId?`, `attendeeIds?`, recorrência (`recurrenceRule`, `recurrenceInterval`, `recurrenceUnit`, `recurrenceEndAt`, obrigatório quando há recorrência), `remindDaysBefore?`.
- `UpdateEventDto`: `PartialType(CreateEventDto)`.

### 2.2 Banco de Dados — Prisma (schema objetivo)

**Arquivo:** `apps/api/prisma/schema.prisma`

**Modelo `Event`:**
- `id`, `tenantId`, `title`, `description?`, `type?`
- `startAt`, `endAt`, `allDay`
- `createdByTenantUserId`, `assigneeTenantUserId?`
- `relatedProjectId?`, `relatedTaskId?`
- Recorrência: `recurrenceRule?`, `recurrenceInterval?`, `recurrenceUnit?`, `recurrenceEndAt?`, `seriesId?`
- `remindDaysBefore?`, `createdAt`, `updatedAt`
- Relações: `attendees`, `reminderActions`, `createdBy`, `assignee`, `project`, `task`, `tenant`

**Modelo `EventAttendee`:**
- `id`, `tenantId`, `eventId`, `tenantUserId`, `responseStatus?`
- `@@unique([eventId, tenantUserId])`

**Modelo `EventReminderAction`:**
- `id`, `tenantId`, `eventId`, `tenantUserId`, `action`, `actionDate?`, `createdAt`
- `@@unique([eventId, tenantUserId, action, actionDate])`

**Permissões semeadas:** `calendar.view`, `calendar.create`, `calendar.edit`, `calendar.delete`.

### 2.3 Frontend Web — Página do Calendário

**Arquivo:** `apps/web/src/app/(app)/calendar/page.tsx`

- **Grid mensal customizado** (sem biblioteca externa de calendário) com navegação anterior/próximo mês, destaque do dia atual e anel verde em dias com eventos.
- Exibe até 2 eventos por dia + indicador `+N mais`.
- **Modal de criação de evento** com os campos:
  - Título, descrição, data/hora início e fim.
  - **Responsável** (select de usuários ativos).
  - **Participantes** (checkbox list de usuários ativos).
  - **Lembrete** (N dias antes).
  - **Recorrência**: presets (não repete / todo dia / a cada 3 meses / a cada 1 ano / período personalizado) + intervalo e unidade customizados + data fim da recorrência.
- **Validação client-side**: data final do evento deve ser posterior ao início; a data fim da recorrência é obrigatória e deve ser ≥ ao início.
- **Tratamento de erro**: banner vermelho com a mensagem do backend quando a criação falha.

### 2.4 App Mobile (Android/Expo)

- **Tela `calendar.tsx`**: lista de eventos agrupada por data (`SectionList`), carrega 30 dias atrás + 60 dias à frente, card com hora/título/localização/criador, FAB que respeita a permissão `calendar.create`.
- **Tela `event-create.tsx`**: título, descrição, presets de dia (Hoje/Amanhã/Em 3 dias/Próx. semana), hora início/fim, toggle "dia inteiro".

### 2.5 Dashboard

- Card de **lembretes de eventos** no dashboard, com opção de dispensar (por dia ou para sempre).

---

## 3. O que falta implementar / pendências

### 3.1 Mobile (maiores lacunas)
- **Sem suporte a recorrência** na criação de eventos no app.
- **Sem seleção de responsável / participantes** no app.
- **Sem edição/exclusão de eventos** no app (não há tela de update nem delete).
- **Campo `location` morto**: o tipo `CalendarEvent.location` existe em `apps/mobile/src/lib/types.ts:101-110` mas **não existe** no schema Prisma nem na resposta da API — código morto (ou sinal de feature não implementada).

### 3.2 Web
- **Sem edição de evento**: o `PATCH /events/:id` existe na API, mas a página web só permite criar (não abrir/clicar num evento para editar ou excluir).
- **Sem exclusão de eventos recorrentes** no frontend (a rota `DELETE /events/series/:seriesId` não é usada na UI).
- Sem feedback visual para **dispensa de lembretes** na web (só no dashboard).

### 3.3 Schema / arquitetura
- O único schema Prisma do repositório é `apps/api/prisma/schema.prisma`; não há schema raiz divergente para reconciliar.
- Responsável, participantes, projeto e tarefa relacionados são validados contra o tenant atual; participantes e responsável precisam estar ativos.
- Campos `relatedProjectId` / `relatedTaskId` / `type` existem no DTO/schema mas **não são usados** no formulário web ou mobile.

### 3.4 Diversos
- Testes do serviço de eventos estão em `apps/api/src/modules/events/events.service.spec.ts` e podem ser executados com `npm run test:events --workspace=apps/api`.
- Verificar se o dashboard card de lembretes está 100% funcional (push pipeline existe; card precisa de validação em campo).

---

## 4. Correção de erros de estabilização

**Contexto:** a criação de eventos recorrentes não dava feedback adequado para datas inválidas e o módulo tinha inconsistências na janela mensal, lembretes e isolamento por tenant.

**Correções aplicadas:**

1. O backend rejeita data final do evento inválida, recorrência sem fim, fim de recorrência inválido e combinações incoerentes de regra/unidade.
2. A interface exige a data fim de recorrência e apresenta erro local ou retornado pela API no modal.
3. Consultas mensais usam intervalo semiaberto e incluem eventos que atravessam a borda do mês; calendário e lembretes usam `America/Sao_Paulo`.
4. Dispensas de lembrete agora são avaliadas por evento e usuário tanto no dashboard quanto no push diário.
5. Referências de evento são verificadas no tenant antes de gravar.

**Para validar:**
```
npm run test:events --workspace=apps/api
npm run build --workspace=apps/api
npm run build --workspace=apps/web
```

---

## 5. Commits relacionados

```
32c801d feat(events): lembretes com push diario, dispensa e card no dashboard
c29ce57 feat(calendar): formulario com responsavel, participantes e eventos recorrentes
4e13243 031- inicio de melhoria do calendario
```

Arquivos principais tocados: `apps/api/src/modules/events/*`, `apps/web/src/app/(app)/calendar/page.tsx`, `apps/mobile/src/app/calendar.tsx`, `apps/mobile/src/app/event-create.tsx`, `apps/api/prisma/schema.prisma`.
