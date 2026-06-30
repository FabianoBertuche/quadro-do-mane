# Plano — Feedback de erro + UX de permissões em `/projects`

## Contexto
Colaborador logou, abriu `/projects`, clicou em "Novo Projeto". Dois sintomas:

1. **Dropdown de responsável vazio** — o `useQuery(['users'])` chama `GET /api/users` que retorna **403** porque a role `colaborador` não tem `users.view`. O React Query deixa `users=undefined`, então `(users || []).map(...)` produz zero `<option>`.
2. **"Criar Projeto" não faz nada** — `POST /api/projects` também retorna 403 (colaborador não tem `projects.create`). O `useMutation` não tem `onError`, então o usuário só vê o botão ficar `disabled` por um instante e voltar ao normal. **Nenhum toast, nenhuma mensagem**.

Sem mexer na matriz de permissões (`PERMISSIONS.md` continua igual), a UI precisa:
- Esconder o botão "+ Novo Projeto" para quem não tem `projects.create`.
- Tratar erros 403/4xx com um toast explicando o motivo.

## Mudanças no [`apps/web/src/app/(app)/projects/page.tsx`](apps/web/src/app/(app)/projects/page.tsx)

### Helper compartilhado
```ts
// extrai mensagem legível do Axios error (compatível com class-validator arrays)
function extractErrorMessage(err: any, fallback: string): string {
  const data = err?.response?.data;
  if (Array.isArray(data?.message)) return data.message.join(', ');
  if (typeof data?.message === 'string') return data.message;
  return fallback;
}
```

### Permissões
- Importar `usePermission` de `@/lib/permissions`
- `const canCreate = usePermission('projects.create');`
- Botão **+ Novo Projeto** renderizado **somente** se `canCreate`.
- Se o usuário é admin/gestor mas `users.view` falhar (improvável mas possível), mostrar fallback no dropdown: `+ Selecione você mesmo (dono)`.

### Mutation `createMutation`
- Adicionar `onError` que seta estado `toast = { kind: 'error', text: ... }`.
- Mensagem especial para 403: `"Você não tem permissão para criar projetos. Fale com um administrador."`.
- Mensagem especial para 400/422 com `message` array: mostrar a primeira entrada.

### Estado de toast (mesmo padrão de `/collaborators`)
```ts
const [toast, setToast] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
```
- Toast verde em `onSuccess` ("Projeto criado").
- Toast vermelho em `onError` (texto amigável).
- Auto-dismiss após 4s.

### Dropdown de responsável — fallback gracioso
Se `users` vier vazio (por falta de `users.view` ou erro), exibir uma mensagem explicativa em vez de dropdown vazio:
```tsx
{!users?.length ? (
  <p className="text-xs text-muted-foreground italic">
    Não foi possível carregar a lista de usuários.
  </p>
) : (
  <select ...>{(users).map(...)}</select>
)}
```

## Validação manual
1. Login `fabiano.bertuche@montemoria.com.br` / `FabianoABC` (gestor):
   - Botão "+ Novo Projeto" visível.
   - Dropdown de responsável lista Admin, Fabiano, Smoke Test, Usuario Novo.
   - Criar projeto com sucesso → toast verde.
2. Criar usuário `colab1@local.test` com role `colaborador` (já testado).
3. Login `colab1@local.test` / `SenhaColab1`:
   - Botão "+ Novo Projeto" **escondido**.
   - Tentar abrir o projeto Implantação Inicial → funciona (colaborador tem `projects.view`).
4. Forçar erro: tentar editar `ownerTenantUserId` inválido via API → toast vermelho com a mensagem do backend.

## Não-objetivos
- Não vou alterar `PERMISSIONS.md`.
- Não vou adicionar fallback de "dono = próprio usuário" automaticamente (UX poderia confundir).
- Não vou ajustar o backend.