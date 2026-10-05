# Modelo de dados — Calendário e lembretes

## Persistência reutilizada e mudanças necessárias

| Entidade | Campos relevantes | Uso / mudança desta feature |
|---|---|---|
| `Event` | `id`, `tenantId`, `seriesId`, `title`, `startAt`, `endAt`, `allDay`, `createdByTenantUserId`, `assigneeTenantUserId`, `relatedProjectId`, `relatedTaskId`, recorrência, `remindDaysBefore` | Cada linha é uma ocorrência; série continua agrupada por `seriesId`. Sem tabela nova. |
| `EventAttendee` | `eventId`, `tenantId`, `tenantUserId`, `responseStatus` | Participação e destinatário por ocorrência; unicidade existente evita duplicata. |
| `EventReminderAction` | `eventId`, `tenantId`, `tenantUserId`, `action`, `actionDate` | Dispensa/`SEND` individual. `actionDate` de `DISMISS_DAY`/`SEND` é início do dia São Paulo. |
| `TenantUser` | `id`, `tenantId`, `isActive`, `status`, `role` | Validação de destinatário e alvo administrativo. |
| `Project` / `Task` | `id`, `tenantId` | Vínculos válidos somente no tenant do evento. |
| `PushDevice` | `tenantId`, `tenantUserId`, `expoPushToken`, `platform` | Destinos de push; token nunca retorna em `CalendarEvent`. |

Não há migração obrigatória. Antes de implementar, confirmar que os índices de `Event` suportam `tenantId,startAt,endAt`, `tenantId,seriesId` e que o banco gera/tem os índices necessários; adicionar migração somente se `EXPLAIN ANALYZE` da massa de 10.000 eventos justificar índice composto ausente.

## Contratos de leitura

```ts
type CalendarEventPage = {
  contractVersion: '2026-09-09';
  timeZone: 'America/Sao_Paulo';
  range: { startAt: string; endAt: string };
  targetTenantUserId: string;
  items: CalendarEventSummary[];
  page: { limit: number; nextCursor: string | null; returned: number };
};

type CalendarEventSummary = {
  id: string;
  seriesId: string | null;
  title: string;
  type: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  assignee: PersonSummary | null;
  attendees: PersonSummary[];
  relatedProject: LinkSummary | null;
  relatedTask: LinkSummary | null;
  recurrence: RecurrenceSummary | null;
  reminder: { daysBefore: number } | null;
};

type CalendarEventDetail = CalendarEventSummary & {
  description: string | null;
  createdBy: PersonSummary;
  can: { editOccurrence: boolean; editSeries: boolean; deleteOccurrence: boolean; deleteSeries: boolean; dismissReminder: boolean };
};

type PersonSummary = { id: string; name: string; avatarUrl: string | null };
type LinkSummary = { id: string; label: string };
type RecurrenceSummary = { rule: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM'; interval: number; unit: 'day' | 'week' | 'month' | 'year'; endsAt: string };
```

### Invariantes

1. Todo `Event`, `EventAttendee`, ação de lembrete e dispositivo usado na operação pertence ao mesmo `tenantId` do contexto autenticado.
2. Uma ocorrência sem `seriesId` é única; ocorrências da série têm o mesmo `seriesId`, mas ids independentes.
3. `endAt > startAt`; evento aparece na janela quando `startAt < range.endAt && endAt > range.startAt`.
4. `attendees` inclui criador e responsável (se houver), não possui ids duplicados e só contém usuários ativos no tenant.
5. O detalhe não é uma autoridade: `can` é dica de UI e a API revalida permissão/predicado em toda mutação.
6. Ações de lembrete não são compartilhadas: nunca se consulta/escreve `EventReminderAction` sem `tenantUserId` autenticado/destinatário.

## Comandos de escrita

```ts
type UpsertOccurrenceInput = {
  title: string;
  description?: string;
  type?: string;
  startAt: string;
  endAt: string;
  allDay?: boolean;
  assigneeTenantUserId?: string | null;
  attendeeIds?: string[];
  relatedProjectId?: string | null;
  relatedTaskId?: string | null;
  remindDaysBefore?: number | null;
};

type CreateEventInput = UpsertOccurrenceInput & {
  recurrence?: { rule: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM'; interval: number; unit: 'day' | 'week' | 'month' | 'year'; endsAt: string };
};

type UpdateSeriesInput = Pick<UpsertOccurrenceInput, 'title' | 'description' | 'type' | 'allDay' | 'assigneeTenantUserId' | 'attendeeIds' | 'relatedProjectId' | 'relatedTaskId' | 'remindDaysBefore'>;
```

`CreateEventInput.recurrence` ausente cria uma ocorrência. Presente materializa até 365 ocorrências. `UpdateSeriesInput` não contém datas nem regra: essas propriedades retornam 422 para tornar a recriação explícita.

## Cache local versionado

```ts
type CalendarReadCache<T> = {
  key: string;
  schemaVersion: 2;
  contractVersion: '2026-09-09';
  tenantId: string;
  viewerTenantUserId: string;
  targetTenantUserId: string;
  resource: 'event-page' | 'event-detail' | 'reminders';
  queryFingerprint: string;
  savedAt: string;
  expiresAt: string;
  payload: T;
};
```

**Chave canônica:** `calendar:v2:{contractVersion}:{tenantId}:{viewerTenantUserId}:{targetTenantUserId}:{resource}:{queryFingerprint}`.

- Página: TTL 10 minutos; detalhe: 30 minutos; lembretes: 5 minutos.
- Apagar por contexto em logout/troca de tenant, por prefixo `calendar:v1` na migração, e em 401/403.
- Invalidar página, detalhe, lembrete e `daily-workspace` relacionados após mutação online 2xx.
- Nunca guardar token, cabeçalho, credencial, corpo de mutação, permissão secreta ou resposta de push.
