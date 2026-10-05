# Research: Fundação segura e paritária dos clientes

**Date**: 2026-09-09  
**Scope**: Contrato API/Web/Expo, autorização de recursos, estados de cliente, cache offline e testes.

## Decision 1: Contrato canônico versionado pela API

**Decision**: A API Nest será a fonte canônica para formatos de recurso, parâmetros, códigos de erro e envelope de erro. Web e Expo consumirão tipos/normalizadores compartilhados em `packages/utils`, sem cada cliente reinterpretar respostas livremente.

**Rationale**: Há dois clientes Axios independentes e formatos de tratamento de erro parcialmente diferentes. Um contrato canônico reduz divergência sem introduzir um terceiro backend ou replicar regras de negócio no cliente.

**Alternatives considered**:

- Duplicar tipos e adaptadores em `apps/web` e `apps/mobile`: rejeitado, pois a paridade volta a depender de manutenção paralela.
- Fazer cada tela definir seu próprio contrato: rejeitado, pois não permite demonstrar paridade sistemática nem testar cenários comuns uma vez.
- Migrar integralmente para um novo protocolo de comunicação: rejeitado, porque ultrapassa o escopo de corrigir a base existente.

## Decision 2: Contexto de autorização único por requisição

**Decision**: A API formará um contexto confiável com `tenantId`, `tenantUserId`, estado ativo, papel e permissões antes de entrar no serviço. Toda consulta e mutação dos recursos cobertos receberá esse contexto, nunca identificadores de tenant ou de usuário fornecidos pelo cliente como autoridade.

**Rationale**: Os modelos já ligam recursos a `tenantId` e participantes a `TenantUser`; porém, algumas operações atuais consultam por identificador simples, aplicam filtro incompleto ou deixam o serviço inferir dados sem o ator. Centralizar o contexto faz com que as mesmas invariantes sejam aplicáveis a tarefas, projetos, eventos, rotina e notificações.

**Alternatives considered**:

- Confiar em filtros passados pela tela: rejeitado, pois filtros do cliente não são controles de segurança.
- Verificar somente permissão no controlador: rejeitado, pois a verificação de pertencimento ao recurso precisa ocorrer também junto da consulta/mutação que o usa.
- Liberar todos os recursos para qualquer papel do tenant: rejeitado, pois participação por projeto, evento e destinatário é requisito da feature.

## Decision 3: Não revelar a existência de recurso não acessível

**Decision**: Uma consulta ou mutação de recurso fora do tenant, sem participação exigida ou sem propriedade do destinatário retornará o resultado padronizado de acesso negado pelo contrato, sem dados do recurso. O contrato preserva o código 403 para regra de autorização conhecida e 404 apenas para recurso inexistente dentro do escopo que o usuário pode consultar.

**Rationale**: A feature pede tratamento uniforme de 403 e exige que informações de outro tenant não sejam expostas. Separar inexistência de proibição torna o comportamento do cliente previsível e reduz enumeração de dados protegidos.

**Alternatives considered**:

- Retornar sempre 404: rejeitado, pois impede o cenário comum e explícito de tratamento de 403 nos clientes.
- Retornar detalhes do recurso com campos ocultos: rejeitado, pois quebra o isolamento requisitado.

## Decision 4: Política de sessão e retry comum

**Decision**: Para 401, o cliente coordena uma única renovação de sessão para solicitações concorrentes. Após sucesso, repete uma única vez somente a requisição original `GET` ou `HEAD`; `POST`, `PATCH`, `PUT`, `DELETE` e upload retornam um resultado que pede nova intenção explícita do usuário. Para 403, não renova e não repete. Para falha transitória, oferece retry explícito em leituras; mutações nunca são reexecutadas automaticamente.

**Rationale**: Os dois clientes já possuem interceptadores de refresh, mas a política precisa ser idêntica, observável e testável. Mesmo uma mutação que pareça idempotente pode ter efeito parcial ou efeitos externos; restringir replay a leitura elimina duplicação de registros, anexos e notificações.

**Alternatives considered**:

- Redirecionar para login em qualquer 401: rejeitado, pois invalida recuperação transparente quando há refresh válido.
- Repetir toda requisição em falha de rede: rejeitado, pois pode criar ou alterar registros mais de uma vez.
- Fazer cada tela escolher a própria política: rejeitado, pois contradiz o contrato único.

## Decision 4a: Upload valida autorização antes do sistema de arquivos

**Decision**: O endpoint `POST /upload/tasks/:taskId` resolve primeiro a tarefa em escopo de tenant, a participação ativa do remetente e a permissão `tasks.edit`. Somente depois pode gravar bytes no diretório de upload e criar `Attachment`; se a persistência de `Attachment` falhar após a escrita, o arquivo recém-gravado é removido.

**Rationale**: O serviço atual grava no disco antes de confirmar a tarefa, o tenant e a pessoa que enviou. Isso deixa artefatos órfãos e pode materializar dados de um tenant em nome de outro.

**Alternatives considered**:

- Validar somente no controller: rejeitado, pois o serviço também pode ser chamado por outro fluxo.
- Criar o `Attachment` antes do arquivo: rejeitado, pois uma falha de disco deixaria um registro que aponta para conteúdo inexistente sem uma compensação explícita.

## Decision 4b: OpenAPI 1.x gerado de DTOs como contrato canônico

**Decision**: O documento OpenAPI gerado por Nest/Swagger a partir de controllers e DTOs será publicado como contrato `1.x`; um snapshot JSON versionado e fixtures versionadas serão mantidos no repositório. O README de contratos é a matriz legível e rastreável, não uma segunda fonte de verdade.

**Rationale**: O projeto já configura Swagger em `apps/api/src/main.ts`. Gerar e testar o mesmo documento reduz a chance de que Web, Expo e documentação manual discordem.

**Alternatives considered**:

- Manter apenas uma tabela Markdown: rejeitado, pois não valida request/response de modo automatizado.
- Criar schemas manualmente fora dos DTOs: rejeitado, pois duplicaria definição e tenderia a divergir.

## Decision 4c: Administrador recebe permissões, não bypass

**Decision**: `PermissionGuard` não terá retorno antecipado para `roleName === 'admin'`. Administradores precisam possuir a permissão decorada como qualquer outro ator. A visibilidade ampliada é uma exceção formal por recurso na matriz e só se aplica depois de a permissão passar, no tenant ativo.

**Rationale**: Bypass global torna uma alteração de papel/permissão ineficaz e permite que “admin” atravesse qualquer nova rota acidentalmente. Separar capacidade de visibilidade mantém a exceção auditável e limitada.

**Alternatives considered**:

- Manter bypass global para reduzir configuração de permissões: rejeitado, pois contraria o requisito de menor privilégio.
- Proibir toda visibilidade administrativa ampliada: rejeitado, pois processos operacionais existentes demandam administração dentro do tenant.

## Decision 5: Cache offline segregado, somente leitura e sem fila

**Decision**: Cada cliente persistirá apenas resultados de leitura explicitamente elegíveis, identificados por tenant, `tenantUserId`, chave da consulta e instante de atualização. Offline, o cliente mostrará somente esse resultado marcado como desatualizado; qualquer mutação será bloqueada localmente sem request e sem fila de sincronização.

**Rationale**: A estratégia entrega consulta útil sem introduzir o problema de consistência, ordem, conflito e replay seguro de mutações corporativas.

**Alternatives considered**:

- Não fornecer cache offline: rejeitado, pois não atende à consulta offline solicitada.
- Enfileirar mutações em dispositivo: rejeitado, pois exigiria semântica de conflito, cancelamento, auditoria e resolução não especificadas.
- Compartilhar cache por dispositivo: rejeitado, pois poderia expor dados de outro usuário ou tenant em aparelho compartilhado.

## Decision 6: Dia operacional de rotina em America/Sao_Paulo

**Decision**: A conversão de instante para a chave diária de rotina e o `lastUpdatedAt` exibido offline usarão `America/Sao_Paulo`. Instantes transportados pela API permanecem inequívocos; datas civis de rotina usam formato `YYYY-MM-DD` nessa zona.

**Rationale**: `toISOString()` usa UTC e pode deslocar a rotina para outro dia no Brasil. A regra unifica API, Web e Expo para relatórios e conclusão diária.

**Alternatives considered**:

- Usar UTC como dia de rotina: rejeitado, pois não representa o dia de trabalho definido pela organização.
- Deixar cada dispositivo escolher a zona: rejeitado, pois colaboradores em fusos diferentes obteriam resultados incompatíveis.

## Decision 7: Pirâmide de testes pequena e focada em regras críticas

**Decision**: Criar testes unitários sem rede real: serviços/guards da API usando Prisma simulado; o núcleo compartilhado do cliente; e adaptadores Web/Expo que traduzem resultados para estado de interface. Testes de contrato verificarão que os três consumidores reconhecem o mesmo envelope de resposta.

**Rationale**: A base atual possui teste isolado de eventos, sem runner unificado para Web e Expo. Os testes devem começar pela política de acesso e comunicação que é comum a todas as telas, antes de ampliar cobertura visual/e2e.

**Alternatives considered**:

- Cobrir somente UI via e2e: rejeitado, pois torna cenários de tenant e retry caros, lentos e difíceis de diagnosticar.
- Testar apenas a API: rejeitado, pois não demonstra igualdade do comportamento observado em Web e Expo.
