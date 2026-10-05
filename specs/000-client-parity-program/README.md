# Programa de Paridade de Clientes

## Objetivo

Entregar uma experiência funcionalmente equivalente do Monte Moria em Web,
Android e iOS, sustentada por uma API única que aplica tenant, permissões e
escopo no servidor. O programa converte a paridade em requisito de entrega:
nenhuma funcionalidade de produto avança como concluída sem contrato,
implementação e testes compatíveis nos três clientes.

## Escopo

O programa cobre autenticação, dashboard, tarefas, rotina, calendário,
lembretes, projetos, equipes, administração, contatos, e-mail, auditoria,
perfil, configurações, notificações e arquivos. Inclui a definição e revisão
dos contratos de API, a matriz de capacidade por plataforma, comportamento de
cache de leitura e os testes necessários para manter a equivalência.

## Exclusões

Não fazem parte deste programa: reformulação visual que não afete fluxo ou
capacidade; criação de recursos exclusivos de uma plataforma; sincronização de
escritas offline; e alterações de infraestrutura que não sejam necessárias
para expor, proteger ou validar os contratos de paridade. Integrações futuras
fora das áreas listadas devem abrir uma spec própria antes de entrar no
programa.

## Matriz de funcionalidades

| Domínio | API | Web | Android | iOS | Referência |
| --- | --- | --- | --- | --- | --- |
| Autenticação | sessão, identidade e escopo | acesso e sessão | acesso e sessão | acesso e sessão | `parity-matrix.md` |
| Trabalho diário | dashboard, tarefas e rotina | consulta e execução | consulta e execução | consulta e execução | `parity-matrix.md` |
| Agenda | calendário e lembretes | consulta e gestão | consulta e gestão | consulta e gestão | `parity-matrix.md` |
| Organização | projetos, equipes e administração | gestão autorizada | gestão autorizada | gestão autorizada | `parity-matrix.md` |
| Comunicação e rastreabilidade | contatos, e-mail e auditoria | consulta e ações autorizadas | consulta e ações autorizadas | consulta e ações autorizadas | `parity-matrix.md` |
| Preferências e conteúdo | perfil, configurações, notificações e arquivos | gestão autorizada | gestão autorizada | gestão autorizada | `parity-matrix.md` |

## Sequência de especificações

| Spec | Foco | Resultado bloqueador |
| --- | --- | --- |
| 001 | Fundação de identidade, tenants, permissões, contratos e política offline | API autoritativa e modelo de compatibilidade definidos |
| 002 | Autenticação, dashboard, tarefas e rotina | Fluxo diário equivalente nas três plataformas |
| 003 | Calendário, lembretes, projetos e equipes | Agenda e organização de trabalho equivalentes |
| 004 | Administração, contatos, e-mail e auditoria | Gestão e rastreabilidade sob autorização de tenant |
| 005 | Perfil, configurações, notificações e arquivos | Preferências, comunicação e conteúdo equivalentes |

## Dependências

- 001 é pré-requisito de 002 a 005, pois define contratos compartilhados,
  escopo de tenant, políticas de acesso e comportamento offline.
- 002 depende de identidade e permissões de 001; pode fornecer referências de
  padrões de tela e testes aos demais fluxos.
- 003 e 004 dependem formalmente de 001 e 002 e podem avançar em paralelo
  somente após a conclusão de ambas; integrações entre seus domínios devem
  preservar o mesmo modelo de autorização.
- 005 depende formalmente de 001, 002, 003 e 004. Perfil, configurações,
  notificações e arquivos só avançam depois que os contratos e fluxos desses
  quatro marcos estiverem concluídos e revisados.

## Gates globais

1. A spec do domínio e a matriz de paridade estão revisadas antes da alteração
   de contrato ou implementação.
2. A API aplica autenticação, tenant, papel, permissão e escopo dos dados sem
   confiar em decisão definitiva do cliente.
3. Web, Android e iOS implementam o mesmo resultado funcional, inclusive
   carregamento, erro, vazio, indisponibilidade e acesso negado.
4. Cada comportamento novo ou modificado possui testes unitários red-green-
   refactor nos módulos afetados; contratos compartilhados possuem testes de
   compatibilidade quando forem alterados.
5. Offline permite apenas consulta de cache com aviso visível de possível
   desatualização; toda mutação fica bloqueada sem conectividade.
6. Documentação de API, permissões, limites por plataforma e critérios de
   aceite é revisada junto da spec antes da liberação.

## Critérios de aceite do programa

- Cada linha da matriz possui contrato de API definido, comportamento Web,
  Android e iOS especificado e estratégia de teste verificável.
- Nenhum cliente recebe autorização, dados fora de seu tenant ou capacidade que
  contradiga a política aplicada pelo backend.
- Uma pessoa usuária autorizada consegue concluir os fluxos em escopo por
  qualquer um dos três clientes, respeitadas apenas diferenças nativas
  documentadas.
- No modo offline, leituras em cache são claramente sinalizadas e não é
  possível iniciar ou confirmar uma mutação.
- As specs 001 a 005 são concluídas na sequência de dependências, com revisão
  de contratos e documentação atualizada para cada entrega.
