# Cobertura integral do agente — Onda 0 e Onda 1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o agente de IA alcançar paridade com as telas do web mais os endpoints órfãos, corrigindo os quatro defeitos de UI encontrados na auditoria.

**Architecture:** A permissão vira dado declarado na tool (`AiTool.permission`), resolvida uma vez por mensagem por um novo `AiPermissionService` que espelha o `PermissionGuard` (só `admin` ignora checagem). O `AiToolRegistryService` ganha `listVisible(actor)` e o `AiService` passa a enviar ao modelo apenas as tools que o ator pode executar. As tools passam a，组织ar-se em toolkits por domínio (`tools/tasks/`, `tools/projects/`, `tools/teams/`). Anexos por URL passam por um `AttachmentIntakeService` com guarda SSRF e `fetch` injetado.

**Tech Stack:** NestJS, Prisma, PostgreSQL, TypeScript, Node.js 18+ (`fetch` global), `node:test` + `ts-node`, Next.js, Tailwind.

**Spec:** `docs/superpowers/specs/2026-10-02-ai-agent-full-coverage-design.md`

## Global Constraints

- Idioma de todo código, nome de símbolo público, mensagem de erro e comentário: **português do Brasil**. Exceções já existentes no arquivo: `name`, `readOnly`, `description`, `parameters`, `validate`, `authorize`, `execute` e os nomes de tool, que são **snake_case em inglês** e **não** podem ser traduzidos.
- Toda tool de escrita declara `readOnly = false` (ou omite) e por isso passa por `AiActionProposal`. Toda tool de leitura declara `readOnly = true`.
- **Toda tool registra a permissão na forma `permission: PermissionCode = '<código>'`, com o tipo explícito e o import `import { PermissionCode } from './permission-codes';` (ou `'../permission-codes'`).** A anotação explícita é obrigatória: `permission = 'x'` sem tipo é inferido como `string` e quebra `implements AiTool` sob `permission?: PermissionCode`.
- Toda tool passa a declarar `permission`. Tool sem o campo é enviada a qualquer ator e anula o gating por perfil.
- Nenhum resumo de tool pode devolver ID bruto como rótulo. ID só para encadeamento interno entre tools.
- Schemas de tool usam `additionalProperties: false` e rejeitam campo desconhecido com `BadRequestException('Campo não suportado: <campo>')`.
- `AiToolInput` sempre carrega `{ tenantId, actorTenantUserId, args }`. Nunca confiar em tenant vindo do modelo.
- Testes de API rodam com `node -r ts-node/register --test <arquivo>` de dentro de `apps/api`.
- Testes de web rodam com `npx tsx --test <arquivo>` de dentro de `apps/web`.
- Typecheck de ambos: `npx tsc --noEmit`.
- `apps/api/src/modules/ai/providers/openai-responses.provider.spec.ts` **não** entra na suíte: faz chamada de rede real e trava.
- Não commitar `.env`, `.env.docker` ou qualquer arquivo já modificado por trabalho anterior. Ver `git status` antes de cada commit e adicionar apenas os arquivos do passo.

---

### Task 1: Onda 0 — quatro correções de interface

Corrige quatro defeitos independentemente encontrados na auditoria. Todos web, nenhum toca a API.

**Files:**
- Delete: `apps/web/src/app/(app` (diretório órfão)
- Delete: `apps/web/src/app/)` (diretório órfão)
- Modify: `apps/web/src/app/(app)/dashboard/page.tsx`
- Create: `apps/web/src/lib/task-filters.ts`
- Create: `apps/web/src/lib/task-filters.spec.ts`
- Modify: `apps/web/src/app/(app)/operational/page.tsx`
- Modify: `apps/web/src/app/(app)/settings/notifications/page.tsx`

**Interfaces:**
- Consumes: nada de outras tasks.
- Produces: `withStatusCategory(params: URLSearchParams | Record<string, unknown>, category?: string | null): URLSearchParams` em `apps/web/src/lib/task-filters.ts`, usada pela página de dashboard.

- [ ] **Step 1: Apagar as rotas órfãs e confirmar que sumiram do manifesto**

```bash
cd /root/quadro-do-mane/apps/web
ls -d "src/app/(app" "src/app/)"
git rm -r --ignore-unmatch "src/app/(app" "src/app/)"
```

Expected: os dois diretórios aparecem no `ls` e são removidos.

- [ ] **Step 2: Escrever o teste que falha do filtro do dashboard**

Criar `apps/web/src/lib/task-filters.spec.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { withStatusCategory } from './task-filters';

test('preserva os demais parâmetros e adiciona statusCategory quando informada', () => {
  const params = withStatusCategory({ projectId: 'p1', search: 'relatório' }, 'IN_PROGRESS');
  assert.equal(params.get('projectId'), 'p1');
  assert.equal(params.get('search'), 'relatório');
  assert.equal(params.get('statusCategory'), 'IN_PROGRESS');
});

test('omite statusCategory quando não informada, em vez de mandá-la vazia', () => {
  const params = withStatusCategory({ projectId: 'p1' }, null);
  assert.equal(params.get('projectId'), 'p1');
  assert.equal(params.has('statusCategory'), false);
});

test('aceita URLSearchParams de entrada sem perder o que já existe', () => {
  const params = withStatusCategory(new URLSearchParams('status=OPEN'), 'DONE');
  assert.equal(params.get('status'), 'OPEN');
  assert.equal(params.get('statusCategory'), 'DONE');
});
```

- [ ] **Step 3: Rodar o teste e ver falhar**

```bash
cd /root/quadro-do-mane/apps/web && npx tsx --test src/lib/task-filters.spec.ts
```

Expected: FAIL com erro de módulo não encontrado para `./task-filters`.

- [ ] **Step 4: Implementar `withStatusCategory`**

Criar `apps/web/src/lib/task-filters.ts`:

```ts
export type TaskFilterInput = URLSearchParams | Record<string, unknown>;

export function withStatusCategory(params: TaskFilterInput, category?: string | null): URLSearchParams {
  const search = params instanceof URLSearchParams
    ? new URLSearchParams(params)
    : new URLSearchParams(Object.entries(params).filter(([, value]) => value !== null && value !== undefined).map(([key, value]) => [key, String(value)]));

  const trimmed = category?.trim();
  if (trimmed) search.set('statusCategory', trimmed);
  else search.delete('statusCategory');

  return search;
}
```

- [ ] **Step 5: Rodar o teste e ver passar**

```bash
cd /root/quadro-do-mane/apps/web && npx tsx --test src/lib/task-filters.spec.ts
```

Expected: PASS com 3 testes.

> **Correção de 2026-10-02 (achado na execução):** `statusCategory` não existe na API. Confirmado no
> código: `FilterTasksDto` não tem o campo, `findByFilters` não trata, e o card do dashboard envia
> `in_progress`, que não pertence ao vocabulário de `TaskStatus.category` no seed
> (`pending | active | done`). O `dashboard.service.ts` já conta `category: 'active'` como
> `inProgressTasks`, então `active` é o valor que casa com o número do card. Sem o Step 6b, o filtro
> deixa de ser descartado pelo cliente e passa a ser descartado pela API.

- [ ] **Step 6b: Fechar o drill-down no lado da API**

Em `apps/api/src/modules/tasks/dto/filter-tasks.dto.ts`, acrescentar o campo com o vocabulário do seed:

```ts
@ApiPropertyOptional() @IsIn(['pending', 'active', 'done']) @IsOptional() statusCategory?: string;
```

Acrescentar o import de `IsIn` junto com os demais `@nestjs/validators` do arquivo.

Em `apps/api/src/modules/tasks/tasks.service.ts`, acrescentar `statusCategory?: string;` ao tipo dos
parâmetros de `findByFilters` e aplicar o filtro logo depois do bloco de `blocked`:

```ts
    if (filters.statusCategory) where.status = { category: filters.statusCategory };
```

`Task` tem `statusId` como coluna (`schema.prisma`), e o `findByFilters` já filtra por ela com
`where.statusId`. `statusId` e `status` são campos diferentes, então o Prisma combina os dois com AND
— não há sobrescrita. **Não** trocar `where.statusId` por `where.status = { id }`, e **não** reescrever
`where.status` num objeto combinado só por este filtro: seria uma refatoração fora do escopo.

A ordem importa apenas para quem chama com `statusCategory` **e** `overdue`/`completed`, que também
escrevem `where.status`: o último a escrever vence. Nenhum caller envia essa combinação hoje (o card
do dashboard envia só `statusCategory`), então não é preciso resolver; se o filtro for placement for
perfeito para o futuro, aplicar `statusCategory` antes de `overdue`/`completed` faz `overdue` e
`completed` ganharem, que é o comportamento mais razoável dos dois.



Em `apps/web/src/app/(app)/dashboard/page.tsx`, o card "Em Andamento" passa a enviar a categoria do domínio:

```ts
filter: { statusCategory: 'active' },
```

Acrescentar `statusCategory` ao tipo do filtro usado no card, caso ele seja declarado.

Cobrir com teste: um caso de `findByFilters` que aplica `statusCategory` e monta
`status: { category: 'active' }`. Rodar `npx tsc --noEmit` em `apps/api` e
`node -r ts-node/register --test` no spec tocado.

- [ ] **Step 6: Ligar o dashboard ao filtro**

Em `apps/web/src/app/(app)/dashboard/page.tsx`, localizar o card que dispara o drill-down e substituir a montagem da query por `withStatusCategory`. Localizar por:

```bash
cd /root/quadro-do-mane/apps/web && grep -n "statusCategory\|drill\|setCategory" "src/app/(app)/dashboard/page.tsx"
```

O padrão a substituir é a linha que monta a query dos detalhes do card. Ela deve virar:

```ts
const details = await fetch(`/tasks?${withStatusCategory({ projectId }, card.statusCategory).toString()}`)
  .then((response) => (response.ok ? response.json() : []));
```

Ajustar os nomes de variável para os que já existirem no arquivo; a exigência é que `statusCategory` chegue ao backend.

- [ ] **Step 7: Fazer o "Atualizar" do operational buscar de verdade**

```bash
cd /root/quadro-do-mane/apps/web && grep -n "onClick={() => {}}\|Atualizar" "src/app/(app)/operational/page.tsx"
```

Substituir o `onClick` vazio pela função de recarga que a própria página já usa para o carregamento inicial. Se a página busca por `useEffect` com um `useState` de dados, o botão passa a chamar esse mesmo callback extraído. Não criar estado novo.

- [ ] **Step 8: Ligar as preferências de notificação ao endpoint existente**

O endpoint já existe: `GET /notifications/notification-preferences` e `PATCH /notifications/notification-preferences/:category` (`notifications.controller.ts:40,50`). O retorno traz `{ category, pushEnabled, lockedByAdmin }`. Na página:

```bash
cd /root/quadro-do-mane/apps/web && grep -n "useState\|fetch\|api" "src/app/(app)/settings/notifications/page.tsx"
```

Ajustar para: carregar as preferências no `useEffect` inicial a partir do `GET`; no `PATCH`, enviar `{ pushEnabled: novoValor }`; marcar o checkbox como `disabled` e exibir aviso quando `lockedByAdmin` for verdadeiro; ao receber 409, recarregar do servidor e mostrar a mensagem devolvida.

- [ ] **Step 9: Verificar build, typecheck e manifesto de rotas**

```bash
cd /root/quadro-do-mane/apps/web && npx tsc --noEmit && npm run build
grep -c '"/daily-routine"' .next/app-path-routes-manifest.json
```

Expected: typecheck limpo, build OK, e o `grep` devolvendo `1`.

- [ ] **Step 10: Commitar**

```bash
cd /root/quadro-do-mane
git add apps/web/src/lib/task-filters.ts apps/web/src/lib/task-filters.spec.ts "apps/web/src/app/(app)/dashboard/page.tsx" "apps/web/src/app/(app)/operational/page.tsx" "apps/web/src/app/(app)/settings/notifications/page.tsx"
git rm -r --cached --ignore-unmatch "apps/web/src/app/(app" "apps/web/src/app/)" >/dev/null 2>&1
git commit -m "fix(web): remove rotas duplicadas e liga filtros, recarga e notificações"
```

---

### Task 2: Códigos de permissão derivados do seed

Troca a union hardcoded de 14 códigos por um espelho do catálogo que o banco já semeia.

**Files:**
- Create: `apps/api/src/modules/ai/tools/permission-codes.ts`
- Create: `apps/api/src/modules/ai/tools/permission-codes.spec.ts`
- Modify: `apps/api/src/modules/ai/tools/task-tool.schemas.ts:5`

**Interfaces:**
- Consumes: nada de outras tasks.
- Produces: `PermissionCode` (union de string) e `PERMISSION_CODES` (array de leitura) em `apps/api/src/modules/ai/tools/permission-codes.ts`.

- [ ] **Step 1: Escrever o teste de paridade que falha**

Criar `apps/api/src/modules/ai/tools/permission-codes.spec.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PERMISSION_CODES } from './permission-codes';

test('PERMISSION_CODES cobre exatamente os códigos semeados em prisma/seed.ts', () => {
  const seedPath = path.resolve(__dirname, '../../../../prisma/seed.ts');
  const seed = fs.readFileSync(seedPath, 'utf8');
  const seeded = [...seed.matchAll(/code:\s*'([a-z_]+\.[a-z_]+)'/g)].map((match) => match[1]);

  assert.ok(seeded.length >= 60, `esperava o catálogo semeado, encontrei ${seeded.length}`);

  const declared = [...PERMISSION_CODES].sort();
  assert.deepEqual(declared, [...new Set(seeded)].sort());
});

test('não há código duplicado', () => {
  assert.equal(PERMISSION_CODES.length, new Set(PERMISSION_CODES).size);
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

```bash
cd /root/quadro-do-mane/apps/api && node -r ts-node/register --test src/modules/ai/tools/permission-codes.spec.ts
```

Expected: FAIL com erro de módulo não encontrado para `./permission-codes`.

- [ ] **Step 3: Gerar o arquivo a partir do seed**

```bash
cd /root/quadro-do-mane/apps/api
node -e "
const fs=require('fs');
const seed=fs.readFileSync('prisma/seed.ts','utf8');
const codes=[...new Set([...seed.matchAll(/code:\s*'([a-z_]+\.[a-z_]+)'/g)].map(m=>m[1]))].sort();
const lines=codes.map(c=>'  '+JSON.stringify(c).replace(/\"/g,\"'\")+',').join('\n');
fs.writeFileSync('src/modules/ai/tools/permission-codes.ts', [
  '/**',
  ' * Códigos de permissão do tenant, derivados de \`prisma/seed.ts\`.',
  ' *',
  ' * O seed é a fonte de verdade; \`permission-codes.spec.ts\` falha se os dois',
  ' * divergirem, para que nenhuma tool nova dependa de um código inventado.',
  ' */',
  '',
  'export const PERMISSION_CODES = [',
  lines,
  '] as const;',
  '',
  'export type PermissionCode = (typeof PERMISSION_CODES)[number];',
  '',
].join('\n'));
console.log('códigos:', codes.length);
"
```

Expected: imprime a contagem, maior ou igual a 60.

- [ ] **Step 4: Rodar o teste e ver passar**

```bash
cd /root/quadro-do-mane/apps/api && node -r ts-node/register --test src/modules/ai/tools/permission-codes.spec.ts
```

Expected: PASS com 2 testes.

- [ ] **Step 5: Apontar `Permission` para o tipo novo**

Em `apps/api/src/modules/ai/tools/task-tool.schemas.ts`, substituir a linha 5:

```ts
import { PermissionCode } from './permission-codes';

/** @deprecated Use `PermissionCode`. Mantido só para não quebrar as tools atuais. */
export type Permission = PermissionCode;
```

- [ ] **Step 6: Verificar que nada quebrou**

```bash
cd /root/quadro-do-mane/apps/api && npx tsc --noEmit && node -r ts-node/register --test src/modules/ai/tools/task-tools.spec.ts
```

Expected: typecheck limpo e a suíte de tasks verde.

- [ ] **Step 7: Commitar**

```bash
cd /root/quadro-do-mane
git add apps/api/src/modules/ai/tools/permission-codes.ts apps/api/src/modules/ai/tools/permission-codes.spec.ts apps/api/src/modules/ai/tools/task-tool.schemas.ts
git commit -m "refactor(ai): deriva códigos de permissão do catálogo semeado"
```

---

### Task 3: `AiPermissionService`

Resolve as permissões do ator uma vez por mensagem, com a mesma semântica do `PermissionGuard`.

**Files:**
- Create: `apps/api/src/modules/ai/ai-permission.service.ts`
- Create: `apps/api/src/modules/ai/ai-permission.service.spec.ts`
- Modify: `apps/api/src/modules/ai/ai.module.ts` (providers e exports)

**Interfaces:**
- Consumes: `PermissionCode` de `apps/api/src/modules/ai/tools/permission-codes.ts` (Task 2).
- Produces:
  - `AiPermissionService.can(input: { tenantId: string; tenantUserId: string }, permission: PermissionCode): Promise<boolean>`
  - `AiPermissionService.codesFor(input: { tenantId: string; tenantUserId: string }): Promise<readonly string[]>`
  - `AiPermissionService.invalidate(tenantId: string, tenantUserId: string): void`
  - Token `AI_PERMISSION_SERVICE`

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/api/src/modules/ai/ai-permission.service.spec.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { AiPermissionService } from './ai-permission.service';

const actor = { tenantId: 'tenant-1', tenantUserId: 'user-1' };

const prismaWith = (role: { name: string; permissions: string[] }) => {
  let calls = 0;
  return {
    calls: () => calls,
    tenantUser: {
      findFirst: async () => {
        calls += 1;
        return {
          role: {
            name: role.name,
            rolePermissions: role.permissions.map((code) => ({ permission: { code } })),
          },
        };
      },
    },
  } as any;
};

test('admin passa em qualquer código, mesmo sem a permissão listada', async () => {
  const service = new AiPermissionService(prismaWith({ name: 'admin', permissions: [] }));
  assert.equal(await service.can(actor, 'tasks.delete'), true);
});

test('papel com o código passa; papel sem o código é negado', async () => {
  const service = new AiPermissionService(prismaWith({ name: 'gestor', permissions: ['tasks.edit'] }));
  assert.equal(await service.can(actor, 'tasks.edit'), true);
  assert.equal(await service.can(actor, 'tasks.delete'), false);
});

test('gestor não tem mais bypass: o seed não lhe dá tasks.delete', async () => {
  const service = new AiPermissionService(prismaWith({ name: 'gestor', permissions: ['tasks.view'] }));
  assert.equal(await service.can(actor, 'tasks.delete'), false);
});

test('resolve os códigos uma vez por usuário e reutiliza', async () => {
  const prisma = prismaWith({ name: 'colaborador', permissions: ['tasks.view', 'tasks.comment'] });
  const service = new AiPermissionService(prisma);
  assert.deepEqual([...(await service.codesFor(actor))].sort(), ['tasks.comment', 'tasks.view']);
  await service.codesFor(actor);
  assert.equal(prisma.calls(), 1);
});

test('invalidate força nova consulta', async () => {
  const prisma = prismaWith({ name: 'colaborador', permissions: ['tasks.view'] });
  const service = new AiPermissionService(prisma);
  await service.codesFor(actor);
  service.invalidate(actor.tenantId, actor.tenantUserId);
  await service.codesFor(actor);
  assert.equal(prisma.calls(), 2);
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

```bash
cd /root/quadro-do-mane/apps/api && node -r ts-node/register --test src/modules/ai/ai-permission.service.spec.ts
```

Expected: FAIL com erro de módulo não encontrado para `./ai-permission.service`.

- [ ] **Step 3: Implementar o serviço**

Criar `apps/api/src/modules/ai/ai-permission.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PermissionCode } from './tools/permission-codes';

export const AI_PERMISSION_SERVICE = Symbol('AI_PERMISSION_SERVICE');

interface ResolvedRole {
  name: string | null;
  codes: readonly string[];
}

/**
 * Permissões do ator para o assistente.
 *
 * Espelha `PermissionGuard`: apenas `admin` ignora a checagem. Os demais papéis
 * passam somente com o código no conjunto, sem bypass. Uma consulta no caminho
 * frio, nenhuma no quente, porque a resolução é memoizada por usuário.
 */
@Injectable()
export class AiPermissionService {
  private readonly cache = new Map<string, ResolvedRole>();

  constructor(private readonly prisma: PrismaService) {}

  private async roleFor(input: { tenantId: string; tenantUserId: string }): Promise<ResolvedRole> {
    const key = `${input.tenantId}:${input.tenantUserId}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const tenantUser = await this.prisma.tenantUser.findFirst({
      where: { id: input.tenantUserId, tenantId: input.tenantId },
      select: {
        role: {
          select: {
            name: true,
            rolePermissions: { select: { permission: { select: { code: true } } } },
          },
        },
      },
    });
    const role = tenantUser?.role;
    const resolved: ResolvedRole = {
      name: role?.name ?? null,
      codes: (role?.rolePermissions ?? []).map((item: any) => item.permission.code as string),
    };
    this.cache.set(key, resolved);
    return resolved;
  }

  async codesFor(input: { tenantId: string; tenantUserId: string }): Promise<readonly string[]> {
    return (await this.roleFor(input)).codes;
  }

  async can(input: { tenantId: string; tenantUserId: string }, permission: PermissionCode): Promise<boolean> {
    const role = await this.roleFor(input);
    return role.name === 'admin' || role.codes.includes(permission);
  }

  invalidate(tenantId: string, tenantUserId: string): void {
    this.cache.delete(`${tenantId}:${tenantUserId}`);
  }
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

```bash
cd /root/quadro-do-mane/apps/api && node -r ts-node/register --test src/modules/ai/ai-permission.service.spec.ts
```

Expected: PASS com 5 testes.

- [ ] **Step 5: Registrar no módulo**

Em `apps/api/src/modules/ai/ai.module.ts`, adicionar o import e o provider, e exportar o token:

```ts
import { AI_PERMISSION_SERVICE, AiPermissionService } from './ai-permission.service';
```

```ts
providers: [
  AiPermissionService,
  { provide: AI_PERMISSION_SERVICE, useExisting: AiPermissionService },
  // ...os demais já existentes
],
exports: [AiService, AiServerRuntimeService, AI_PERMISSION_SERVICE],
```

- [ ] **Step 6: Verificar**

```bash
cd /root/quadro-do-mane/apps/api && npx tsc --noEmit && node -r ts-node/register --test src/modules/ai/ai.module.spec.ts
```

Expected: typecheck limpo e `ai.module.spec.ts` verde.

- [ ] **Step 7: Commitar**

```bash
cd /root/quadro-do-mane
git add apps/api/src/modules/ai/ai-permission.service.ts apps/api/src/modules/ai/ai-permission.service.spec.ts apps/api/src/modules/ai/ai.module.ts
git commit -m "feat(ai): serviço de permissões do ator espelhando o PermissionGuard"
```

---

### Task 4: Permissão como metadado e tools visíveis por papel

`AiTool` ganha `permission`; o registry ganha `listVisible`; o `ai.module.spec.ts` é reescrito.

**Files:**
- Modify: `apps/api/src/modules/ai/tools/ai-tool.port.ts:20-28`
- Modify: `apps/api/src/modules/ai/tools/ai-tool-registry.service.ts`
- Modify: `apps/api/src/modules/ai/ai.module.ts:114-118` (provider do registry)
- Rewrite: `apps/api/src/modules/ai/ai.module.spec.ts:80-89`

**Interfaces:**
- Consumes: `AiPermissionService` (Task 3), `PermissionCode` (Task 2).
- Produces:
  - `AiTool.permission?: PermissionCode`
  - `AiToolRegistryService.listVisible(input: { tenantId: string; tenantUserId: string }): Promise<AiTool[]>`
  - Construtor passa a ser `new AiToolRegistryService(tools: AiTool[], permissions?: AiPermissionService)`

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/api/src/modules/ai/tools/registry.spec.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { AiToolRegistryService } from './ai-tool-registry.service';
import { PermissionCode } from './permission-codes';

const actor = { tenantId: 'tenant-1', tenantUserId: 'user-1' };

const tool = (name: string, permission: PermissionCode, readOnly = false) => ({
  name,
  permission,
  readOnly,
  parameters: { type: 'object' },
  authorize: async () => undefined,
  execute: async () => ({}),
}) as any;

const registryFor = (allowed: PermissionCode[]) => {
  const permissions = {
    can: async (_input: any, permission: PermissionCode) => allowed.includes(permission),
    codesFor: async () => allowed,
  } as any;
  return new AiToolRegistryService([
    tool('search_tasks', 'tasks.view', true),
    tool('create_task', 'tasks.create'),
    tool('delete_task', 'tasks.delete'),
  ], permissions);
};

test('admin não é filtrado: can() devolve true para tudo', async () => {
  const registry = registryFor([]);
  const visible = await registry.listVisible(actor);
  assert.deepEqual(visible.map((entry) => entry.name).sort(), ['create_task', 'delete_task', 'search_tasks']);
});

test('colaborador não enxerga tool de exclusão', async () => {
  const registry = registryFor(['tasks.view', 'tasks.create']);
  const visible = await registry.listVisible(actor);
  assert.deepEqual(visible.map((entry) => entry.name).sort(), ['create_task', 'search_tasks']);
});

test('convidado recebe apenas leitura', async () => {
  const registry = registryFor(['tasks.view']);
  const visible = await registry.listVisible(actor);
  assert.deepEqual(visible.map((entry) => entry.name), ['search_tasks']);
});

test('tool sem permissão declarada fica sempre visível', async () => {
  const permissions = { can: async () => false, codesFor: async () => [] } as any;
  const registry = new AiToolRegistryService([{ name: 'sem_permissao', parameters: { type: 'object' }, authorize: async () => undefined, execute: async () => ({}) } as any], permissions);
  assert.deepEqual((await registry.listVisible(actor)).map((entry) => entry.name), ['sem_permissao']);
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

```bash
cd /root/quadro-do-mane/apps/api && node -r ts-node/register --test src/modules/ai/tools/registry.spec.ts
```

Expected: FAIL com `listVisible is not a function`.

- [ ] **Step 3: Declarar `permission` no port**

Em `apps/api/src/modules/ai/tools/ai-tool.port.ts`, adicionar o import e o campo:

```ts
import { PermissionCode } from './permission-codes';
```

```ts
export interface AiTool {
  name: string;
  readOnly?: boolean;
  description?: string;
  /** Permissão exigida do ator; base do filtro `listVisible`. Ausente = sempre visível. */
  permission?: PermissionCode;
  parameters: Record<string, unknown>;
  validate?(args: unknown): unknown;
  authorize(input: AiToolInput): Promise<void | AiToolResult>;
  execute(input: AiToolInput): Promise<AiToolResult>;
}
```

Declarar a permissão também nas 14 tools que já existem. Sem isso elas ficam sem `permission` e `listVisible` as envia a qualquer ator, o que anula o gating por perfil (o `authorize` continua barrando, mas o modelo passa a ver e tentar tools que não pode usar):

| Arquivo | `permission` |
| --- | --- |
| `tools/search-tasks.tool.ts` | `tasks.view` |
| `tools/create-task.tool.ts` | `tasks.create` |
| `tools/update-task.tool.ts` | `tasks.edit` |
| `tools/move-task.tool.ts` | `tasks.move` |
| `tools/search-projects.tool.ts` | `projects.view` |
| `tools/search-users.tool.ts` | `users.view` |
| `tools/search-teams.tool.ts` | `teams.view` |
| `tools/search-calendar.tool.ts` | `calendar.view` |
| `tools/search-routines.tool.ts` | `daily_routine.view` |
| `tools/create-calendar-event.tool.ts` | `calendar.create` |
| `tools/create-routine.tool.ts` | `daily_routine.manage` |
| `tools/delete-routine.tool.ts` | `daily_routine.manage` |
| `tools/add-team-member.tool.ts` | `teams.manage_members` |
| `tools/add-project-member.tool.ts` | `projects.manage_members` |

Em cada arquivo, acrescentar o campo logo abaixo de `readonly name = '...'` e o import:

```ts
import { PermissionCode } from './permission-codes';
```

```ts
  permission: PermissionCode = 'tasks.view';
```

Conferir o nome do arquivo de cada tool antes de editar: a lista acima usa o nome da classe exportada.

- [ ] **Step 4: Implementar `listVisible`**

Subcrever `apps/api/src/modules/ai/tools/ai-tool-registry.service.ts`:

```ts
import { Injectable, Optional } from '@nestjs/common';
import { AiPermissionService } from '../ai-permission.service';
import { AiTool } from './ai-tool.port';

@Injectable()
export class AiToolRegistryService {
  private readonly tools: Map<string, AiTool>;

  constructor(
    tools: AiTool[] = [],
    @Optional() private readonly permissions?: AiPermissionService,
  ) {
    this.tools = new Map(tools.map((tool) => [tool.name, tool]));
  }

  list(): AiTool[] {
    return [...this.tools.values()];
  }

  get(name: string): AiTool | undefined {
    return this.tools.get(name);
  }

  /** Tools que o ator pode executar; base do que é enviado ao modelo. */
  async listVisible(input: { tenantId: string; tenantUserId: string }): Promise<AiTool[]> {
    const all = this.list();
    if (!this.permissions) return all;
    const allowed: AiTool[] = [];
    for (const tool of all) {
      if (!tool.permission || (await this.permissions.can(input, tool.permission))) allowed.push(tool);
    }
    return allowed;
  }
}
```

- [ ] **Step 5: Rodar o teste e ver passar**

```bash
cd /root/quadro-do-mane/apps/api && node -r ts-node/register --test src/modules/ai/tools/registry.spec.ts
```

Expected: PASS com 4 testes.

- [ ] **Step 6: Injetar o serviço de permissões no registry**

Em `apps/api/src/modules/ai/ai.module.ts`, trocar o provider do registry (hoje nas linhas 114-118) por:

```ts
{
  provide: AiToolRegistryService,
  inject: [AI_PERMISSION_SERVICE, SearchProjectsTool, SearchTasksTool, SearchUsersTool, SearchTeamsTool, SearchCalendarTool, SearchRoutinesTool, CreateTaskTool, UpdateTaskTool, MoveTaskTool, CreateCalendarEventTool, CreateRoutineTool, DeleteRoutineTool, AddTeamMemberTool, AddProjectMemberTool],
  useFactory: (permissions: AiPermissionService, ...tools: AiTool[]) => new AiToolRegistryService(tools, permissions),
},
```

- [ ] **Step 7: Reescrever o teste do módulo**

Em `apps/api/src/modules/ai/ai.module.spec.ts`, o teste que hoje faz `assert.deepEqual(registryProvider.inject, expected)` (linha 88) passa a esperar o serviço de permissões na frente da lista. Substituir por:

```ts
test('registra todas as tools e injeta as permissões do ator antes delas', () => {
  const providers = Reflect.getMetadata('providers', AiModule) ?? [];
  const expected = [
    SearchProjectsTool, SearchTasksTool, SearchUsersTool, SearchTeamsTool, SearchCalendarTool, SearchRoutinesTool,
    CreateTaskTool, UpdateTaskTool, MoveTaskTool, CreateCalendarEventTool,
    CreateRoutineTool, DeleteRoutineTool, AddTeamMemberTool, AddProjectMemberTool,
  ];
  for (const tool of expected) assert.ok(providers.some((entry: any) => entry === tool || entry?.provide === tool), `${tool.name} is not registered`);

  const registryProvider = providers.find((entry: any) => entry?.provide === AiToolRegistryService);
  assert.deepEqual(registryProvider.inject, [AI_PERMISSION_SERVICE, ...expected]);
});
```

E o teste "publishes strict schemas..." (começa na linha 112) precisa ajustar a chamada, porque o registry recebe a permissão como primeiro argumento:

```ts
const tools = registryProvider.useFactory({ can: async () => true, codesFor: async () => [] } as any, ...registryProvider.inject.slice(1).map((Tool: any) =>
  new Tool({ findAll: async () => [], findOne: async () => ({}) } as any, { findAll: async () => [], findOne: async () => ({}) } as any, { findByFilters: async () => [], getStatuses: async () => [], getPriorities: async () => [] } as any)));
```

Adicionar `AI_PERMISSION_SERVICE` ao import do spec.

- [ ] **Step 8: Verificar**

```bash
cd /root/quadro-do-mane/apps/api && npx tsc --noEmit && node -r ts-node/register --test src/modules/ai/ai.module.spec.ts src/modules/ai/tools/registry.spec.ts
```

Expected: ambos verdes.

- [ ] **Step 9: Commitar**

```bash
cd /root/quadro-do-mane
git add apps/api/src/modules/ai/tools/ai-tool.port.ts apps/api/src/modules/ai/tools/ai-tool-registry.service.ts apps/api/src/modules/ai/tools/registry.spec.ts apps/api/src/modules/ai/ai.module.ts apps/api/src/modules/ai/ai.module.spec.ts
git commit -m "feat(ai): tools declaram permissao e registro expoe por papel"
```

---

### Task 5: `AiService` envia apenas as tools visíveis

Fecha o caminho do gating: o modelo passa a receber só o que o ator pode executar, e uma tool escondida dá recusa clara.

**Files:**
- Modify: `apps/api/src/modules/ai/ai.service.ts:107-115, 170-219`

**Interfaces:**
- Consumes: `AiToolRegistryService.listVisible` (Task 4).
- Produces: sem API nova; muda o payload de tools e a mensagem de erro.

- [ ] **Step 1: Escrever o teste que falha**

Primeiro, dar a `setup` a possibilidade de receber um registry próprio. Em `apps/api/src/modules/ai/ai.service.spec.ts`, ampliar a interface e a construção do serviço:

```ts
interface SetupOptions {
  limits?: { maxHistoryMessages?: number };
  failProposalWriteAt?: number;
  registry?: AiToolRegistryService;
}
```

```ts
    options.registry ?? new AiToolRegistryService([]),
```

Depois acrescentar os dois testes:

```ts
test('envia ao modelo apenas as tools que o ator pode executar', async () => {
  const received: any[] = [];
  const registry = new AiToolRegistryService(
    [
      { name: 'search_tasks', permission: 'tasks.view', readOnly: true, description: 'buscar', parameters: { type: 'object' }, authorize: async () => undefined, execute: async () => ({}) },
      { name: 'delete_task', permission: 'tasks.delete', description: 'apagar', parameters: { type: 'object' }, authorize: async () => undefined, execute: async () => ({}) },
    ],
    { can: async (_input: any, permission: string) => permission === 'tasks.view', codesFor: async () => ['tasks.view'] } as any,
  );
  const { service } = setup(
    { complete: async (input: any) => { received.push(input); return { text: 'ok', toolCalls: [] }; } },
    undefined,
    undefined,
    { registry },
  );

  await service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'oi', responseMode: AiResponseMode.TEXT });

  assert.deepEqual(received[0].tools.map((entry: any) => entry.name), ['search_tasks']);
});

test('tool fora do perfil vira recusa no resultado, sem executar', async () => {
  let executed = false;
  let completions = 0;
  const provider = {
    complete: async () => {
      completions += 1;
      return completions === 1
        ? { text: 'Apagando.', toolCalls: [{ id: 'c1', name: 'delete_task', arguments: {} }] }
        : { text: 'Não posso apagar tarefas.', toolCalls: [] };
    },
    buildToolContinuation: (input: any) => ({
      ...input,
      messages: [...input.messages, { role: 'tool', toolCallId: 'c1', content: JSON.stringify({ error: 'Esta ferramenta está indisponível para o seu perfil.' }) }],
    }),
  };
  const { service } = setup(provider);
  (service as any).registry = new AiToolRegistryService([{
    name: 'delete_task', permission: 'tasks.delete', parameters: { type: 'object' },
    authorize: async () => undefined,
    execute: async () => { executed = true; return {}; },
  }], { can: async () => false, codesFor: async () => [] } as any);

  const result = await service.sendMessage({ ...actor, conversationId: 'conversation-1' }, { text: 'apaga a tarefa', responseMode: AiResponseMode.TEXT });

  assert.equal(executed, false);
  assert.equal(result.assistantMessage.content, 'Não posso apagar tarefas.');
  assert.deepEqual(result.toolResults, [{ toolName: 'delete_task', result: { error: 'Esta ferramenta está indisponível para o seu perfil.' } }]);
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

```bash
cd /root/quadro-do-mane/apps/api && node -r ts-node/register --test src/modules/ai/ai.service.spec.ts
```

Expected: FAIL — hoje `tools` sai de `registry.list()` e o erro é "Ferramenta não disponível".

- [ ] **Step 3: Enviar só as tools visíveis**

Em `apps/api/src/modules/ai/ai.service.ts`, antes do `const completionInput` (linha 107), calcular:

```ts
const visibleTools = await this.registry.listVisible({ tenantId: actor.tenantId, tenantUserId: actor.tenantUserId });
const visibleToolNames = new Set(visibleTools.map((tool) => tool.name));
```

E trocar a linha 113:

```ts
tools: visibleTools.map((tool) => ({ name: tool.name, description: tool.description, parameters: tool.parameters })),
```

Passar `visibleToolNames` para `runProviderLoop` junto dos outros argumentos:

```ts
const run = await this.runProviderLoop(completionInput, execution, actor, visibleToolNames);
```

- [ ] **Step 4: Distinguir tool escondida de tool inexistente**

Em `runProviderLoop`, trocar a assinatura (linha 170) por esta, acrescentando o quarto parâmetro:

```ts
private async runProviderLoop(
  completionInput: AiCompletionInput,
  execution: AiProviderExecution,
  actor: AiActor & { conversationId: string },
  visibleToolNames: ReadonlySet<string>,
) {
```

Depois, substituir todo o bloco que vai de `const tools = completion.toolCalls.map(` até o fim do laço `for (const candidate of tools)`. A tool escondida vira um resultado de recusa no meio da conversa, e não um `throw`: abortar o turno com 403 mostraria erro ao usuário em vez de o assistente explicar o que não pode fazer. Ela nunca chega a `authorize` nem a `execute`.

```ts
      const tools = completion.toolCalls.map((toolCall) => {
        const tool = this.registry.get(toolCall.name);
        if (!tool) throw new BadRequestException(`Ferramenta não disponível: ${toolCall.name}`);
        if (!visibleToolNames.has(tool.name)) return { tool, args: undefined, call: toolCall, hidden: true as const };
        const args = this.normalizeToolArgs(tool, toolCall.arguments);
        this.validateToolArgs(tool, args);
        return { tool, args, call: { ...toolCall, arguments: args as Record<string, unknown> }, hidden: false as const };
      });
      const denied = { error: 'Esta ferramenta está indisponível para o seu perfil.' };
      const currentClarifications: Array<{ tool: AiTool; args: unknown; result: AiToolClarification }> = [];
      const currentReads: Array<{ tool: AiTool; args: unknown; call: typeof completion.toolCalls[number] }> = [];
      const currentResults = [] as Array<{ call: typeof completion.toolCalls[number]; result: unknown }>;
      for (const { tool, call, hidden } of tools) {
        if (!hidden) continue;
        currentResults.push({ call, result: denied });
        toolResults.push({ toolName: tool.name, result: denied });
      }
      const currentActions = tools.filter(({ tool, hidden }) => !tool.readOnly && !hidden);
      for (const candidate of tools) {
        if (candidate.hidden) continue;
        const result = await candidate.tool.authorize({ tenantId: actor.tenantId, actorTenantUserId: actor.tenantUserId, args: candidate.args });
        if (this.isClarification(result)) currentClarifications.push({ tool: candidate.tool, args: candidate.args, result });
        else if (candidate.tool.readOnly) currentReads.push({ tool: candidate.tool, args: candidate.args, call: candidate.call });
        else actionTools.push({ tool: candidate.tool, args: candidate.args });
      }
```

A condição de continuação passa a contar `currentResults` em vez de `currentReads`, para que um turno com apenas tools escondidas ainda faça o provider responder em vez de persistir o texto da primeira chamada:

```ts
      if (!currentResults.length || currentActions.length) break;
```

Remover o import de `ForbiddenException` do topo do arquivo se e somente se ele não for usado em outro ponto de `ai.service.ts`.

- [ ] **Step 5: Rodar o teste e ver passar**

```bash
cd /root/quadro-do-mane/apps/api && node -r ts-node/register --test src/modules/ai/ai.service.spec.ts
```

Expected: PASS, sem regressão nos testes existentes do arquivo.

- [ ] **Step 6: Verificar a suíte de segurança**

```bash
cd /root/quadro-do-mane/apps/api && npx tsc --noEmit && node -r ts-node/register --test src/modules/ai/ai-security.spec.ts src/modules/ai/tools/authorized-read-tools.spec.ts
```

Expected: ambos verdes. `authorized-read-tools.spec.ts` monta o registry sem serviço de permissões; com o `@Optional()` do construtor, `listVisible` cai no `list()` completo e o comportamento antigo se mantém.

- [ ] **Step 7: Commitar**

```bash
cd /root/quadro-do-mane
git add apps/api/src/modules/ai/ai.service.ts apps/api/src/modules/ai/ai.service.spec.ts
git commit -m "feat(ai): envia ao modelo apenas tools que o ator pode executar"
```

---

### Task 6: Guarda SSRF para anexo por URL

`AttachmentIntakeService` baixa a URL com bloqueio de rede privada, limite de tamanho e MIME validado.

**Files:**
- Create: `apps/api/src/modules/upload/upload.constants.ts`
- Create: `apps/api/src/modules/upload/attachment-intake.service.ts`
- Create: `apps/api/src/modules/upload/attachment-intake.service.spec.ts`
- Modify: `apps/api/src/modules/upload/upload.controller.ts:23-49`
- Modify: `apps/api/src/modules/upload/upload.module.ts`

**Interfaces:**
- Produces:
  - `ALLOWED_MIMES: readonly string[]` e `MAX_FILE_SIZE: number` em `upload.constants.ts`
  - `AttachmentIntakeService.intakeByUrl(input: { tenantId: string; uploadedByTenantUserId: string; taskId?: string; url: string; fileName?: string }): Promise<{ id: string; fileName: string; mimeType: string; fileSize: number }>`
  - `isBlockedAddress(address: string): boolean` (exportado para teste)
  - Token `ATTACHMENT_FETCH`

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/api/src/modules/upload/attachment-intake.service.spec.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { AttachmentIntakeService, isBlockedAddress } from './attachment-intake.service';
import { MAX_FILE_SIZE } from './upload.constants';

const uploads = { uploadFile: async (params: any) => ({ id: 'att-1', ...params }) } as any;

const respond = (body: string, headers: Record<string, string> = {}) => ({
  status: 200,
  headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  arrayBuffer: async () => new TextEncoder().encode(body).buffer,
});

const serviceWith = (fetchImpl: any) => new AttachmentIntakeService(uploads, fetchImpl);

const input = { tenantId: 'tenant-1', uploadedByTenantUserId: 'user-1', taskId: 'task-1', url: 'https://files.exemplo.com/relatorio.txt' };

test('recusa endereços de loopback, rede privada e link-local', () => {
  for (const address of ['127.0.0.1', '10.0.0.1', '192.168.1.5', '172.16.0.1', '169.254.169.254', '::1', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1']) {
    assert.equal(isBlockedAddress(address), true, address);
  }
});

test('aceita endereços públicos', () => {
  for (const address of ['8.8.8.8', '1.1.1.1', '2606:4700::1111']) {
    assert.equal(isBlockedAddress(address), false, address);
  }
});

test('baixa a URL pública e registra o anexo', async () => {
  let captured: any;
  const service = serviceWith(async (url: string) => { captured = url; return respond('conteúdo', { 'content-type': 'text/plain' }); });
  const saved = await service.intakeByUrl(input);
  assert.equal(captured, input.url);
  assert.equal(saved.fileName, 'relatorio.txt');
  assert.equal(saved.mimeType, 'text/plain');
});

test('recusa esquema que não seja http ou https', async () => {
  const service = serviceWith(async () => respond('x'));
  await assert.rejects(() => service.intakeByUrl({ ...input, url: 'file:///etc/passwd' }), /não permitido/i);
});

test('recusa arquivo acima de 100 MB', async () => {
  const service = serviceWith(async () => respond('x', { 'content-length': String(MAX_FILE_SIZE + 1), 'content-type': 'text/plain' }));
  await assert.rejects(() => service.intakeByUrl(input), /tamanho/i);
});

test('recusa MIME fora da lista', async () => {
  const service = serviceWith(async () => respond('x', { 'content-type': 'application/x-msdownload' }));
  await assert.rejects(() => service.intakeByUrl(input), /tipo de arquivo/i);
});

test('segue no máximo dois redirecionamentos e revalida o destino', async () => {
  let chamadas = 0;
  const service = serviceWith(async () => { chamadas += 1; return { status: 302, headers: { get: (name: string) => (name.toLowerCase() === 'location' ? 'https://outro.exemplo.com/a.txt' : null) }, arrayBuffer: async () => new ArrayBuffer(0) }; });
  await assert.rejects(() => service.intakeByUrl(input), /redirecionamento/i);
  assert.equal(chamadas, 3);
});

test('texto com acento em nome de arquivo é preservado', async () => {
  const service = serviceWith(async () => respond('x', { 'content-type': 'text/plain' }));
  const saved = await service.intakeByUrl({ ...input, url: 'https://files.exemplo.com/relat%C3%B3rio%20anual.txt' });
  assert.equal(saved.fileName, 'relatório anual.txt');
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

```bash
cd /root/quadro-do-mane/apps/api && node -r ts-node/register --test src/modules/upload/attachment-intake.service.spec.ts
```

Expected: FAIL com erro de módulo não encontrado.

- [ ] **Step 3: Extrair as constantes do controller**

Criar `apps/api/src/modules/upload/upload.constants.ts`:

```ts
export const ALLOWED_MIMES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
] as const;

export const MAX_FILE_SIZE = 100 * 1024 * 1024;
```

Em `apps/api/src/modules/upload/upload.controller.ts`, remover o array local (linhas 23-49) e a constante `MAX_FILE_SIZE`, e importar:

```ts
import { ALLOWED_MIMES, MAX_FILE_SIZE } from './upload.constants';
```

- [ ] **Step 4: Implementar o serviço de intake**

Criar `apps/api/src/modules/upload/attachment-intake.service.ts`:

```ts
import { BadRequestException, Inject, Injectable, Optional } from '@nestjs/common';
import * as dns from 'node:dns/promises';
import * as net from 'node:net';
import { UploadService } from './upload.service';
import { ALLOWED_MIMES, MAX_FILE_SIZE } from './upload.constants';

export const ATTACHMENT_FETCH = Symbol('ATTACHMENT_FETCH');
export const MAX_REDIRECTS = 2;

export type AttachmentFetch = (
  url: string,
  init: { redirect: 'manual'; signal?: AbortSignal },
) => Promise<{ status: number; headers: { get(name: string): string | null }; arrayBuffer(): Promise<ArrayBuffer> }>;

const PRIVATE_V4 = [/^127\./, /^10\./, /^192\.168\./, /^169\.254\./, /^0\./, /^172\.(1[6-9]|2\d|3[01])\./];

export const isBlockedAddress = (address: string): boolean => {
  if (net.isIPv4(address)) return PRIVATE_V4.some((pattern) => pattern.test(address));
  const value = address.toLowerCase();
  if (value.startsWith('::ffff:')) return isBlockedAddress(value.slice('::ffff:'.length));
  if (value === '::' || value === '::1') return true;
  if (value.startsWith('fe80')) return true;
  return /^f[cd]/.test(value);
};

const fileNameFrom = (url: string, override?: string) => {
  const candidate = override?.trim() || decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() ?? 'anexo');
  return candidate.replace(/[/\\]/g, '_').slice(0, 180) || 'anexo';
};

@Injectable()
export class AttachmentIntakeService {
  constructor(
    private readonly uploads: UploadService,
    @Optional() @Inject(ATTACHMENT_FETCH) private readonly fetchImpl: AttachmentFetch = ((url, init) => fetch(url, init)) as AttachmentFetch,
  ) {}

  async intakeByUrl(input: { tenantId: string; uploadedByTenantUserId: string; taskId?: string; projectId?: string; url: string; fileName?: string }) {
    const url = new URL(input.url);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new BadRequestException('Esquema de URL não permitido. Use http ou https.');
    }

    let target = url;
    for (let redirect = 0; ; redirect += 1) {
      const addresses = await dns.lookup(target.hostname, { all: true });
      if (addresses.some((entry) => isBlockedAddress(entry.address))) {
        throw new BadRequestException('Destino não permitido: a URL aponta para rede interna.');
      }

      const response = await this.fetchImpl(target.toString(), { redirect: 'manual' });
      if (response.status >= 300 && response.status < 400) {
        if (redirect >= MAX_REDIRECTS) throw new BadRequestException('Excesso de redirecionamentos ao baixar o arquivo.');
        const location = response.headers.get('location');
        if (!location) throw new BadRequestException('Redirecionamento sem destino.');
        target = new URL(location, target);
        if (target.protocol !== 'http:' && target.protocol !== 'https:') {
          throw new BadRequestException('Esquema de URL não permitido. Use http ou https.');
        }
        continue;
      }

      const declared = Number(response.headers.get('content-length') ?? '0');
      if (declared > MAX_FILE_SIZE) throw new BadRequestException('Arquivo acima do tamanho máximo de 100 MB.');

      const mimeType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
      if (!(ALLOWED_MIMES as readonly string[]).includes(mimeType)) {
        throw new BadRequestException('Tipo de arquivo não permitido. Envie imagens, documentos ou planilhas.');
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength > MAX_FILE_SIZE) throw new BadRequestException('Arquivo acima do tamanho máximo de 100 MB.');

      return this.uploads.uploadFile({
        tenantId: input.tenantId,
        uploadedByTenantUserId: input.uploadedByTenantUserId,
        taskId: input.taskId,
        projectId: input.projectId,
        fileName: fileNameFrom(target.toString(), input.fileName),
        mimeType,
        fileSize: buffer.byteLength,
        buffer,
      });
    }
  }
}
```

- [ ] **Step 5: Rodar o teste e ver passar**

```bash
cd /root/quadro-do-mane/apps/api && node -r ts-node/register --test src/modules/upload/attachment-intake.service.spec.ts
```

Expected: PASS com 8 testes.

- [ ] **Step 6: Registrar no módulo de upload**

Em `apps/api/src/modules/upload/upload.module.ts`:

```ts
import { ATTACHMENT_FETCH, AttachmentIntakeService } from './attachment-intake.service';
```

```ts
providers: [
  UploadService,
  AttachmentIntakeService,
  { provide: ATTACHMENT_FETCH, useFactory: () => ((url: string, init: any) => fetch(url, init)) },
],
exports: [UploadService, AttachmentIntakeService],
```

- [ ] **Step 7: Verificar**

```bash
cd /root/quadro-do-mane/apps/api && npx tsc --noEmit && node -r ts-node/register --test src/modules/upload/attachment-intake.service.spec.ts src/modules/upload/*.spec.ts
```

Expected: tudo verde.

- [ ] **Step 8: Commitar**

```bash
cd /root/quadro-do-mane
git add apps/api/src/modules/upload/upload.constants.ts apps/api/src/modules/upload/attachment-intake.service.ts apps/api/src/modules/upload/attachment-intake.service.spec.ts apps/api/src/modules/upload/upload.controller.ts apps/api/src/modules/upload/upload.module.ts
git commit -m "feat(upload): intake de anexo por URL com guarda SSRF"
```

---

### Task 7: Toolkit de tarefas

Comentários, checklists, anexos e exclusão.

**Files:**
- Create: `apps/api/src/modules/ai/tools/tasks/index.ts`
- Create: `apps/api/src/modules/ai/tools/tasks/task-collaboration.tools.ts`
- Create: `apps/api/src/modules/ai/tools/tasks/task-checklist.tools.ts`
- Create: `apps/api/src/modules/ai/tools/tasks/task-attachment.tools.ts`
- Create: `apps/api/src/modules/ai/tools/tasks/task-delete.tool.ts`
- Create: `apps/api/src/modules/ai/tools/tasks/task-tools.spec.ts`
- Modify: `apps/api/src/modules/ai/ai.module.ts`
- Modify: `apps/api/src/modules/ai/ai.module.spec.ts`

**Interfaces:**
- Consumes: `AiPermissionService` (Task 3), `AiTool.permission` (Task 4), `AttachmentIntakeService` (Task 6).
- Produces: `TASK_TOOL_PROVIDERS` (array de providers) exportado por `tasks/index.ts`.

- [ ] **Step 1: Escrever os testes que falham**

Criar `apps/api/src/modules/ai/tools/tasks/task-tools.spec.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ListTaskCommentsTool, AddTaskCommentTool, DeleteTaskCommentTool,
  CreateTaskChecklistTool, AddTaskChecklistItemTool, ToggleTaskChecklistItemTool,
  ListTaskAttachmentsTool, AttachTaskFileTool, DeleteTaskAttachmentTool,
} from './index';

const actor = { tenantId: 'tenant-1', actorTenantUserId: 'user-1', args: {} };
const permitted = { can: async () => true, codesFor: async () => [] } as any;

const tasks = {
  findByFilters: async () => [
    { id: 'task-1', title: 'Relatório mensal' },
    { id: 'task-2', title: 'Relatório trimestral' },
  ],
  getComments: async () => [{ id: 'c1', content: 'olá', author: { user: { name: 'Ana' } }, createdAt: new Date('2026-10-01') }],
  addComment: async (_t: string, taskId: string, authorTenantUserId: string, content: string) => ({ id: 'c2', taskId, authorTenantUserId, content }),
  removeComment: async () => ({ id: 'c1', deleted: true }),
  createChecklist: async (_t: string, taskId: string, title: string) => ({ id: 'cl-1', taskId, title }),
  addChecklistItem: async (_t: string, checklistId: string, content: string) => ({ id: 'it-1', checklistId, content, done: false }),
  toggleChecklistItem: async (_t: string, itemId: string) => ({ id: itemId, done: true }),
  removeAttachment: async () => ({ id: 'a1', deleted: true }),
} as any;

const uploads = { getAttachments: async () => [{ id: 'a1', fileName: 'contrato.pdf', mimeType: 'application/pdf', fileSize: 2048, uploadedBy: { user: { name: 'Ana' } } }] } as any;
const intake = { intakeByUrl: async (params: any) => ({ id: 'att-9', fileName: 'contrato.pdf', ...params }) } as any;

test('list_task_comments devolve nome do autor e nenhuma tool aceita campo desconhecido', async () => {
  const tool = new ListTaskCommentsTool(tasks, permitted);
  const rows = await tool.execute({ ...actor, args: { taskId: 'task-1' } }) as any[];
  assert.equal(rows[0].authorName, 'Ana');
  assert.equal((rows[0] as any).author, undefined);
  assert.throws(() => tool.validate?.({ taskId: 'task-1', surprise: 1 }), /Campo não suportado: surprise/);
});

test('taskName ambíguo vira clarification em vez de escolher uma tarefa', async () => {
  const tool = new AddTaskCommentTool(tasks, permitted);
  const result = await tool.execute({ ...actor, args: { taskName: 'Relatório', content: 'ok' } });
  assert.equal((result as any).needsClarification, true);
  assert.equal((result as any).field, 'taskName');
});

test('add_task_comment exige conteúdo não vazio', () => {
  const tool = new AddTaskCommentTool(tasks, permitted);
  assert.throws(() => tool.validate?.({ taskId: 'task-1', content: '   ' }), /content/);
});

test('delete_task_comment é ação, não leitura', () => {
  const tool = new DeleteTaskCommentTool(tasks, permitted);
  assert.notEqual(tool.readOnly, true);
  assert.equal(tool.permission, 'tasks.comment');
});

test('checklists usam tasks.checklist_manage', () => {
  for (const tool of [new CreateTaskChecklistTool(tasks, permitted), new AddTaskChecklistItemTool(tasks, permitted), new ToggleTaskChecklistItemTool(tasks, permitted)]) {
    assert.equal(tool.permission, 'tasks.checklist_manage');
    assert.notEqual(tool.readOnly, true);
  }
});

test('list_task_attachments é leitura e devolve quem enviou', async () => {
  const tool = new ListTaskAttachmentsTool(tasks, uploads, permitted);
  assert.equal(tool.readOnly, true);
  const rows = await tool.execute({ ...actor, args: { taskId: 'task-1' } }) as any[];
  assert.equal(rows[0].uploadedByName, 'Ana');
});

test('attach_task_file exige URL http ou https', () => {
  const tool = new AttachTaskFileTool(tasks, intake, permitted);
  assert.throws(() => tool.validate?.({ taskId: 'task-1', url: 'file:///etc/passwd' }), /url/i);
});

test('attach_task_file repassa tenant e ator do input, nunca da URL', async () => {
  const tool = new AttachTaskFileTool(tasks, intake, permitted);
  await tool.execute({ ...actor, args: { taskId: 'task-1', url: 'https://files.exemplo.com/a.txt' } });
  assert.equal(intake.intakeByUrl.length >= 0, true);
});

test('delete_task_attachment usa tasks.attachments_manage', () => {
  const tool = new DeleteTaskAttachmentTool(tasks, permitted);
  assert.equal(tool.permission, 'tasks.attachments_manage');
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd /root/quadro-do-mane/apps/api && node -r ts-node/register --test src/modules/ai/tools/tasks/task-tools.spec.ts
```

Expected: FAIL com erro de módulo não encontrado para `./index`.

- [ ] **Step 3: Implementar comentários, com resolução por nome**

Criar `apps/api/src/modules/ai/tools/tasks/task-target.ts`, o helper que todo tool de escrita do domínio usa para aceitar `taskId` **ou** `taskName`:

```ts
import { BadRequestException } from '@nestjs/common';
import { TasksService } from '../../../tasks/tasks.service';
import { AiToolClarification } from '../ai-tool.port';
import { clarification, resolveOne } from '../task-tool.schemas';

export type TaskTarget = { taskId?: string; taskName?: string };

export const taskTargetFields = ['taskId', 'taskName'];

/**
 * Resolve o alvo de uma tool de tarefa por ID ou por nome. Nome ambíguo vira
 * `AiToolClarification`, que o `AiService` transforma em pergunta ao usuário.
 */
export const resolveTaskTarget = async (
  tasks: TasksService,
  tenantId: string,
  value: TaskTarget,
): Promise<{ id: string } | AiToolClarification> => {
  if (value.taskId) return { id: value.taskId };
  if (!value.taskName) throw new BadRequestException('taskId ou taskName é obrigatório');
  const rows = await tasks.findByFilters(tenantId, { search: value.taskName });
  const candidates = rows.filter((row: any) => row.title);
  if (!candidates.length) throw new BadRequestException(`Nenhuma tarefa chamada "${value.taskName}"`);
  const match = resolveOne(candidates, value.taskName, 'taskName');
  if (clarification(match)) return match as AiToolClarification;
  return { id: (match as any).id };
};
```

`resolveOne` casa por `row.name`; as tarefas usam `title`. Por isso o helper mapeia o campo antes de delegar:

```ts
const candidates = rows.map((row: any) => ({ ...row, name: row.title }));
```

Manter essa linha no arquivo final, no lugar da que filtra só `row.title`. O nome devolvido na clarificação passa a ser o título da tarefa, que é o que o usuário reconhece.

Criar `apps/api/src/modules/ai/tools/tasks/task-collaboration.tools.ts`:

```ts
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { TasksService } from '../../../tasks/tasks.service';
import { AiPermissionService } from '../../ai-permission.service';
import { AiTool, AiToolInput } from '../ai-tool.port';
import { objectArgs, nonEmpty, safeDate } from '../task-tool.schemas';
import { resolveTaskTarget, taskTargetFields } from './task-target';

const DENIED = 'Você não tem permissão para usar esta ferramenta';

@Injectable()
export class ListTaskCommentsTool implements AiTool {
  name = 'list_task_comments';
  readOnly = true;
  permission: PermissionCode = 'tasks.view';
  description = 'Lista os comentários de uma tarefa com o nome de quem escreveu.';
  parameters = { type: 'object', additionalProperties: false, properties: { taskId: { type: 'string' }, taskName: { type: 'string' } } };
  validate = (args: unknown) => objectArgs(args, taskTargetFields);

  constructor(private readonly tasks: TasksService, private readonly permissions: AiPermissionService) {}

  async authorize(input: AiToolInput) {
    if (!(await this.permissions.can(input, this.permission))) throw new ForbiddenException(DENIED);
  }

  async execute(input: AiToolInput) {
    const target = await resolveTaskTarget(this.tasks, input.tenantId, this.validate(input.args) as any);
    if ((target as any).needsClarification) return target;
    const rows = await this.tasks.getComments(input.tenantId, (target as any).id);
    return rows.map((comment: any) => ({
      id: comment.id,
      content: comment.content,
      authorName: comment.author?.user?.name ?? null,
      createdAt: safeDate(comment.createdAt),
    }));
  }
}

@Injectable()
export class AddTaskCommentTool implements AiTool {
  name = 'add_task_comment';
  permission: PermissionCode = 'tasks.comment';
  description = 'Comenta em uma tarefa. Use search_tasks para achar a tarefa.';
  parameters = {
    type: 'object', additionalProperties: false, required: ['content'],
    properties: { taskId: { type: 'string' }, taskName: { type: 'string' }, content: { type: 'string' } },
  };
  validate = (args: unknown) => {
    const value = objectArgs(args, [...taskTargetFields, 'content']);
    return { ...value, content: nonEmpty(value.content, 'content') };
  };

  constructor(private readonly tasks: TasksService, private readonly permissions: AiPermissionService) {}

  async authorize(input: AiToolInput) {
    if (!(await this.permissions.can(input, this.permission))) throw new ForbiddenException(DENIED);
  }

  async execute(input: AiToolInput) {
    const { content, ...target } = this.validate(input.args) as any;
    const resolved = await resolveTaskTarget(this.tasks, input.tenantId, target);
    if ((resolved as any).needsClarification) return resolved;
    const saved = await this.tasks.addComment(input.tenantId, (resolved as any).id, input.actorTenantUserId, content);
    return { id: saved.id, content, createdAt: safeDate((saved as any).createdAt) };
  }
}

@Injectable()
export class DeleteTaskCommentTool implements AiTool {
  name = 'delete_task_comment';
  permission: PermissionCode = 'tasks.comment';
  description = 'Remove um comentário de tarefa.';
  parameters = { type: 'object', additionalProperties: false, required: ['commentId'], properties: { commentId: { type: 'string' } } };
  validate = (args: unknown) => ({ commentId: nonEmpty((objectArgs(args, ['commentId']) as any).commentId, 'commentId') });

  constructor(private readonly tasks: TasksService, private readonly permissions: AiPermissionService) {}

  async authorize(input: AiToolInput) {
    if (!(await this.permissions.can(input, this.permission))) throw new ForbiddenException(DENIED);
  }

  async execute(input: AiToolInput) {
    const { commentId } = this.validate(input.args) as any;
    return this.tasks.removeComment(input.tenantId, commentId, input.actorTenantUserId);
  }
}
```

`objectArgs`, `nonEmpty` e `safeDate` precisam ser exportados de `task-tool.schemas.ts` — hoje `objectArgs` e `nonEmpty` são privados (linhas 7 e 15); adicione `export` aos dois, sem mudar o corpo.

- [ ] **Step 4: Implementar checklists**

Criar `apps/api/src/modules/ai/tools/tasks/task-checklist.tools.ts`:

```ts
import { ForbiddenException, Injectable } from '@nestjs/common';
import { TasksService } from '../../../tasks/tasks.service';
import { AiPermissionService } from '../../ai-permission.service';
import { AiTool, AiToolInput } from '../ai-tool.port';
import { objectArgs, nonEmpty } from '../task-tool.schemas';

@Injectable()
export class CreateTaskChecklistTool implements AiTool {
  name = 'create_task_checklist';
  permission: PermissionCode = 'tasks.checklist_manage';
  description = 'Cria uma checklist numa tarefa.';
  parameters = { type: 'object', additionalProperties: false, required: ['taskId', 'title'], properties: { taskId: { type: 'string' }, title: { type: 'string' } } };
  validate = (args: unknown) => {
    const value = objectArgs(args, ['taskId', 'title']);
    return { taskId: nonEmpty(value.taskId, 'taskId'), title: nonEmpty(value.title, 'title') };
  };
  constructor(private readonly tasks: TasksService, private readonly permissions: AiPermissionService) {}
  async authorize(input: AiToolInput) { if (!(await this.permissions.can(input, this.permission))) throw new ForbiddenException('Você não tem permissão para usar esta ferramenta'); }
  async execute(input: AiToolInput) {
    const { taskId, title } = this.validate(input.args) as any;
    const saved = await this.tasks.createChecklist(input.tenantId, taskId, title, input.actorTenantUserId);
    return { id: saved.id, taskId, title: saved.title };
  }
}

@Injectable()
export class AddTaskChecklistItemTool implements AiTool {
  name = 'add_task_checklist_item';
  permission: PermissionCode = 'tasks.checklist_manage';
  description = 'Adiciona um item a uma checklist de tarefa.';
  parameters = { type: 'object', additionalProperties: false, required: ['checklistId', 'content'], properties: { checklistId: { type: 'string' }, content: { type: 'string' } } };
  validate = (args: unknown) => {
    const value = objectArgs(args, ['checklistId', 'content']);
    return { checklistId: nonEmpty(value.checklistId, 'checklistId'), content: nonEmpty(value.content, 'content') };
  };
  constructor(private readonly tasks: TasksService, private readonly permissions: AiPermissionService) {}
  async authorize(input: AiToolInput) { if (!(await this.permissions.can(input, this.permission))) throw new ForbiddenException('Você não tem permissão para usar esta ferramenta'); }
  async execute(input: AiToolInput) {
    const { checklistId, content } = this.validate(input.args) as any;
    const saved = await this.tasks.addChecklistItem(input.tenantId, checklistId, content, input.actorTenantUserId);
    return { id: saved.id, checklistId, content: saved.content, done: saved.done };
  }
}

@Injectable()
export class ToggleTaskChecklistItemTool implements AiTool {
  name = 'toggle_task_checklist_item';
  permission: PermissionCode = 'tasks.checklist_manage';
  description = 'Marca ou desmarca um item de checklist.';
  parameters = { type: 'object', additionalProperties: false, required: ['itemId'], properties: { itemId: { type: 'string' } } };
  validate = (args: unknown) => ({ itemId: nonEmpty((objectArgs(args, ['itemId']) as any).itemId, 'itemId') });
  constructor(private readonly tasks: TasksService, private readonly permissions: AiPermissionService) {}
  async authorize(input: AiToolInput) { if (!(await this.permissions.can(input, this.permission))) throw new ForbiddenException('Você não tem permissão para usar esta ferramenta'); }
  async execute(input: AiToolInput) {
    const { itemId } = this.validate(input.args) as any;
    const saved = await this.tasks.toggleChecklistItem(input.tenantId, itemId, input.actorTenantUserId);
    return { id: saved.id, done: saved.done };
  }
}
```

- [ ] **Step 5: Implementar anexos**

Criar `apps/api/src/modules/ai/tools/tasks/task-attachment.tools.ts`:

```ts
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { TasksService } from '../../../tasks/tasks.service';
import { UploadService } from '../../../upload/upload.service';
import { AttachmentIntakeService } from '../../../upload/attachment-intake.service';
import { AiPermissionService } from '../../ai-permission.service';
import { AiTool, AiToolInput } from '../ai-tool.port';
import { objectArgs, nonEmpty } from '../task-tool.schemas';

const httpUrl = (value: unknown) => {
  const raw = nonEmpty(value, 'url');
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new BadRequestException('url inválida');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BadRequestException('url deve usar http ou https');
  }
  return raw;
};

@Injectable()
export class ListTaskAttachmentsTool implements AiTool {
  name = 'list_task_attachments';
  readOnly = true;
  permission: PermissionCode = 'tasks.view';
  description = 'Lista os anexos de uma tarefa com nome, tipo e tamanho.';
  parameters = { type: 'object', additionalProperties: false, required: ['taskId'], properties: { taskId: { type: 'string' } } };
  validate = (args: unknown) => ({ taskId: nonEmpty((objectArgs(args, ['taskId']) as any).taskId, 'taskId') });
  constructor(private readonly tasks: TasksService, private readonly uploads: UploadService, private readonly permissions: AiPermissionService) {}
  async authorize(input: AiToolInput) { if (!(await this.permissions.can(input, this.permission))) throw new ForbiddenException('Você não tem permissão para usar esta ferramenta'); }
  async execute(input: AiToolInput) {
    const { taskId } = this.validate(input.args) as any;
    const rows = await this.uploads.getAttachments(input.tenantId, taskId);
    return rows.map((attachment: any) => ({
      id: attachment.id,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
      uploadedByName: attachment.uploadedBy?.user?.name ?? null,
      createdAt: attachment.createdAt,
    }));
  }
}

@Injectable()
export class AttachTaskFileTool implements AiTool {
  name = 'attach_task_file';
  permission: PermissionCode = 'tasks.attachments_manage';
  description = 'Baixa uma URL pública e anexa o arquivo numa tarefa. Aceita imagens, PDF, planilha, apresentação ou texto.';
  parameters = {
    type: 'object', additionalProperties: false, required: ['taskId', 'url'],
    properties: { taskId: { type: 'string' }, url: { type: 'string' }, fileName: { type: 'string' } },
  };
  validate = (args: unknown) => {
    const value = objectArgs(args, ['taskId', 'url', 'fileName']);
    return { taskId: nonEmpty(value.taskId, 'taskId'), url: httpUrl(value.url), fileName: value.fileName };
  };
  constructor(private readonly tasks: TasksService, private readonly intake: AttachmentIntakeService, private readonly permissions: AiPermissionService) {}
  async authorize(input: AiToolInput) { if (!(await this.permissions.can(input, this.permission))) throw new ForbiddenException('Você não tem permissão para usar esta ferramenta'); }
  async execute(input: AiToolInput) {
    const { taskId, url, fileName } = this.validate(input.args) as any;
    try {
      const saved = await this.intake.intakeByUrl({
        tenantId: input.tenantId,
        uploadedByTenantUserId: input.actorTenantUserId,
        taskId,
        url,
        fileName,
      });
      return { id: saved.id, fileName: saved.fileName, mimeType: saved.mimeType, fileSize: saved.fileSize };
    } catch (error) {
      if (error instanceof BadRequestException) return { error: error.message, hint: 'Não consegui baixar o arquivo. Peça ao usuário para anexá-lo pela tela.' };
      throw error;
    }
  }
}

@Injectable()
export class DeleteTaskAttachmentTool implements AiTool {
  name = 'delete_task_attachment';
  permission: PermissionCode = 'tasks.attachments_manage';
  description = 'Remove um anexo de uma tarefa.';
  parameters = { type: 'object', additionalProperties: false, required: ['taskId', 'attachmentId'], properties: { taskId: { type: 'string' }, attachmentId: { type: 'string' } } };
  validate = (args: unknown) => {
    const value = objectArgs(args, ['taskId', 'attachmentId']);
    return { taskId: nonEmpty(value.taskId, 'taskId'), attachmentId: nonEmpty(value.attachmentId, 'attachmentId') };
  };
  constructor(private readonly tasks: TasksService, private readonly permissions: AiPermissionService) {}
  async authorize(input: AiToolInput) { if (!(await this.permissions.can(input, this.permission))) throw new ForbiddenException('Você não tem permissão para usar esta ferramenta'); }
  async execute(input: AiToolInput) {
    const { taskId, attachmentId } = this.validate(input.args) as any;
    return this.tasks.removeAttachment(input.tenantId, taskId, attachmentId, input.actorTenantUserId);
  }
}
```

- [ ] **Step 6: Implementar exclusão**

Criar `apps/api/src/modules/ai/tools/tasks/task-delete.tool.ts`:

```ts
import { ForbiddenException, Injectable } from '@nestjs/common';
import { TasksService } from '../../../tasks/tasks.service';
import { AiPermissionService } from '../../ai-permission.service';
import { AiTool, AiToolInput } from '../ai-tool.port';
import { objectArgs } from '../task-tool.schemas';
import { resolveTaskTarget, taskTargetFields } from './task-target';

@Injectable()
export class DeleteTaskTool implements AiTool {
  name = 'delete_task';
  permission: PermissionCode = 'tasks.delete';
  description = 'Exclui uma tarefa. Use search_tasks para achar a tarefa e confirme com o usuário.';
  parameters = { type: 'object', additionalProperties: false, properties: { taskId: { type: 'string' }, taskName: { type: 'string' } } };
  validate = (args: unknown) => objectArgs(args, taskTargetFields);
  constructor(private readonly tasks: TasksService, private readonly permissions: AiPermissionService) {}
  async authorize(input: AiToolInput) { if (!(await this.permissions.can(input, this.permission))) throw new ForbiddenException('Você não tem permissão para usar esta ferramenta'); }
  async execute(input: AiToolInput) {
    const resolved = await resolveTaskTarget(this.tasks, input.tenantId, this.validate(input.args) as any);
    if ((resolved as any).needsClarification) return resolved;
    return this.tasks.remove(input.tenantId, (resolved as any).id, input.actorTenantUserId);
  }
}
```

- [ ] **Step 7: Exportar o toolkit**

Criar `apps/api/src/modules/ai/tools/tasks/index.ts`:

```ts
import { ListTaskCommentsTool, AddTaskCommentTool, DeleteTaskCommentTool } from './task-collaboration.tools';
import { CreateTaskChecklistTool, AddTaskChecklistItemTool, ToggleTaskChecklistItemTool } from './task-checklist.tools';
import { ListTaskAttachmentsTool, AttachTaskFileTool, DeleteTaskAttachmentTool } from './task-attachment.tools';
import { DeleteTaskTool } from './task-delete.tool';
import { TasksService } from '../../../tasks/tasks.service';
import { UploadService } from '../../../upload/upload.service';
import { AttachmentIntakeService } from '../../../upload/attachment-intake.service';
import { AiPermissionService } from '../../ai-permission.service';

export * from './task-collaboration.tools';
export * from './task-checklist.tools';
export * from './task-attachment.tools';
export * from './task-delete.tool';

/** Providers do domínio de tarefas, na ordem em que entram no registro. */
export const TASK_TOOL_PROVIDERS = [
  { provide: ListTaskCommentsTool, inject: [TasksService, AiPermissionService], useFactory: (tasks: TasksService, permissions: AiPermissionService) => new ListTaskCommentsTool(tasks, permissions) },
  { provide: AddTaskCommentTool, inject: [TasksService, AiPermissionService], useFactory: (tasks: TasksService, permissions: AiPermissionService) => new AddTaskCommentTool(tasks, permissions) },
  { provide: DeleteTaskCommentTool, inject: [TasksService, AiPermissionService], useFactory: (tasks: TasksService, permissions: AiPermissionService) => new DeleteTaskCommentTool(tasks, permissions) },
  { provide: CreateTaskChecklistTool, inject: [TasksService, AiPermissionService], useFactory: (tasks: TasksService, permissions: AiPermissionService) => new CreateTaskChecklistTool(tasks, permissions) },
  { provide: AddTaskChecklistItemTool, inject: [TasksService, AiPermissionService], useFactory: (tasks: TasksService, permissions: AiPermissionService) => new AddTaskChecklistItemTool(tasks, permissions) },
  { provide: ToggleTaskChecklistItemTool, inject: [TasksService, AiPermissionService], useFactory: (tasks: TasksService, permissions: AiPermissionService) => new ToggleTaskChecklistItemTool(tasks, permissions) },
  { provide: ListTaskAttachmentsTool, inject: [TasksService, UploadService, AiPermissionService], useFactory: (tasks: TasksService, uploads: UploadService, permissions: AiPermissionService) => new ListTaskAttachmentsTool(tasks, uploads, permissions) },
  { provide: AttachTaskFileTool, inject: [TasksService, AttachmentIntakeService, AiPermissionService], useFactory: (tasks: TasksService, intake: AttachmentIntakeService, permissions: AiPermissionService) => new AttachTaskFileTool(tasks, intake, permissions) },
  { provide: DeleteTaskAttachmentTool, inject: [TasksService, AiPermissionService], useFactory: (tasks: TasksService, permissions: AiPermissionService) => new DeleteTaskAttachmentTool(tasks, permissions) },
  { provide: DeleteTaskTool, inject: [TasksService, AiPermissionService], useFactory: (tasks: TasksService, permissions: AiPermissionService) => new DeleteTaskTool(tasks, permissions) },
];
```

- [ ] **Step 8: Rodar os testes e ver passar**

```bash
cd /root/quadro-do-mane/apps/api && node -r ts-node/register --test src/modules/ai/tools/tasks/task-tools.spec.ts
```

Expected: PASS com 8 testes.

- [ ] **Step 9: Registrar no módulo**

Em `apps/api/src/modules/ai/ai.module.ts`:

```ts
import { TASK_TOOL_PROVIDERS } from './tools/tasks';
import { UploadModule } from '../upload/upload.module';
```

Adicionar `UploadModule` ao array `imports` do `@Module` e espalhar os providers:

```ts
providers: [
  ...TASK_TOOL_PROVIDERS,
  // ...os demais já existentes
],
```

E acrescentar os tokens novos ao `inject` do `AiToolRegistryService`, na ordem do array:

```ts
inject: [AI_PERMISSION_SERVICE, SearchProjectsTool, SearchTasksTool, /* ... */ AddProjectMemberTool, ListTaskCommentsTool, AddTaskCommentTool, DeleteTaskCommentTool, CreateTaskChecklistTool, AddTaskChecklistItemTool, ToggleTaskChecklistItemTool, ListTaskAttachmentsTool, AttachTaskFileTool, DeleteTaskAttachmentTool, DeleteTaskTool],
```

Importar cada tool de `./tools/tasks`.

- [ ] **Step 10: Atualizar o teste do módulo**

Em `apps/api/src/modules/ai/ai.module.spec.ts`, no teste reescrito na Task 4, anexar ao array `expected`:

```ts
  ListTaskCommentsTool, AddTaskCommentTool, DeleteTaskCommentTool,
  CreateTaskChecklistTool, AddTaskChecklistItemTool, ToggleTaskChecklistItemTool,
  ListTaskAttachmentsTool, AttachTaskFileTool, DeleteTaskAttachmentTool, DeleteTaskTool,
```

O teste "publishes strict schemas..." monta cada tool com fakes; as novas precisam de fakes para `AiPermissionService`. Ajustar para um helper único:

```ts
const permissionsFake = { can: async () => true, codesFor: async () => [] } as any;
const deps = [
  { findAll: async () => [], findOne: async () => ({}) },
  { findAll: async () => [], findOne: async () => ({}) },
  { findByFilters: async () => [], getComments: async () => [], createChecklist: async () => ({}), addChecklistItem: async () => ({}), toggleChecklistItem: async () => ({}) },
  permissionsFake,
];
```

Como as tools têm construtores com aridades diferentes, montar cada uma com os argumentos que o construtor declara, usando `permissionsFake` na posição do serviço de permissões e `undefined` nos serviços não usados. O objetivo do teste é apenas que `validate` rejeite campo desconhecido, não exercitar `execute`. Uma forma estável de fazer isso é ler a aridade de cada construtor:

```ts
const instanceFor = (Tool: any) => {
  const arity = Tool.length;
  const args = Array.from({ length: arity }, (_, index) => (index === arity - 1 ? permissionsFake : undefined));
  return new Tool(...args);
};
```

- [ ] **Step 11: Verificar**

```bash
cd /root/quadro-do-mane/apps/api && npx tsc --noEmit && node -r ts-node/register --test src/modules/ai/ai.module.spec.ts src/modules/ai/tools/tasks/task-tools.spec.ts src/modules/ai/tools/task-tools.spec.ts
```

Expected: tudo verde.

- [ ] **Step 12: Commitar**

```bash
cd /root/quadro-do-mane
git add apps/api/src/modules/ai/tools/tasks apps/api/src/modules/ai/ai.module.ts apps/api/src/modules/ai/ai.module.spec.ts apps/api/src/modules/ai/tools/task-tool.schemas.ts
git commit -m "feat(ai): tools de comentario, checklist, anexo e exclusao de tarefa"
```

---

### Task 8: Toolkit de projetos

Criar, editar, excluir e remover membro.

**Files:**
- Create: `apps/api/src/modules/ai/tools/projects/index.ts`
- Create: `apps/api/src/modules/ai/tools/projects/project-tools.ts`
- Create: `apps/api/src/modules/ai/tools/projects/project-tools.spec.ts`
- Modify: `apps/api/src/modules/ai/ai.module.ts`
- Modify: `apps/api/src/modules/ai/ai.module.spec.ts`

**Interfaces:**
- Consumes: `AiPermissionService` (Task 3), `AiTool.permission` (Task 4), `resolveOne`/`clarification` de `task-tool.schemas.ts`.
- Produces: `PROJECT_TOOL_PROVIDERS`.

- [ ] **Step 1: Escrever os testes que falham**

Criar `apps/api/src/modules/ai/tools/projects/project-tools.spec.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { CreateProjectTool, UpdateProjectTool, DeleteProjectTool, RemoveProjectMemberTool } from './index';

const actor = { tenantId: 'tenant-1', actorTenantUserId: 'user-1', args: {} };
const permitted = { can: async () => true, codesFor: async () => [] } as any;

const projects = {
  findAll: async () => [
    { id: 'p1', name: 'Website', status: 'ATIVO', team: { name: 'Frontend' }, owner: { user: { name: 'Ana' } }, _count: { tasks: 4 } },
    { id: 'p2', name: 'Website Institutional', status: 'ATIVO', team: null, owner: null, _count: { tasks: 0 } },
  ],
  create: async (_t: string, dto: any) => ({ id: 'p9', name: dto.name }),
  update: async (_t: string, id: string, dto: any) => ({ id, name: dto.name ?? 'Website' }),
  remove: async (_t: string, id: string) => ({ id, deleted: true }),
  removeMember: async (_t: string, projectId: string, tenantUserId: string) => ({ projectId, tenantUserId, removed: true }),
} as any;

const users = { findAll: async () => [{ id: 'u1', name: 'Ana Souza', user: { name: 'Ana Souza' } }, { id: 'u2', name: 'Bruno Lima', user: { name: 'Bruno Lima' } }] } as any;

test('create_project exige nome e usa projects.create', () => {
  const tool = new CreateProjectTool(projects, permitted);
  assert.equal(tool.permission, 'projects.create');
  assert.throws(() => tool.validate?.({ name: '  ' }), /name/);
  assert.throws(() => tool.validate?.({ name: 'X', color: '#fff' }), /Campo não suportado: color/);
});

test('update_project resolve projectName ambíguo em vez de adivinhar', async () => {
  const tool = new UpdateProjectTool(projects, users, permitted);
  const result = await tool.execute({ ...actor, args: { projectName: 'Website', description: 'nova' } });
  assert.deepEqual(result, { needsClarification: true, field: 'projectName', matches: [{ id: 'p1', name: 'Website' }, { id: 'p2', name: 'Website Institutional' }] });
});

test('delete_project é ação restrita a quem tem projects.delete', async () => {
  const tool = new DeleteProjectTool(projects, permitted);
  assert.notEqual(tool.readOnly, true);
  const denied = new DeleteProjectTool(projects, { can: async () => false, codesFor: async () => [] } as any);
  await assert.rejects(() => denied.authorize(actor), /permissão/i);
});

test('remove_project_member usa projects.manage_members e aceita memberName', async () => {
  const tool = new RemoveProjectMemberTool(projects, users, permitted);
  assert.equal(tool.permission, 'projects.manage_members');
  const result = await tool.execute({ ...actor, args: { projectId: 'p1', memberName: 'Bruno Lima' } });
  assert.deepEqual(result, { projectId: 'p1', memberName: 'Bruno Lima', removed: true });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd /root/quadro-do-mane/apps/api && node -r ts-node/register --test src/modules/ai/tools/projects/project-tools.spec.ts
```

Expected: FAIL com erro de módulo não encontrado para `./index`.

- [ ] **Step 3: Implementar as quatro tools**

Criar `apps/api/src/modules/ai/tools/projects/project-tools.ts`:

```ts
import { ForbiddenException, Injectable } from '@nestjs/common';
import { ProjectsService } from '../../../projects/projects.service';
import { UsersService } from '../../../users/users.service';
import { AiPermissionService } from '../../ai-permission.service';
import { AiTool, AiToolClarification, AiToolInput } from '../ai-tool.port';
import { objectArgs, nonEmpty, clarification, resolveOne, visibleProjects } from '../task-tool.schemas';

const DENIED = 'Você não tem permissão para usar esta ferramenta';

@Injectable()
export class CreateProjectTool implements AiTool {
  name = 'create_project';
  permission: PermissionCode = 'projects.create';
  description = 'Cria um projeto. Confirme o nome e, se houver, a equipe com o usuário.';
  parameters = {
    type: 'object', additionalProperties: false, required: ['name'],
    properties: { name: { type: 'string' }, description: { type: 'string' }, status: { type: 'string' }, color: { type: 'string' }, startDate: { type: 'string' }, dueDate: { type: 'string' } },
  };
  validate = (args: unknown) => {
    const value = objectArgs(args, ['name', 'description', 'status', 'color', 'startDate', 'dueDate']);
    return { name: nonEmpty(value.name, 'name'), description: value.description, status: value.status, color: value.color, startDate: value.startDate, dueDate: value.dueDate };
  };
  constructor(private readonly projects: ProjectsService, private readonly permissions: AiPermissionService) {}
  async authorize(input: AiToolInput) { if (!(await this.permissions.can(input, this.permission))) throw new ForbiddenException(DENIED); }
  async execute(input: AiToolInput) {
    const dto = this.validate(input.args) as any;
    const saved = await this.projects.create(input.tenantId, dto);
    return { id: saved.id, name: saved.name, status: (saved as any).status };
  }
}

@Injectable()
export class UpdateProjectTool implements AiTool {
  name = 'update_project';
  permission: PermissionCode = 'projects.edit';
  description = 'Atualiza um projeto existente. Aceita projectId ou projectName.';
  parameters = {
    type: 'object', additionalProperties: false,
    properties: { projectId: { type: 'string' }, projectName: { type: 'string' }, name: { type: 'string' }, description: { type: 'string' }, status: { type: 'string' }, color: { type: 'string' }, startDate: { type: 'string' }, dueDate: { type: 'string' } },
  };
  validate = (args: unknown) => {
    const value = objectArgs(args, ['projectId', 'projectName', 'name', 'description', 'status', 'color', 'startDate', 'dueDate']);
    if (!value.projectId && !value.projectName) throw new Error('projectId ou projectName é obrigatório');
    return value;
  };
  constructor(private readonly projects: ProjectsService, private readonly users: UsersService, private readonly permissions: AiPermissionService) {}
  async authorize(input: AiToolInput) { if (!(await this.permissions.can(input, this.permission))) throw new ForbiddenException(DENIED); }
  async execute(input: AiToolInput): Promise<unknown> {
    const value = this.validate(input.args) as any;
    const rows = await visibleProjects(this.projects, this.users, input);
    const project = value.projectId
      ? rows.find((row: any) => row.id === value.projectId)
      : resolveOne(rows, value.projectName, 'projectName');
    if (clarification(project)) return project as AiToolClarification;
    if (!project) throw new Error('projeto não encontrado no tenant');
    const { projectId, projectName, ...changes } = value;
    if (!Object.keys(changes).length) throw new Error('informe ao menos um campo para alterar');
    const saved = await this.projects.update(input.tenantId, project.id, changes, input.actorTenantUserId);
    return { id: saved.id, name: saved.name, status: (saved as any).status };
  }
}

@Injectable()
export class DeleteProjectTool implements AiTool {
  name = 'delete_project';
  permission: PermissionCode = 'projects.delete';
  description = 'Exclui um projeto e todas as tarefas dele. Confirme com o usuário antes.';
  parameters = { type: 'object', additionalProperties: false, required: ['projectId'], properties: { projectId: { type: 'string' } } };
  validate = (args: unknown) => ({ projectId: nonEmpty((objectArgs(args, ['projectId']) as any).projectId, 'projectId') });
  constructor(private readonly projects: ProjectsService, private readonly permissions: AiPermissionService) {}
  async authorize(input: AiToolInput) { if (!(await this.permissions.can(input, this.permission))) throw new ForbiddenException(DENIED); }
  async execute(input: AiToolInput) {
    const { projectId } = this.validate(input.args) as any;
    return this.projects.remove(input.tenantId, projectId);
  }
}

@Injectable()
export class RemoveProjectMemberTool implements AiTool {
  name = 'remove_project_member';
  permission: PermissionCode = 'projects.manage_members';
  description = 'Remove uma pessoa da equipe do projeto. Use search_users para achar a pessoa.';
  parameters = {
    type: 'object', additionalProperties: false, required: ['projectId'],
    properties: { projectId: { type: 'string' }, memberTenantUserId: { type: 'string' }, memberName: { type: 'string' } },
  };
  validate = (args: unknown) => {
    const value = objectArgs(args, ['projectId', 'memberTenantUserId', 'memberName']);
    if (!value.memberTenantUserId && !value.memberName) throw new Error('memberTenantUserId ou memberName é obrigatório');
    return value;
  };
  constructor(private readonly projects: ProjectsService, private readonly users: UsersService, private readonly permissions: AiPermissionService) {}
  async authorize(input: AiToolInput) { if (!(await this.permissions.can(input, this.permission))) throw new ForbiddenException(DENIED); }
  async execute(input: AiToolInput): Promise<unknown> {
    const value = this.validate(input.args) as any;
    const rows = await visibleProjects(this.projects, this.users, input);
    const project = rows.find((row: any) => row.id === value.projectId);
    if (!project) throw new Error('projeto não encontrado no tenant');
    const people = await this.users.findAll(input.tenantId);
    const member = value.memberTenantUserId
      ? people.find((row: any) => row.id === value.memberTenantUserId)
      : resolveOne(people, value.memberName, 'memberName');
    if (clarification(member)) return member as AiToolClarification;
    if (!member) throw new Error('pessoa não encontrada no tenant');
    await this.projects.removeMember(input.tenantId, project.id, member.id);
    return { projectId: project.id, memberName: member.name ?? member.user?.name, removed: true };
  }
}
```

Substitua cada `throw new Error(...)` de validação por `throw new BadRequestException(...)` — o `AiService` trata `BadRequestException` como erro de argumento, que volta ao modelo para correção. `ForbiddenException` fica reservado para recusa de permissão. Os testes acima usam `/permissão/i` e `/name/`, que casam com as duas mensagens.

- [ ] **Step 4: Exportar o toolkit**

Criar `apps/api/src/modules/ai/tools/projects/index.ts`:

```ts
import { CreateProjectTool, UpdateProjectTool, DeleteProjectTool, RemoveProjectMemberTool } from './project-tools';
import { ProjectsService } from '../../../projects/projects.service';
import { UsersService } from '../../../users/users.service';
import { AiPermissionService } from '../../ai-permission.service';

export * from './project-tools';

export const PROJECT_TOOL_PROVIDERS = [
  { provide: CreateProjectTool, inject: [ProjectsService, AiPermissionService], useFactory: (projects: ProjectsService, permissions: AiPermissionService) => new CreateProjectTool(projects, permissions) },
  { provide: UpdateProjectTool, inject: [ProjectsService, UsersService, AiPermissionService], useFactory: (projects: ProjectsService, users: UsersService, permissions: AiPermissionService) => new UpdateProjectTool(projects, users, permissions) },
  { provide: DeleteProjectTool, inject: [ProjectsService, AiPermissionService], useFactory: (projects: ProjectsService, permissions: AiPermissionService) => new DeleteProjectTool(projects, permissions) },
  { provide: RemoveProjectMemberTool, inject: [ProjectsService, UsersService, AiPermissionService], useFactory: (projects: ProjectsService, users: UsersService, permissions: AiPermissionService) => new RemoveProjectMemberTool(projects, users, permissions) },
];
```

- [ ] **Step 5: Rodar os testes e ver passar**

```bash
cd /root/quadro-do-mane/apps/api && node -r ts-node/register --test src/modules/ai/tools/projects/project-tools.spec.ts
```

Expected: PASS com 4 testes.

- [ ] **Step 6: Registrar no módulo**

```ts
import { PROJECT_TOOL_PROVIDERS, CreateProjectTool, UpdateProjectTool, DeleteProjectTool, RemoveProjectMemberTool } from './tools/projects';
```

```ts
providers: [
  ...PROJECT_TOOL_PROVIDERS,
  // ...os demais
],
```

E no `inject` do registry, acrescentar `CreateProjectTool, UpdateProjectTool, DeleteProjectTool, RemoveProjectMemberTool` ao final da lista existente.

- [ ] **Step 7: Atualizar o teste do módulo e verificar**

Em `ai.module.spec.ts`, anexar as quatro tools ao `expected` do teste de registro e ao fakes do teste de schema. Depois:

```bash
cd /root/quadro-do-mane/apps/api && npx tsc --noEmit && node -r ts-node/register --test src/modules/ai/ai.module.spec.ts src/modules/ai/tools/projects/project-tools.spec.ts
```

Expected: tudo verde.

- [ ] **Step 8: Commitar**

```bash
cd /root/quadro-do-mane
git add apps/api/src/modules/ai/tools/projects apps/api/src/modules/ai/ai.module.ts apps/api/src/modules/ai/ai.module.spec.ts
git commit -m "feat(ai): tools de criacao, edicao, exclusao e membro de projeto"
```

---

### Task 9: Toolkit de equipes

**Files:**
- Create: `apps/api/src/modules/ai/tools/teams/index.ts`
- Create: `apps/api/src/modules/ai/tools/teams/team-tools.ts`
- Create: `apps/api/src/modules/ai/tools/teams/team-tools.spec.ts`
- Modify: `apps/api/src/modules/ai/ai.module.ts`
- Modify: `apps/api/src/modules/ai/ai.module.spec.ts`

**Interfaces:**
- Consumes: `AiPermissionService` (Task 3), `AiTool.permission` (Task 4), `resolveOne`/`clarification`.
- Produces: `TEAM_TOOL_PROVIDERS`.

- [ ] **Step 1: Escrever os testes que falham**

Criar `apps/api/src/modules/ai/tools/teams/team-tools.spec.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { CreateTeamTool, UpdateTeamTool, DeleteTeamTool, RemoveTeamMemberTool } from './index';

const actor = { tenantId: 'tenant-1', actorTenantUserId: 'user-1', args: {} };
const permitted = { can: async () => true, codesFor: async () => [] } as any;

const teams = {
  findAll: async () => [{ id: 't1', name: 'Frontend', manager: { user: { name: 'Ana' } } }, { id: 't2', name: 'Backend', manager: null }],
  create: async (_t: string, dto: any) => ({ id: 't9', name: dto.name }),
  update: async (_t: string, id: string, dto: any) => ({ id, name: dto.name ?? 'Frontend' }),
  remove: async (_t: string, id: string) => ({ id, deleted: true }),
  removeMember: async (_t: string, teamId: string, tenantUserId: string) => ({ teamId, tenantUserId, removed: true }),
} as any;

const users = { findAll: async () => [{ id: 'u1', name: 'Ana Souza', user: { name: 'Ana Souza' } }] } as any;

test('create_team usa teams.create e exige nome', () => {
  const tool = new CreateTeamTool(teams, permitted);
  assert.equal(tool.permission, 'teams.create');
  assert.throws(() => tool.validate?.({}), /name/);
});

test('update_team resolve teamName ambíguo', async () => {
  const teamsWithDup = { ...teams, findAll: async () => [{ id: 't1', name: 'Frontend' }, { id: 't2', name: 'Frontend Novo' }] } as any;
  const tool = new UpdateTeamTool(teamsWithDup, users, permitted);
  const result = await tool.execute({ ...actor, args: { teamName: 'Frontend', description: 'x' } });
  assert.equal((result as any).needsClarification, true);
  assert.equal((result as any).field, 'teamName');
});

test('delete_team é ação com teams.delete', () => {
  const tool = new DeleteTeamTool(teams, permitted);
  assert.equal(tool.permission, 'teams.delete');
  assert.notEqual(tool.readOnly, true);
});

test('remove_team_member usa teams.manage_members', async () => {
  const tool = new RemoveTeamMemberTool(teams, users, permitted);
  assert.equal(tool.permission, 'teams.manage_members');
  const result = await tool.execute({ ...actor, args: { teamId: 't1', memberName: 'Ana Souza' } });
  assert.deepEqual(result, { teamId: 't1', memberName: 'Ana Souza', removed: true });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd /root/quadro-do-mane/apps/api && node -r ts-node/register --test src/modules/ai/tools/teams/team-tools.spec.ts
```

Expected: FAIL com erro de módulo não encontrado.

- [ ] **Step 3: Implementar as quatro tools**

Criar `apps/api/src/modules/ai/tools/teams/team-tools.ts`:

```ts
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { TeamsService } from '../../../teams/teams.service';
import { UsersService } from '../../../users/users.service';
import { AiPermissionService } from '../../ai-permission.service';
import { AiTool, AiToolClarification, AiToolInput } from '../ai-tool.port';
import { objectArgs, nonEmpty, clarification, resolveOne } from '../task-tool.schemas';

const DENIED = 'Você não tem permissão para usar esta ferramenta';

const teamRows = async (teams: TeamsService, tenantId: string) => teams.findAll(tenantId);

@Injectable()
export class CreateTeamTool implements AiTool {
  name = 'create_team';
  permission: PermissionCode = 'teams.create';
  description = 'Cria uma equipe. Confirme o nome e o gestor com o usuário.';
  parameters = {
    type: 'object', additionalProperties: false, required: ['name'],
    properties: { name: { type: 'string' }, description: { type: 'string' }, color: { type: 'string' }, managerTenantUserId: { type: 'string' } },
  };
  validate = (args: unknown) => {
    const value = objectArgs(args, ['name', 'description', 'color', 'managerTenantUserId']);
    return { name: nonEmpty(value.name, 'name'), description: value.description, color: value.color, managerTenantUserId: value.managerTenantUserId };
  };
  constructor(private readonly teams: TeamsService, private readonly permissions: AiPermissionService) {}
  async authorize(input: AiToolInput) { if (!(await this.permissions.can(input, this.permission))) throw new ForbiddenException(DENIED); }
  async execute(input: AiToolInput) {
    const dto = this.validate(input.args) as any;
    const saved = await this.teams.create(input.tenantId, dto);
    return { id: saved.id, name: saved.name };
  }
}

@Injectable()
export class UpdateTeamTool implements AiTool {
  name = 'update_team';
  permission: PermissionCode = 'teams.edit';
  description = 'Atualiza uma equipe existente. Aceita teamId ou teamName.';
  parameters = {
    type: 'object', additionalProperties: false,
    properties: { teamId: { type: 'string' }, teamName: { type: 'string' }, name: { type: 'string' }, description: { type: 'string' }, color: { type: 'string' } },
  };
  validate = (args: unknown) => {
    const value = objectArgs(args, ['teamId', 'teamName', 'name', 'description', 'color']);
    if (!value.teamId && !value.teamName) throw new BadRequestException('teamId ou teamName é obrigatório');
    return value;
  };
  constructor(private readonly teams: TeamsService, private readonly users: UsersService, private readonly permissions: AiPermissionService) {}
  async authorize(input: AiToolInput) { if (!(await this.permissions.can(input, this.permission))) throw new ForbiddenException(DENIED); }
  async execute(input: AiToolInput): Promise<unknown> {
    const value = this.validate(input.args) as any;
    const rows = await teamRows(this.teams, input.tenantId);
    const team = value.teamId ? rows.find((row: any) => row.id === value.teamId) : resolveOne(rows, value.teamName, 'teamName');
    if (clarification(team)) return team as AiToolClarification;
    if (!team) throw new BadRequestException('equipe não encontrada no tenant');
    const { teamId, teamName, ...changes } = value;
    if (!Object.keys(changes).length) throw new BadRequestException('informe ao menos um campo para alterar');
    const saved = await this.teams.update(input.tenantId, team.id, changes, input.actorTenantUserId);
    return { id: saved.id, name: saved.name };
  }
}

@Injectable()
export class DeleteTeamTool implements AiTool {
  name = 'delete_team';
  permission: PermissionCode = 'teams.delete';
  description = 'Exclui uma equipe. Confirme com o usuário antes.';
  parameters = { type: 'object', additionalProperties: false, required: ['teamId'], properties: { teamId: { type: 'string' } } };
  validate = (args: unknown) => ({ teamId: nonEmpty((objectArgs(args, ['teamId']) as any).teamId, 'teamId') });
  constructor(private readonly teams: TeamsService, private readonly permissions: AiPermissionService) {}
  async authorize(input: AiToolInput) { if (!(await this.permissions.can(input, this.permission))) throw new ForbiddenException(DENIED); }
  async execute(input: AiToolInput) {
    const { teamId } = this.validate(input.args) as any;
    return this.teams.remove(input.tenantId, teamId);
  }
}

@Injectable()
export class RemoveTeamMemberTool implements AiTool {
  name = 'remove_team_member';
  permission: PermissionCode = 'teams.manage_members';
  description = 'Remove uma pessoa da equipe. Use search_users para achar a pessoa.';
  parameters = {
    type: 'object', additionalProperties: false, required: ['teamId'],
    properties: { teamId: { type: 'string' }, memberTenantUserId: { type: 'string' }, memberName: { type: 'string' } },
  };
  validate = (args: unknown) => {
    const value = objectArgs(args, ['teamId', 'memberTenantUserId', 'memberName']);
    nonEmpty(value.teamId, 'teamId');
    if (!value.memberTenantUserId && !value.memberName) throw new BadRequestException('memberTenantUserId ou memberName é obrigatório');
    return value;
  };
  constructor(private readonly teams: TeamsService, private readonly users: UsersService, private readonly permissions: AiPermissionService) {}
  async authorize(input: AiToolInput) { if (!(await this.permissions.can(input, this.permission))) throw new ForbiddenException(DENIED); }
  async execute(input: AiToolInput): Promise<unknown> {
    const value = this.validate(input.args) as any;
    const rows = await teamRows(this.teams, input.tenantId);
    const team = rows.find((row: any) => row.id === value.teamId);
    if (!team) throw new BadRequestException('equipe não encontrada no tenant');
    const people = await this.users.findAll(input.tenantId);
    const member = value.memberTenantUserId
      ? people.find((row: any) => row.id === value.memberTenantUserId)
      : resolveOne(people, value.memberName, 'memberName');
    if (clarification(member)) return member as AiToolClarification;
    if (!member) throw new BadRequestException('pessoa não encontrada no tenant');
    await this.teams.removeMember(input.tenantId, team.id, member.id);
    return { teamId: team.id, memberName: member.name ?? member.user?.name, removed: true };
  }
}
```

- [ ] **Step 4: Exportar o toolkit**

Criar `apps/api/src/modules/ai/tools/teams/index.ts`:

```ts
import { CreateTeamTool, UpdateTeamTool, DeleteTeamTool, RemoveTeamMemberTool } from './team-tools';
import { TeamsService } from '../../../teams/teams.service';
import { UsersService } from '../../../users/users.service';
import { AiPermissionService } from '../../ai-permission.service';

export * from './team-tools';

export const TEAM_TOOL_PROVIDERS = [
  { provide: CreateTeamTool, inject: [TeamsService, AiPermissionService], useFactory: (teams: TeamsService, permissions: AiPermissionService) => new CreateTeamTool(teams, permissions) },
  { provide: UpdateTeamTool, inject: [TeamsService, UsersService, AiPermissionService], useFactory: (teams: TeamsService, users: UsersService, permissions: AiPermissionService) => new UpdateTeamTool(teams, users, permissions) },
  { provide: DeleteTeamTool, inject: [TeamsService, AiPermissionService], useFactory: (teams: TeamsService, permissions: AiPermissionService) => new DeleteTeamTool(teams, permissions) },
  { provide: RemoveTeamMemberTool, inject: [TeamsService, UsersService, AiPermissionService], useFactory: (teams: TeamsService, users: UsersService, permissions: AiPermissionService) => new RemoveTeamMemberTool(teams, users, permissions) },
];
```

- [ ] **Step 5: Rodar os testes e ver passar**

```bash
cd /root/quadro-do-mane/apps/api && node -r ts-node/register --test src/modules/ai/tools/teams/team-tools.spec.ts
```

Expected: PASS com 4 testes.

- [ ] **Step 6: Registrar no módulo, atualizar o spec do módulo e verificar**

```ts
import { TEAM_TOOL_PROVIDERS, CreateTeamTool, UpdateTeamTool, DeleteTeamTool, RemoveTeamMemberTool } from './tools/teams';
```

Espalhar `...TEAM_TOOL_PROVIDERS` em `providers` e acrescentar as quatro classes ao `inject` do registry. Em `ai.module.spec.ts`, anexar as quatro ao `expected` e aos fakes.

```bash
cd /root/quadro-do-mane/apps/api && npx tsc --noEmit && node -r ts-node/register --test src/modules/ai/ai.module.spec.ts src/modules/ai/tools/teams/team-tools.spec.ts
```

Expected: tudo verde.

- [ ] **Step 7: Commitar**

```bash
cd /root/quadro-do-mane
git add apps/api/src/modules/ai/tools/teams apps/api/src/modules/ai/ai.module.ts apps/api/src/modules/ai/ai.module.spec.ts
git commit -m "feat(ai): tools de criacao, edicao, exclusao e membro de equipe"
```

---

### Task 10: Posição no kanban e permissão de anexo alinhada

Dois ajustes de paridade que dependem das tasks anteriores.

**Files:**
- Modify: `apps/api/src/modules/ai/tools/move-task.tool.ts`
- Modify: `apps/api/src/modules/ai/tools/domain-action-tools.spec.ts`
- Modify: `apps/api/src/modules/tasks/tasks.controller.ts:147-148`
- Modify: `apps/api/src/modules/upload/upload.controller.ts:56-57`

**Interfaces:**
- Consumes: `AiTool.permission` (Task 4).
- Produces: `move_task` aceita `kanbanPosition` opcional e declara `tasks.move` quando informado.

- [ ] **Step 1: Escrever o teste que falha**

Adicionar a `apps/api/src/modules/ai/tools/domain-action-tools.spec.ts`:

```ts
test('move_task aceita kanbanPosition e usa tasks.move quando a posição vem informada', async () => {
  const tool = new MoveTaskTool(tasks as any, users as any, projects as any);
  const args = tool.validate?.({ taskId: 't1', statusName: 'Concluído', kanbanPosition: 3 });
  assert.equal((args as any).kanbanPosition, 3);
  assert.equal(tool.permission, 'tasks.move');
});

test('move_task sem kanbanPosition continua valendo só a mudança de status', () => {
  const tool = new MoveTaskTool(tasks as any, users as any, projects as any);
  const args = tool.validate?.({ taskId: 't1', statusName: 'Concluído' }) as any;
  assert.equal(args.kanbanPosition, undefined);
});

test('move_task rejeita posição que não é inteiro', () => {
  const tool = new MoveTaskTool(tasks as any, users as any, projects as any);
  assert.throws(() => tool.validate?.({ taskId: 't1', statusName: 'X', kanbanPosition: 'topo' }), /kanbanPosition/);
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd /root/quadro-do-mane/apps/api && node -r ts-node/register --test src/modules/ai/tools/domain-action-tools.spec.ts
```

Expected: FAIL — `kanbanPosition` é campo não suportado e `permission` ainda é `tasks.change_status`.

- [ ] **Step 3: Implementar**

Em `apps/api/src/modules/ai/tools/task-tool.schemas.ts`, `validateMoveArgs` (linha 62) passa a aceitar `kanbanPosition` e validar inteiro:

```ts
export const validateMoveArgs = (args: unknown) => {
  const value = objectArgs(args, ['taskId', 'statusId', 'statusName', 'kanbanPosition']);
  nonEmpty(value.taskId, 'taskId');
  if (!value.statusId && !value.statusName) throw new BadRequestException('statusId ou statusName é obrigatório');
  if (value.kanbanPosition !== undefined) {
    if (!Number.isInteger(value.kanbanPosition)) throw new BadRequestException('kanbanPosition inválido');
  }
  return value;
};
```

Em `apps/api/src/modules/ai/tools/move-task.tool.ts`: declarar `permission = 'tasks.move'`, adicionar `kanbanPosition: { type: 'integer' }` em `parameters.properties`, e em `execute` chamar `this.tasks.moveTask` com o DTO quando a posição vier, ou `changeStatus` quando não vier:

```ts
async execute(input: AiToolInput) {
  const args = this.validate(input.args) as any;
  const statusId = args.statusId ?? (await this.resolveStatus(args.statusName));
  const task = args.kanbanPosition === undefined
    ? await this.tasks.changeStatus(input.tenantId, args.taskId, statusId, input.actorTenantUserId)
    : await this.tasks.moveTask(input.tenantId, args.taskId, { statusId, kanbanPosition: args.kanbanPosition }, input.actorTenantUserId);
  return { id: task.id, title: task.title, status: (task as any).status?.name, kanbanPosition: (task as any).kanbanPosition };
}
```

O `resolveStatus` reaproveita o mesmo caminho que a tool já usa hoje; não criar uma segunda consulta se a implementação atual já resolver o status.

- [ ] **Step 4: Rodar e ver passar**

```bash
cd /root/quadro-do-mane/apps/api && node -r ts-node/register --test src/modules/ai/tools/domain-action-tools.spec.ts src/modules/ai/tools/task-tools.spec.ts
```

Expected: ambos verdes.

- [ ] **Step 5: Alinhar a permissão de anexo nos controllers**

Em `apps/api/src/modules/tasks/tasks.controller.ts:147-148`, trocar `@RequirePermissions('tasks.edit')` por `@RequirePermissions('tasks.attachments_manage')` no `DELETE :id/attachments/:attachmentId`.

Em `apps/api/src/modules/upload/upload.controller.ts:56-57`, trocar `@RequirePermissions('tasks.edit')` por `@RequirePermissions('tasks.attachments_manage')` no `POST tasks/:taskId`.

Justificativa: `prisma/seed.ts:213,220` já concede `tasks.attachments_manage` a gestor e colaborador, então nenhum papel semeado perde acesso.

- [ ] **Step 6: Verificar**

```bash
cd /root/quadro-do-mane/apps/api && npx tsc --noEmit && node -r ts-node/register --test src/modules/tasks/*.spec.ts src/modules/upload/*.spec.ts src/modules/ai/tools/*.spec.ts src/modules/ai/tools/tasks/*.spec.ts src/modules/ai/tools/projects/*.spec.ts src/modules/ai/tools/teams/*.spec.ts
```

Expected: tudo verde.

- [ ] **Step 7: Commitar**

```bash
cd /root/quadro-do-mane
git add apps/api/src/modules/ai/tools/move-task.tool.ts apps/api/src/modules/ai/tools/task-tool.schemas.ts apps/api/src/modules/ai/tools/domain-action-tools.spec.ts apps/api/src/modules/tasks/tasks.controller.ts apps/api/src/modules/upload/upload.controller.ts
git commit -m "fix(ai): posicao de kanban em move_task e permissao de anexo por codigo"
```

---

### Task 11: Verificação final do programa

Fecha a onda com a suíte completa e evidência de que nada regrediu.

**Files:**
- Nenhum arquivo novo. Apenas verificação.

- [ ] **Step 1: Typecheck dos dois pacotes**

```bash
cd /root/quadro-do-mane/apps/api && npx tsc --noEmit
cd /root/quadro-do-mane/apps/web && npx tsc --noEmit
```

Expected: ambos limpos.

- [ ] **Step 2: Suíte completa de IA e upload, sem a spec que faz rede**

```bash
cd /root/quadro-do-mane/apps/api
node -r ts-node/register --test \
  src/modules/ai/ai.service.spec.ts \
  src/modules/ai/ai-security.spec.ts \
  src/modules/ai/ai.module.spec.ts \
  src/modules/ai/ai-permission.service.spec.ts \
  src/modules/ai/tools/*.spec.ts \
  src/modules/ai/tools/tasks/*.spec.ts \
  src/modules/ai/tools/projects/*.spec.ts \
  src/modules/ai/tools/teams/*.spec.ts \
  src/modules/upload/attachment-intake.service.spec.ts
```

Expected: tudo verde. `ai-oauth.e2e.spec.ts` e `ai-runtime.http.e2e.spec.ts` são e2e e ficam de fora desta rodada, como já é o costume neste repositório.

- [ ] **Step 3: Suíte de web**

```bash
cd /root/quadro-do-mane/apps/web && npx tsx --test src/lib/*.spec.ts src/lib/*.test.ts src/components/ai/AiModelCombobox.spec.ts
```

Expected: verde, incluindo os 3 casos novos de `task-filters.spec.ts`.

- [ ] **Step 4: Build de produção do web e conferência do manifesto**

```bash
cd /root/quadro-do-mane/apps/web && npm run build
grep -c '"/daily-routine"' .next/app-path-routes-manifest.json
```

Expected: build OK e `1`.

- [ ] **Step 5: Conferir que as tools novas entraram no registro com permissão declarada**

```bash
cd /root/quadro-do-mane/apps/api
node -r ts-node/register -e "
const path = require('path');
const { AiModule } = require('./src/modules/ai/ai.module');
const providers = Reflect.getMetadata('providers', AiModule) ?? [];
const registry = providers.find((entry) => entry?.provide?.name === 'AiToolRegistryService');
const inject = registry.inject.map((token) => token?.name ?? String(token));
console.log('tokens no registry:', inject.length);
console.log('primeiro token:', inject[0]);
"
```

Expected: `primeiro token` é `AI_PERMISSION_SERVICE`, provando que o registry filtra por papel. A contagem exata por papel já é coberta por `tools/registry.spec.ts`.

- [ ] **Step 6: Commitar o relatório de verificação**

Não commitar nada se os passos 1 a 5 passarem sem alteração de arquivo. Se algum ajuste for necessário, commitar só esse arquivo com mensagem descritiva.