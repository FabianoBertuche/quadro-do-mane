# Assistente com Contexto Autorizado do Sistema

## Objetivo

Permitir que o assistente consulte dados relevantes de toda a instalação disponível
ao usuário autenticado, sem limitar a conversa a um projeto, mantendo isolamento por
tenant, permissões existentes e as regras atuais de confirmação/auditoria para escrita.

O assistente também deve conhecer somente a identidade necessária do usuário atual
para chamá-lo pelo nome ou tratamento correto:

- Emanuel Barsotini: `pai`.
- Alexandre Bergamasco: `Coronel`.
- Demais usuários: nome cadastrado.

E-mail não será enviado ao modelo. A futura conexão com outros bancos de dados fica
fora deste escopo e deverá usar conectores/escopos separados.

## Decisões

### Acesso sob demanda

O sistema não despeja todas as tabelas no prompt. O servidor monta um contexto curto
com a identidade do usuário e disponibiliza ferramentas de consulta. O modelo usa as
ferramentas conforme a pergunta, recebendo somente resultados autorizados e limitados.

O chat global não depende de um projeto selecionado. Quando houver contexto explícito
de projeto, ele pode priorizar esse contexto, mas nunca restringe o acesso do usuário
aos demais dados autorizados.

### Limite de segurança

Cada ferramenta recebe o ator autenticado e aplica as mesmas fronteiras do sistema:

- sempre filtra pelo tenant atual;
- respeita proprietário, membro, equipe, papel e permissões existentes;
- não aceita tenant, usuário, proprietário ou escopo fornecido pelo modelo como fonte
  de autorização;
- limita volume, campos sensíveis e tamanho do resultado;
- não retorna credenciais, tokens, hashes, segredos, dados de outros tenants ou
  informações que o ator não poderia consultar na UI/API.

O modelo nunca acessa Prisma, serviços internos ou credenciais diretamente.

### Escrita e mudanças

As ferramentas de escrita reutilizam os serviços de domínio e as autorizações já
existentes. O modelo não executa uma alteração diretamente:

1. a ferramenta valida o ator e os argumentos;
2. uma proposta de ação é persistida;
3. o usuário confirma a proposta;
4. o serviço de domínio executa a mudança com as permissões do ator;
5. auditoria e atividades seguem as regras existentes da operação.

Qualquer alteração deve ser registrada pela auditoria ou atividade correspondente. Não
serão criados caminhos paralelos que escrevam diretamente nas tabelas.

### Desambiguação antes da ação

As ferramentas de escrita devem declarar seus campos obrigatórios e referências
relacionadas. O assistente não pode escolher silenciosamente um alvo quando houver mais
de uma possibilidade ou quando faltar uma informação necessária.

Exemplos:

- ao criar uma tarefa, deve identificar o projeto quando a operação exigir projeto;
- ao alterar uma tarefa, deve confirmar qual tarefa está sendo referenciada quando o
  nome não for único;
- ao criar ou alterar uma rotina, deve confirmar a rotina e os responsáveis envolvidos;
- ao criar ou alterar um evento de calendário, deve confirmar agenda, data, horário e
  participantes quando houver ambiguidade;
- ao adicionar colaboradores, deve identificar as pessoas e validar se o ator possui a
  permissão correspondente.

Quando faltar informação ou houver ambiguidade, a ferramenta deve retornar uma resposta
estruturada de esclarecimento, sem criar proposta nem alterar dados. O assistente deve
fazer uma pergunta objetiva ao usuário. Depois que a resposta tornar o alvo inequívoco,
a operação segue pelo fluxo normal de proposta, confirmação, execução autorizada e
auditoria/atividade.

### Identidade e tratamento

O servidor resolve o usuário autenticado antes da chamada ao provider e injeta apenas
um contexto de identidade mínimo, sem e-mail. O tratamento especial deve ser baseado
na identidade canônica do usuário, preferencialmente seu ID persistente, evitando que
uma alteração de nome faça uma conta herdar o tratamento de outra. A configuração
inicial associará Emanuel Barsotini a `pai`; Alexandre Bergamasco receberá `Coronel`
quando sua conta for criada e associada.

Se não houver correspondência especial, o modelo deve usar o nome cadastrado. O
tratamento é uma instrução de apresentação, não uma autorização nem uma forma de
elevar privilégios.

## Ferramentas iniciais

O registry deve evoluir de ferramentas focadas em tarefas para consultas autorizadas
dos domínios existentes do Monte Moria, começando por:

- usuário atual e seu contexto de tenant, sem e-mail;
- projetos visíveis;
- tarefas visíveis, filtros, responsáveis, status e prazos;
- equipes e membros visíveis;
- calendário e demais módulos existentes somente após reutilizar suas regras de acesso.

As ferramentas devem retornar resumos limitados e paginação/limites, nunca snapshots
ilimitados do banco. Consultas sem resultado devem retornar uma resposta explícita,
sem inferência ou preenchimento inventado.

## Fluxo de dados

1. `AiService.sendMessage` valida a conversa e o ator atual.
2. Um builder de identidade gera nome/tratamento sem e-mail.
3. O contexto inicial inclui identidade e política de acesso, sem dados não solicitados.
4. O provider decide se precisa chamar uma ferramenta.
5. A ferramenta recebe o ator do request, consulta o domínio autorizado e devolve um
   resultado redigido e limitado.
6. A resposta e propostas seguem a persistência atômica existente.
7. Escritas permanecem propostas até confirmação; a execução gera auditoria/atividade
   através do serviço de domínio.

## Não objetivos

- Não conceder acesso administrativo ao modelo.
- Não remover confirmação de ações destrutivas ou mutações.
- Não expor e-mail por padrão.
- Não permitir consulta entre tenants.
- Não conectar bancos externos nesta etapa.
- Não criar uma segunda implementação de autorização por ferramenta.

## Testes de aceitação

- O modelo recebe o nome/tratamento do usuário atual sem e-mail.
- Emanuel é tratado como `pai` somente quando a identidade autenticada corresponde à
  conta de Emanuel.
- Alexandre é tratado como `Coronel` após sua conta ser criada e associada.
- Um usuário consegue consultar dados de qualquer projeto autorizado, mesmo em chat
  sem projeto selecionado.
- Consultas entre tenants, projetos sem acesso e campos sensíveis são rejeitados ou
  redigidos.
- Uma escrita sem permissão não cria proposta nem altera dados.
- Uma escrita autorizada exige confirmação, altera via serviço de domínio e gera o
  registro de auditoria/atividade existente.
- Uma criação com projeto, tarefa, rotina, calendário ou colaboradores pergunta antes
  quando o alvo ou os participantes não estiverem inequívocos; não escolhe por conta
  própria.
- Falhas de ferramenta/provider não persistem mensagens parciais nem propostas
  inválidas.
