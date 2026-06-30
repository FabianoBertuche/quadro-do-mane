# E-mail MVP — Plano Arquitetural

## Visão geral

Reescrita da aba **E-mail** como um cliente corporativo integrado, onde:

- O **tenant** (admin) define uma única vez o **servidor** IMAP/SMTP (preset por domínio ou customizado).
- O **colaborador** cadastra **apenas sua senha** na aba E-mail e visualiza sua caixa.
- O backend resolve IMAP/SMTP a partir de **tenant + User.email + senha criptografada do próprio user**.

## Decisões fechadas

| Tema | Decisão |
|---|---|
| Onde mora o host/porta/secure | Tabela `email_tenant_settings` (1 linha por tenant) |
| Quem configura o servidor | Admin do tenant, em `Configurações → Empresa` |
| Como o admin descobre o host | Radio "Detectar por domínio" (preset table) ou "Personalizado" (inputs livres) |
| UX de senha ausente/incorreta | Card inline na aba E-mail, estilo Gmail setup (passo-a-passo) |
| Escopo do MVP | INBOX últimos 20, ler (HTML sanitizado), responder (reply), enviar novo |
| Senha | Mantida em AES-256-GCM (tabela `email_settings` permanece, só encolhe) |
| Provider de referência | `mail.montemoria.com.br` — IMAP 993 SSL, SMTP 465 SSL |

## Modelo de dados

### Nova tabela `email_tenant_settings`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid FK → tenants (unique) | 1:1 |
| `email_domain` | text | ex: `montemoria.com.br` |
| `detection_mode` | enum | `PRESET` \| `CUSTOM` |
| `preset_key` | text? | ex: `montemoria`, `gmail`, `office365` |
| `imap_host`, `imap_port`, `imap_secure` | text/int/bool | sempre preenchido |
| `smtp_host`, `smtp_port`, `smtp_secure` | text/int/bool | sempre preenchido |
| `updated_by_tenant_user_id` | uuid FK | |
| `created_at` / `updated_at` | timestamptz | |

### Tabela `email_settings` (encolhe)

Mantém: `tenantUserId`, `protocol`, `passwordCiphertext`, `passwordIv`, `passwordAuthTag`, `createdAt`, `updatedAt`.
**Removidos:** `host`, `port`, `user`, `secure` (agora vêm do tenant + `User.email`).

### Preset table (estática, backend)

JSON embutido em `apps/api/src/modules/emails/domain-presets.ts`:

```ts
[
  { key: 'montemoria',  domain: 'montemoria.com.br', imapHost: 'mail.montemoria.com.br', imapPort: 993, imapSecure: true,  smtpHost: 'mail.montemoria.com.br', smtpPort: 465, smtpSecure: true },
  { key: 'gmail',       domain: 'gmail.com',         imapHost: 'imap.gmail.com',         imapPort: 993, imapSecure: true,  smtpHost: 'smtp.gmail.com',         smtpPort: 465, smtpSecure: true },
  { key: 'office365',   domain: 'outlook.com',       imapHost: 'outlook.office365.com',  imapPort: 993, imapSecure: true,  smtpHost: 'smtp.office365.com',      smtpPort: 587, smtpSecure: false },
]
```

## Endpoints

| Método | Rota | Permissão | Função |
|---|---|---|---|
| GET | `/email/domain-presets` | `email.view` | Lista presets disponíveis |
| GET | `/email/tenant-settings` | `email.view` | Retorna config do tenant para o card de setup |
| PATCH | `/email/tenant-settings` | `email.admin` | Admin atualiza servidor do tenant |
| GET | `/emails/settings` | `email.view` | Snapshot leve `{ tenantConfigured, imapConfigured, smtpConfigured, userEmail, server }` |
| PATCH | `/emails/password` | `email.view` | `{ protocol, password }` — salva cifra |
| POST | `/emails/test-connection` | `email.view` | Tenta IMAP+SMTP com a senha informada; retorna `{imap, smtp}` |
| GET | `/emails/messages` | `email.view` | Lista últimos 20 da INBOX |
| GET | `/emails/messages/:uid` | `email.view` | Body + headers (Message-ID, References, attachmentsCount) |
| POST | `/emails/send` | `email.view` | Envia novo (from = User.email) |
| POST | `/emails/reply` | `email.view` | `{ uid, body }` → reply com In-Reply-To/References |

## Frontend

### `apps/web/src/app/(app)/emails/page.tsx` (reescrito)

- Header de ferramentas: `[Atualizar] [Escrever]`.
- Layout 2 colunas: lista (esquerda) + reader (direita).
- Estado derivado:
  - `tenantConfigured && imapConfigured && smtpConfigured` → renderiza inbox (lista + reader + composer modal).
  - Caso contrário → renderiza `<EmailSetupCard />` com passo-a-passo + banner de "senha incorreta" se IMAP retornar 401/500.
- Erros IMAP estruturados (ex: `Invalid login: 535 Incorrect authentication data`) → capturados em `isError` da query e mostrados como banner.

### Novos componentes em `apps/web/src/components/emails/`

| Componente | Responsabilidade |
|---|---|
| `EmailSetupCard` | Card Gmail-style com servidor readonly + 2 campos de senha (IMAP/SMTP) + toggle "mostrar/ocultar" |
| `EmailList` | Lista de mensagens (subject, from, data) com suporte a seleção |
| `EmailReader` | HTML sanitizado via DOMPurify + fallback text + ações |
| `EmailComposer` | Modal "Escrever" (to/subject/body) |
| `EmailReplyForm` | Inline no reader, textarea + Enviar via POST /emails/reply |
| `TenantEmailAdminCard` | Card admin em `Configurações → Empresa` com presets + custom |

### `apps/web/src/app/(app)/settings/page.tsx` (estensão)

Adiciona `<TenantEmailAdminCard />` visível **somente** quando `role === 'admin'`.

## Segurança

- Senha: AES-256-GCM (já existe via `EncryptionService`).
- Senha **nunca** devolvida para o front — apenas `passwordSet: boolean`.
- HTML do e-mail sanitizado com DOMPurify antes de renderizar.
- Conexão IMAP/SMTP: TLS por padrão; modo `secure=false` só via config explícita do tenant.

## Permissões

- `email.view` (existente renomeado) — para usar a aba E-mail.
- `email.admin` (nova) — para configurar o servidor do tenant. Adicionada ao role admin no seed.

## Fluxo end-to-end (validado em dev)

1. Admin faz login → vai em `Configurações → Empresa → E-mail`.
2. Admin digita `montemoria.com.br` + seleciona preset `montemoria` → clica "Salvar".
3. Backend persiste `email_tenant_settings` com IMAP `mail.montemoria.com.br:993` e SMTP `:465`.
4. Colaborador `fabiano.bertuche@montemoria.com.br` faz login e clica na aba **E-mail**.
5. Backend retorna `tenantConfigured: true`, mas `imapConfigured: false, smtpConfigured: false` → renderiza `<EmailSetupCard />`.
6. Usuário digita a senha (IMAP e/ou SMTP) → clica "Salvar e conectar".
7. Backend cifra e grava; recarrega snapshot → agora `imapConfigured && smtpConfigured` → renderiza inbox.
8. Lista carrega (sucesso ou erro); clique em mensagem → reader com HTML sanitizado.
9. Botão "Responder" → POST `/emails/reply` com `In-Reply-To` e `References` corretos.

## Validação curl (smoke test em dev)

```
GET  /email/tenant-settings        → 200 { configured: false }
GET  /email/domain-presets         → 200 { presets: [montemoria, gmail, office365] }
PATCH /email/tenant-settings       → 200 { id, tenantId, ... } (preset montemoria)
GET  /email/tenant-settings        → 200 { configured: true, ... }
GET  /emails/settings              → 200 { tenantConfigured: true, imapConfigured: false, smtpConfigured: false, server: {...} }
PATCH /emails/password             → 200 { id, passwordCiphertext, passwordIv, passwordAuthTag } (cifra AES-GCM)
GET  /emails/settings              → 200 { tenantConfigured: true, imapConfigured: true, smtpConfigured: true }
POST /emails/test-connection       → 201 { imap: {ok:false,error}, smtp: {ok:false,error:"535 Incorrect authentication data"} }
GET  /emails/messages              → 500 (esperado — IMAP real da Montemoria recusa senha fake)
```

## Estrutura de arquivos

```
apps/api/src/modules/emails/
├── emails.module.ts        # registra EmailsService + EmailsConfigResolver
├── emails.controller.ts    # todas as rotas novas (sem updateEmailSettingsDto com host/port)
├── emails.service.ts       # EmailsService + EmailsConfigResolver + EmailSession + helpers
├── domain-presets.ts       # tabela estática de provedores conhecidos
└── dto/
    ├── index.ts            # barrel
    ├── send-email.dto.ts
    ├── email-password.dto.ts
    ├── email-tenant-settings.dto.ts
    ├── test-connection.dto.ts
    └── reply-email.dto.ts

apps/web/src/
├── types/email.ts                              # tipos do domínio
├── lib/emails-api.ts                            # cliente API tipado
├── lib/sanitize.ts                              # DOMPurify wrapper
├── components/emails/
│   ├── EmailSetupCard.tsx
│   ├── EmailList.tsx
│   ├── EmailReader.tsx
│   ├── EmailComposer.tsx
│   ├── EmailReplyForm.tsx
│   └── TenantEmailAdminCard.tsx
└── app/(app)/emails/page.tsx                   # cliente de e-mail (entrada principal)

apps/api/prisma/
├── migrations/20260629130000_email_tenant_settings/migration.sql
└── schema.prisma                               # EmailTenantSetting + EmailSetting encolhido
```

## Fora do MVP (próxima iteração)

- Múltiplas pastas (Sent/Drafts/Trash).
- Busca full-text.
- Anexos (download/upload).
- Marcar lido/não-lido.
- Encaminhar.
- Sincronização por IDLE/push.
- Múltiplas contas por colaborador.