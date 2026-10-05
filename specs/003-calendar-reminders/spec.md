# Feature Specification: Calendário paritário e lembretes pessoais

**Feature Branch**: `003-calendar-reminders`  
**Created**: 2026-09-09  
**Status**: Approved  
**Depends on**: `001-client-foundation-security`, `002-daily-workspace`  
**Input**: Calendário Web/Android/iOS em visões mensal, semanal, diária e lista; eventos em volume; detalhe, criação, edição e exclusão de ocorrência ou série; recorrência, responsáveis, participantes, vínculos, lembretes individuais, push e deep link.

## Scope

Entregar o mesmo comportamento funcional de calendário no Next.js e no Expo (Android/iOS), preservando o layout próprio de cada plataforma. A API NestJS continua a fonte de verdade. Datas de apresentação, limites de consulta, regras de recorrência e janelas de lembrete usam exclusivamente `America/Sao_Paulo`.

Cada pessoa vê somente eventos dos quais é criadora, responsável ou participante. A exceção formal de visibilidade é o administrador que possui `calendar.view`: ele pode selecionar uma pessoa ativa do tenant e então vê exatamente o conjunto daquela pessoa. Essa exceção não concede permissão ausente, não atravessa tenant e não autoriza alteração sem a permissão da operação.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Consultar calendário pessoal em qualquer cliente (Priority: P1)

Como colaborador, quero alternar entre as visões mensal, semanal, diária e lista do meu calendário no Web, Android e iOS para localizar rapidamente meus compromissos, mesmo quando há muitos eventos.

**Why this priority**: visibilidade pessoal correta e navegação previsível são pré-requisitos para toda ação em eventos e lembretes.

**Independent Test**: com eventos que se sobrepõem, atravessam dias e pertencem a pessoas distintas, cada cliente consulta uma janela paginada e mostra apenas os eventos visíveis para a pessoa autenticada, na mesma zona e ordem definida pelo contrato.

**Acceptance Scenarios**:

1. **Given** que o colaborador tem `calendar.view` e eventos como criador, responsável e participante, **When** abre mensal, semanal, diária ou lista, **Then** cada visão mostra somente a interseção dos eventos dele com a janela solicitada, com horários em `America/Sao_Paulo` e ordenação determinística por início, fim e identificador.
2. **Given** que uma semana ou dia contém mais eventos do que cabem no espaço visual, **When** o colaborador abre a visão, **Then** o cliente mostra contagem/continuação acessível e permite navegar ou abrir a lista sem ocultar eventos silenciosamente.
3. **Given** que um evento inicia antes e termina dentro/depois da janela, **When** a janela é consultada, **Then** o evento aparece em todos os dias com que intersecta, sem duplicar a ocorrência no mesmo dia.
4. **Given** que o usuário é administrador ativo com `calendar.view`, **When** seleciona outro colaborador ativo do mesmo tenant, **Then** vê somente os eventos visíveis à pessoa selecionada; se não for administrador, o seletor não aparece e qualquer `tenantUserId` diferente do próprio retorna 403.

### User Story 2 — Gerir evento único ou série com segurança (Priority: P2)

Como pessoa autorizada, quero abrir o detalhe e criar, editar ou excluir somente uma ocorrência ou uma série recorrente para manter meus compromissos, participantes e vínculos atualizados.

**Why this priority**: a operação de agenda perde valor se não puder representar recorrência e corrigir com clareza o escopo da alteração.

**Independent Test**: uma pessoa com as permissões necessárias cria série, altera uma ocorrência e a série em comandos distintos, e remove cada escopo; testes confirmam que registros fora do escopo ou tenant nunca mudam.

**Acceptance Scenarios**:

1. **Given** que o usuário pode criar eventos e informa título, intervalo válido, responsável, participantes, projeto/tarefa e regra de recorrência, **When** confirma o formulário online, **Then** a API valida todos os vínculos no tenant, cria um evento único ou uma série limitada e devolve o contrato versionado.
2. **Given** que o detalhe de uma ocorrência recorrente está aberto, **When** o usuário escolhe editar somente esta ocorrência, **Then** somente ela muda e seu `seriesId` continua identificando a origem; a mudança de data não recalcula outras ocorrências.
3. **Given** que o detalhe de uma ocorrência recorrente está aberto, **When** o usuário escolhe editar ou excluir toda a série e confirma, **Then** a API altera ou remove todas e apenas as ocorrências ainda pertencentes ao mesmo `seriesId` e tenant, retornando a contagem afetada.
4. **Given** que alguém informa usuário inativo, usuário de outro tenant, projeto/tarefa externos ou intervalo inválido, **When** tenta salvar, **Then** recebe 400/404 conforme contrato e nenhuma alteração parcial é persistida.
5. **Given** que o cliente está offline, **When** tenta criar, editar, excluir, dispensar lembrete ou registrar dispositivo, **Then** bloqueia a ação antes do transporte, não mantém fila e explica que exige conexão.

### User Story 3 — Receber e dispensar lembretes individualmente (Priority: P3)

Como destinatário de evento, quero receber lembrete no aplicativo e abrir a ocorrência correspondente por deep link, podendo dispensá-lo apenas para mim, para não perder compromissos nem alterar a preferência dos demais.

**Why this priority**: o lembrete transforma o calendário em suporte operacional sem vazar informações entre participantes.

**Independent Test**: com dois participantes e dois dispositivos, o job envia no máximo um push elegível por ocorrência/destinatário/dia; a dispensa de um participante não remove o lembrete do outro, e o toque navega ao detalhe autorizado.

**Acceptance Scenarios**:

1. **Given** que o evento tem lembrete e a pessoa é criadora, responsável ou participante, **When** a janela individual começa e ela não o dispensou, **Then** a API inclui o lembrete pessoal na consulta e o job envia push com `eventId`, `occurrenceId` e deep link canônico, no máximo uma vez por dia e destinatário.
2. **Given** que a pessoa dispensa o lembrete no dia ou para sempre, **When** outra pessoa participante consulta ou recebe lembrete, **Then** a ação dela não é aplicada à outra pessoa; a ação persistida é associada ao destinatário autenticado e ao tenant.
3. **Given** que a pessoa toca uma notificação de lembrete com sessão válida, **When** o app recebe o payload, **Then** abre `/calendar/events/{occurrenceId}` no Web ou `/calendar/{occurrenceId}` no Expo e carrega o detalhe normalmente; com sessão inválida, realiza o fluxo de autenticação e só abre o destino após restaurar contexto.

### Edge Cases

- Evento de dia inteiro usa datas civis São Paulo e ocupa cada dia civil intersectado; evento com horário usa instantes ISO UTC e é formatado em São Paulo.
- Consulta com cursor inválido, `limit` fora de `1..100`, data inválida ou fim não posterior ao início retorna 400 sem consultar parcialmente.
- Série acima de 365 ocorrências é rejeitada com 422; o cliente orienta reduzir a data final/intervalo.
- Editar a série atualiza campos compartilhados, participantes, responsável, vínculos e lembrete de todas as ocorrências ainda na série; não recria ocorrências, preservando ids e ações individuais de lembrete. Datas e regra de recorrência da série exigem recriação explícita, para evitar ambiguidade de exceções.
- `DELETE` de ocorrência remove suas ações de lembrete; `DELETE` da série remove somente as ocorrências e ações daquele `seriesId` no tenant.
- Push é melhor esforço: falha de provedor não desfaz evento, dispensa ou consulta; tentativas/erros são auditáveis e não expõem token.
- Offline permite somente ler `CalendarReadCache` validado e ainda não expirado, marcado como salvo/desatualizado; sem entrada há estado de indisponibilidade offline.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST publicar o contrato de calendário `2026-09-09` para API, Web e Expo, com método, entrada, resposta, erro e rastreabilidade de cada operação.
- **FR-002**: O sistema MUST oferecer visões mensal, semanal, diária e lista com a mesma semântica de intervalo, ordenação, paginação e eventos que intersectam a janela nos três clientes.
- **FR-003**: O sistema MUST restringir leitura normal a eventos em que a pessoa autenticada é criadora, responsável ou participante, sempre no tenant ativo.
- **FR-004**: O sistema MUST permitir seleção de outro usuário somente a administrador ativo com `calendar.view`, somente para pessoa ativa do tenant, e aplicar ao resultado o predicado de visibilidade da pessoa selecionada.
- **FR-005**: O sistema MUST exigir permissão em toda operação; administração não ignora `calendar.view`, `calendar.create`, `calendar.edit` ou `calendar.delete`, nem o tenant.
- **FR-006**: O sistema MUST expor detalhe de evento somente se ele for visível pelo predicado aplicável e MUST retornar 404 para identificador inexistente/no tenant e 403 para evento existente mas invisível ao ator.
- **FR-007**: O sistema MUST criar evento único ou série usando instantes válidos, duração positiva, recorrência definida e no máximo 365 ocorrências.
- **FR-008**: O sistema MUST validar responsável e cada participante como `TenantUser` ativo no tenant, e validar projeto/tarefa vinculados ao mesmo tenant, antes de qualquer escrita.
- **FR-009**: O sistema MUST incluir automaticamente criador e responsável na lista de destinatários sem duplicá-los.
- **FR-010**: O sistema MUST permitir editar uma ocorrência com `PATCH /events/:id`, inclusive suas datas, e MUST permitir editar campos compartilhados de uma série com `PATCH /events/series/:seriesId`; alteração de frequência, intervalo, fim ou grade de ocorrências exige recriar a série.
- **FR-011**: O sistema MUST permitir excluir a ocorrência com `DELETE /events/:id` e a série com `DELETE /events/series/:seriesId`, com confirmação explícita no cliente antes da mutação destrutiva.
- **FR-012**: O sistema MUST retornar listas com cursor opaco, `limit` máximo 100, `nextCursor`, total da página e `contractVersion`, sem carregar janela ilimitada no cliente.
- **FR-013**: O sistema MUST calcular e apresentar datas civis, fronteiras de visão, lembretes por dia e formatação em `America/Sao_Paulo`.
- **FR-014**: O sistema MUST criar, consultar e dispensar lembretes por destinatário autenticado; dispensa diária e permanente não afetam outro destinatário.
- **FR-015**: O job de push MUST deduplicar por ocorrência, destinatário e dia São Paulo, suprimir destinatários dispensados e incluir deep link/versionamento de payload sem dados sensíveis.
- **FR-016**: Web e Expo MUST tratar o toque de push/deep link para o detalhe da ocorrência e passar por autenticação/tenant antes de expor o conteúdo.
- **FR-017**: Os clientes MUST exibir loading, vazio, erro recuperável, 401, 403, 404, 409/422 e sucesso com semântica equivalente; 401 de leitura segue a política de 001, e mutações nunca são repetidas automaticamente.
- **FR-018**: Os clientes MUST manter cache somente leitura por contrato/tenant/usuário/consulta, com versão explícita, TTL e invalidação em logout, troca de tenant, 401/403 e escrita online bem-sucedida.
- **FR-019**: Os clientes MUST bloquear antes do transporte qualquer mutação offline e MUST não persistir fila, corpo mutável ou sincronização automática.
- **FR-020**: O sistema MUST registrar testes automatizados de autorização, recorrência, datas São Paulo, paginação, lembrete individual, push/deep link, cache e paridade Web/Android/iOS.

### Key Entities

- **Event**: ocorrência persistida, única ou membro de uma série (`seriesId`), delimitada por tenant e instantes início/fim.
- **EventSeries**: agrupamento lógico identificado por `seriesId`; não é tabela nova nesta feature.
- **EventAttendee**: vínculo por ocorrência entre evento e destinatário ativo do tenant.
- **EventReminderAction**: ação individual `SEND`, `DISMISS_DAY` ou `DISMISS_FOREVER`, pertencente a ocorrência, destinatário e tenant.
- **PushDevice**: token de dispositivo pertencente ao destinatário no tenant; tokens não são incluídos em contratos de leitura.
- **CalendarReadCache**: leitura local versionada, segregada por contrato/tenant/usuário/consulta, sem segredo nem mutação.

## Success Criteria *(mandatory)*

- **SC-001**: 100% dos testes de contrato exercem resposta válida e cada erro declarado para todas as rotas de calendário/lembrete alteradas ou novas.
- **SC-002**: 100% dos testes de visibilidade cobrem criador, responsável, participante, não envolvido, tenant diferente e administrador selecionando usuário; nenhum caso retorna evento fora do predicado.
- **SC-003**: 100% das consultas de mês/semana/dia/lista com mais de 100 eventos preservam cursor, ordenação e todos os eventos alcançáveis sem duplicação de ocorrência.
- **SC-004**: 100% dos testes de série confirmam que edição/exclusão de ocorrência não modifica irmã, e edição/exclusão de série afeta somente registros do mesmo `seriesId` e tenant.
- **SC-005**: 100% dos testes de horário cobrem limite de dia São Paulo e evento que atravessa meia-noite; Web e Expo exibem o mesmo dia/hora lógico.
- **SC-006**: 100% dos testes de lembrete com dois destinatários confirmam que dispensa e deduplicação de push são individuais.
- **SC-007**: 100% dos testes de toque de notificação/deep link atingem o id da ocorrência correta após sessão/tenant válidos, sem dados no payload além dos ids e versão.
- **SC-008**: 100% das mutações offline nos testes são bloqueadas antes de Axios/fetch, e nenhuma mutação é colocada em fila.

## Assumptions and Out of Scope

- A fundação de sessão, autorização, retry e cache read-only de 001 está disponível; a navegação diária/base de 002 permanece compatível.
- Um papel com nome `admin` é a única exceção de seleção de pessoa nesta entrega, mas ainda passa por guard de tenant e permissão; papéis customizados não ganham essa exceção implicitamente.
- A série é materializada nas ocorrências `Event` existentes. Não há RFC 5545, exceções complexas, convite externo, resposta RSVP, calendário compartilhado livre, sincronização CalDAV/Google ou edição offline.
- O máximo de 365 ocorrências é um limite de produto/segurança e a recorrência preserva o horário civil São Paulo definido na criação.
