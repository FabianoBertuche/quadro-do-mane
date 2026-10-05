# Matriz de Paridade de Clientes

Esta matriz define a capacidade mínima que cada entrega deve detalhar e validar.
“Equivalente” significa resultado funcional e regras de acesso iguais; a
apresentação pode seguir convenções nativas desde que não elimine fluxo,
informação ou proteção prevista no contrato.

| Área | Spec responsável | Contrato | API | Web | Android | iOS | Testes |
| --- | --- | --- | --- | --- | --- | --- |
| Autenticação | 001 e 002 | Endpoint e esquema a definir pelas Specs 001 e 002. | Autentica sessão e aplica tenant, papel, permissão e escopo. | Entrar, encerrar e recuperar sessão; tratar acesso negado. | Entrar, encerrar e recuperar sessão; tratar acesso negado. | Entrar, encerrar e recuperar sessão; tratar acesso negado. | Unitários de sessão/autorização e contrato de escopo. |
| Dashboard | 001 e 002 | Endpoint e esquema a definir pelas Specs 001 e 002. | Fornece indicadores e itens autorizados. | Exibir indicadores e itens do escopo. | Exibir indicadores e itens do escopo. | Exibir indicadores e itens do escopo. | Unitários de mapeamento e contrato de filtros/escopo. |
| Tarefas | 001 e 002 | Endpoint e esquema a definir pelas Specs 001 e 002. | Lista e altera tarefas somente autorizadas. | Criar, consultar, editar, concluir e excluir quando permitido; escrita offline bloqueada. | Criar, consultar, editar, concluir e excluir quando permitido; escrita offline bloqueada. | Criar, consultar, editar, concluir e excluir quando permitido; escrita offline bloqueada. | Unitários de regras/permissões, contrato de mutações e offline. |
| Rotina | 001 e 002 | Endpoint e esquema a definir pelas Specs 001 e 002. | Expõe e altera rotinas conforme escopo. | Consultar e gerir rotinas autorizadas; escrita offline indisponível. | Consultar e gerir rotinas autorizadas; escrita offline indisponível. | Consultar e gerir rotinas autorizadas; escrita offline indisponível. | Unitários de recorrência/acesso, contrato e cache offline. |
| Calendário | 001, 002 e 003 | Endpoint e esquema a definir pelas Specs 001, 002 e 003. | Entrega eventos filtrados por tenant, equipe e permissão. | Consultar e gerir eventos autorizados. | Consultar e gerir eventos autorizados. | Consultar e gerir eventos autorizados. | Unitários de datas/filtros e contrato de eventos. |
| Lembretes | 001, 002 e 003 | Endpoint e esquema a definir pelas Specs 001, 002 e 003. | Cria, consulta e altera lembretes no escopo. | Configurar, consultar e cancelar quando permitido; escrita offline bloqueada. | Configurar, consultar e cancelar quando permitido; escrita offline bloqueada. | Configurar, consultar e cancelar quando permitido; escrita offline bloqueada. | Unitários de agendamento/permissão, contrato e offline. |
| Projetos | 001, 002 e 003 | Endpoint e esquema a definir pelas Specs 001, 002 e 003. | Protege leitura e mutação de projetos por tenant e permissão. | Criar, consultar, editar, arquivar e navegar projetos permitidos. | Criar, consultar, editar, arquivar e navegar projetos permitidos. | Criar, consultar, editar, arquivar e navegar projetos permitidos. | Unitários de regras e contrato de escopo; ações autorizadas/negadas. |
| Equipes | 001, 002 e 003 | Endpoint e esquema a definir pelas Specs 001, 002 e 003. | Gerencia associações e visibilidade de equipe. | Consultar e gerir equipes e membros quando autorizado. | Consultar e gerir equipes e membros quando autorizado. | Consultar e gerir equipes e membros quando autorizado. | Unitários de associação/papéis e contrato de visibilidade. |
| Administração | 001, 002 e 004 | Endpoint e esquema a definir pelas Specs 001, 002 e 004. | Expõe ações administrativas por papel e tenant. | Executar administração permitida e informar restrição. | Executar administração permitida e informar restrição. | Executar administração permitida e informar restrição. | Unitários de políticas, contrato de papel e ações proibidas auditáveis. |
| Contatos | 001, 002 e 004 | Endpoint e esquema a definir pelas Specs 001, 002 e 004. | Retorna contatos dentro do tenant e permissões. | Consultar e gerir contatos autorizados; escrita offline bloqueada. | Consultar e gerir contatos autorizados; escrita offline bloqueada. | Consultar e gerir contatos autorizados; escrita offline bloqueada. | Unitários de validação/escopo, contrato e offline. |
| E-mail | 001, 002 e 004 | Endpoint e esquema a definir pelas Specs 001, 002 e 004. | Autoriza operações e preserva escopo de destinatários/tenant. | Consultar e executar ações autorizadas; envio offline bloqueado. | Consultar e executar ações autorizadas; envio offline bloqueado. | Consultar e executar ações autorizadas; envio offline bloqueado. | Unitários de autorização/composição, contrato e envio offline. |
| Auditoria | 001, 002 e 004 | Endpoint e esquema a definir pelas Specs 001, 002 e 004. | Registra e expõe eventos auditáveis no escopo. | Consultar trilha autorizada com filtros. | Consultar trilha autorizada com filtros. | Consultar trilha autorizada com filtros. | Unitários de registro/filtragem, contrato e ausência de vazamento entre tenants. |
| Perfil | 001, 002, 003, 004 e 005 | Endpoint e esquema a definir pelas Specs 001, 002, 003, 004 e 005. | Atualiza e consulta perfil da identidade autorizada. | Consultar e editar perfil próprio; escrita offline bloqueada. | Consultar e editar perfil próprio; escrita offline bloqueada. | Consultar e editar perfil próprio; escrita offline bloqueada. | Unitários de validação, contrato de identidade e offline. |
| Configurações | 001, 002, 003, 004 e 005 | Endpoint e esquema a definir pelas Specs 001, 002, 003, 004 e 005. | Persiste configurações respeitando tenant, papel e escopo. | Consultar e editar configurações autorizadas; escrita offline bloqueada. | Consultar e editar configurações autorizadas; escrita offline bloqueada. | Consultar e editar configurações autorizadas; escrita offline bloqueada. | Unitários de política/persistência, contrato, acesso negado e offline. |
| Notificações | 001, 002, 003, 004 e 005 | Endpoint e esquema a definir pelas Specs 001, 002, 003, 004 e 005. | Lista, configura e marca notificações no escopo. | Consultar preferências e notificações; mutações apenas online. | Consultar preferências e notificações; mutações apenas online. | Consultar preferências e notificações; mutações apenas online. | Unitários de preferência/estado, contrato, permissão e offline. |
| Arquivos | 001, 002, 003, 004 e 005 | Endpoint e esquema a definir pelas Specs 001, 002, 003, 004 e 005. | Autoriza metadados, acesso e operações pelo escopo do recurso. | Consultar arquivos autorizados; envio, substituição e exclusão apenas online. | Consultar arquivos autorizados; envio, substituição e exclusão apenas online. | Consultar arquivos autorizados; envio, substituição e exclusão apenas online. | Unitários de autorização, contrato de metadados/acesso e mutações offline. |

## Estados auditáveis em todas as linhas

Para cada área, Web, Android e iOS devem registrar nos testes e na revisão da
spec os estados aplicáveis de carregamento, erro, vazio e acesso negado. A
ausência de um desses estados reprova o gate da linha, mesmo que a operação
principal esteja disponível.

## Registro de exceções de paridade aprovadas

Este é o local oficial para registrar exceções. Sem uma linha aprovada neste
registro, uma diferença de capacidade entre clientes não é permitida. Cada
registro deve informar área, cliente afetado, diferença, justificativa,
alternativa para a pessoa usuária, aprovadores e data de revisão.

| Área | Cliente afetado | Diferença aprovada | Justificativa | Alternativa | Aprovadores | Data de revisão |
| --- | --- | --- | --- | --- | --- | --- |
| Nenhuma exceção aprovada | — | — | — | — | — | — |

## Regra transversal de cache e conectividade

Para todas as áreas, uma leitura pode usar cache somente em modo offline e deve
exibir aviso persistente de que o conteúdo pode estar desatualizado. Nenhum
cliente cria fila de escrita offline: botões, comandos e chamadas de mutação
ficam indisponíveis até a conectividade ser restabelecida e uma nova validação
do backend ocorrer.
