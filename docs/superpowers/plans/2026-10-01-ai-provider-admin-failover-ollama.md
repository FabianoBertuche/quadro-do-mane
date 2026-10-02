# AI Provider Admin Config, Failover, and Ollama Cloud — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all AI model/provider configuration from the chat into the admin settings screen, add Ollama Cloud as a second provider with a fixed model catalog, and route chat traffic through a primary provider with automatic failover.

**Architecture:** A new `ai_server_runtime` row stores the primary provider, an optional failover provider, per-provider selected models, and an encrypted Ollama API key. A new `AiProviderRoutingService` resolves the ordered list of usable executions (primary → failover, skipping unconfigured providers). `AiService` pins one provider per flow; on a provider error it replays the flow against the failover execution, but never on business errors (tool BadRequest/Forbidden). The admin settings screen (`/settings/ai-providers` path is unchanged) hosts OAuth, provider/model selection, and the Ollama key via `/ai/runtime` + `/settings/ai/ollama/key`, both guarded by `settings.edit`. The chat page drops all runtime UI.

**Tech Stack:** NestJS, Prisma/PostgreSQL, node:test, OpenAI SDK (for the Ollama v1-compatible endpoint), Next.js, React Query, `openai` npm package with `baseURL='https://ollama.com/v1'`.

**Spec:** `docs/superpowers/specs/2026-10-01-ai-provider-admin-failover-ollama-design.md`

## Global Constraints

- `settings.edit` is the only guard for runtime/OAuth/key endpoints (admin-only today; do not introduce new permission codes). `ai.use` stays on the message/audio controllers.
- Never return credential fields in any HTTP response: no Ollama key, no OAuth access token, no `oauthConnectionId`. Allow-list every response shape in controllers; specs assert absence by JSON-serializing.
- Ollama base URL is fixed at `https://ollama.com/v1`; model catalog is the fixed 6-model list from the spec (no `/v1/models` fetch, no local Ollama).
- Failover eligibility: only `AiProviderError` and `Error` whose message starts with `AI provider` or `AI response`. Anything else (Nest exceptions, tool errors) propagates immediately — never triggers failover.
- Business output of tool reads may be replayed after failover; tool *actions* are never executed during the provider loop (only proposals), so a restart from the original input is safe.
- AES-256-GCM via the existing `EncryptionService` (`encrypt` → `{ ciphertext, iv, authTag }`, key decrypt needs matching triple). Store the three hex fields on the runtime row.
- The repo working tree already has many uncommitted AI files from prior work (see `git status`). Do NOT `git reset`, `git stash`, or `git checkout .`. In commit steps, stage only the files listed in the task.

---

### Task 1: Ollama Cloud model catalog and completions provider

**Files:**
- Create: `apps/api/src/modules/ai/providers/ollama-models.ts`
- Create: `apps/api/src/modules/ai/providers/ollama-completions.provider.ts`
- Test: `apps/api/src/modules/ai/providers/ollama-completions.provider.spec.ts`

**Interfaces:**
- Consumes: `AiProvider`, `AiCompletionInput`, `AiCompletionResult`, `AiToolCall`, `AiToolResultForCall`, `AiProviderError` from `./../ports/ai-provider.port`; `AiServerModel` from `./../ai-server-runtime.service` (runtime service file exports it — avoid a circular import problem by defining the `AiServerModel` shape locally in `ollama-models.ts` instead and importing `AiServerModel` there).
- Produces: `export const OLLAMA_BASE_URL = 'https://ollama.com/v1'`; `export const OLLAMA_CLOUD_MODELS: readonly AiServerModel[]`; `export class OllamaCompletionsProvider implements AiProvider` with constructor `(apiKey: string, clientFactory?: (apiKey: string, timeout: number) => { chat: { completions: { create(input: any): Promise<any> } } })`, `complete(input, auth?)`, `buildToolContinuation(input, completion, results)`. Implement `complete` exactly like `OpenAiProvider.complete` but pass `model: input.model?.trim()`, build the client with `new OpenAI({ apiKey, baseURL: OLLAMA_BASE_URL, timeout })` in the default factory, and reuse `getAiRequestTimeout` from `openai.provider` for the timeout.

- [ ] **Step 1: Write the failing test**

`apps/api/src/modules/ai/providers/ollama-completions.provider.spec.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { OllamaCompletionsProvider, OLLAMA_BASE_URL } from './ollama-completions.provider';
import { OLLAMA_CLOUD_MODELS } from './ollama-models';

test('catalog exports the fixed 6 cloud models in spec order', () => {
  assert.deepEqual(OLLAMA_CLOUD_MODELS.map((model) => model.slug), [
    'gemma4:31b', 'gpt-oss:120b', 'gpt-oss:20b', 'nemotron-3-nano:30b', 'nemotron-3-super', 'nemotron-3-ultra',
  ]);
  assert.equal(OLLAMA_BASE_URL, 'https://ollama.com/v1');
});

test('builds a chat-completions request with the input model, tools, and message roles', async () => {
  let body: any;
  const client = { chat: { completions: { create: async (input: any) => {
    body = input;
    return { choices: [{ message: { content: 'ok', tool_calls: [] } }] };
  } } } };
  const provider = new OllamaCompletionsProvider('sk-ollama', () => client as any);

  const result = await provider.complete({
    model: 'gpt-oss:20b',
    messages: [
      { role: 'system', content: 'you are helpful' },
      { role: 'user', content: 'hi' },
    ],
    tools: [{ name: 'search', description: 'searches', parameters: { type: 'object' } }],
  });

  assert.equal(body.model, 'gpt-oss:20b');
  assert.deepEqual(body.messages, [
    { role: 'system', content: 'you are helpful' },
    { role: 'user', content: 'hi' },
  ]);
  assert.deepEqual(body.tools, [{ type: 'function', function: { name: 'search', description: 'searches', parameters: { type: 'object' } } }]);
  assert.deepEqual(result, { text: 'ok', toolCalls: [] });
});

test('parses tool calls and builds the chat-completions continuation', async () => {
  const client = { chat: { completions: { create: async () => ({ choices: [{ message: {
    content: '', tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'search', arguments: '{"q":"x"}' } }],
  } }] }) } } };
  const provider = new OllamaCompletionsProvider('sk-ollama', () => client as any);

  const completion = await provider.complete({ messages: [{ role: 'user', content: 'hi' }] });
  assert.deepEqual(completion.toolCalls, [{ id: 'call-1', name: 'search', arguments: { q: 'x' } }]);

  const continuation = provider.buildToolContinuation!({ messages: [{ role: 'user', content: 'hi' }] }, completion, [
    { call: completion.toolCalls[0], result: { count: 1 } },
  ]);
  assert.deepEqual(continuation.messages, [
    { role: 'user', content: 'hi' },
    { role: 'assistant', content: null, toolCalls: completion.toolCalls },
    { role: 'tool', toolCallId: 'call-1', content: JSON.stringify({ count: 1 }) },
  ]);
});

test('surfaces only the safe message when the provider request fails', async () => {
  const client = { chat: { completions: { create: async () => { throw new Error('upstream exploded'); } } } };
  const provider = new OllamaCompletionsProvider('sk-ollama', () => client as any);
  await assert.rejects(
    () => provider.complete({ messages: [{ role: 'user', content: 'hi' }] }),
    /AI provider request failed/,
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `apps/api`): `node -r ts-node/register --test src/modules/ai/providers/ollama-completions.provider.spec.ts`
Expected: FAIL with `Cannot find module './ollama-completions.provider'`.

- [ ] **Step 3: Create `ollama-models.ts`**

```ts
import type { AiServerModel } from '../ai-server-runtime.service';

export const OLLAMA_CLOUD_MODELS: readonly AiServerModel[] = Object.freeze([
  Object.freeze({ slug: 'gemma4:31b', displayName: 'Gemma 4 31B' }),
  Object.freeze({ slug: 'gpt-oss:120b', displayName: 'GPT-OSS 120B' }),
  Object.freeze({ slug: 'gpt-oss:20b', displayName: 'GPT-OSS 20B' }),
  Object.freeze({ slug: 'nemotron-3-nano:30b', displayName: 'Nemotron 3 Nano 30B' }),
  Object.freeze({ slug: 'nemotron-3-super', displayName: 'Nemotron 3 Super' }),
  Object.freeze({ slug: 'nemotron-3-ultra', displayName: 'Nemotron 3 Ultra' }),
]);
```

- [ ] **Step 4: Create `ollama-completions.provider.ts`**

```ts
import OpenAI from 'openai';
import {
  AiCompletionInput,
  AiCompletionResult,
  AiProvider,
  AiToolCall,
  AiToolResultForCall,
} from '../ports/ai-provider.port';
import { getAiRequestTimeout } from './openai.provider';

export const OLLAMA_BASE_URL = 'https://ollama.com/v1';

type OllamaClient = { chat: { completions: { create(input: any): Promise<any> } } };
export type OllamaClientFactory = (apiKey: string, timeout: number) => OllamaClient;

const defaultClientFactory: OllamaClientFactory = (apiKey, timeout) =>
  new OpenAI({ apiKey, baseURL: OLLAMA_BASE_URL, timeout }) as unknown as OllamaClient;

export class OllamaCompletionsProvider implements AiProvider {
  private readonly client: OllamaClient;

  constructor(apiKey: string, clientFactory: OllamaClientFactory = defaultClientFactory) {
    if (!apiKey) throw new Error('AI provider is not configured');
    this.client = clientFactory(apiKey, getAiRequestTimeout({ get: () => undefined } as any));
  }

  async complete(input: AiCompletionInput): Promise<AiCompletionResult> {
    try {
      const response = await this.client.chat.completions.create({
        model: input.model?.trim(),
        messages: input.messages.map((message: any) => {
          if (message.role === 'assistant' && message.toolCalls) {
            return {
              role: 'assistant',
              content: message.content,
              tool_calls: message.toolCalls.map((call: AiToolCall) => ({
                id: this.requireCallId(call),
                type: 'function',
                function: { name: call.name, arguments: JSON.stringify(call.arguments) },
              })),
            };
          }
          if (message.role === 'tool') return { role: 'tool', tool_call_id: message.toolCallId, content: message.content };
          return message;
        }) as any,
        tools: input.tools?.map((tool) => ({
          type: 'function' as const,
          function: { name: tool.name, description: tool.description, parameters: tool.parameters },
        })),
      });
      const message = response.choices[0]?.message;
      const toolCalls: AiToolCall[] = (message?.tool_calls ?? []).map((call: any) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(call.function.arguments);
        } catch {
          throw new Error('AI provider returned invalid tool arguments');
        }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('AI provider returned invalid tool arguments');
        }
        return { ...(call.id ? { id: call.id } : {}), name: call.function.name, arguments: parsed as Record<string, unknown> };
      });
      return { text: message?.content ?? '', toolCalls };
    } catch (error) {
      if (error instanceof Error && error.message === 'AI provider returned invalid tool arguments') throw error;
      throw new Error('AI provider request failed');
    }
  }

  buildToolContinuation(input: AiCompletionInput, completion: AiCompletionResult, results: AiToolResultForCall[]): AiCompletionInput {
    return {
      ...input,
      messages: [
        ...input.messages,
        { role: 'assistant', content: completion.text || null, toolCalls: completion.toolCalls },
        ...results.map(({ call, result }) => ({
          role: 'tool' as const,
          toolCallId: this.requireCallId(call),
          content: this.serializeToolResult(result),
        })),
      ],
    };
  }

  private requireCallId(call: AiToolCall): string {
    if (!call.id) throw new Error('AI provider returned a tool call without an id');
    return call.id;
  }

  private serializeToolResult(result: unknown): string {
    return typeof result === 'string' ? result : JSON.stringify(result ?? null);
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run (from `apps/api`): `node -r ts-node/register --test src/modules/ai/providers/ollama-completions.provider.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/ai/providers/ollama-models.ts apps/api/src/modules/ai/providers/ollama-completions.provider.ts apps/api/src/modules/ai/providers/ollama-completions.provider.spec.ts
git commit -m "feat(ai): add fixed Ollama Cloud catalog and completions provider"
```

---

### Task 2: `ai_server_runtime` schema columns and migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (model `AiServerRuntime`, lines 1089-1099)
- Create: `apps/api/prisma/migrations/<timestamp>_ai_provider_config/migration.sql` (name it via `prisma migrate dev --name ai_provider_config`)
- Test: `apps/api/src/modules/ai/ai-server-runtime-persistence.spec.ts`

**Interfaces:**
- Consumes: current schema `selectedModelSlug`/`selectedModelDisplayName` fields.
- Produces: schema fields `primaryProvider` (String, default `'chatgpt'`, map `primary_provider`), `failoverProvider` (String?, map `failover_provider`), `chatgptModelSlug`/`chatgptModelDisplayName`, `ollamaModelSlug`/`ollamaModelDisplayName`, `ollamaApiKeyCiphertext`/`ollamaApiKeyIv`/`ollamaApiKeyAuthTag`. Legacy `selectedModel*` are removed and their values copied to `chatgptModel*`.

- [ ] **Step 1: Write the failing test**

Extend `apps/api/src/modules/ai/ai-server-runtime-persistence.spec.ts` — keep the `runtimeMigration()` helper untouched (it targets `*_add_ai_server_runtime` for the legacy singleton test), add a `providerConfigMigration()` helper that targets the new `*_ai_provider_config` directory, replace the `selectedModelSlug`/`selectedModelDisplayName` field assertions on lines 39-40, and add:

```ts
function providerConfigMigration(): string {
  const migrationName = readdirSync(migrationDirectory).find((entry) =>
    entry.endsWith('_ai_provider_config'),
  );
  assert.ok(migrationName, 'missing AI provider config migration');
  return readFileSync(join(migrationDirectory, migrationName, 'migration.sql'), 'utf8');
}

test('defines one global AI runtime with provider config and per-provider model metadata', () => {
  const runtime = modelBlock('AiServerRuntime');
  assert.equal(modelLine(runtime, 'id'), 'id                       String   @id @default("global")');
  assert.equal(modelLine(runtime, 'oauthConnectionId'), 'oauthConnectionId        String?  @unique @map("oauth_connection_id")');
  assert.equal(modelLine(runtime, 'primaryProvider'), 'primaryProvider          String   @default("chatgpt") @map("primary_provider")');
  assert.equal(modelLine(runtime, 'failoverProvider'), 'failoverProvider         String?  @map("failover_provider")');
  assert.equal(modelLine(runtime, 'chatgptModelSlug'), 'chatgptModelSlug         String?  @map("chatgpt_model_slug")');
  assert.equal(modelLine(runtime, 'chatgptModelDisplayName'), 'chatgptModelDisplayName  String?  @map("chatgpt_model_display_name")');
  assert.equal(modelLine(runtime, 'ollamaModelSlug'), 'ollamaModelSlug          String?  @map("ollama_model_slug")');
  assert.equal(modelLine(runtime, 'ollamaModelDisplayName'), 'ollamaModelDisplayName   String?  @map("ollama_model_display_name")');
  assert.equal(modelLine(runtime, 'ollamaApiKeyCiphertext'), 'ollamaApiKeyCiphertext  String?  @map("ollama_api_key_ciphertext")');
  assert.equal(modelLine(runtime, 'ollamaApiKeyIv'), 'ollamaApiKeyIv         String?  @map("ollama_api_key_iv")');
  assert.equal(modelLine(runtime, 'ollamaApiKeyAuthTag'), 'ollamaApiKeyAuthTag    String?  @map("ollama_api_key_auth_tag")');
});

test('migration copies legacy selected model into the chatgpt columns and drops the old ones', () => {
  const migration = providerConfigMigration();
  assert.match(migration, /ADD COLUMN "primary_provider" TEXT NOT NULL DEFAULT 'chatgpt'/);
  assert.match(migration, /ADD COLUMN "failover_provider" TEXT/);
  assert.match(migration, /ADD COLUMN "chatgpt_model_slug" TEXT/);
  assert.match(migration, /ADD COLUMN "ollama_api_key_ciphertext" TEXT/);
  assert.match(migration, /UPDATE "ai_server_runtime" SET "chatgpt_model_slug" = "selected_model_slug"/);
  assert.match(migration, /DROP COLUMN "selected_model_slug"/);
  assert.match(migration, /DROP COLUMN "selected_model_display_name"/);
  assert.doesNotMatch(migration, /CREATE TABLE "ai_server_runtime"/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `apps/api`): `node -r ts-node/register --test src/modules/ai/ai-server-runtime-persistence.spec.ts`
Expected: FAIL (assertions on the missing fields / legacy fields still present).

- [ ] **Step 3: Edit the schema and generate the migration**

Edit `apps/api/prisma/schema.prisma` model `AiServerRuntime` to the block below, then run:

```bash
npx prisma migrate dev --name ai_provider_config
```

```prisma
model AiServerRuntime {
  id                       String   @id @default("global")
  oauthConnectionId        String?  @unique @map("oauth_connection_id")
  primaryProvider          String   @default("chatgpt") @map("primary_provider")
  failoverProvider         String?  @map("failover_provider")
  chatgptModelSlug         String?  @map("chatgpt_model_slug")
  chatgptModelDisplayName  String?  @map("chatgpt_model_display_name")
  ollamaModelSlug          String?  @map("ollama_model_slug")
  ollamaModelDisplayName   String?  @map("ollama_model_display_name")
  ollamaApiKeyCiphertext   String?  @map("ollama_api_key_ciphertext")
  ollamaApiKeyIv           String?  @map("ollama_api_key_iv")
  ollamaApiKeyAuthTag      String?  @map("ollama_api_key_auth_tag")
  createdAt                DateTime @default(now()) @map("created_at")
  updatedAt                DateTime @updatedAt @map("updated_at")
  oauthConnection          AiOAuthConnection? @relation(fields: [oauthConnectionId], references: [id], onDelete: SetNull)

  @@map("ai_server_runtime")
}
```

`prisma migrate dev` may refuse to run interactively (no TTY / no DB). If it errors or blocks, create the migration folder manually by copying the timestamped pattern of a sibling migration and write `migration.sql` with exactly:

```sql
ALTER TABLE "ai_server_runtime" ADD COLUMN "primary_provider" TEXT NOT NULL DEFAULT 'chatgpt';
ALTER TABLE "ai_server_runtime" ADD COLUMN "failover_provider" TEXT;
ALTER TABLE "ai_server_runtime" ADD COLUMN "chatgpt_model_slug" TEXT;
ALTER TABLE "ai_server_runtime" ADD COLUMN "chatgpt_model_display_name" TEXT;
ALTER TABLE "ai_server_runtime" ADD COLUMN "ollama_model_slug" TEXT;
ALTER TABLE "ai_server_runtime" ADD COLUMN "ollama_model_display_name" TEXT;
ALTER TABLE "ai_server_runtime" ADD COLUMN "ollama_api_key_ciphertext" TEXT;
ALTER TABLE "ai_server_runtime" ADD COLUMN "ollama_api_key_iv" TEXT;
ALTER TABLE "ai_server_runtime" ADD COLUMN "ollama_api_key_auth_tag" TEXT;
UPDATE "ai_server_runtime" SET "chatgpt_model_slug" = "selected_model_slug", "chatgpt_model_display_name" = "selected_model_display_name" WHERE "selected_model_slug" IS NOT NULL;
ALTER TABLE "ai_server_runtime" DROP COLUMN "selected_model_slug";
ALTER TABLE "ai_server_runtime" DROP COLUMN "selected_model_display_name";
```

Then run `npx prisma generate`.

- [ ] **Step 4: Run the test to verify it passes**

Run (from `apps/api`): `node -r ts-node/register --test src/modules/ai/ai-server-runtime-persistence.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations apps/api/src/modules/ai/ai-server-runtime-persistence.spec.ts
git commit -m "feat(ai): store per-provider models, primary/failover and Ollama key columns"
```

---

### Task 3: Multi-provider runtime service (view, catalogs, model selection, Ollama key)

**Files:**
- Modify: `apps/api/src/modules/ai/ai-server-runtime.service.ts`
- Modify: `apps/api/src/modules/ai/ai-oauth.service.ts` (lines 87-145 `withLockedRuntime` update in `persistTokens`, line 235 in `disconnectConnection`: replace `selectedModelSlug`/`selectedModelDisplayName` writes with `chatgptModelSlug`/`chatgptModelDisplayName`)
- Modify: `apps/api/src/modules/ai/ai-oauth.e2e.spec.ts` (replaces old column writes asserted there, if any)
- Test: `apps/api/src/modules/ai/ai-server-runtime.service.spec.ts`
- Test: `apps/api/src/modules/ai/ai-oauth.service.spec.ts` (constructor unchanged, no edits needed unless assertions on selected columns exist — fix if the runner reports)

**Interfaces:**
- Consumes: `AiServerModel` (unchanged); `EncryptionService` (optional 4th constructor arg); `OLLAMA_CLOUD_MODELS` from `./providers/ollama-models`.
- Produces:
  - `export type AiProviderName = 'chatgpt' | 'ollama'`
  - `export interface AiServerProviderView { connectionStatus: 'connected' | 'disconnected'; selectedModel: AiServerModel | null }`
  - `export interface AiServerRuntimeView { primaryProvider: AiProviderName; failoverProvider: AiProviderName | null; providers: Record<AiProviderName, AiServerProviderView> }`
  - Methods: `getRuntime(): Promise<AiServerRuntimeView>`; `listModels(provider: AiProviderName): Promise<AiServerModel[]>`; `selectModel(provider: AiProviderName, slug: string, actor?): Promise<AiServerRuntimeView>`; `setPrimaryProvider(provider: AiProviderName, actor?)`; `setFailoverProvider(provider: AiProviderName | null, actor?)`; `saveOllamaKey(apiKey: string, actor?)`; `removeOllamaKey(actor?)`; `getOllamaApiKey(): Promise<string | null>`.
  - Constructor becomes `(prisma, oauth, audit?, encryption?)` — appending keeps existing spec call sites valid.

- [ ] **Step 1: Write the failing tests**

Prepend/append to `apps/api/src/modules/ai/ai-server-runtime.service.spec.ts`. Existing helper `runtime()` builds rows with legacy fields; add a new fixture builder and tests:

```ts
function providerRuntime(overrides: Record<string, unknown> = {}) {
  return {
    id: 'global',
    oauthConnectionId: null,
    oauthConnection: null,
    primaryProvider: 'chatgpt',
    failoverProvider: null,
    chatgptModelSlug: null,
    chatgptModelDisplayName: null,
    ollamaModelSlug: null,
    ollamaModelDisplayName: null,
    ollamaApiKeyCiphertext: null,
    ollamaApiKeyIv: null,
    ollamaApiKeyAuthTag: null,
    ...overrides,
  };
}

test('getRuntime returns primary/failover and per-provider connection and model state', async () => {
  const service = new AiServerRuntimeService(createPrisma(providerRuntime({
    oauthConnectionId: 'conn-1', oauthConnection: { id: 'conn-1' },
    chatgptModelSlug: 'gpt-5', chatgptModelDisplayName: 'GPT-5',
    primaryProvider: 'chatgpt', failoverProvider: 'ollama',
    ollamaApiKeyCiphertext: 'deadbeef',
    ollamaModelSlug: 'gpt-oss:20b', ollamaModelDisplayName: 'GPT-OSS 20B',
  })) as any, { resolveProviderAuth: async () => undefined } as any);

  assert.deepEqual(await service.getRuntime(), {
    primaryProvider: 'chatgpt',
    failoverProvider: 'ollama',
    providers: {
      chatgpt: { connectionStatus: 'connected', selectedModel: { slug: 'gpt-5', displayName: 'GPT-5' } },
      ollama: { connectionStatus: 'connected', selectedModel: { slug: 'gpt-oss:20b', displayName: 'GPT-OSS 20B' } },
    },
  });
});

test('listModels returns the fixed cloud catalog for ollama without any fetch', async () => {
  let fetched = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => { fetched += 1; throw new Error('unexpected'); }) as any;
  try {
    const service = new AiServerRuntimeService(createPrisma(providerRuntime()) as any, {} as any);
    const models = await service.listModels('ollama');
    assert.deepEqual(models.map((model) => model.slug), ['gemma4:31b', 'gpt-oss:120b', 'gpt-oss:20b', 'nemotron-3-nano:30b', 'nemotron-3-super', 'nemotron-3-ultra']);
    assert.equal(fetched, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('selecting an ollama model persists to the ollama columns', async () => {
  const prisma = createPrisma(providerRuntime());
  const service = new AiServerRuntimeService(prisma as any, {} as any);
  const view = await service.selectModel('ollama', 'gpt-oss:120b');
  assert.equal(view.providers.ollama.selectedModel?.slug, 'gpt-oss:120b');
  assert.equal((prisma as any).row.ollamaModelSlug, 'gpt-oss:120b');
  assert.equal((prisma as any).row.chatgptModelSlug, null);
});

test('setting the primary provider validates membership and writes the column', async () => {
  const prisma = createPrisma(providerRuntime());
  const service = new AiServerRuntimeService(prisma as any, {} as any);
  await assert.rejects(() => service.setPrimaryProvider('anthropic' as any), /ChatGPT|Ollama|Provedor/);
  await service.setPrimaryProvider('ollama');
  assert.equal((prisma as any).row.primaryProvider, 'ollama');
});

test('setFailoverProvider rejects the same provider as primary and accepts null', async () => {
  const prisma = createPrisma(providerRuntime({ primaryProvider: 'chatgpt', failoverProvider: 'ollama' }));
  const service = new AiServerRuntimeService(prisma as any, {} as any);
  await assert.rejects(() => service.setFailoverProvider('chatgpt'), /substituto/);
  await service.setFailoverProvider(null);
  assert.equal((prisma as any).row.failoverProvider, null);
});

test('saveOllamaKey encrypts and persists the tripled key without leaking plaintext', async () => {
  let encrypted: any;
  const prisma = createPrisma(providerRuntime());
  const service = new AiServerRuntimeService(prisma as any, {} as any, undefined, {
    encrypt: (plaintext: string) => { encrypted = plaintext; return { ciphertext: 'aabb', iv: 'cc', authTag: 'dd' }; },
  } as any);
  await service.saveOllamaKey('sk-secret-ollama');
  assert.equal(encrypted, 'sk-secret-ollama');
  const row = (prisma as any).row;
  assert.equal(row.ollamaApiKeyCiphertext, 'aabb');
  assert.equal(row.ollamaApiKeyIv, 'cc');
  assert.equal(row.ollamaApiKeyAuthTag, 'dd');
});

test('getOllamaApiKey decrypts the stored key and returns null when absent', async () => {
  const prisma = createPrisma(providerRuntime({ ollamaApiKeyCiphertext: 'aabb', ollamaApiKeyIv: 'cc', ollamaApiKeyAuthTag: 'dd' }));
  const service = new AiServerRuntimeService(prisma as any, {} as any, undefined, {
    decrypt: ({ ciphertext, iv, authTag }: any) => `plain-${ciphertext}-${iv}-${authTag}`,
  } as any);
  assert.equal(await service.getOllamaApiKey(), 'plain-aabb-cc-dd');
  const empty = new AiServerRuntimeService(createPrisma(providerRuntime()) as any, {} as any);
  assert.equal(await empty.getOllamaApiKey(), null);
});

test('removeOllamaKey clears the three key columns', async () => {
  const prisma = createPrisma(providerRuntime({ ollamaApiKeyCiphertext: 'aabb', ollamaApiKeyIv: 'cc', ollamaApiKeyAuthTag: 'dd' }));
  const service = new AiServerRuntimeService(prisma as any, {} as any);
  await service.removeOllamaKey();
  assert.equal((prisma as any).row.ollamaApiKeyCiphertext, null);
  assert.equal((prisma as any).row.ollamaApiKeyAuthTag, null);
});
```

`createPrisma` currently does not expose the row and its `upsert`/`update` store it privately; add `row` to the returned object:

```ts
function createPrisma(initial: any) {
  let row = initial;
  return {
    row,
    aiServerRuntime: {
      upsert: async ({ create, update }: any) => { row = { ...row ?? create, ...update }; return row; },
      update: async ({ data }: any) => { row = { ...row, ...data }; return row; },
    },
  };
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `apps/api`): `node -r ts-node/register --test src/modules/ai/ai-server-runtime.service.spec.ts`
Expected: FAIL (new shape / methods missing).

- [ ] **Step 3: Implement the service changes in `ai-server-runtime.service.ts`**

Replace the file's top types and add methods. Full target file:

```ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { fetchOpenAiModels } from './ai-oauth.protocol';
import { AiOAuthService } from './ai-oauth.service';
import { AiAuditService } from './ai-audit.service';
import { AiProviderAuth } from './ports/ai-provider.port';
import { OLLAMA_CLOUD_MODELS } from './providers/ollama-models';

export type AiProviderName = 'chatgpt' | 'ollama';
export const AI_PROVIDER_NAMES: readonly AiProviderName[] = ['chatgpt', 'ollama'];

export interface AiServerModel {
  slug: string;
  displayName: string;
}

export interface AiServerProviderView {
  connectionStatus: 'connected' | 'disconnected';
  selectedModel: AiServerModel | null;
}

export interface AiServerRuntimeView {
  primaryProvider: AiProviderName;
  failoverProvider: AiProviderName | null;
  providers: Record<AiProviderName, AiServerProviderView>;
}

@Injectable()
export class AiServerRuntimeService {
  private catalog?: { connectionKey: string; models: AiServerModel[] };

  constructor(
    private readonly prisma: PrismaService,
    private readonly oauth: AiOAuthService,
    private readonly audit?: AiAuditService,
    private readonly encryption?: EncryptionService,
  ) {}

  async getRuntime(): Promise<AiServerRuntimeView> {
    const runtime = await this.runtime();
    return {
      primaryProvider: runtime.primaryProvider === 'ollama' ? 'ollama' : 'chatgpt',
      failoverProvider: runtime.failoverProvider === 'ollama' ? 'ollama' : runtime.failoverProvider === 'chatgpt' ? 'chatgpt' : null,
      providers: {
        chatgpt: {
          connectionStatus: runtime.oauthConnectionId ? 'connected' : 'disconnected',
          selectedModel: runtime.chatgptModelSlug && runtime.chatgptModelDisplayName
            ? { slug: runtime.chatgptModelSlug, displayName: runtime.chatgptModelDisplayName }
            : null,
        },
        ollama: {
          connectionStatus: runtime.ollamaApiKeyCiphertext ? 'connected' : 'disconnected',
          selectedModel: runtime.ollamaModelSlug && runtime.ollamaModelDisplayName
            ? { slug: runtime.ollamaModelSlug, displayName: runtime.ollamaModelDisplayName }
            : null,
        },
      },
    };
  }

  async listModels(provider: AiProviderName): Promise<AiServerModel[]> {
    if (provider === 'ollama') return [...OLLAMA_CLOUD_MODELS];
    return (await this.catalogForCurrentRuntime()).models;
  }

  async selectModel(provider: AiProviderName, slug: string, actor?: { tenantId: string; tenantUserId: string; userId?: string }): Promise<AiServerRuntimeView> {
    const catalog = await this.catalogFor(provider);
    const model = catalog.find((candidate) => candidate.slug === slug);
    if (!model) throw new BadRequestException('Modelo selecionado não está disponível');
    const columns = provider === 'chatgpt'
      ? { chatgptModelSlug: model.slug, chatgptModelDisplayName: model.displayName }
      : { ollamaModelSlug: model.slug, ollamaModelDisplayName: model.displayName };
    await this.withLockedRuntime(async (tx) => {
      await tx.aiServerRuntime.update({ where: { id: 'global' }, data: columns });
    });
    if (actor) await this.audit?.record({ tenantId: actor.tenantId, actorTenantUserId: actor.tenantUserId, actorUserId: actor.userId, action: 'runtime.model_selected', targetId: 'global', metadata: { provider, modelSlug: model.slug } });
    return this.getRuntime();
  }

  async setPrimaryProvider(provider: AiProviderName, actor?: { tenantId: string; tenantUserId: string; userId?: string }): Promise<AiServerRuntimeView> {
    this.assertProvider(provider);
    const current = await this.runtime();
    if (current.failoverProvider === provider) throw new BadRequestException('O provedor principal e o substituto devem ser diferentes');
    await this.withLockedRuntime(async (tx) => {
      await tx.aiServerRuntime.update({ where: { id: 'global' }, data: { primaryProvider: provider } });
    });
    if (actor) await this.audit?.record({ tenantId: actor.tenantId, actorTenantUserId: actor.tenantUserId, actorUserId: actor.userId, action: 'runtime.primary_provider', targetId: 'global', metadata: { provider } });
    return this.getRuntime();
  }

  async setFailoverProvider(provider: AiProviderName | null, actor?: { tenantId: string; tenantUserId: string; userId?: string }): Promise<AiServerRuntimeView> {
    if (provider !== null) this.assertProvider(provider);
    const current = await this.runtime();
    if (provider && provider === current.primaryProvider) throw new BadRequestException('O provedor substituto deve ser diferente do principal');
    await this.withLockedRuntime(async (tx) => {
      await tx.aiServerRuntime.update({ where: { id: 'global' }, data: { failoverProvider: provider } });
    });
    if (actor) await this.audit?.record({ tenantId: actor.tenantId, actorTenantUserId: actor.tenantUserId, actorUserId: actor.userId, action: 'runtime.failover_provider', targetId: 'global', metadata: { provider: provider ?? null } });
    return this.getRuntime();
  }

  async saveOllamaKey(apiKey: string, actor?: { tenantId: string; tenantUserId: string; userId?: string }): Promise<void> {
    if (!this.encryption) throw new Error('EncryptionService is not configured');
    const { ciphertext, iv, authTag } = this.encryption.encrypt(apiKey);
    await this.withLockedRuntime(async (tx) => {
      await tx.aiServerRuntime.update({ where: { id: 'global' }, data: { ollamaApiKeyCiphertext: ciphertext, ollamaApiKeyIv: iv, ollamaApiKeyAuthTag: authTag } });
    });
    if (actor) await this.audit?.record({ tenantId: actor.tenantId, actorTenantUserId: actor.tenantUserId, actorUserId: actor.userId, action: 'runtime.ollama_key', targetId: 'global', metadata: { provider: 'ollama', status: 'saved' } });
  }

  async removeOllamaKey(actor?: { tenantId: string; tenantUserId: string; userId?: string }): Promise<void> {
    await this.withLockedRuntime(async (tx) => {
      await tx.aiServerRuntime.update({ where: { id: 'global' }, data: { ollamaApiKeyCiphertext: null, ollamaApiKeyIv: null, ollamaApiKeyAuthTag: null, ollamaModelSlug: null, ollamaModelDisplayName: null } });
    });
    if (actor) await this.audit?.record({ tenantId: actor.tenantId, actorTenantUserId: actor.tenantUserId, actorUserId: actor.userId, action: 'runtime.ollama_key', targetId: 'global', metadata: { provider: 'ollama', status: 'removed' } });
  }

  async getOllamaApiKey(): Promise<string | null> {
    const row = await this.runtime();
    if (!row.ollamaApiKeyCiphertext || !this.encryption) return null;
    return this.encryption.decrypt({ ciphertext: row.ollamaApiKeyCiphertext, iv: row.ollamaApiKeyIv, authTag: row.ollamaApiKeyAuthTag });
  }

  private async catalogFor(provider: AiProviderName): Promise<AiServerModel[]> {
    try {
      return await this.listModels(provider);
    } catch (error) {
      if (provider === 'ollama') throw error;
      throw new BadRequestException('Catálogo de modelos indisponível');
    }
  }

  private assertProvider(provider: AiProviderName): void {
    if (provider !== 'chatgpt' && provider !== 'ollama') {
      throw new BadRequestException('Provedor não suportado');
    }
  }

  private async catalogForCurrentRuntime(): Promise<{ connectionKey: string; models: AiServerModel[] }> {
    let runtime = await this.runtime();
    if (!runtime.oauthConnectionId) {
      this.catalog = undefined;
      throw new BadRequestException('Catálogo de modelos indisponível');
    }
    if (this.catalog?.connectionKey === this.connectionKey(runtime)) return this.catalog;

    const auth = await this.oauth.resolveProviderAuth();
    if (!auth) throw new BadRequestException('Catálogo de modelos indisponível');
    runtime = await this.runtime();
    if (!runtime.oauthConnectionId) {
      this.catalog = undefined;
      throw new BadRequestException('Catálogo de modelos indisponível');
    }
    const connectionKey = this.connectionKey(runtime);
    if (this.connectionChanged(auth, runtime)) {
      throw new BadRequestException('A conexão do ChatGPT foi alterada. Atualize a lista de modelos e tente novamente.');
    }
    if (this.catalog?.connectionKey === connectionKey) return this.catalog;
    let models: AiServerModel[];
    try {
      models = await fetchOpenAiModels(auth.accessToken);
    } catch {
      throw new BadRequestException('Catálogo de modelos indisponível');
    }
    if (this.connectionChanged(auth, await this.runtime())) {
      throw new BadRequestException('A conexão do ChatGPT foi alterada. Atualize a lista de modelos e tente novamente.');
    }
    const catalog = { connectionKey, models };
    this.catalog = catalog;
    return catalog;
  }

  private runtime() {
    return this.prisma.aiServerRuntime.upsert({
      where: { id: 'global' },
      create: { id: 'global' },
      update: {},
      include: { oauthConnection: true },
    });
  }

  private connectionKey(runtime: any): string {
    return `${runtime.oauthConnectionId}:${runtime.oauthConnection?.updatedAt?.toISOString?.() ?? ''}`;
  }

  private connectionChanged(auth: AiProviderAuth, runtime: any): boolean {
    if (!auth.connectionId) return false;
    return auth.connectionId !== runtime.oauthConnectionId
      || (!!auth.connectionUpdatedAt && auth.connectionUpdatedAt !== runtime.oauthConnection?.updatedAt?.toISOString?.());
  }

  private async withLockedRuntime<T>(callback: (tx: any, runtime: any) => Promise<T>): Promise<T> {
    const execute = async (tx: any) => {
      await tx.$queryRawUnsafe('SELECT "id" FROM "ai_server_runtime" WHERE "id" = $1 FOR UPDATE', 'global');
      const runtime = await tx.aiServerRuntime.findUnique({ where: { id: 'global' }, include: { oauthConnection: true } });
      if (!runtime) throw new Error('AI server runtime not found');
      return callback(tx, runtime);
    };
    if (this.prisma.$transaction) return this.prisma.$transaction(execute);
    return execute({
      ...this.prisma,
      $queryRawUnsafe: async () => undefined,
      aiServerRuntime: { ...this.prisma.aiServerRuntime, findUnique: async () => this.runtime() },
    });
  }
}
```

- [ ] **Step 4: Update the OAuth service column writes**

In `apps/api/src/modules/ai/ai-oauth.service.ts`:
- line 143 `data: { oauthConnectionId: saved.id, selectedModelSlug: null, selectedModelDisplayName: null }` → `data: { oauthConnectionId: saved.id, chatgptModelSlug: null, chatgptModelDisplayName: null }`
- line 235 `data: { oauthConnectionId: null, selectedModelSlug: null, selectedModelDisplayName: null }` → `data: { oauthConnectionId: null, chatgptModelSlug: null, chatgptModelDisplayName: null }`

Grep the repo for remaining `selectedModelSlug` references and update any spec assertions (they should now be gone from the runtime service spec after fixtures are updated in the next step).

- [ ] **Step 5: Update legacy fixtures in `ai-server-runtime.service.spec.ts`**

The existing tests construct `runtime()` with `selectedModelSlug`/`selectedModelDisplayName` and call `service.listModels()` / `selectModel(slug, actor)` with the old signatures. Update:
- The `runtime()` helper → use `providerRuntime()` fields.
- `listModels()` calls → `listModels('chatgpt')`.
- `selectModel('gpt-5', actor)`-style calls → `selectModel('chatgpt', 'gpt-5', actor)`.
- Run the full spec; fix any remaining assertion that references the old flat view.

- [ ] **Step 6: Run tests to verify everything passes**

Run (from `apps/api`):
- `node -r ts-node/register --test src/modules/ai/ai-server-runtime.service.spec.ts`
- `node -r ts-node/register --test src/modules/ai/ai-oauth.service.spec.ts`
- `node -r ts-node/register --test src/modules/ai/ai-oauth.e2e.spec.ts`
- `npx tsc --noEmit`

Expected: all PASS, typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/ai/ai-server-runtime.service.ts apps/api/src/modules/ai/ai-server-runtime.service.spec.ts apps/api/src/modules/ai/ai-oauth.service.ts apps/api/src/modules/ai/ai-oauth.e2e.spec.ts
git commit -m "feat(ai): multi-provider runtime view with per-provider models and encrypted Ollama key"
```

---

### Task 4: Runtime controller, DTOs, and `settings.edit` permission

**Files:**
- Modify: `apps/api/src/modules/ai/ai-server-runtime.controller.ts`
- Modify: `apps/api/src/modules/ai/dto/select-ai-runtime-model.dto.ts` (add `provider`)
- Create: `apps/api/src/modules/ai/dto/ai-runtime-config.dto.ts`
- Test: `apps/api/src/modules/ai/ai-server-runtime.controller.spec.ts`

**Interfaces:**
- Consumes: `AiServerRuntimeService` methods from Task 3.
- Produces: `AiRuntimeProviderResponse` (`AiServerProviderView & { models: AiServerModel[] }`), `AiRuntimeResponse` (`{ primaryProvider, failoverProvider, providers: Record<AiProviderName, AiRuntimeProviderResponse> }`). HTTP routes: `GET /ai/runtime`, `POST /ai/runtime/model` `{ provider, slug }`, `POST /ai/runtime/primary` `{ provider }`, `POST /ai/runtime/failover` `{ provider | null }`. Class-level `@RequirePermissions('settings.edit')`.

- [ ] **Step 1: Write the failing tests**

Update `apps/api/src/modules/ai/ai-server-runtime.controller.spec.ts`:

```ts
test('runtime controller requires an authenticated user with the settings.edit permission', () => {
  const guards = Reflect.getMetadata(GUARDS_METADATA, AiServerRuntimeController) as Function[];
  assert.equal(guards.length, 3);
  assert.equal(guards.includes(TenantContextGuard), true);
  assert.equal(guards.includes(PermissionGuard), true);
  assert.deepEqual(Reflect.getMetadata(PERMISSIONS_KEY, AiServerRuntimeController), ['settings.edit']);
});

test('runtime view returns per-provider state and catalogs without credential fields', async () => {
  const controller = new AiServerRuntimeController({
    getRuntime: async () => ({
      primaryProvider: 'chatgpt', failoverProvider: 'ollama',
      providers: {
        chatgpt: { connectionStatus: 'connected', selectedModel: { slug: 'gpt-5', displayName: 'GPT-5' }, accessToken: 'secret-token', oauthConnectionId: 'connection-1' },
        ollama: { connectionStatus: 'connected', selectedModel: { slug: 'gpt-oss:20b', displayName: 'GPT-OSS 20B' }, apiKey: 'sk-secret' },
      },
    }),
    listModels: async (provider: any) => provider === 'ollama'
      ? [{ slug: 'gpt-oss:20b', displayName: 'GPT-OSS 20B' }]
      : [{ slug: 'gpt-5', displayName: 'GPT-5' }],
  } as any);

  const result = await controller.getRuntime();

  assert.deepEqual(result, {
    primaryProvider: 'chatgpt', failoverProvider: 'ollama',
    providers: {
      chatgpt: { connectionStatus: 'connected', selectedModel: { slug: 'gpt-5', displayName: 'GPT-5' }, models: [{ slug: 'gpt-5', displayName: 'GPT-5' }] },
      ollama: { connectionStatus: 'connected', selectedModel: { slug: 'gpt-oss:20b', displayName: 'GPT-OSS 20B' }, models: [{ slug: 'gpt-oss:20b', displayName: 'GPT-OSS 20B' }] },
    },
  });
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes('secret-token'), false);
  assert.equal(serialized.includes('sk-secret'), false);
  assert.equal(serialized.includes('accessToken'), false);
  assert.equal(serialized.includes('apiKey'), false);
});

test('primary, failover, and model endpoints wire the runtime service with the authenticated actor', async () => {
  const calls: string[] = [];
  const controller = new AiServerRuntimeController({
    getRuntime: async () => ({ primaryProvider: 'chatgpt', failoverProvider: null, providers: { chatgpt: { connectionStatus: 'disconnected', selectedModel: null }, ollama: { connectionStatus: 'disconnected', selectedModel: null } } }),
    listModels: async () => [],
    setPrimaryProvider: async (...args: unknown[]) => { calls.push(`primary:${args[0]}`); return controller.getRuntime(); },
    setFailoverProvider: async (...args: unknown[]) => { calls.push(`failover:${args[0]}`); return controller.getRuntime(); },
    selectModel: async (...args: unknown[]) => { calls.push(`model:${args[0]}:${args[1]}`); return controller.getRuntime(); },
  } as any);

  await controller.setPrimary(user as any, { provider: 'ollama' });
  await controller.setFailover(user as any, { provider: 'chatgpt' });
  await controller.selectModel(user as any, { provider: 'ollama', slug: 'gpt-oss:20b' });

  assert.deepEqual(calls.sort(), ['failover:chatgpt', 'model:ollama:gpt-oss:20b', 'primary:ollama']);
});
```

Also update the pipe-based DTO tests in that file: the new `selectModel` body is `{ provider, slug }`; `bodyMetadata('selectModel')` param type becomes `SelectAiRuntimeModelDto` (with `provider`), and payloads in the coercion tests must include `provider: 'chatgpt'`.

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `apps/api`): `node -r ts-node/register --test src/modules/ai/ai-server-runtime.controller.spec.ts`
Expected: FAIL (new endpoints/shape missing).

- [ ] **Step 3: Write DTOs**

`apps/api/src/modules/ai/dto/select-ai-runtime-model.dto.ts`:

```ts
import { IsIn, IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import type { AiProviderName } from '../ai-server-runtime.service';

export class SelectAiRuntimeModelDto {
  @IsIn(['chatgpt', 'ollama'])
  provider!: AiProviderName;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(200)
  slug!: string;
}
```

`apps/api/src/modules/ai/dto/ai-runtime-config.dto.ts`:

```ts
import { IsIn, IsOptional } from 'class-validator';
import type { AiProviderName } from '../ai-server-runtime.service';

export class SetAiRuntimePrimaryDto {
  @IsIn(['chatgpt', 'ollama'])
  provider!: AiProviderName;
}

export class SetAiRuntimeFailoverDto {
  @IsIn(['chatgpt', 'ollama'])
  @IsOptional()
  provider?: AiProviderName | null;
}
```

- [ ] **Step 4: Rewrite the runtime controller**

`apps/api/src/modules/ai/ai-server-runtime.controller.ts`:

```ts
import { BadRequestException, Body, Controller, Get, Logger, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';
import { RequestUser } from '../../common/interfaces/request-context.interface';
import { AiProviderName, AiServerModel, AiServerProviderView, AiServerRuntimeService, AiServerRuntimeView } from './ai-server-runtime.service';
import { SelectAiRuntimeModelDto } from './dto/select-ai-runtime-model.dto';
import { SetAiRuntimeFailoverDto, SetAiRuntimePrimaryDto } from './dto/ai-runtime-config.dto';

export interface AiRuntimeProviderResponse extends AiServerProviderView {
  models: AiServerModel[];
}

export interface AiRuntimeResponse {
  primaryProvider: AiProviderName;
  failoverProvider: AiProviderName | null;
  providers: Record<AiProviderName, AiRuntimeProviderResponse>;
}

@UseGuards(AuthGuard('jwt'), TenantContextGuard, PermissionGuard)
@RequirePermissions('settings.edit')
@Controller('ai/runtime')
export class AiServerRuntimeController {
  private readonly logger = new Logger(AiServerRuntimeController.name);

  constructor(private readonly runtime: AiServerRuntimeService) {}

  @Get()
  async getRuntime(): Promise<AiRuntimeResponse> {
    return this.response(await this.runtime.getRuntime());
  }

  @Post('model')
  async selectModel(@CurrentUser() user: RequestUser, @Body() dto: SelectAiRuntimeModelDto): Promise<AiRuntimeResponse> {
    const runtime = await this.runtime.selectModel(dto.provider, dto.slug, this.actor(user));
    return this.response(runtime);
  }

  @Post('primary')
  async setPrimary(@CurrentUser() user: RequestUser, @Body() dto: SetAiRuntimePrimaryDto): Promise<AiRuntimeResponse> {
    return this.response(await this.runtime.setPrimaryProvider(dto.provider, this.actor(user)));
  }

  @Post('failover')
  async setFailover(@CurrentUser() user: RequestUser, @Body() dto: SetAiRuntimeFailoverDto): Promise<AiRuntimeResponse> {
    return this.response(await this.runtime.setFailoverProvider(dto.provider ?? null, this.actor(user)));
  }

  private async response(view: AiServerRuntimeView): Promise<AiRuntimeResponse> {
    return {
      primaryProvider: view.primaryProvider,
      failoverProvider: view.failoverProvider,
      providers: {
        chatgpt: { ...view.providers.chatgpt, models: await this.models('chatgpt') },
        ollama: { ...view.providers.ollama, models: await this.models('ollama') },
      },
    };
  }

  private async models(provider: AiProviderName): Promise<AiServerModel[]> {
    try {
      return await this.runtime.listModels(provider);
    } catch (error) {
      if (!(error instanceof BadRequestException)) throw error;
      this.logger.error(error.constructor.name);
      return [];
    }
  }

  private actor(user: RequestUser) {
    return { tenantId: user.tenantId, tenantUserId: user.tenantUserId, userId: user.userId };
  }
}
```

- [ ] **Step 5: Update the remaining controller spec assertions**

Replace every old-shape mock (`connectionStatus/provider/selectedModel` flat) and the `selectModel(slug, ...)` signatures in the pipe tests with the new `provider`+slug variants. In the coercion test, iterate `{ provider: 'chatgpt', slug: 42 }` / `{ provider: 'chatgpt', slug: true }`, expect `serviceCalls` `['chatgpt-42', 'chatgpt-true']` (assert on the joined args), and rejection payloads `{ provider: 'chatgpt' }`, `{ provider: 'chatgpt', slug: '' }`, `{ slug: 'x' }` (missing provider → 400). Keep the "safe recoverable error" and "200-char slug" cases, adding `provider: 'chatgpt'` to their payloads.

- [ ] **Step 6: Run tests and typecheck**

Run (from `apps/api`):
- `node -r ts-node/register --test src/modules/ai/ai-server-runtime.controller.spec.ts`
- `npx tsc --noEmit`

Expected: PASS, typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/ai/ai-server-runtime.controller.ts apps/api/src/modules/ai/ai-server-runtime.controller.spec.ts apps/api/src/modules/ai/dto/select-ai-runtime-model.dto.ts apps/api/src/modules/ai/dto/ai-runtime-config.dto.ts
git commit -m "feat(ai): admin runtime endpoints for primary/failover and per-provider models"
```

---

### Task 5: `AiProviderRoutingService`

**Files:**
- Create: `apps/api/src/modules/ai/ai-provider-routing.service.ts`
- Test: `apps/api/src/modules/ai/ai-provider-routing.service.spec.ts`

**Interfaces:**
- Consumes: `AiServerRuntimeService.getRuntime()`, `AiServerRuntimeService.getOllamaApiKey()`, `AiOAuthService.resolveProviderAuth()`, `AiProvider` instances, `AiProviderAuth` (from `ports/ai-provider.port`).
- Produces: `export interface AiProviderExecution { provider: AiProviderName; providerInstance: AiProvider; model?: string; auth?: AiProviderAuth }`; `export const AI_OLLAMA_PROVIDER_FACTORY = 'AI_OLLAMA_PROVIDER_FACTORY'`; `export type OllamaProviderFactory = (apiKey: string) => AiProvider`; class `AiProviderRoutingService` with `async resolveExecutions(): Promise<AiProviderExecution[]>`.

- [ ] **Step 1: Write the failing test**

`apps/api/src/modules/ai/ai-provider-routing.service.spec.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { AiProviderRoutingService } from './ai-provider-routing.service';

const chatgptInstance = { name: 'chatgpt-instance' } as any;

function runtimeView(primaryProvider: 'chatgpt' | 'ollama', failoverProvider: 'chatgpt' | 'ollama' | null) {
  return {
    primaryProvider, failoverProvider,
    providers: {
      chatgpt: { connectionStatus: 'connected', selectedModel: { slug: 'gpt-5', displayName: 'GPT-5' } },
      ollama: { connectionStatus: 'connected', selectedModel: { slug: 'gpt-oss:20b', displayName: 'GPT-OSS 20B' } },
    },
  };
}

function service(options: {
  primary?: 'chatgpt' | 'ollama'; failover?: 'chatgpt' | 'ollama' | null;
  ollamaKey?: string | null; oauthAuth?: any; oauthCalls?: number;
}) {
  const oauthCalls: number[] = [];
  return new AiProviderRoutingService(
    { getRuntime: async () => runtimeView(options.primary ?? 'chatgpt', options.failover ?? null), getOllamaApiKey: async () => options.ollamaKey ?? null },
    { resolveProviderAuth: async () => { oauthCalls.push(1); return options.oauthAuth; } },
    chatgptInstance,
    (apiKey: string) => ({ ollamaFactoryKey: apiKey }) as any,
  );
}

test('orders primary then failover executions', async () => {
  const routing = service({ primary: 'chatgpt', failover: 'ollama', ollamaKey: 'sk-ollama', oauthAuth: { type: 'oauth', accessToken: 'token' } });
  const executions = await routing.resolveExecutions();
  assert.deepEqual(executions.map((execution) => execution.provider), ['chatgpt', 'ollama']);
  assert.equal(executions[0].model, 'gpt-5');
  assert.equal(executions[1].model, 'gpt-oss:20b');
  assert.deepEqual((executions[1].providerInstance as any).ollamaFactoryKey, 'sk-ollama');
});

test('skips an unconfigured primary and keeps the configured failover', async () => {
  const routing = service({ primary: 'chatgpt', failover: 'ollama', ollamaKey: 'sk-ollama', oauthAuth: undefined });
  const executions = await routing.resolveExecutions();
  assert.deepEqual(executions.map((execution) => execution.provider), ['ollama']);
});

test('skips the ollama failover when no key is saved', async () => {
  const routing = service({ primary: 'chatgpt', failover: 'ollama', ollamaKey: null, oauthAuth: { type: 'oauth', accessToken: 'token' } });
  const executions = await routing.resolveExecutions();
  assert.deepEqual(executions.map((execution) => execution.provider), ['chatgpt']);
});

test('returns no executions when the only configured provider is unavailable', async () => {
  const routing = service({ primary: 'chatgpt', failover: null, ollamaKey: null, oauthAuth: undefined });
  assert.deepEqual(await routing.resolveExecutions(), []);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `apps/api`): `node -r ts-node/register --test src/modules/ai/ai-provider-routing.service.spec.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `ai-provider-routing.service.ts`**

```ts
import { Injectable, Inject } from '@nestjs/common';
import { AiProvider } from './ports/ai-provider.port';
import { AiProviderAuth } from './ports/ai-provider.port';
import { AiServerRuntimeService, AiProviderName } from './ai-server-runtime.service';
import { AiOAuthService } from './ai-oauth.service';
import { OllamaCompletionsProvider } from './providers/ollama-completions.provider';

export const AI_OLLAMA_PROVIDER_FACTORY = 'AI_OLLAMA_PROVIDER_FACTORY';
export type OllamaProviderFactory = (apiKey: string) => AiProvider;

export interface AiProviderExecution {
  provider: AiProviderName;
  providerInstance: AiProvider;
  model?: string;
  auth?: AiProviderAuth;
}

@Injectable()
export class AiProviderRoutingService {
  constructor(
    private readonly runtime: AiServerRuntimeService,
    private readonly oauth: AiOAuthService,
    @Inject('AI_PROVIDER') private readonly chatgptProvider: AiProvider,
    @Inject(AI_OLLAMA_PROVIDER_FACTORY) private readonly ollamaFactory: OllamaProviderFactory,
  ) {}

  async resolveExecutions(): Promise<AiProviderExecution[]> {
    const view = await this.runtime.getRuntime();
    const ordered: Array<AiProviderName | null> = [view.primaryProvider, view.failoverProvider];
    const executions: AiProviderExecution[] = [];
    for (const provider of ordered) {
      if (!provider || executions.some((execution) => execution.provider === provider)) continue;
      if (provider === 'chatgpt') {
        const auth = await this.oauth.resolveProviderAuth();
        if (!auth) continue;
        executions.push({ provider, providerInstance: this.chatgptProvider, model: view.providers.chatgpt.selectedModel?.slug, auth });
      } else {
        const apiKey = await this.runtime.getOllamaApiKey();
        if (!apiKey) continue;
        executions.push({ provider, providerInstance: this.ollamaFactory(apiKey), model: view.providers.ollama.selectedModel?.slug });
      }
    }
    return executions;
  }
}

export const defaultOllamaProviderFactory: OllamaProviderFactory = (apiKey) => new OllamaCompletionsProvider(apiKey);
```

- [ ] **Step 4: Run the test to verify it passes**

Run (from `apps/api`): `node -r ts-node/register --test src/modules/ai/ai-provider-routing.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/ai/ai-provider-routing.service.ts apps/api/src/modules/ai/ai-provider-routing.service.spec.ts
git commit -m "feat(ai): route ordered provider executions with failover eligibility"
```

---

### Task 6: `AiService` flow-level failover

**Files:**
- Modify: `apps/api/src/modules/ai/ai.service.ts`
- Modify: `apps/api/src/modules/ai/ai.service.spec.ts`
- Test: `apps/api/src/modules/ai/ai.service.spec.ts` (additions)

**Interfaces:**
- Consumes: `AiProviderExecution` from `./ai-provider-routing.service`; new token `export const AI_PROVIDER_ROUTING = 'AI_PROVIDER_ROUTING'`.
- Produces: optional constructor arg index 10 `@Optional() @Inject(AI_PROVIDER_ROUTING) private readonly routing?: AiProviderRoutingService`. `sendMessage` returns the same shape, with `message.completed` audit gaining `provider`. Audit `provider.failed` reports the failing execution's provider.

- [ ] **Step 1: Write the failing tests**

Append to `apps/api/src/modules/ai/ai.service.spec.ts`:

```ts
import { AiProviderError } from './ports/ai-provider.port';
import { ServiceUnavailableException } from '@nestjs/common';

const executionRuntime = (provider: 'chatgpt' | 'ollama' = 'chatgpt') => ({
  getRuntime: async () => ({
    primaryProvider: provider, failoverProvider: null,
    providers: {
      chatgpt: { connectionStatus: 'connected', selectedModel: { slug: 'gpt-5', displayName: 'GPT-5' } },
      ollama: { connectionStatus: 'disconnected', selectedModel: { slug: 'gpt-oss:20b', displayName: 'GPT-OSS 20B' } },
    },
  }),
});

test('replays the whole flow on the failover provider when the primary errors', async () => {
  const calls: string[] = [];
  const primary = {
    complete: async () => { calls.push('primary'); throw new AiProviderError('AI provider request failed', { status: 429, code: 'subscription_sharing_usage_limit_exceeded' }); },
  };
  const failover = { complete: async () => { calls.push('failover'); return { text: 'resolvi do fallback', toolCalls: [] }; } };
  const routing = { resolveExecutions: async () => [
    { provider: 'chatgpt' as const, providerInstance: primary, model: 'gpt-5', auth: { type: 'oauth' as const, accessToken: 'x' } },
    { provider: 'ollama' as const, providerInstance: failover, model: 'gpt-oss:20b' },
  ] };
  const { service, txWrites, auditLog } = setup({ complete: async () => { throw new Error('must not be used'); } }, undefined, executionRuntime());
  (service as any).routing = routing;

  const result = await service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'oi', responseMode: AiResponseMode.TEXT });

  assert.deepEqual(calls, ['primary', 'failover']);
  assert.equal(result.assistantMessage.content, 'resolvi do fallback');
  assert.deepEqual(JSON.parse(txWrites[1].providerMetaJson), { toolCallCount: 0 });
  assert.equal(auditLog.at(-1).metadata.provider, 'chatgpt');
  assert.equal(auditLog.filter((entry) => entry.action === 'provider.failed').at(-1).metadata.provider, 'chatgpt');
  const completed = auditLog.filter((entry) => entry.action === 'message.completed').at(-1);
  assert.equal(completed.metadata.provider, 'ollama');
});

test('a business error never triggers failover', async () => {
  const primary = { complete: async () => ({ text: 'x', toolCalls: [{ name: 'read', arguments: {} }] }) };
  const failover = { complete: async () => { throw new Error('failover must not run'); } };
  const routing = { resolveExecutions: async () => [
    { provider: 'chatgpt' as const, providerInstance: primary, model: 'gpt-5' },
    { provider: 'ollama' as const, providerInstance: failover, model: 'gpt-oss:20b' },
  ] };
  const { service } = setup({ complete: async () => { throw new Error('must not be used'); } }, undefined, executionRuntime());
  (service as any).registry = new AiToolRegistryService([{
    name: 'read', readOnly: true, parameters: { type: 'object' },
    authorize: async () => { throw new ForbiddenException('sem acesso'); },
    execute: async () => { throw new Error('must not run'); },
  }]);
  (service as any).routing = routing;

  await assert.rejects(() => service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'oi', responseMode: AiResponseMode.TEXT }), ForbiddenException);
});

test('raises the last provider error when both providers fail', async () => {
  const primary = { complete: async () => { throw new AiProviderError('AI provider request failed', { status: 500 }); } };
  const failover = { complete: async () => { throw new Error('AI provider request failed'); } };
  const routing = { resolveExecutions: async () => [
    { provider: 'chatgpt' as const, providerInstance: primary, model: 'gpt-5' },
    { provider: 'ollama' as const, providerInstance: failover, model: 'gpt-oss:20b' },
  ] };
  const { service, txWrites, outsideWrites, persistedRows, transactions } = setup({ complete: async () => { throw new Error('must not be used'); } }, undefined, executionRuntime());
  (service as any).routing = routing;

  await assert.rejects(() => service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'oi', responseMode: AiResponseMode.TEXT }), /AI provider request failed/);

  assert.deepEqual(txWrites, []);
  assert.deepEqual(outsideWrites, []);
  assert.deepEqual(persistedRows(), []);
  assert.deepEqual(transactions, []);
});

test('sendMessage fails fast with the routing error when no provider is configured', async () => {
  const { service } = setup({ complete: async () => ({ text: 'ok', toolCalls: [] }) }, undefined, executionRuntime());
  (service as any).routing = { resolveExecutions: async () => [] };
  await assert.rejects(
    () => service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'oi', responseMode: AiResponseMode.TEXT }),
    ServiceUnavailableException,
  );
});
```

Update the existing assertion `provider: 'AI_PROVIDER'` → `provider: 'chatgpt'` in the "audits provider HTTP metadata" test, and update the three runtime-model tests to the new view shape (`executionRuntime()` fixture above) — `completes with the globally selected runtime model` still asserts `receivedInput.model === 'gpt-5-codex'`; change the fixture's selected slug to `gpt-5-codex`.

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `apps/api`): `node -r ts-node/register --test src/modules/ai/ai.service.spec.ts`
Expected: FAIL (routing not integrated; old shape assertions fail).

- [ ] **Step 3: Refactor `AiService`**

In `apps/api/src/modules/ai/ai.service.ts`:
1. Add imports: `ServiceUnavailableException` (nestjs), `AiProviderExecution` + `AI_PROVIDER_ROUTING` awareness via a type-only import of `AiProviderRoutingService`.
2. Add `export const AI_PROVIDER_ROUTING = 'AI_PROVIDER_ROUTING';` next to the other tokens.
3. Add constructor token index 10:
```ts
@Optional() @Inject(AI_PROVIDER_ROUTING) private readonly routing?: AiProviderRoutingService,
```
4. Replace the `try/catch` block in `sendMessage` (lines 119-163) with:

```ts
const executions = this.routing
  ? await this.routing.resolveExecutions()
  : [{ provider: 'chatgpt' as const, providerInstance: this.provider, model: await this.selectedModel(), auth: this.oauth ? await this.oauth.resolveProviderAuth() : undefined }];
if (!executions.length) throw new ServiceUnavailableException('AI provider is not configured');

let completion: Awaited<ReturnType<AiProvider['complete']>> | undefined;
let toolResults: Array<{ toolName: string; result: unknown }> = [];
let clarifiedTools: Array<{ tool: AiTool; args: unknown; result: AiToolClarification }> = [];
let actionTools: Array<{ tool: AiTool; args: unknown }> = [];
let toolCallCount = 0;
let lastError: unknown;
let usedProvider: 'chatgpt' | 'ollama' = 'chatgpt';

for (const execution of executions) {
  try {
    const run = await this.runProviderLoop(completionInput, execution, actor);
    completion = run.completion;
    toolResults = run.toolResults;
    clarifiedTools = run.clarifiedTools;
    actionTools = run.actionTools;
    toolCallCount = run.toolCallCount;
    usedProvider = execution.provider;
    break;
  } catch (error) {
    lastError = error;
    if (!(error instanceof AiProviderError) && !(error instanceof Error && /^AI (provider|response)/.test(error.message))) throw error;
    await this.audit.record({
      tenantId: actor.tenantId, actorTenantUserId: actor.tenantUserId, actorUserId: actor.userId,
      action: 'provider.failed', targetId: conversation.id,
      metadata: this.providerErrorMetadata(error, execution.provider),
    });
  }
}
if (!completion) throw lastError;
```

And add the helpers plus update the persist call signature and the `message.completed` audit to:

```ts
await this.audit.record({ tenantId: actor.tenantId, actorTenantUserId: actor.tenantUserId, actorUserId: actor.userId, action: 'message.completed', targetId: conversation.id, metadata: { responseMode: dto.responseMode, toolCallCount, provider: usedProvider } });
```

```ts
private providerErrorMetadata(error: unknown, provider: 'chatgpt' | 'ollama') {
  return {
    provider,
    status: 'failed',
    ...(error instanceof AiProviderError ? {
      providerStatus: error.metadata.status,
      providerCode: error.metadata.code,
      providerRequestId: error.metadata.requestId,
    } : {}),
  };
}

private async runProviderLoop(
  completionInput: AiCompletionInput,
  execution: AiProviderExecution,
  actor: AiActor & { conversationId: string },
) {
  let completionMessages = completionInput.messages;
  let actionTools: Array<{ tool: AiTool; args: unknown }> = [];
  let clarifiedTools: Array<{ tool: AiTool; args: unknown; result: AiToolClarification }> = [];
  const toolResults: Array<{ toolName: string; result: unknown }> = [];
  let toolCallCount = 0;
  let completion: Awaited<ReturnType<AiProvider['complete']>>;
  for (let continuation = 0; ; continuation += 1) {
    completion = await execution.providerInstance.complete(
      { ...completionInput, messages: completionMessages, ...(execution.model ? { model: execution.model } : {}) },
      execution.auth,
    );
    toolCallCount += completion.toolCalls.length;
    const tools = completion.toolCalls.map((toolCall) => {
      const tool = this.registry.get(toolCall.name);
      if (!tool) throw new BadRequestException(`Ferramenta não disponível: ${toolCall.name}`);
      const args = this.normalizeToolArgs(tool, toolCall.arguments);
      this.validateToolArgs(tool, args);
      return { tool, args, call: { ...toolCall, arguments: args as Record<string, unknown> } };
    });
    const currentClarifications: Array<{ tool: AiTool; args: unknown; result: AiToolClarification }> = [];
    const currentReads: Array<{ tool: AiTool; args: unknown; call: typeof completion.toolCalls[number] }> = [];
    const currentActions = tools.filter(({ tool }) => !tool.readOnly);
    for (const candidate of tools) {
      const result = await candidate.tool.authorize({ tenantId: actor.tenantId, actorTenantUserId: actor.tenantUserId, args: candidate.args });
      if (this.isClarification(result)) currentClarifications.push({ ...candidate, result });
      else if (candidate.tool.readOnly) currentReads.push(candidate);
      else actionTools.push({ tool: candidate.tool, args: candidate.args });
    }
    if (currentClarifications.length) {
      clarifiedTools = currentClarifications;
      break;
    }
    const currentResults = [] as Array<{ call: typeof completion.toolCalls[number]; result: unknown }>;
    for (const { tool, args, call } of currentReads) {
      const result = await tool.execute({ tenantId: actor.tenantId, actorTenantUserId: actor.tenantUserId, args });
      currentResults.push({ call, result });
      toolResults.push({ toolName: tool.name, result });
    }
    if (!currentReads.length || currentActions.length) break;
    if (continuation >= 3) throw new BadRequestException('Limite de consultas do assistente excedido');
    if (!execution.providerInstance.buildToolContinuation) throw new BadRequestException('O provider não suporta continuação de ferramentas');
    completionMessages = execution.providerInstance.buildToolContinuation({ ...completionInput, messages: completionMessages }, completion, currentResults).messages;
  }
  return { completion, toolResults, clarifiedTools, actionTools, toolCallCount };
}
```

Adapt `runProviderLoop`'s call site to pass only the locals it needs (`completionInput`, `execution`, `actor`). Persistence block after the loop stays, using the loop-scoped `completion`, `toolResults`, `clarifiedTools`, `actionTools`, `toolCallCount`.

- [ ] **Step 4: Update remaining spec fixtures in `ai.service.spec.ts`**

Change the three runtime-view tests to use `executionRuntime()` and `gpt-5-codex` slug; ensure the "surfaces a global runtime read failure" test still passes (that one throws from `getRuntime` inside the non-routing fallback `await this.selectedModel()` — keep `selectedModel()` reading `providers.chatgpt.selectedModel`).

- [ ] **Step 5: Update `selectedModel()` in the service**

```ts
private async selectedModel(): Promise<string | undefined> {
  if (!this.runtime) return undefined;
  try {
    const runtime = await this.runtime.getRuntime();
    return runtime.providers.chatgpt.selectedModel?.slug || undefined;
  } catch (error) {
    this.logger.error(`Falha ao ler o runtime global de IA: ${safeError(error)}`);
    throw error;
  }
}
```

- [ ] **Step 6: Run tests and typecheck**

Run (from `apps/api`):
- `node -r ts-node/register --test src/modules/ai/ai.service.spec.ts`
- `node -r ts-node/register --test src/modules/ai/ai-persistence.spec.ts`
- `node -r ts-node/register --test src/modules/ai/ai-oauth-persistence.spec.ts`
- `npx tsc --noEmit`

Expected: PASS, typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/ai/ai.service.ts apps/api/src/modules/ai/ai.service.spec.ts
git commit -m "feat(ai): flow-level provider failover with per-provider model pinning"
```

---

### Task 7: Module wiring, OAuth/runtime permission moves, and settings key endpoints

**Files:**
- Modify: `apps/api/src/modules/ai/ai.module.ts`
- Modify: `apps/api/src/modules/ai/ai.module.spec.ts`
- Modify: `apps/api/src/modules/ai/ai-oauth.controller.ts` (permission → `settings.edit`)
- Modify: `apps/api/src/modules/ai/ai-oauth.controller.spec.ts`
- Modify: `apps/api/src/modules/settings/ai-provider-settings.controller.ts` (map new view + key endpoints)
- Modify: `apps/api/src/modules/settings/ai-provider-settings.controller.spec.ts`
- Modify: `apps/api/src/modules/ai/ai-runtime.http.e2e.spec.ts`

**Interfaces:**
- Consumes: all tasks above.
- Produces: module providers `AiProviderRoutingService` + alias token `AI_PROVIDER_ROUTING` + `AI_OLLAMA_PROVIDER_FACTORY` provider; settings controller routes `PUT /settings/ai/ollama/key` and `DELETE /settings/ai/ollama/key` (class-level `settings.edit`).

- [ ] **Step 1: Write the failing tests**

Update `apps/api/src/modules/ai/ai.module.spec.ts`:

```ts
test('registers the provider routing service and the Ollama factory token', () => {
  const providers = Reflect.getMetadata('providers', AiModule) ?? [];
  assert.ok(providers.includes(AiProviderRoutingService));
  assert.deepEqual(
    (providers.find((entry: any) => entry?.provide === AI_PROVIDER_ROUTING) ?? {}).useExisting,
    AiProviderRoutingService,
  );
  const ollamaFactory = providers.find((entry: any) => entry?.provide === AI_OLLAMA_PROVIDER_FACTORY);
  assert.ok(ollamaFactory, 'missing Ollama provider factory');
  const instance = ollamaFactory.useFactory();
  assert.equal(typeof instance, 'function');
});

test('AiService declares the routing token behind the optional deps', () => {
  const dependencies = Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, AiService) ?? [];
  const routingDependency = dependencies.find((dependency: any) => dependency.index === 10);
  assert.equal(routingDependency.param, AI_PROVIDER_ROUTING);
});
```

Update `apps/api/src/modules/ai/ai-oauth.controller.spec.ts` line 19: `assert.deepEqual(Reflect.getMetadata(PERMISSIONS_KEY, AiOAuthController), ['settings.edit']);` and the test name.

Update `apps/api/src/modules/settings/ai-provider-settings.controller.spec.ts`:

```ts
import { RequestMethod } from '@nestjs/common';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';

test('lists the ChatGPT provider with live global connection status and no credential fields', async () => {
  const controller = new AiProviderSettingsController({
    getRuntime: async () => ({
      primaryProvider: 'chatgpt', failoverProvider: null,
      providers: {
        chatgpt: { connectionStatus: 'connected', selectedModel: { slug: 'gpt-5', displayName: 'GPT-5' } },
        ollama: { connectionStatus: 'disconnected', selectedModel: null, accessToken: 'secret-token' },
      },
    }),
  } as any);

  const result = await controller.providers();
  assert.deepEqual(result.providers[0], {
    id: 'chatgpt', name: 'ChatGPT', status: 'active', connectionStatus: 'connected', connectable: false,
  });
  assert.equal(result.providers.length, 1 + COMING_SOON_AI_PROVIDERS.length);
  assert.equal(JSON.stringify(result).includes('secret-token'), false);
});

test('Ollama key save/remove routes live on the settings controller under settings.edit', async () => {
  const calls: any[] = [];
  const controller = new AiProviderSettingsController({
    saveOllamaKey: async (apiKey: string, actor: any) => calls.push(['save', apiKey, actor]),
    removeOllamaKey: async (actor: any) => calls.push(['remove', actor]),
  } as any);
  const user = { userId: 'user-1', tenantId: 'tenant-a', tenantUserId: 'tenant-user-1' };
  assert.equal(Reflect.getMetadata(PATH_METADATA, AiProviderSettingsController.prototype.saveOllamaKey), 'ollama/key');
  assert.equal(Reflect.getMetadata(METHOD_METADATA, AiProviderSettingsController.prototype.saveOllamaKey), RequestMethod.PUT);
  assert.equal(Reflect.getMetadata(METHOD_METADATA, AiProviderSettingsController.prototype.removeOllamaKey), RequestMethod.DELETE);
  assert.equal(Reflect.getMetadata(PERMISSIONS_KEY, AiProviderSettingsController), 'settings.edit');
  await controller.saveOllamaKey(user as any, { apiKey: 'sk-secret' });
  await controller.removeOllamaKey(user as any);
  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], 'save');
  assert.equal(calls[0][1], 'sk-secret');
  assert.deepEqual(calls[0][2], { tenantId: 'tenant-a', tenantUserId: 'tenant-user-1', userId: 'user-1' });
  assert.equal(calls[1][0], 'remove');
});
```

Update `apps/api/src/modules/ai/ai-runtime.http.e2e.spec.ts`:
- `runtime` fixture `getRuntime` returns the new nested view; `listModels(provider)` returns per-provider; `selectModel(provider, slug, actor)` returns a simple new-shape view; add `setPrimaryProvider`/`setFailoverProvider` stubs returning the new shape.
- Users: `test-user` keeps `['ai.use']` (`403` on runtime now); use `test-admin` for `200` on runtime fetch/model; `test-limited` `403`; keep `/api/settings/ai/providers` admin check with `test-admin` `200`.
- Add a check that GET `/api/ai/runtime` with `test-admin` returns `providers.chatgpt.models` and no `secret-token`/`secret-connection`.

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `apps/api`):
- `node -r ts-node/register --test src/modules/ai/ai.module.spec.ts`
- `node -r ts-node/register --test src/modules/ai/ai-oauth.controller.spec.ts`
- `node -r ts-node/register --test src/modules/settings/ai-provider-settings.controller.spec.ts`
- `node -r ts-node/register --test src/modules/ai/ai-runtime.http.e2e.spec.ts`

Expected: at least the module and settings specs FAIL.

- [ ] **Step 3: Wire `ai.module.ts`**

Add providers and imports:

```ts
import { AiProviderRoutingService, AI_OLLAMA_PROVIDER_FACTORY, defaultOllamaProviderFactory } from './ai-provider-routing.service';
import { AI_PROVIDER_ROUTING } from './ai.service';
```

In `providers`, after the `AI_PROVIDER` factory:

```ts
{
  provide: AI_OLLAMA_PROVIDER_FACTORY,
  useFactory: () => defaultOllamaProviderFactory,
},
AiProviderRoutingService,
{ provide: AI_PROVIDER_ROUTING, useExisting: AiProviderRoutingService },
```

- [ ] **Step 4: Update the OAuth controller permission**

In `apps/api/src/modules/ai/ai-oauth.controller.ts`, change `@RequirePermissions('ai.use')` → `@RequirePermissions('settings.edit')` and update the class comment (it governs admin config now; only `ai.controller`/`ai-audio.controller` keep `ai.use`).

- [ ] **Step 5: Extend the settings controller**

`apps/api/src/modules/settings/ai-provider-settings.controller.ts`:

```ts
import { Body, Controller, Delete, Get, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-context.interface';
import { UpdateOllamaApiKeyDto } from '../ai/dto/update-ollama-api-key.dto';
```

Change the `providers()` mapping to read `runtime.providers.chatgpt`:

```ts
const chatgpt: ActiveAiProvider = {
  id: 'chatgpt',
  name: 'ChatGPT',
  status: 'active',
  connectionStatus: runtime.providers.chatgpt.connectionStatus,
  connectable: false,
};
```

Add:

```ts
@Put('ollama/key')
async saveOllamaKey(@CurrentUser() user: RequestUser, @Body() dto: UpdateOllamaApiKeyDto) {
  await this.runtime.saveOllamaKey(dto.apiKey, { tenantId: user.tenantId, tenantUserId: user.tenantUserId, userId: user.userId });
  return { status: 'saved' };
}

@Delete('ollama/key')
async removeOllamaKey(@CurrentUser() user: RequestUser) {
  await this.runtime.removeOllamaKey({ tenantId: user.tenantId, tenantUserId: user.tenantUserId, userId: user.userId });
  return { status: 'removed' };
}
```

Create `apps/api/src/modules/ai/dto/update-ollama-api-key.dto.ts`:

```ts
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class UpdateOllamaApiKeyDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  apiKey!: string;
}
```

Update the class comment describing the endpoint roles (providers status + key management are both admin-only under `settings.edit`).

- [ ] **Step 6: Update `ai-provider-settings.controller.spec.ts` disconnected-provider test**

The "ChatGPT provider reads as disconnected" test mocks `getRuntime` with the old flat shape — change to the nested shape (`providers.chatgpt.connectionStatus: 'disconnected'`, `selectedModel: null`).

- [ ] **Step 7: Run all affected tests + typecheck**

Run (from `apps/api`):
- `node -r ts-node/register --test src/modules/ai/ai.module.spec.ts src/modules/ai/ai-oauth.controller.spec.ts src/modules/settings/ai-provider-settings.controller.spec.ts src/modules/ai/ai-runtime.http.e2e.spec.ts`
- `npx tsc --noEmit`

Expected: PASS, typecheck clean.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/ai/ai.module.ts apps/api/src/modules/ai/ai.module.spec.ts apps/api/src/modules/ai/ai-oauth.controller.ts apps/api/src/modules/ai/ai-oauth.controller.spec.ts apps/api/src/modules/settings/ai-provider-settings.controller.ts apps/api/src/modules/settings/ai-provider-settings.controller.spec.ts apps/api/src/modules/ai/ai-runtime.http.e2e.spec.ts apps/api/src/modules/ai/dto/update-ollama-api-key.dto.ts
git commit -m "feat(ai): wire provider routing, move config endpoints to admin, add Ollama key routes"
```

---

### Task 8: Web runtime library for the settings screen

**Files:**
- Modify: `apps/web/src/lib/ai-runtime.ts`
- Modify: `apps/web/src/lib/ai-runtime.spec.ts`

**Interfaces:**
- Consumes: `GET /ai/runtime`, `POST /ai/runtime/model` `{ provider, slug }`, `POST /ai/runtime/primary` `{ provider }`, `POST /ai/runtime/failover` `{ provider }`.
- Produces: `type AiProviderName = 'chatgpt' | 'ollama'`; `AiRuntime { primaryProvider; failoverProvider; providers: Record<AiProviderName, AiRuntimeProvider> }`; `AiRuntimeProvider { connectionStatus; selectedModel; models }`; `getAiRuntime(): Promise<AiRuntime>`; `selectAiProviderModel(provider, slug)`; `setAiPrimaryProvider(provider)`; `setAiFailoverProvider(provider | null)` (all return `Promise<AiRuntime>` with clientside parsing that drops extra fields); `getAiRuntimeErrorMessage` unchanged behavior.

- [ ] **Step 1: Write the failing tests**

Rewrite `apps/web/src/lib/ai-runtime.spec.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { api } from './api';
import { getAiRuntime, selectAiProviderModel, setAiPrimaryProvider, setAiFailoverProvider, getAiRuntimeErrorMessage } from './ai-runtime';

const redactedAssets = {
  primaryProvider: 'chatgpt' as const,
  failoverProvider: 'ollama' as const,
  providers: {
    chatgpt: {
      connectionStatus: 'connected' as const,
      selectedModel: { slug: 'gpt-4.1', displayName: 'GPT-4.1', accessToken: 'secret' },
      models: [{ slug: 'gpt-4.1', displayName: 'GPT-4.1', token: 'secret' }],
    },
    ollama: {
      connectionStatus: 'disconnected' as const,
      selectedModel: null,
      models: [{ slug: 'gpt-oss:20b', displayName: 'GPT-OSS 20B', apiKey: 'sk-x' }],
    },
  },
  accessToken: 'secret',
};

test('parses only redacted per-provider runtime metadata', async () => {
  const originalGet = api.get;
  api.get = (async (url: string) => {
    assert.equal(url, '/ai/runtime');
    return { data: redactedAssets };
  }) as typeof api.get;

  try {
    assert.deepEqual(await getAiRuntime(), {
      primaryProvider: 'chatgpt',
      failoverProvider: 'ollama',
      providers: {
        chatgpt: {
          connectionStatus: 'connected',
          selectedModel: { slug: 'gpt-4.1', displayName: 'GPT-4.1' },
          models: [{ slug: 'gpt-4.1', displayName: 'GPT-4.1' }],
        },
        ollama: {
          connectionStatus: 'disconnected',
          selectedModel: null,
          models: [{ slug: 'gpt-oss:20b', displayName: 'GPT-OSS 20B' }],
        },
      },
    });
  } finally {
    api.get = originalGet;
  }
});

test('selects a model per provider and calls the provider-driven primary/failover setters', async () => {
  const originalPost = api.post;
  const calls: Array<{ url: string; payload?: unknown }> = [];
  api.post = (async (url: string, payload?: unknown) => {
    calls.push({ url, payload });
    return { data: redactedAssets };
  }) as typeof api.post;

  try {
    await selectAiProviderModel('ollama', 'gpt-oss:20b');
    await setAiPrimaryProvider('ollama');
    await setAiFailoverProvider(null);
    assert.deepEqual(calls, [
      { url: '/ai/runtime/model', payload: { provider: 'ollama', slug: 'gpt-oss:20b' } },
      { url: '/ai/runtime/primary', payload: { provider: 'ollama' } },
      { url: '/ai/runtime/failover', payload: { provider: null } },
    ]);
  } finally {
    api.post = originalPost;
  }
});

test('maps runtime failures to safe user-facing messages', () => {
  assert.equal(
    getAiRuntimeErrorMessage({ response: { data: { code: 'AI_RUNTIME_CATALOG_UNAVAILABLE' } } }),
    'O catálogo de modelos está indisponível no momento. Você ainda pode consultar o histórico do chat.',
  );
  assert.equal(
    getAiRuntimeErrorMessage(new Error('network')),
    'Não foi possível carregar o runtime de IA. Você ainda pode consultar o histórico do chat.',
  );
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `apps/web`): `npx tsx --test src/lib/ai-runtime.spec.ts`
Expected: FAIL (new exports missing / old shape parse fails).

- [ ] **Step 3: Rewrite `apps/web/src/lib/ai-runtime.ts`**

```ts
import { api } from './api';

export type AiProviderName = 'chatgpt' | 'ollama';

export interface AiRuntimeModel {
  slug: string;
  displayName: string;
}

export interface AiRuntimeProvider {
  connectionStatus: 'connected' | 'disconnected';
  selectedModel: AiRuntimeModel | null;
  models: AiRuntimeModel[];
}

export interface AiRuntime {
  primaryProvider: AiProviderName;
  failoverProvider: AiProviderName | null;
  providers: Record<AiProviderName, AiRuntimeProvider>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseModel(value: unknown): AiRuntimeModel {
  if (!isRecord(value) || typeof value.slug !== 'string' || typeof value.displayName !== 'string') {
    throw new Error('Resposta de modelo de IA inválida');
  }
  return { slug: value.slug, displayName: value.displayName };
}

function parseProvider(value: unknown): AiRuntimeProvider {
  if (!isRecord(value) || (value.connectionStatus !== 'connected' && value.connectionStatus !== 'disconnected')) {
    throw new Error('Resposta do runtime de IA inválida');
  }
  return {
    connectionStatus: value.connectionStatus,
    selectedModel: value.selectedModel === null ? null : parseModel(value.selectedModel),
    models: Array.isArray(value.models) ? value.models.map(parseModel) : [],
  };
}

function parseProviderName(value: unknown): AiProviderName {
  if (value !== 'chatgpt' && value !== 'ollama') throw new Error('Resposta do runtime de IA inválida');
  return value;
}

function parseRuntime(value: unknown): AiRuntime {
  if (!isRecord(value) || !isRecord(value.providers)) throw new Error('Resposta do runtime de IA inválida');
  return {
    primaryProvider: parseProviderName(value.primaryProvider),
    failoverProvider: value.failoverProvider === null ? null
      : value.failoverProvider === undefined ? null
      : parseProviderName(value.failoverProvider),
    providers: {
      chatgpt: parseProvider(value.providers.chatgpt),
      ollama: parseProvider(value.providers.ollama),
    },
  };
}

export async function getAiRuntime(): Promise<AiRuntime> {
  const { data } = await api.get('/ai/runtime');
  return parseRuntime(data);
}

export async function selectAiProviderModel(provider: AiProviderName, slug: string): Promise<AiRuntime> {
  const { data } = await api.post('/ai/runtime/model', { provider, slug });
  return parseRuntime(data);
}

export async function setAiPrimaryProvider(provider: AiProviderName): Promise<AiRuntime> {
  const { data } = await api.post('/ai/runtime/primary', { provider });
  return parseRuntime(data);
}

export async function setAiFailoverProvider(provider: AiProviderName | null): Promise<AiRuntime> {
  const { data } = await api.post('/ai/runtime/failover', { provider });
  return parseRuntime(data);
}

export function getAiRuntimeErrorMessage(error: unknown): string {
  const directCode = isRecord(error) && typeof error.code === 'string' ? error.code : undefined;
  const response = isRecord(error) && isRecord(error.response) ? error.response : undefined;
  const data = response && isRecord(response.data) ? response.data : undefined;
  const code = directCode ?? (typeof data?.code === 'string' ? data.code : undefined);
  if (code === 'AI_RUNTIME_CATALOG_UNAVAILABLE' || code === 'AI_RUNTIME_DISCONNECTED') {
    return 'O catálogo de modelos está indisponível no momento. Você ainda pode consultar o histórico do chat.';
  }
  return 'Não foi possível carregar o runtime de IA. Você ainda pode consultar o histórico do chat.';
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (from `apps/web`):
- `npx tsx --test src/lib/ai-runtime.spec.ts`
- `npx tsc --noEmit`

Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/ai-runtime.ts apps/web/src/lib/ai-runtime.spec.ts
git commit -m "feat(web): per-provider runtime config library"
```

---

### Task 9: Remove runtime UI from the chat page

**Files:**
- Modify: `apps/web/src/app/(app)/ai-chat/page.tsx`

**Interfaces:**
- Consumes: nothing new; drops `AiOAuthConnectionCard`, `AiModelCombobox`, and all `ai-runtime` import usage.

- [ ] **Step 1: Write the failing check (grep assertion as a node:test)**

Append to `apps/web/src/lib/ai-runtime.spec.ts`? No — the chat page is a client component; verify statically instead. Add the verification as a code-free checklist here (no new test file; the repo has no component test runner). Assert manually:

Run (from `apps/web`):
- `rg -n "ai-runtime|AiOAuthConnectionCard|AiModelCombobox|Runtime global|runtime" "src/app/(app)/ai-chat/page.tsx"`
  Expected: no matches.

- [ ] **Step 2: Verify it currently fails**

Run the grep now. Expected: matches for `getAiRuntime`, `AiOAuthConnectionCard`, `AiModelCombobox`, and the `Runtime global` section.

- [ ] **Step 3: Edit the page**

In `apps/web/src/app/(app)/ai-chat/page.tsx`:
1. Remove imports on lines 9-10 (`AiOAuthConnectionCard`, `AiModelCombobox`) and line 22 (`getAiRuntime, getAiRuntimeErrorMessage, selectAiRuntimeModel`).
2. Remove the `runtime` `useQuery` and `selectModel` mutation blocks (lines 35-43).
3. Remove the whole `<section ... aria-labelledby="ai-runtime-title">...` block (lines 146-161) and the `<AiOAuthConnectionCard />` line (163).
4. Keep `useQueryClient` (still used by `refreshAfterAction`).

- [ ] **Step 4: Verify the check passes and typecheck**

Run (from `apps/web`):
- `rg -n "ai-runtime|AiOAuthConnectionCard|AiModelCombobox|Runtime global|runtime" "src/app/(app)/ai-chat/page.tsx"`
  Expected: no matches.
- `npx tsc --noEmit`
- `npx tsx --test src/lib/ai-chat.test.ts`
  Expected: PASS (no regressions in the chat data layer).

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(app)/ai-chat/page.tsx"
git commit -m "refactor(web): remove provider/runtime config from the chat page"
```

---

### Task 10: Admin settings UI for providers, models, and failover

**Files:**
- Modify: `apps/web/src/components/settings/AiProviderSettings.tsx`
- Modify: `apps/web/src/app/(app)/settings/ai-providers/page.tsx` (page-level admin gate already present — no change)

**Interfaces:**
- Consumes: `getAiRuntime`, `selectAiProviderModel`, `setAiPrimaryProvider`, `setAiFailoverProvider` from `@/lib/ai-runtime`; `AiOAuthConnectionCard` from `@/components/ai/AiOAuthConnectionCard`; `AiModelCombobox` from `@/components/ai/AiModelCombobox` (existing components keep their props).
- Produces: a configured admin screen with primary/failover selectors, ChatGPT card (OAuth + catalog model), Ollama card (key save/remove + fixed catalog model), and mutation invalidation of `['ai-runtime']`.

- [ ] **Step 1: Reason about the UI contract (no framework test runner exists — verify by typecheck + build)**

There is no component test framework in `apps/web`. Verification is `npx tsc --noEmit` + `npm run build --workspace=apps/web`. The screen must satisfy:

1. Loads `getAiRuntime` via `useQuery({ queryKey: ['ai-runtime'] })`.
2. Renders two `<select>` controls for `primeiro provid.` primary (ChatGPT / Ollama Cloud) and `substituto` (nenhum + the other provider), dispatching `setAiPrimaryProvider`/`setAiFailoverProvider` mutations that `setQueryData(['ai-runtime'], updated)`.
3. ChatGPT card: `AiOAuthConnectionCard` + `AiModelCombobox` (`models={providers.chatgpt.models}`, `value={providers.chatgpt.selectedModel?.slug}`, `onSelect={(slug) => selectAiProviderModel('chatgpt', slug)}`).
4. Ollama card: an API key input (password type) with Save via `PUT /settings/ai/ollama/key` through `api.put` and Remove via `DELETE /settings/ai/ollama/key` through `api.delete`, invalidating `['ai-runtime']` on success; plus `AiModelCombobox` for `ollama` models.
5. After saving/removing a key the runtime query is invalidated so `connectionStatus`/`models` refresh.
6. Error state uses `getAiRuntimeErrorMessage`.

Add `api.put`/`api.delete` helpers to `apps/web/src/lib/ai-oauth.ts`? No — call `api.put`/`api.delete` directly from the component via `@/lib/api`.

- [ ] **Step 2: Write the component**

Replace `apps/web/src/components/settings/AiProviderSettings.tsx` with the full implementation below (authored in the existing file's styling conventions). Keep the "provedores futuros" list via the existing `GET /api/settings/ai/providers` query.

```tsx
'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CircleOff, KeyRound, LockKeyhole, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { AiOAuthConnectionCard } from '@/components/ai/AiOAuthConnectionCard';
import { AiModelCombobox } from '@/components/ai/AiModelCombobox';
import {
  getAiRuntime,
  getAiRuntimeErrorMessage,
  selectAiProviderModel,
  setAiFailoverProvider,
  setAiPrimaryProvider,
  type AiProviderName,
  type AiRuntime,
} from '@/lib/ai-runtime';

interface AiProvider {
  id: string;
  name: string;
  status: 'active' | 'coming_soon';
  connectionStatus?: 'connected' | 'disconnected';
  connectable: false;
}

const PROVIDER_OPTIONS: Array<{ value: AiProviderName; label: string }> = [
  { value: 'chatgpt', label: 'ChatGPT' },
  { value: 'ollama', label: 'Ollama Cloud' },
];

export function AiProviderSettings() {
  const queryClient = useQueryClient();
  const [ollamaKey, setOllamaKey] = useState('');
  const [keyMessage, setKeyMessage] = useState<string>();

  const runtime = useQuery({ queryKey: ['ai-runtime'], queryFn: getAiRuntime });
  const providers = useQuery({
    queryKey: ['ai-provider-settings'],
    queryFn: async () => {
      const { data } = await api.get<{ providers: AiProvider[] }>('/settings/ai/providers');
      return data.providers;
    },
  });

  const applyRuntime = (updated: AiRuntime) => queryClient.setQueryData(['ai-runtime'], updated);

  const setPrimary = useMutation({ mutationFn: setAiPrimaryProvider, onSuccess: applyRuntime });
  const setFailover = useMutation({ mutationFn: setAiFailoverProvider, onSuccess: applyRuntime });
  const selectModel = useMutation({
    mutationFn: ({ provider, slug }: { provider: AiProviderName; slug: string }) => selectAiProviderModel(provider, slug),
    onSuccess: applyRuntime,
  });
  const saveKey = useMutation({
    mutationFn: async (apiKey: string) => {
      const { data } = await api.put<{ status: string }>('/settings/ai/ollama/key', { apiKey });
      return data;
    },
    onSuccess: async () => {
      setOllamaKey('');
      setKeyMessage('Chave do Ollama salva.');
      await queryClient.invalidateQueries({ queryKey: ['ai-runtime'] });
    },
    onError: () => { setKeyMessage('Não foi possível salvar a chave do Ollama.'); },
  });
  const removeKey = useMutation({
    mutationFn: async () => {
      const { data } = await api.delete<{ status: string }>('/settings/ai/ollama/key');
      return data;
    },
    onSuccess: async () => {
      setKeyMessage('Chave do Ollama removida.');
      await queryClient.invalidateQueries({ queryKey: ['ai-runtime'] });
    },
    onError: () => { setKeyMessage('Não foi possível remover a chave do Ollama.'); },
  });

  if (runtime.isLoading) return <div className="h-40 animate-pulse rounded-2xl bg-muted" />;

  return (
    <section className="space-y-4" aria-labelledby="ai-providers-title">
      <div>
        <h1 id="ai-providers-title" className="text-2xl font-bold">Provedores de IA</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure o provedor principal, um substituto automático e os modelos por provedor. A alteração vale para todos os usuários do tenant.
        </p>
      </div>

      {runtime.data && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-semibold">Failover</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="text-xs font-medium text-muted-foreground">Provedor principal</span>
              <select
                value={runtime.data.primaryProvider}
                onChange={(event) => setPrimary.mutate(event.target.value as AiProviderName)}
                disabled={setPrimary.isPending}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              >
                {PROVIDER_OPTIONS.map((provider) => <option key={provider.value} value={provider.value}>{provider.label}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-xs font-medium text-muted-foreground">Provedor substituto</span>
              <select
                value={runtime.data.failoverProvider ?? ''}
                onChange={(event) => setFailover.mutate(event.target.value || null)}
                disabled={setFailover.isPending}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">Nenhum</option>
                {PROVIDER_OPTIONS
                  .filter((provider) => provider.value !== runtime.data.primaryProvider)
                  .map((provider) => <option key={provider.value} value={provider.value}>{provider.label}</option>)}
              </select>
            </label>
          </div>
        </div>
      )}

      {runtime.data && runtime.data.primaryProvider === 'chatgpt' && (
        <AiOAuthConnectionCard />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {runtime.data && (
          <>
            <article className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">ChatGPT</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Catálogo ao vivo via conexão global.</p>
                </div>
                {runtime.data.providers.chatgpt.connectionStatus === 'connected'
                  ? <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-label="Conectado" />
                  : <CircleOff className="h-5 w-5 text-muted-foreground" aria-label="Desconectado" />}
              </div>
              {runtime.data.providers.chatgpt.models.length > 0 && (
                <div className="mt-4">
                  <AiModelCombobox
                    models={runtime.data.providers.chatgpt.models}
                    value={runtime.data.providers.chatgpt.selectedModel?.slug}
                    disabled={selectModel.isPending}
                    onSelect={(slug) => selectModel.mutate({ provider: 'chatgpt', slug })}
                  />
                </div>
              )}
            </article>

            <article className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-primary/10 p-2 text-primary"><KeyRound className="h-5 w-5" /></div>
                  <div>
                    <h2 className="font-semibold">Ollama Cloud</h2>
                    <p className="mt-1 text-sm text-muted-foreground">API key de ollama.com/settings/keys.</p>
                  </div>
                </div>
                {runtime.data.providers.ollama.connectionStatus === 'connected'
                  ? <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-label="Conectado" />
                  : <CircleOff className="h-5 w-5 text-muted-foreground" aria-label="Desconectado" />}
              </div>
              <div className="mt-4 flex items-end gap-2">
                <label className="min-w-0 flex-1 text-sm">
                  <span className="text-xs font-medium text-muted-foreground">API key</span>
                  <input
                    type="password"
                    value={ollamaKey}
                    onChange={(event) => setOllamaKey(event.target.value)}
                    placeholder={runtime.data.providers.ollama.connectionStatus === 'connected' ? 'Chave salva (digite para substituir)' : 'Cole sua API key'}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    autoComplete="new-password"
                  />
                </label>
                {runtime.data.providers.ollama.connectionStatus === 'connected' && (
                  <button
                    type="button"
                    onClick={() => removeKey.mutate()}
                    disabled={removeKey.isPending}
                    className="rounded-xl border border-border p-2.5 hover:bg-muted disabled:opacity-50"
                    aria-label="Remover chave do Ollama"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => saveKey.mutate(ollamaKey.trim())}
                  disabled={saveKey.isPending || ollamaKey.trim().length < 8}
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {saveKey.isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
              {keyMessage && <p role="status" className="mt-2 text-sm text-muted-foreground">{keyMessage}</p>}
              {runtime.data.providers.ollama.models.length > 0 && (
                <div className="mt-4">
                  <AiModelCombobox
                    models={runtime.data.providers.ollama.models}
                    value={runtime.data.providers.ollama.selectedModel?.slug}
                    disabled={selectModel.isPending}
                    onSelect={(slug) => selectModel.mutate({ provider: 'ollama', slug })}
                  />
                </div>
              )}
            </article>
          </>
        )}
      </div>

      {runtime.isError && <p role="alert" className="rounded-xl bg-red-500/10 p-4 text-sm text-red-700">{getAiRuntimeErrorMessage(runtime.error)}</p>}
      {(setPrimary.isError || setFailover.isError || selectModel.isError) && <p role="alert" className="rounded-xl bg-red-500/10 p-4 text-sm text-red-700">{getAiRuntimeErrorMessage(setPrimary.error ?? setFailover.error ?? selectModel.error)}</p>}

      {providers.data && (
        <div className="grid gap-4 md:grid-cols-2">
          {providers.data.filter((provider) => provider.status === 'coming_soon').map((provider) => (
            <article key={provider.id} className="rounded-2xl border border-border bg-card p-5 opacity-70">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{provider.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Disponível em uma próxima versão</p>
                </div>
                <LockKeyhole className="h-5 w-5 text-muted-foreground" aria-label="Em breve" />
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
```

Note: `api.put`/`api.delete` are generic helpers on the axios instance; if `apps/web/src/lib/api.ts` lacks them, cast the axios instance: call `(api as unknown as { put: typeof api['post']; delete: typeof api['delete'] })` only if the method is absent at runtime — check `apps/web/src/lib/api.ts` first and add explicit `put`/`delete` helpers there instead (axios exposes them natively on `api`).

- [ ] **Step 3: Typecheck and build**

Run (from `apps/web`):
- `npx tsc --noEmit`
- `npm run build --workspace=apps/web`

Expected: clean build, no type errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/settings/AiProviderSettings.tsx apps/web/src/lib/ai-runtime.ts apps/web/src/app/'(app)'/ai-chat/page.tsx
git commit -m "feat(web): admin provider/model/failover configuration screen"
```

---

## Self-Review Notes

- **Spec coverage:** runtime view/methods (T3), catalog (T1+T3), key save/remove (T3+T7), endpoints + `settings.edit` (T4+T7), routing (T5), flow failover + business-error exemption (T6), chat removal (T9), settings UI (T10), module wiring (T7), persistence/migration (T2).
- **Legacy migrations:** `ai-oauth.service.ts` writes updated in T3; `ai-oauth.e2e.spec.ts` column references updated there; `ai-persistence`/`ai-oauth-persistence` specs re-run in T6 as a guard. The `ai-server-runtime-persistence.spec.ts` keeps `runtimeMigration()` for the legacy singleton test and adds `providerConfigMigration()` (targeting `*_ai_provider_config`) for the new column assertions.
- **Type consistency:** the runtime view is nested everywhere — `selectedModel()` in `AiService` reads `providers.chatgpt.selectedModel`; the controller serializes `providers[provider].models`; the web lib parses the nesting. `SelectAiRuntimeModelDto` requires `provider`; `SetAiRuntimeFailoverDto` permits `null`. The `OllamaClientFactory`/`OpenAiClientFactory` names and `AI_PROVIDER_ROUTING`/`AI_OLLAMA_PROVIDER_FACTORY` tokens are referenced identically from `ai.service.ts`, `ai-provider-routing.service.ts`, and `ai.module.ts`.
- **Uncommitted work:** preserve the existing dirty tree; stage only task-listed files in commits (Global Constraints).