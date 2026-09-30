# Assistente IA Global com Chat e Voz

## Objetivo

Adicionar um assistente global ao aplicativo, inicialmente no Android, capaz de responder perguntas sobre os dados permitidos do tenant e propor comandos operacionais sobre tarefas. O assistente deve aceitar texto e voz, responder em texto ou voz e permitir a troca futura do provedor de modelo sem reescrever o domínio da aplicação.

O chat aberto pelo detalhe de um projeto continuará levando o contexto inicial desse projeto, mas a conversa será global e poderá consultar as demais entidades permitidas do tenant.

## Decisões

- O primeiro provider será OpenAI.
- O backend será o único componente autorizado a chamar providers e armazenará as chaves em configuração segura.
- Comandos que alteram dados sempre exigirão confirmação explícita do usuário.
- Entrada de voz usará gesto estilo WhatsApp: pressionar e segurar grava; soltar envia; arrastar para cima bloqueia a gravação até enviar ou cancelar.
- O usuário escolherá a forma da resposta entre texto e voz.
- O MVP será mobile-first; os endpoints serão agnósticos ao cliente para permitir web depois.
- O MVP consultará dados estruturados do próprio app e executará somente ferramentas de tarefas.
- Conectores de bases externas, exclusões e alterações em massa ficam para uma etapa posterior.

## Arquitetura

### API

Criar um `AiModule` protegido por JWT, tenant e uma permissão `ai.use`. O módulo será composto por:

- `AiOrchestratorService`: coordena conversa, contexto, provider, ferramentas e resposta.
- `AiProvider`: contrato para chat/tool calls; o adapter inicial será `OpenAiProvider`.
- `SpeechToTextProvider`: contrato para transcrição; implementação inicial via OpenAI.
- `TextToSpeechProvider`: contrato para síntese; implementação inicial via OpenAI.
- `AiContextService`: busca dados estruturados respeitando tenant, permissões e escopo opcional do projeto.
- `AiToolRegistry`: expõe ferramentas tipadas ao modelo e encaminha cada execução ao service de domínio existente.
- `AiKnowledgeSource`: contrato futuro para banco externo, documentos, APIs e RAG.
- `AiAuditService`: registra perguntas, propostas, confirmações, resultados e falhas sem registrar tokens ou segredos.

O provider recebe uma porta estável e configuração por ambiente. Trocar OpenAI por outro provider deverá exigir apenas um novo adapter e configuração, não alterações nas telas ou nas regras de negócio.

### Persistência

Adicionar entidades equivalentes a:

- `AiConversation`: tenant, usuário, título, contexto inicial opcional, timestamps e estado.
- `AiMessage`: conversa, autor, formato (`TEXT` ou `AUDIO`), texto/transcrição, referência temporária de áudio e metadados não sensíveis do provider.
- `AiActionProposal`: ferramenta, argumentos validados, status (`PENDING`, `CONFIRMED`, `CANCELLED`, `EXECUTED`, `FAILED`), expiração e auditoria.

Arquivos de áudio não serão armazenados permanentemente no MVP; serão processados por upload temporário e removidos após transcrição ou síntese. O desenho deve permitir armazenamento futuro com política de retenção definida.

## Fluxos

### Pergunta

1. O cliente abre ou cria uma conversa global, opcionalmente com `contextProjectId`.
2. O cliente envia texto ou áudio e a preferência de resposta (`TEXT` ou `AUDIO`).
3. O API autentica usuário e tenant, transcreve áudio quando necessário e grava a mensagem.
4. O contexto consulta apenas dados permitidos e limita tamanho/relevância antes de chamar o provider.
5. O provider responde texto ou uma chamada de ferramenta.
6. O API persiste a resposta e, se solicitado, gera áudio temporário.
7. O cliente exibe texto, reproduz áudio ou ambos conforme o modo escolhido.

### Comando

1. O provider solicita uma ferramenta, por exemplo `create_task`.
2. O API valida argumentos com DTO/schema, resolve nomes para IDs e verifica permissões e vínculos ao tenant.
3. O API grava uma `AiActionProposal` e devolve ao cliente um resumo legível da ação.
4. O usuário confirma ou cancela.
5. O endpoint de confirmação revalida autorização e dados atuais, executa o service de domínio existente e grava o resultado.
6. A conversa recebe uma mensagem de resultado e o cliente invalida consultas de tarefas relacionadas.

Nunca executar uma ação apenas porque o modelo a sugeriu. Propostas expiram e são vinculadas ao usuário, tenant e conversa de origem.

## Ferramentas do MVP

- `search_tasks`: buscar tarefas por texto, projeto, status, responsável e prazo.
- `create_task`: criar tarefa com título, descrição, projeto, responsável, status, prioridade e datas.
- `update_task`: alterar título, descrição, responsável, status, prioridade e datas.
- `move_task`: alterar status/posição usando o service já protegido.

As ferramentas não acessam Prisma diretamente. Elas chamam services existentes, preservando notificações, activity log, validações e permissões.

## Clientes

O chat global será uma rota própria no mobile. O ícone existente no projeto abrirá essa rota com o projeto como contexto inicial; uma entrada global será adicionada à navegação principal.

O composer terá:

- campo de texto;
- botão de microfone com gesto de pressionar/soltar e bloqueio ao arrastar para cima;
- seletor de resposta `Texto` ou `Voz`;
- estado de gravação, cancelamento, transcrição, processamento e erro;
- cartões de confirmação para propostas de ferramenta;
- histórico paginado da conversa.

O web poderá consumir os mesmos endpoints posteriormente, sem duplicar orquestração, permissões ou execução de comandos.

## Segurança e privacidade

- Todas as rotas exigem JWT, tenant e `ai.use`; cada ferramenta aplica sua permissão de domínio novamente.
- Contexto, mensagens e propostas são sempre filtrados pelo tenant e usuário autorizados.
- Tokens de provider, credenciais de conectores e conteúdo sensível não entram em logs.
- O modelo não recebe SQL, credenciais ou dados de tenants diferentes.
- Respostas deixam explícito quando não há dados suficientes ou quando o usuário não tem acesso.
- Ações confirmadas entram no activity/audit log existente e no log específico da IA.
- Limites de tamanho, duração, taxa e custo serão aplicados por tenant/usuário antes da integração de produção.

## Fora do MVP

- Streaming de tokens e áudio em tempo real.
- Wake word ou escuta contínua.
- Exclusão de tarefas, projetos ou usuários pela IA.
- Alterações em massa sem confirmação individual ou fluxo específico.
- Bases externas, documentos e RAG; apenas o contrato de `AiKnowledgeSource` será preparado.
- Escolha de provider pelo usuário final.

## Testes e verificação

- Testes unitários dos adapters, normalização de tool calls, validação de argumentos e expiração de propostas.
- Testes de serviço para isolamento por tenant, permissões e revalidação na confirmação.
- Testes de controller para texto, áudio, resposta em voz e cancelamento.
- Testes mobile para estados do gesto de gravação, seletor de saída e confirmação de comandos.
- Teste de integração com provider usando adapter fake; chamadas reais ficam fora da suíte padrão.
- Typecheck, build API e testes mobile/web devem passar antes da entrega.

## Entrega Web em Etapas

### Etapa 1: texto e comandos

Antes de migrar a validação funcional para o Android, o mesmo contrato de API será disponibilizado no web autenticado. A rota `/ai-chat` terá histórico de conversas, entrada de texto, propostas de ação com confirmação/cancelamento, mensagens de esclarecimento e contexto opcional de projeto. O sidebar terá uma entrada global para o assistente e o detalhe de projeto poderá abrir o chat com `contextProjectId`.

O cliente web usará o Axios autenticado existente e não terá dependência do SDK ou credenciais do provider. Conversas globais não poderão selecionar automaticamente uma conversa vinculada a projeto; o contexto de projeto só será aplicado quando explicitamente informado pela navegação.

Nesta etapa também serão corrigidos os bloqueios residuais identificados na revisão: o estado visual de `needsClarification`, a seleção de conversa global e a validação estrita de `inputFormat` no API.

### Etapa 2: voz no web

Após validar perguntas e comandos por texto no web, uma etapa separada adicionará `MediaRecorder`, envio multipart e reprodução de respostas de voz no navegador. Ela reutilizará os endpoints de áudio existentes, sem alterar a abstração de provider ou a execução de ferramentas.
