# MOBILE_APP.md — App Android Quadro do Manê

> Plano e status de desenvolvimento do aplicativo Android (Expo/React Native).
> Atualizar o status das fases conforme o progresso.

---

## Visão Geral

App Android nativo com **todas as funções do app web**, construído com
Expo/React Native dentro do monorepo (`apps/mobile`), consumindo a mesma API
NestJS (`apps/api`) via REST + JWT Bearer.

| Decisão | Escolha |
|---|---|
| Tecnologia | Expo (React Native + TypeScript + expo-router) |
| Distribuição | APK direto via EAS Build (sem Play Store por enquanto) |
| Push notifications | Sim — expo-notifications + Firebase (Fase 5) |
| Escopo | Completo, incluindo telas admin (respeitando permissões) |

## Por que Expo

- Mesma linguagem do projeto (TypeScript/React).
- A API já emite tokens **JWT Bearer + refresh rotativo** sem dependência de
  cookies → funciona nativamente no app.
- Reaproveita lógica de API, tipos e modelo de permissões da web.
- Monorepo: `apps/*` já é workspace npm.

## Estrutura

```
apps/mobile/
  app/                      # Rotas (expo-router, file-based)
    _layout.tsx             # Root layout + guarda de sessão
    index.tsx               # Redirect inicial (/dashboard ou /login)
    (auth)/
      login.tsx
      select-tenant.tsx
    (tabs)/                 # Navegação inferior
      _layout.tsx
      dashboard.tsx
      tasks.tsx
      projects.tsx
      more.tsx              # Menu secundário (equipes, contatos, admin...)
    ...                     # Stacks de detalhe (fase 3+)
  src/
    lib/
      api.ts                # Cliente axios: Bearer + refresh rotativo silencioso
      auth.ts               # Zustand persistido em expo-secure-store
      permissions.ts        # can() / usePermission() (paridade com web)
    theme/
      colors.ts             # Tema slate escuro espelhando tailwind.config da web
```

## Contrato de Autenticação (já existente na API)

| Endpoint | Payload | Retorno |
|---|---|---|
| `POST /auth/login` | `{email, password}` | `{accessToken, refreshToken, user, tenant, permissions, role}` — auto-seleciona tenant único/Monte Moria |
| `POST /auth/select-tenant` | `{tenantId}` (Bearer) | mesma sessão |
| `POST /auth/refresh` | `{refreshToken}` ou Bearer | novo par de tokens (rotação) |
| `POST /auth/logout` | — | revoga família do refresh |
| `GET /auth/me` | — | perfil da sessão atual |

No app os tokens vão em headers (`Authorization: Bearer`), guardados em
**expo-secure-store** (Keystore/Keychain). Sem cookies.

## Fases e Status

### Fase 1 — Setup + Auth — ✅ CONCLUÍDA
- [x] Decisões de arquitetura
- [x] Mapeamento dos endpoints de auth
- [x] Scaffold `apps/mobile` (Expo SDK 57, RN 0.86, TS, expo-router)
- [x] Metro config p/ monorepo npm workspaces
- [x] `src/lib/api.ts` (Bearer + refresh silencioso single-flight)
- [x] `src/lib/auth.ts` (zustand + SecureStore: só tokens; perfil via /auth/me)
- [x] `src/lib/permissions.ts` (can/canAny/usePermission)
- [x] Telas Login e Seleção de Tenant
- [x] Guarda de rotas autenticadas (_layout raiz)
- [x] Tabs iniciais (Início/Tarefas/Projetos/Mais) + tela "Mais" com perfil e logout
- [x] Scripts raiz (`dev:mobile`)
- [x] Validação: tsc sem erros · expo export android OK · build web intacto

> Tokens ficam no SecureStore (Keystore/Keychain). O app NÃO usa cookies.
> Configurar `apps/mobile/.env` (ver `.env.example`) com a URL pública da API.

### Fase 2 — Navegação — ✅ CONCLUÍDA
- [x] Bottom tabs (Início · Tarefas · Projetos · Mais)
- [x] Stacks: detalhe de projeto (card), detalhe de tarefa (modal), criação de projeto/tarefa (modais)
- [x] Telas secundárias: Equipes, Colaboradores, Calendário, Contatos
- [x] Tema slate escuro espelhando o tailwind.config da web

### Fase 3 — Funcionalidades Core — 🚧 GRANDE PARTE CONCLUÍDA
| Tela | Endpoints | Status |
|---|---|---|
| Dashboard (overview + taxa de conclusão) | `/dashboard/overview` | ✅ |
| Projetos: lista + criar + detalhe c/ tarefas | `/projects` | ✅ |
| Tarefas: lista + **Kanban** (mover entre colunas) | `/tasks`, `/tasks/statuses` | ✅ |
| Detalhe da tarefa: status, prioridade, comentários, excluir | `/tasks/:id`, `/comments` | ✅ |
| Criar tarefa (projeto/status/prioridade/responsável) | `POST /tasks` | ✅ |
| Equipes (leitura) | `/teams` | ✅ |
| Colaboradores (leitura) | `/users` | ✅ |
| Calendário (lista por dia) | `/events` | ✅ |
| Contatos (busca local) | `/contacts` | ✅ |

Pendências da Fase 3 (próximas iterações):
- [ ] Editar/excluir projetos; gerenciar membros
- [ ] Edição completa da tarefa (título/descrição/prazo), checklists, anexos, subtarefas
- [ ] Drag-and-drop por gesto longo no Kanban (hoje: setas ← → nas colunas)
- [ ] Formulários de equipes/eventos/contatos (hoje: leitura)
- [ ] Perfil: editar dados + upload de avatar (`/upload`)
- [ ] E-mails (módulo web dedicado)

> Permissões respeitadas via `can()`: botões de criar só aparecem com
> `tasks.create` / `projects.create`; excluir/comentar/prioridade idem.

### Fase 4 — Admin e Secundárias — 🚧 GRANDE PARTE CONCLUÍDA
| Tela | Endpoint | Status |
|---|---|---|
| Notificações (lista, marcar lida, marcar todas) | `/notifications` | ✅ |
| Rotina Diária (checklist do dia + criar item) | `/daily-routine` | ✅ |
| E-mails (caixa de entrada + leitura) | `/emails/messages[/:uid]` | ✅ |
| Auditoria (feed completo) | `/audit-log` | ✅ |
| Atividades (mudanças operacionais) | `/audit-log/activity` | ✅ |

Pendências da Fase 4:
- [ ] Responder/enviar e-mails (`/emails/send`, `/emails/reply`)
- [ ] Gerenciar rotinas (admin: atribuir itens a usuários, eficiência)
- [ ] Filtros de auditoria (ação/período/usuário)

> Todas as entradas no menu "Mais" respeitam permissões
> (`audit.view`, `email.view`) — igual à sidebar web.

### Fase 5 — Push Notifications — ✅ CONCLUÍDA (código)
Backend:
- [x] Modelo `PushDevice` (tabela `push_devices`) + migração aplicada
- [x] Módulo push: `POST /push-devices` (registrar) e `DELETE /push-devices/:token`
- [x] `PushService.sendToUser()` via expo-server-sdk (chunks, falha silenciosa)
- [x] Gatilho: tarefa atribuída (criação e reatribuição) → notificação in-app + push

Mobile:
- [x] `expo-notifications` instalado; handler global configurado
- [x] Registro do token após login/hidratação (`src/lib/push.ts`, tolerante a falhas)
- [x] Canal Android "default" criado
- [x] Logout remove o registro local

Observações de operação:
- Em **Expo Go** o push funciona sem Firebase. Para o **APK standalone**
  será preciso `extra.eas.projectId` no app.json + conta Expo (Fase 6).
- O container `quadro-api` precisa ser rebuildado para expor os novos
  endpoints: `docker compose build api && docker compose up -d api`.

### Fase 6 — Build APK (EAS) — ✅ CONCLUÍDA
- [x] Projeto vinculado: **@phalgus/quadro-do-mane**
  (`projectId: 5c27f9c8-ada8-4061-acf8-c1032f08ea06` no app.json)
- [x] `eas.json`: perfil `preview` → APK direto; `production` → AAB p/ Play Store
- [x] Primeiro build concluído com sucesso
- [x] APK assinado e instalável (94 MB)

**Como gerar um novo APK após mudanças no app:**
```bash
cd apps/mobile
EXPO_TOKEN=<seu-token> eas build -p android --profile preview --non-interactive
```
O link para download aparece no final do log (ou em expo.dev → Builds).

> **Nota:** a URL da API de produção está definida em `eas.json`
> (`build.preview.env.EXPO_PUBLIC_API_URL`) porque arquivos `.env`
> são ignorados pelo git e não sobem para o EAS.

**APK atual (produção, apontando para https://montemoria.com/api):**
https://expo.dev/artifacts/eas/xMmZIpV6PiwjtyOvn-pvg6g1HtmU_xPXzjfxpHqZBSI.apk

**Push standalone (opcional):** o APK atual funciona sem Firebase. Para push
nativo no APK, crie projeto no Firebase Console, gere o `google-services.json`
e registre as credenciais: `eas credentials -p android`.

## Como Rodar (dev)

```bash
npm run dev:mobile          # sobe o metro bundler (apps/mobile)
# escanear QR com o app Expo Go no celular (mesma rede Wi-Fi)
```

A API precisa estar acessível pelo celular: configure `EXPO_PUBLIC_API_URL`
em `apps/mobile/.env` apontando para a API pública
(ex.: `https://seu-dominio.com/api`).
