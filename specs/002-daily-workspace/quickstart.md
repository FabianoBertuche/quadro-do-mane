# Quickstart — validar Daily Workspace

## Pré-requisitos

- Node.js e npm compatíveis com o `package-lock.json` do repositório.
- PostgreSQL e API configurados conforme `docker-compose.yml`/`.env` local.
- Um tenant com usuário de teste, tarefas, eventos e rotinas; para a cobertura completa, uma conta com permissões de tarefa, calendário e rotina.
- Para mobile, `apps/mobile/.env` com `EXPO_PUBLIC_API_URL` acessível pelo simulador/dispositivo.
- Depois da T001, executar `npm install` para instalar os runners e dependências declarados em `apps/api/package.json`, `packages/utils/package.json`, `apps/web/package.json` e `apps/mobile/package.json`.

## Subir o ambiente

```bash
cd /root/quadro-do-mane/.worktrees/client-parity-sdd
npm install
npm run dev:api       # terminal 1
npm run dev:web       # terminal 2
npm run dev:mobile    # terminal 3; selecione Android ou iOS no Expo
```

Esses três aliases existem hoje no `package.json` raiz. A API deve responder autenticada sob o prefixo configurado pelo proxy local.

## Cenário manual mínimo

1. Entre com a conta de teste e selecione o tenant.
2. Em **Início**, confirme que a data usa “Horário de São Paulo”, crie massa com uma tarefa vencida, uma atribuída e um item de rotina, e confira as seções.
3. Em **Trabalho**, procure um termo do título, combine projeto e status, abra o detalhe e valide checklists, comentários, anexos, responsáveis e subtarefas.
4. Em **Agenda**, valide um evento que cruza o dia e um lembrete ativo; dispense o lembrete online.
5. Navegue por **Início → Trabalho → Agenda → Mais** na Web e no Expo (Android/iOS).
6. Carregue Início e Agenda online, desligue a rede e reabra no Chrome, Android e iOS: deve aparecer “Dados salvos; somente leitura”; tente criar, editar e excluir tarefa, comentar, concluir rotina ou enviar anexo e confirme que não ocorre chamada mutável.
7. Faça logout e entre em outro tenant. Com rede desligada, confirme que nenhum dado do tenant anterior é exibido.

## Testes automatizados esperados

Após T001 criar os scripts/configurações e T002–T028 criarem os specs, os comandos abaixo existem e são a verificação final: API e `utils` usam `node --test` com `ts-node/register`; Web usa `vitest.config.ts` + jsdom; Expo usa `jest.config.js` + `jest-expo`.

```bash
npm run test:daily-workspace --workspace=api
npm run test:daily-workspace --workspace=utils
npm run test:daily-workspace --workspace=web
npm run test:daily-workspace --workspace=@quadro/mobile
npx playwright test e2e/daily-workspace.spec.ts e2e/daily-workspace-offline.spec.ts
npm run build --workspace=api
npm run build --workspace=web
npm run typecheck --workspace=web
npm run typecheck --workspace=@quadro/mobile
```

O comando Expo roda a mesma suite de componente para Android e iOS com o preset nativo; a validação manual do fluxo também deve ser executada em ambos os simuladores/dispositivos conforme a seção anterior.

## Dados de teste de borda

- Fixar relógio em `2026-09-09T02:59:59.000Z` e `2026-09-09T03:00:00.000Z` para validar a virada local.
- Criar tarefa com `assigneeTenantUserId` e `TaskAssignee` para o mesmo usuário; ela deve aparecer uma vez.
- Criar evento das `2026-09-08T23:30:00-03:00` às `2026-09-09T00:30:00-03:00`; ele deve aparecer no dia 09.
- Remover `tasks.comment` da sessão de teste e confirmar ausência do compositor e 403 na rota direta.
