# Sistema de Notificações Confiável

## Contexto

O push Android foi validado em produção: um envio de diagnóstico recebeu ticket
e receipt `ok` da Expo/FCM e chegou ao aparelho. O fluxo automático de
lembretes de calendário, porém, está indisponível porque depende de
`POST /admin/send-event-reminders`, de `CLEANUP_TOKEN` e de um cron externo;
no ambiente ativo, `CLEANUP_TOKEN` não está configurado.

O sistema atual também só notifica atribuição e reatribuição de tarefas. Não
há política única de preferências, deduplicação de alertas recorrentes,
auditoria das preferências, administração remota ou navegação pelo payload.

## Objetivos

- Registrar cada alerta na Central de Notificações e enviar push quando a
  política permitir.
- Cobrir tarefas, calendário, rotina diária, colaboração, projetos/equipes e
  eventos administrativos/de segurança definidos nesta especificação.
- Permitir preferência de push por categoria, bloqueável remotamente por admin.
- Garantir deduplicação idempotente para jobs e reexecuções.
- Remover a dependência operacional de cron externo para lembretes.
- Entregar deep links no app mobile e tela administrativa na web.

## Não Objetivos

- Criar suporte a menções em comentários. O domínio ainda não modela menções.
- Criar detecção de novos e-mails. A inbox não usa IDLE, webhook ou job de
  sincronização.
- Implementar horários silenciosos nesta entrega.
- Notificar o autor da própria ação.

## Arquitetura

### Dispatcher central

`NotificationDispatcher` será o único serviço de domínio que cria entregas.
Sua entrada inclui destinatário, categoria, tipo, título, mensagem, payload,
entidade relacionada e `occurrenceKey`.

Para cada chamada, o dispatcher:

1. Tenta criar o ledger `NotificationDispatch` em transação.
2. Quando a chave já existe, retorna a entrega existente sem criar Central ou
   push novamente.
3. Quando a criação é nova, cria a `Notification` existente para a Central e
   vincula as duas linhas na mesma transação.
4. Consulta a preferência da categoria.
5. Envia push se habilitado pela preferência ou regra administrativa.
6. Persiste ticket/estado da entrega sem interromper a operação de negócio.

Uma falha no push nunca desfaz a criação da Central ou a operação original.

### Modelos

`NotificationPreference`

- `tenantId`, `tenantUserId`, `category`.
- `pushEnabled`, padrão `true`.
- `lockedByAdmin`, padrão `false`.
- `updatedByTenantUserId`, `createdAt`, `updatedAt`.
- Único por `tenantUserId + category`.

`NotificationPreferenceAudit`

- Referência à preferência, ator, origem (`USER` ou `ADMIN`), valores antes e
  depois e data.
- Preserva o registro exigido para ativações, desativações e locks.

`NotificationDispatch`

- `tenantId`, `tenantUserId`, `category`, `type`.
- `entityType`, `entityId`, `occurrenceKey`.
- Referência opcional à `Notification` criada.
- `pushStatus`: `PENDING`, `SENT`, `SKIPPED`, `FAILED`.
- Tickets Expo, motivo de falha e timestamps.
- Chave única: `tenantUserId + type + entityId + occurrenceKey`.

O `occurrenceKey` representa uma ocorrência de negócio, por exemplo:

- `2026-09-28` para alerta diário de atraso;
- `scheduled:08:30:2026-09-28` para rotina;
- `update:<updatedAt>` para atualização de entidade;
- `assignment:<createdAt>` para atribuição.

### Preferências e lock administrativo

Categorias:

- `TASKS`
- `CALENDAR`
- `ROUTINE`
- `COLLABORATION`
- `PROJECTS_TEAMS`
- `SECURITY`

A Central recebe todos os alertas. A preferência controla somente push.

Usuários alteram apenas categorias sem lock. O admin pode definir estado e
bloquear uma categoria. Enquanto bloqueada, a API do usuário responde conflito
e o app exibe “Gerenciada pela empresa”. Ao desbloquear, o valor escolhido pelo
admin permanece como estado atual e o usuário volta a poder alterá-lo.

## Gatilhos e destinatários

O ator é excluído de todos os destinatários.

### Operacionais

| Tipo | Destinatário | Cadência |
|---|---|---|
| Tarefa atribuída ou reatribuída | Novo responsável | Imediata |
| Prazo de tarefa próximo | Responsável | 08:00, um dia antes |
| Tarefa atrasada | Responsável | 08:00, uma vez por dia até concluir/arquivar |
| Lembrete de evento | Participantes, responsável e criador | Janela `remindDaysBefore`, uma vez por dia |
| Rotina no horário | Responsável | No horário configurado |
| Rotina pendente | Responsável | 30 min após horário, uma vez no dia |

### Colaboração

| Tipo | Destinatário |
|---|---|
| Comentário em tarefa | Responsável único, múltiplos responsáveis e criador |
| Status, conclusão, reabertura ou prazo alterado | Responsável único, múltiplos responsáveis e criador |
| Convite de evento | Novo participante e novo responsável |
| Evento alterado ou cancelado | Participantes existentes e responsável |

### Projetos e equipes

| Tipo | Destinatário |
|---|---|
| Entrada em projeto ou equipe | Membro incluído |
| Owner de projeto ou gestor de equipe alterado | Pessoa afetada |
| Alteração relevante de projeto | Owner e membros: nome, descrição, datas, status, owner ou equipe |

### Administrativo e segurança

| Tipo | Destinatário |
|---|---|
| Convite, ativação, suspensão ou papel alterado | Usuário afetado |
| Senha alterada | Próprio usuário |
| Login interativo com credencial | Próprio usuário; nunca em refresh de sessão |

## Scheduler

`@nestjs/schedule` executa a cada cinco minutos no timezone
`America/Sao_Paulo`.

O job executa:

- lembretes de eventos;
- rotinas no horário e pendentes;
- prazos próximos;
- tarefas atrasadas;
- consulta de receipts Expo pendentes.

O ledger garante que múltiplas execuções, reinícios ou instâncias concorrentes
não gerem duplicidade. O endpoint manual de lembretes permanece como fallback,
mas não é necessário para operação automática.

## Push e receipts

O dispatcher envia mensagens Expo após persistir a entrega. Tickets são salvos
no ledger. O scheduler consulta receipts pendentes.

Quando a Expo informar `DeviceNotRegistered`, o `PushDevice` correspondente é
removido. Outros erros marcam o dispatch como `FAILED` e ficam disponíveis para
diagnóstico administrativo.

## APIs e interfaces

### API do usuário

- `GET /notification-preferences`
- `PATCH /notification-preferences/:category`

### API administrativa

- `GET /admin/notification-preferences`
- `PATCH /admin/notification-preferences/:tenantUserId/:category`
- `GET /admin/notification-preferences/:tenantUserId/history`
- `GET /admin/notification-dispatches`

### Web e mobile

- Mobile: tela de preferências no menu Mais, estado de lock e Central com
  deep-link por payload.
- Web: tela administrativa com matriz usuário/categoria, filtro por
  ativada/desativada/bloqueada, edição remota, lock e histórico.

## Configuração e operação

- O perfil EAS `production` declara `EXPO_PUBLIC_API_URL` igual ao `preview`.
- O mobile solicita token Expo com `projectId` explícito e re-registra após
  mudança de tenant/sessão.
- Logs nunca incluem tokens, somente IDs de dispatch, categoria, tipo e estado.
- Métricas operacionais: `sent`, `skipped`, `failed`, `receipts_pending` e
  `devices_removed`.

## Testes

- Unitários para política de preferências, lock e deduplicação.
- Unitários para cálculo de janela de cada job.
- Testes de serviço para dispatcher, ticket/receipt e remoção de device.
- Testes de integração para APIs de usuário/admin e gatilhos essenciais.
- Testes mobile para interpretação de payload/deep-link e re-registro de token.

## Fases

### Fase 1

Fundação, preferências, auditoria, ledger, scheduler, calendário, rotina,
atribuição, prazo próximo e atraso.

### Fase 2

Comentários, mudanças de tarefa, convites/alterações/cancelamentos de evento,
projetos/equipes e alertas administrativos/de segurança.
