# Design: Configuração admin de provedores de IA com failover e suporte a Ollama Cloud

Data: 2026-10-01
Status: aprovado (partes 1 e 2)

## Resumo

Hoje o chat de IA usa o ChatGPT por OAuth com seleção de modelo global embutida na
tela do chat (`ai.use`). Este design move **toda** a configuração de provedor e
modelo para a tela administrativa (admin apenas), adiciona um segundo provedor —
**Ollama Cloud** — e permite definir um **provedor primário com failover** para o
substituto caso o primário falhe (ex.: `subscription_sharing_usage_limit_exceeded`).

## Objetivos

- Migration da configuração de modelo/conexão do chat para `settings` (admin).
- Novo provedor Ollama Cloud (URL fixa `https://ollama.com/v1`, key por Bearer,
  catálogo fixo de 6 modelos de nuvem).
- Provider primário + provider substituto configuráveis; falha do primário dispara
  tentativa automática no substituto antes de retornar erro ao usuário.
- Manter a segurança atual: credenciais nunca saem da API; acesso restrito ao
  tenant; modelo continua sem acesso a credenciais.

## Fora de escopo

- STT/TTS (áudio) continuam no provedor OpenAI existente; não trocam de provider.
- Suporte a Ollama local / base URL customizável — apenas Ollama Cloud fixo.
- Catálogo dinâmico Ollama via `/v1/models` — lista fixa aprovada.
- Alterações no fluxo de autorização lida de dados do assistente.

## Modelo de dados (`prisma`)

Colunas novas/alteradas em `AiServerRuntime` (tabela `ai_server_runtime`):

| Coluna | Tipo | Observações |
| --- | --- | --- |
| `primaryProvider` | String @default("chatgpt") | `'chatgpt' \| 'ollama'` |
| `failoverProvider` | String? | null = sem failover; default null |
| `chatgptModelSlug` | String? | migração: copiar `selectedModelSlug` |
| `chatgptModelDisplayName` | String? | migração: copiar `selectedModelDisplayName` |
| `ollamaModelSlug` | String? | |
| `ollamaModelDisplayName` | String? | |
| `ollamaApiKeyCiphertext` | String? | AES-256-GCM via `EncryptionService` |
| `ollamaApiKeyIv` | String? | |
| `ollamaApiKeyAuthTag` | String? | |

- `selectedModelSlug`/`selectedModelDisplayName` são removidos; a migration copia
  seus valores para as colunas `chatgpt*` (comportamento atual = `primaryProvider`
  `'chatgpt'`, `failoverProvider` null).
- O estado existente de OAuth (`AiOAuthConnection`) não muda.

## Catálogo Ollama (fixo)

Constant exportada (slug → displayName):

- `gemma4:31b`
- `gpt-oss:120b`
- `gpt-oss:20b`
- `nemotron-3-nano:30b`
- `nemotron-3-super`
- `nemotron-3-ultra`

## Arquitetura backend

### Providers

- `OpenAiResponsesProvider` (existente) → ChatGPT via OAuth. Permanece.
- `OllamaCompletionsProvider` (novo) → implementa `AiProvider` (`complete` +
  `buildToolContinuation`), espelhando `OpenAiProvider` (chat completions):
  - SDK OpenAI com `{ baseURL: 'https://ollama.com/v1', apiKey, timeout }`.
  - `apiKey` fornecida por injeção (key criptografada decifrada pelo roteador).
  - Usa `input.model` (o modelo selecionado do Ollama); fallback não usa modelo de
    config (não há modelo Ollama default por env).
  - Sanitização de erro idêntica aos providers atuais ("AI provider ...").

### Roteamento e failover

- Novo `AiProviderRoutingService` (no módulo AI):
  - Lê `ai_server_runtime` (primary, failover, keys, modelos por provider).
  - Expõe `resolveExecutions(): Promise<AiProviderExecution[]>` retornando a lista
    **ordenada e utilizável**: primário primeiro; depois substituto; pula provider
    não configurado (ChatGPT sem OAuth; Ollama sem key).
  - `AiProviderExecution = { provider: 'chatgpt' | 'ollama'; instance: AiProvider; auth?: AiProviderAuth }`.
- `AiService.sendMessage` passa a rodar o fluxo **por execução**:
  - Para cada execução em ordem: executa o loop completo (complete → ferramentas →
    continuação) com esse provider pinado.
  - Se a execução falhar por **erro de provider** (transport, usage/rate limit,
    autenticação, resposta incompleta), registra auditoria `provider.failed` e
    tenta a próxima execução a partir do input original.
  - Erros de negócio (BadRequest/Forbidden de ferramentas, clarificação) **não**
    acionam failover — propagam imediatamente.
  - Se todas falharem, sobe o último erro (real, preservado).
  - Sucesso: auditoria `message.completed` ganha `provider` usado.
- A decisão de "provider configurado" pertence ao routing service; o fluxo reinicia
  do `completionInput` original (leituras de ferramentas são idempotentes).

### Runtime service e controller

- `AiServerRuntimeService` (novos métodos):
  - `getRuntime()` → visão de config: `{ primaryProvider, failoverProvider,
    providers: { chatgpt: { connectionStatus, selectedModel, models },
    ollama: { connectionStatus, selectedModel, models } } }`.
  - `setPrimaryProvider`, `setFailoverProvider`, `selectModel(provider, slug)`
    (valida contra o catálogo do provider), `saveOllamaKey(apiKey)`,
    `removeOllamaKey()`. Auditoria para cada mutação (key nunca no metadata).
  - Catálogos: ChatGPT via `fetchOpenAiModels` (OAuth); Ollama = lista fixa.
  - `connectionStatus` do chatgpt = tem conexão OAuth ativa; do ollama = key salva.
- `selectModel(provider, slug)` valida slug no catálogo do provider selecionado;
  persiste no par de colunas do provider.

## API HTTP

| Método | Rota | Permissão | Ação |
| --- | --- | --- | --- |
| GET | `/ai/runtime` | `settings.edit` | visão de config (acima) |
| POST | `/ai/runtime/primary` | `settings.edit` | define `primaryProvider` |
| POST | `/ai/runtime/failover` | `settings.edit` | define `failoverProvider` (ou null) |
| POST | `/ai/runtime/model` | `settings.edit` | `{ provider, slug }` seleciona modelo |
| PUT | `/settings/ai/ollama/key` | `settings.edit` | salva key (criptografada) |
| DELETE | `/settings/ai/ollama/key` | `settings.edit` | remove key |
| * | `/ai/oauth/*` | `settings.edit` | fluxo OAuth ChatGPT (sem mudança) |

- `AiServerRuntimeController` e `AiOAuthController` passam de `ai.use` para
  `settings.edit`; comentários desatualizados são corrigidos.
- Nenhum campo de credencial (key/token) sai da API.

## Frontend

- `apps/web/src/app/(app)/ai-chat/page.tsx`: remover toda a seção "Runtime global"
  e o `AiOAuthConnectionCard`; remover `useQuery`/`useMutation`/imports de runtime e
  oauth. O chat passa a exibir somente a conversa.
- `apps/web/src/app/(app)/settings/ai-providers/page.tsx` + componente
  `AiProviderSettings` (reconstruído):
  - **Provedor principal**: seleção ChatGPT | Ollama Cloud.
  - **Provedor substituto**: nenhum | o outro (visível apenas se tiver 2 providers
    utilizáveis, mas exibido sempre como config).
  - **Card ChatGPT**: `AiOAuthConnectionCard` (movido para cá) + combobox de modelo
    (`AiModelCombobox`) com catálogo ao vivo.
  - **Card Ollama**: campo de API key (oculto, salvar/remover) + combobox de modelo
    com a lista fixa dos 6.
  - Estados de carregamento/erro seguindo o padrão atual dos cartões.
- `lib/ai-runtime.ts`: union `'chatgpt' | 'ollama'`, novo shape de `getAiRuntime`,
  novas funções `setPrimaryProvider`, `setFailoverProvider`, `selectProviderModel`.
- `lib/ai-oauth.ts`: reutilizado como está.

## Segurança

- Key do Ollama: criptografada com AES-256-GCM (`EncryptionService`); nunca
  retornada pela API; escrita/remoção com auditoria.
- Config de provider restrita a `settings.edit` (admin); chat segue com `ai.use`
  para as mensagens, sem config.
- Erros de provider permanecem sanitizados; o routing registra origem em auditoria
  sem expor credenciais.

## Testes (TDD)

- `OllamaCompletionsProvider` (novo spec): mensagens/tools enviadas ao SDK, modelo
  vindo de `input.model`, `buildToolContinuation`, sanitização de erro.
- `AiProviderRoutingService` (novo spec): ordenação primary→failover, pulo de
  provider não configurado, decifração da key.
- `AiService` failover (spec estendido): falha do primário → fluxo reexecutado no
  substituto; erro de negócio não aciona failover; todas falham → último erro.
- `AiServerRuntimeService`/controller: novo shape do GET, set primary/failover,
  select por provider, key save/remove (sem vazamento), catálogo Ollama fixo,
  `connectionStatus` por provider.
- `ai.module.spec`: wiring do routing + novo provider.
- `settings` `ai-provider-settings.controller.spec`: endpoints key.
- e2e runtime/oauth atualizados: shape com providers, permissão `settings.edit`.
- Web: `ai-runtime.spec.ts` (novo shape + funções), `ai-chat.test.ts`
  (sem regressão no merge de cache; chat não referencia mais runtime).
- `tsc --noEmit` em api e web; suíte focada AI + construção docker.

## Riscos e mitigação

- **Custo duplo no failover**: o primário pode consumir tokens antes de falhar.
  Aceito e explícito; failover só em erro de provider.
- **Formato de mensagem por provider**: mitigado pelo failover em nível de fluxo
  (provider pinado por execução, reinício a partir do input original).
- **Regressão de testes ampla (rename de coluna)**: migration copia dados e specs
  são atualizados em conjunto.