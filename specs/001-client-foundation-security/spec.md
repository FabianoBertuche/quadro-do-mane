# Feature Specification: Fundação segura e paritária dos clientes

**Feature Branch**: `001-client-foundation-security`  
**Created**: 2026-09-09  
**Status**: Approved  
**Input**: User description: "Contrato único API/Web/Expo; tratamento uniforme loading/error/401/403/retry; corrigir tenant/usuário/participação/permissões em tarefas, projetos, eventos, rotina, notificações; cache read-only offline explícito e mutações bloqueadas; base de testes unitários API/Next/Expo."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Trabalhar somente no tenant autorizado (Priority: P1)

Como colaborador autenticado, quero visualizar e alterar apenas os recursos aos quais tenho acesso no tenant selecionado para que dados e ações de outra organização nunca sejam expostos ou modificados.

**Why this priority**: Isolamento de tenant e autorização correta são pré-requisitos para uso seguro de todas as demais jornadas.

**Independent Test**: Com dois tenants, usuários e participações distintos, cada recurso de tarefas, seus anexos, projetos, eventos, rotina e notificações pode ser solicitado e alterado por um usuário autorizado; tentativas contra recursos de outro tenant ou sem participação retornam o resultado de acesso negado definido sem gravar arquivo ou dado.

**Acceptance Scenarios**:

1. **Given** que uma pessoa selecionou o Tenant A, **When** ela lista, consulta ou altera uma tarefa, projeto, evento, item de rotina ou notificação, **Then** o resultado contém somente dados do Tenant A e a ação não afeta dados do Tenant B.
2. **Given** que uma pessoa não tem a permissão ou participação necessária para um recurso do seu tenant, **When** ela tenta realizar a operação protegida, **Then** a ação não é executada e ela recebe uma resposta de acesso negado.
3. **Given** que uma pessoa informa o identificador de um participante, responsável, membro ou destinatário, **When** salva a alteração, **Then** o vínculo só é aceito se a pessoa informada estiver ativa no mesmo tenant e tiver participação válida quando exigida.
4. **Given** que uma notificação pertence a outra pessoa do mesmo tenant, **When** o usuário atual tenta marcá-la como lida, **Then** a notificação permanece inalterada e o acesso é negado.
5. **Given** que uma pessoa tenta anexar um arquivo a uma tarefa não visível, de outro tenant ou sem permissão, **When** ela envia o arquivo, **Then** nenhum arquivo nem registro de anexo é criado.

---

### User Story 2 - Ter comportamento igual de comunicação no Web e no mobile (Priority: P2)

Como usuário que alterna entre Web e aplicativo mobile, quero que as mesmas operações tenham contratos, estados de carregamento, erros e recuperação equivalentes para que eu saiba o que esperar em qualquer dispositivo.

**Why this priority**: Paridade previsível reduz erros operacionais e evita que uma plataforma exponha comportamento diferente para a mesma regra de negócio.

**Independent Test**: Para cada recurso coberto, a mesma requisição válida e cada resposta 401, 403, indisponibilidade temporária e falha definitiva produzem os mesmos resultados funcionais definidos nos dois clientes.

**Acceptance Scenarios**:

1. **Given** que uma consulta ou ação ainda está em andamento, **When** o usuário abre a área correspondente em Web ou mobile, **Then** ambos mostram que a operação está em carregamento e impedem duplicação involuntária da mesma ação.
2. **Given** que a sessão expirou durante uma consulta, **When** uma operação `GET` ou `HEAD` recebe 401, **Then** cada cliente tenta renovar a sessão uma única vez e repete a consulta original somente se a sessão for renovada.
3. **Given** que a sessão expirou durante uma criação, edição, exclusão, upload ou outra mutação, **When** a operação recebe 401, **Then** o cliente não a repete automaticamente e exige uma nova intenção explícita do usuário após a recuperação da sessão.
4. **Given** que o usuário não está autorizado, **When** uma operação recebe 403, **Then** cada cliente mantém a sessão, não repete a operação e apresenta uma mensagem de permissão insuficiente.
5. **Given** que uma operação falha temporariamente antes de chegar ao servidor, **When** ela é uma leitura elegível para nova tentativa, **Then** cada cliente oferece nova tentativa conforme a política comum sem duplicar uma mutação.

---

### User Story 3 - Consultar com clareza quando estiver offline (Priority: P3)

Como usuário sem conexão, quero consultar apenas dados já disponíveis localmente com indicação explícita de desatualização e sem conseguir enviar alterações para que eu não presuma que uma alteração foi salva.

**Why this priority**: A consulta offline conserva produtividade, mas não pode comprometer a integridade das informações corporativas.

**Independent Test**: Após carregar uma lista com conexão, desligar a rede permite consultar essa lista com o aviso offline; criar, editar, mover, concluir, excluir ou marcar como lido fica bloqueado e nenhuma solicitação de mutação é enviada.

**Acceptance Scenarios**:

1. **Given** que o usuário já consultou dados permitidos com conexão, **When** fica offline, **Then** ele pode ler a última versão disponível identificada como conteúdo offline e com data/hora da última atualização em `America/Sao_Paulo`.
2. **Given** que o usuário está offline, **When** tenta qualquer mutação, **Then** a ação é bloqueada antes do envio e informa que ela exige conexão.
3. **Given** que não existe uma versão local do dado, **When** o usuário o abre sem conexão, **Then** o cliente informa indisponibilidade offline em vez de mostrar conteúdo vazio como se fosse atual.

### Edge Cases

- A sessão continua inválida após a única tentativa de renovação: o cliente encerra a sessão local de forma segura e orienta novo acesso, sem repetir a operação novamente.
- A associação solicitada referencia um usuário inativo, removido, de outro tenant ou não participante do projeto/evento: o vínculo é recusado sem alteração parcial.
- Uma operação de leitura falha após a atualização local mais recente: o conteúdo existente continua visível com estado desatualizado, sem ser apresentado como resultado novo.
- Duas pessoas tentam alterar o mesmo item enquanto uma delas está offline: não há fila nem sincronização automática de mutações nesta entrega; a pessoa offline deve reconectar e repetir a ação sobre o estado atual.
- Para itens de rotina e consultas por data, o dia de referência é o dia civil de `America/Sao_Paulo`, inclusive em transições de horário de verão quando aplicável.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST aplicar a mesma definição pública de cada operação coberta pela funcionalidade para API, Web e aplicativo mobile, incluindo dados aceitos, dados devolvidos e resultados de erro.
- **FR-002**: O sistema MUST identificar o tenant ativo e a pessoa participante antes de permitir leitura ou alteração de tarefas, projetos, eventos, itens de rotina e notificações.
- **FR-003**: O sistema MUST impedir que uma operação em um recurso de um tenant produza leitura ou alteração em recurso de outro tenant.
- **FR-004**: O sistema MUST verificar permissão e, quando aplicável, participação no recurso antes de cada operação protegida.
- **FR-005**: O sistema MUST aceitar responsáveis, participantes, membros e destinatários somente quando pertencerem ao tenant ativo, estiverem ativos e cumprirem a regra de participação do recurso.
- **FR-006**: O sistema MUST permitir que uma notificação seja lida ou contabilizada apenas por seu destinatário no tenant ativo.
- **FR-007**: O sistema MUST apresentar estados equivalentes de carregamento, sucesso, falha, acesso não autenticado e acesso proibido nos clientes Web e mobile.
- **FR-008**: O sistema MUST tentar recuperar uma sessão inválida no máximo uma vez por operação.
- **FR-008a**: O sistema MUST repetir automaticamente após recuperação de sessão somente operações `GET` ou `HEAD`; `POST`, `PATCH`, `PUT`, `DELETE` e upload MUST exigir nova intenção explícita do usuário.
- **FR-009**: O sistema MUST preservar a sessão em resposta de acesso proibido e não repetir automaticamente uma operação proibida.
- **FR-010**: O sistema MUST permitir nova tentativa apenas para leituras cuja falha seja temporária; nenhuma mutação pode ser repetida automaticamente sem nova intenção explícita do usuário.
- **FR-011**: O sistema MUST oferecer, sem conexão, somente consulta de dados previamente disponíveis e identificá-los como offline, incluindo a data e hora da última atualização em `America/Sao_Paulo`.
- **FR-012**: O sistema MUST bloquear antes do envio todas as mutações enquanto estiver offline e não manter fila de mutações para envio posterior nesta funcionalidade.
- **FR-013**: O sistema MUST disponibilizar testes automatizados de unidade para as regras de autorização da API e para os comportamentos de cliente comuns no Web e no aplicativo mobile.
- **FR-014**: O sistema MUST validar o escopo de tenant, tarefa e pessoa enviadora antes de gravar um arquivo ou criar seu registro de anexo.
- **FR-015**: O sistema MUST publicar um contrato canônico versionado que descreva, para toda operação coberta, método, solicitação, resposta, erros, paginação/filtros e requisito funcional rastreável.
- **FR-016**: O sistema MUST aplicar permissões do papel ativo também a usuários administrativos; exceções administrativas de visibilidade só podem ocorrer pelas regras formais de cada recurso e nunca ignoram o tenant ou a permissão exigida.

### Key Entities *(include if feature involves data)*

- **Tenant**: Organização selecionada que delimita todo dado e toda autorização operacional.
- **TenantUser**: Participação ativa de uma pessoa em um Tenant; porta o papel e as permissões no contexto daquele Tenant.
- **Permission**: Capacidade concedida à participação para executar uma operação protegida.
- **ProjectMember**: Participação direta de uma pessoa em um projeto, usada para determinar visibilidade e operações permitidas quando a regra exigir vínculo.
- **Task**: Trabalho pertencente a um projeto e a um Tenant, com responsável, participantes e estado.
- **Attachment**: Arquivo e seus metadados, ligado a uma tarefa ou projeto, ao tenant e à participação que o enviou; arquivo e registro só existem após validação do escopo.
- **Event**: Compromisso do Tenant que pode ter criador, responsável, participantes, projeto ou tarefa relacionados.
- **DailyRoutineItem**: Item recorrente atribuído a uma participação de Tenant; seu registro diário usa a data civil de `America/Sao_Paulo`.
- **Notification**: Mensagem destinada a uma participação específica no Tenant, com estado individual de leitura.
- **CachedReadModel**: Última versão local e somente leitura de uma consulta permitida, vinculada ao tenant, ao usuário e ao instante da obtenção.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dos testes automatizados de isolamento executam pelo menos uma tentativa de leitura e uma de mutação entre tenants para cada um dos cinco recursos cobertos e confirmam que nenhuma retorna ou altera dado externo.
- **SC-002**: 100% dos testes de autorização cobrem resultado permitido e proibido para cada operação protegida definida no contrato; nenhuma operação proibida produz alteração persistida.
- **SC-003**: Para cada cenário comum de loading, 401, 403, erro temporário e retry, Web e mobile apresentam o mesmo resultado funcional em 100% dos testes de paridade.
- **SC-004**: 100% das mutações disparadas sem conexão são bloqueadas no cliente antes de qualquer tentativa de comunicação e apresentam uma explicação de que exigem conexão.
- **SC-005**: Em testes de sessão expirada, cada operação gera no máximo uma tentativa de renovação; somente operações `GET` e `HEAD` podem gerar no máximo uma repetição da operação original.
- **SC-005a**: Em 100% dos testes de 401 para `POST`, `PATCH`, `PUT`, `DELETE` e upload, a operação original é enviada exatamente uma vez; somente cenários `GET`/`HEAD` podem registrar uma repetição pós-refresh.
- **SC-006**: 100% dos testes de consulta offline mostram um identificador offline e uma data/hora de última atualização interpretável em `America/Sao_Paulo`.
- **SC-007**: 100% dos testes de upload negado confirmam que nenhum arquivo é gravado e nenhum `Attachment` é criado.

## Assumptions

- A identidade autenticada já fornece tenant selecionado, participação, papel e permissões para as áreas cobertas.
- Papéis administrativos não ignoram permissões. Quando a matriz de contrato permitir visibilidade ampliada, ela permanece limitada ao tenant ativo e deve ser aplicada pelo predicado formal do recurso.
- A autorização baseada em participação é aplicada somente onde a regra de visibilidade/alteração do recurso a exige; permissões continuam necessárias em todos os casos.
- O cache offline é por usuário e tenant, não é compartilhado entre contas nem tenants, e não substitui o registro oficial.
- A entrega não inclui edição offline, sincronização em segundo plano, resolução de conflitos nem mudanças de produto fora dos cinco recursos cobertos.
