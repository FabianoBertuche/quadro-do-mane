# Especificação — 002 Daily Workspace

**Branch de especificação:** `002-daily-workspace`
**Status:** Aprovada para planejamento
**Data:** 2026-09-09

## Objetivo

Entregar uma experiência operacional coerente em Web, Android e iOS para que uma pessoa veja e execute o seu trabalho do dia. A funcionalidade reúne tarefas atribuídas, atrasadas, rotinas diárias, compromissos e lembretes de calendário, preservando autorização por tenant e permissão. Em ausência de rede, informações previamente sincronizadas continuam consultáveis; nenhuma alteração é aceita ou enfileirada offline.

## Escopo

- Nova navegação principal: **Início**, **Trabalho**, **Agenda** e **Mais**.
- Início operacional na data local de `America/Sao_Paulo`.
- Lista de tarefas com busca, filtros e detalhe com responsáveis, anexos, checklists, comentários e subtarefas.
- Agenda diária de compromissos e lembretes de calendário.
- Ações, menus e atalhos condicionados a permissões tanto visualmente quanto no servidor.
- Cache local somente leitura, segregado por tenant, usuário e data de referência.

Fora de escopo: sincronização de alterações offline, conflitos de edição, alterações de autorização, novos papéis, recorrência nova, upload em segundo plano e mudança de esquema PostgreSQL.

## Premissas e regras de negócio

- O tenant ativo, `tenantUserId` e permissões vêm da sessão autenticada. Toda consulta é limitada ao tenant ativo.
- A leitura agregada é autorizada por OR explícito: `tasks.view || calendar.view || daily_routine.view`. O controller usa `DailyWorkspaceReadGuard`, e não o `PermissionGuard` padrão, pois este interpreta múltiplas permissões do decorator como AND. Quando o snapshot de permissões no JWT não satisfaz o OR, o guard consulta as permissões atuais do papel no banco com o mesmo fallback `roleId` → `roleName` do `PermissionGuard`, atualiza `request.user.permissions` e só então decide.
- “Hoje” é a data de calendário em `America/Sao_Paulo`, não a data UTC nem o fuso do dispositivo.
- Uma tarefa atrasada tem `dueDate` anterior ao início de hoje em São Paulo e status cuja categoria não é `done`.
- Uma tarefa atribuída é aquela cujo responsável principal ou vínculo em `TaskAssignee` é o usuário autenticado. A versão inicial deve retornar ambos sem duplicação.
- Compromissos e lembretes só são exibidos ao criador, responsável ou participante elegível do evento.
- O cache contém apenas respostas GET já concluídas com sucesso. Quando offline, controles que causariam POST, PATCH, DELETE ou upload ficam indisponíveis com mensagem explícita.
- Ocultar um controle por falta de permissão melhora a interface, mas não substitui os guards existentes da API.

## Histórias de usuário e critérios de aceitação

### US1 — Início operacional (P1)

Como colaborador autenticado, quero abrir o Início e entender tudo que exige minha atenção hoje, para priorizar o trabalho sem percorrer várias telas.

**Independente porque:** pode ser entregue como uma página de leitura que agrega recursos existentes; nenhuma edição de tarefa ou nova navegação é necessária para validar o conteúdo.

**Critérios GWT**

1. **Dado** um usuário com uma tarefa em atraso, uma atribuída para hoje e um item de rotina, **quando** abre o Início, **então** vê seções distintas “Atrasadas”, “Meu trabalho”, “Rotina diária”, “Compromissos” e “Lembretes” com as contagens e itens aplicáveis.
2. **Dado** a data UTC próxima à meia-noite, **quando** o usuário abre a página, **então** a data e a classificação de atraso usam o dia de `America/Sao_Paulo`.
3. **Dado** que uma seção não possui itens, **quando** o painel é carregado, **então** a seção mostra estado vazio contextual sem esconder as demais seções.
4. **Dado** que o usuário não possui uma permissão de criar tarefa ou evento, **quando** vê atalhos, **então** os atalhos correspondentes não são mostrados.

### US2 — Trabalho e detalhe de tarefa (P2)

Como colaborador com acesso a tarefas, quero localizar, filtrar e inspecionar tarefas, para atualizar o trabalho que está sob minha responsabilidade.

**Independente porque:** a tela Trabalho funciona a partir de uma rota direta, usa a sessão e os contratos de tarefas, sem depender da agregação do Início.

**Critérios GWT**

1. **Dado** tarefas de vários projetos e responsáveis, **quando** aplico busca e filtros, **então** a lista contém somente itens que satisfazem todos os filtros selecionados e a busca por título ou descrição.
2. **Dado** uma tarefa com responsáveis, anexos, checklists, comentários e subtarefas, **quando** abro seu detalhe, **então** cada recurso é exibido com contagem e conteúdo disponível ao usuário.
3. **Dado** um usuário com `tasks.comment`, **quando** publica comentário válido online, **então** ele aparece na conversa após sucesso da API; **dado** que não possui a permissão, **então** o compositor não é exibido e a API recusaria a operação.
4. **Dado** um usuário com `tasks.checklist_manage`, **quando** alterna um item de checklist online, **então** o estado e o progresso são atualizados; **dado** que está offline, **então** o controle fica desabilitado e nenhum pedido de escrita é feito.

### US3 — Agenda, navegação e consulta offline (P3)

Como usuário de Web, Android ou iOS, quero navegar entre Início, Trabalho, Agenda e Mais e consultar o último estado carregado sem rede, para continuar orientado durante deslocamentos ou instabilidade.

**Independente porque:** o shell de navegação, a agenda e o adaptador de cache podem ser testados com dados de consulta simulados sem editar tarefas.

**Critérios GWT**

1. **Dado** uma sessão válida, **quando** abro qualquer cliente, **então** encontro as quatro entradas na mesma ordem e com a rota/tela ativa destacada.
2. **Dado** eventos sobrepostos no dia, **quando** abro Agenda, **então** cada compromisso aparece no intervalo do dia em São Paulo, ordenado por início, e o evento relacionado à tarefa mantém link para o detalhe quando há permissão de tarefa.
3. **Dado** um lembrete ainda não dispensado, **quando** vejo Agenda ou Início, **então** ele é apresentado separadamente do compromisso, com opção de dispensar apenas se o usuário estiver online e autorizado pelo contrato existente.
4. **Dado** que uma consulta foi carregada com sucesso e depois a conectividade é perdida, **quando** revisito a mesma visão para o mesmo tenant, usuário e dia, **então** vejo os dados salvos, um indicador “Dados salvos; somente leitura” e nenhuma ação mutável habilitada.
5. **Dado** que não existe cache compatível, **quando** abro uma visão offline, **então** vejo um estado offline vazio e uma ação de tentar novamente, sem conteúdo de outro tenant ou usuário.

## Requisitos funcionais

- **FR-001:** O sistema DEVE calcular `referenceDate` e as fronteiras do dia em `America/Sao_Paulo` para Início, Agenda, rotinas e atraso.
- **FR-002:** O Início DEVE mostrar tarefas atribuídas ao usuário, tarefas atrasadas, rotina diária, compromissos e lembretes elegíveis para a data de referência.
- **FR-003:** Uma mesma tarefa NÃO DEVE aparecer duas vezes na seção “Meu trabalho” quando houver responsável principal e vínculo adicional para o mesmo usuário; “Minhas tarefas” e filtro por responsável DEVEM considerar `Task.assigneeTenantUserId` e `TaskAssignee.tenantUserId`.
- **FR-004:** O Início DEVE permitir abrir a tarefa, o evento ou o destino de cada atalho que o usuário tem permissão para acessar.
- **FR-005:** Atalhos para criar tarefa, evento, projeto ou rotina DEVEM ser derivados das respectivas permissões e não devem aparecer sem autorização.
- **FR-006:** Trabalho DEVE aceitar filtros combináveis de projeto, status, responsável, prioridade, equipe, tag, atraso, concluída, bloqueada e intervalo de datas, além de termo de busca.
- **FR-007:** Trabalho DEVE apresentar filtro “Minhas tarefas” usando o `tenantUserId` da sessão, sem aceitar um identificador de outro tenant como substituto.
- **FR-008:** A lista DEVE oferecer estado de carregamento, estado vazio e falha recuperável sem apagar filtros já selecionados.
- **FR-009:** O detalhe de tarefa DEVE apresentar título, descrição, projeto, status, prioridade, datas, bloqueio, responsáveis, anexos, checklists, comentários e subtarefas quando presentes.
- **FR-010:** O detalhe DEVE exibir ações de criar, editar, mover/status, prioridade, responsável, comentário, checklist, anexo e exclusão apenas quando a permissão real da rota existe. Criar usa `tasks.create`; editar, atribuir responsável e enviar/remover anexo usam `tasks.edit`; excluir usa `tasks.delete`; status usa `tasks.change_status`; prioridade usa `tasks.change_priority`.
- **FR-011:** O cliente DEVE continuar usando os endpoints protegidos existentes; o backend DEVE permanecer a fonte de verdade para todas as escritas, incluindo `POST /tasks` e `DELETE /tasks/:id`.
- **FR-012:** Agenda DEVE consultar eventos por intervalo de um dia São Paulo e listar apenas eventos visíveis ao usuário autenticado.
- **FR-013:** Agenda e Início DEVEM consultar lembretes ativos do usuário e permitir dispensá-los somente pelas rotas existentes e somente online.
- **FR-014:** Web, Android e iOS DEVEM expor Início, Trabalho, Agenda e Mais com rótulos em português e ordem idêntica.
- **FR-015:** Mais DEVE conter apenas destinos que a sessão pode visualizar; o perfil e sair permanecem disponíveis à sessão autenticada.
- **FR-016:** O cache de leitura DEVE ter chave que inclua `contractVersion` literal `2026-09-09`, tenant, `tenantUserId`, recurso e, quando aplicável, data de referência.
- **FR-017:** O cache DEVE ser invalidado no logout, troca de tenant, erro de autorização 401/403 e após uma escrita online bem-sucedida que afete o recurso.
- **FR-018:** Offline, o cliente DEVE bloquear POST, PATCH, DELETE e upload, não deve criar fila de mutações e DEVE comunicar o motivo antes da tentativa de escrita.
- **FR-019:** O banner de dados salvos DEVE informar data/hora da última sincronização e que o modo é somente leitura.
- **FR-020:** Todos os estados de autorização, vazio, erro e offline DEVEM ser acessíveis por leitor de tela e navegáveis por teclado na Web.

## Requisitos não funcionais

- **NFR-001:** A API agregada deve responder em até 1,5 s no p95 para até 100 itens de cada coleção, excluindo indisponibilidade externa.
- **NFR-002:** A primeira renderização útil de uma resposta cacheada deve ocorrer em até 500 ms, medida do início da montagem/foco da visão até o primeiro estado de conteúdo visível, em Chrome desktop de referência e em emuladores Android e iOS reais de referência. A métrica móvel é obtida por Detox no dispositivo/emulador, nunca por Jest ou por simulação de `Platform.OS`.
- **NFR-003:** Dados de tenant ou usuário anterior nunca podem ser exibidos após troca de sessão, inclusive offline.
- **NFR-004:** Os clientes devem compilar sem erro TypeScript e os testes de contrato, unidade e E2E definidos em `tasks.md` devem passar.

## Cenários de exceção

- Data inválida: API responde 400 com mensagem de validação; o cliente mantém a última data válida e explica o erro.
- Sessão expirada ou permissão removida: cache é limpo, a consulta é interrompida e o usuário passa pelo fluxo de sessão/autorização vigente.
- Serviço parcial indisponível: a API agregada retorna o painel disponível com `unavailableSections`; o cliente sinaliza apenas a seção indisponível e mantém as outras.
- Dispositivo em fuso distinto: a data visualizada e os limites de consulta seguem São Paulo; horários do evento são apresentados com indicação “Horário de São Paulo”.

## Critérios de sucesso

- **SC-001:** Em testes E2E, 100% dos cenários GWT P1, P2 e P3 passam em Web; os mesmos cenários de navegação, permissão, data São Paulo e offline passam nos runners Expo Android e iOS.
- **SC-002:** Em dados de teste contendo uma tarefa atribuída duas vezes, a seção “Meu trabalho” apresenta exatamente uma ocorrência.
- **SC-003:** Em cinco execuções de teste em fronteira de dia (02:59:59Z e 03:00:00Z, conforme DST aplicável), a data de referência e atraso são consistentes com `America/Sao_Paulo`.
- **SC-004:** Em teste de rede desligada, há zero chamadas mutáveis e zero itens em fila; todas as ações de escrita ficam indisponíveis.
- **SC-005:** Em teste de mudança de tenant e logout, nenhuma chave de cache do contexto anterior pode ser lida.
- **SC-006:** Usuários sem permissão não veem ações vedadas, e chamadas diretas às rotas recebem 403 conforme guards atuais.
- **SC-007:** Em teste instrumentado com entrada cacheada, o primeiro conteúdo útil é renderizado em até 500 ms em Web e nos runs Detox de emuladores Android e iOS reais.

## Dependências

- API NestJS de tarefas, eventos, rotinas, upload e sessão já existentes.
- Prisma/PostgreSQL com entidades descritas em `data-model.md`; a primeira entrega não exige migration.
- Next.js Web e Expo Router para Android/iOS; armazenamento seguro já adotado pelo app móvel.

## Riscos e mitigação

- **Divergência de fuso entre API e cliente:** centralizar a criação do intervalo São Paulo no backend e testar bordas temporais.
- **Contrato de tarefas não inclui todos os responsáveis na lista:** criar projeção diária que una responsável principal e `TaskAssignee` no servidor.
- **Vazamento de cache entre tenants:** encapsular chaves e limpeza de sessão em um único adaptador testado.
- **Paridade visual se degradar:** reutilizar contratos, copy e testes de fluxo compartilhados, mantendo adaptações apenas de layout/plataforma.
