# EXPO_DEV.md — Uso do Expo.dev no Quadro do Manê

> Guia completo de uso da plataforma **Expo.dev** (EAS Services) para o app
> móvel Android do Quadro do Manê.
> Última atualização: **08/09/2026**

---

## 1. Visão Geral

O app móvel (`apps/mobile`) é construído com **Expo SDK 57** (React Native
0.86 + TypeScript + expo-router) e usa a infraestrutura do **Expo.dev / EAS
(Expo Application Services)** para:

- **Desenvolvimento local** — `expo start` (Expo Go, dev server, web).
- **Builds na nuvem** — gerar **APK** de distribuição interna (perfil `preview`)
  e **AAB** para a Play Store (perfil `production`), sem precisar de máquina
  com Android SDK/Keystore local.
- **Push notifications** — expo-notifications + Firebase Cloud Messaging (FCM).
- **Configuração remota** — `appVersionSource: "remote"` gerencia a versão.

**Dados do projeto EAS:**

| Item | Valor |
|---|---|
| Projeto EAS (projectId) | `5c27f9c8-ada8-4061-acf8-c1032f08ea06` |
| Owner | `phalgus` |
| Slug | `quadro-do-mane` |
| Pacote Android | `com.quadrodomane.app` |
| Scheme | `quadrodomane` |

---

## 2. Pré-requisitos

1. **Node.js** (>= 18) e **npm**.
2. **Conta Expo.dev** criada e vinculada ao projeto como `owner` ou membro.
3. **CLI do EAS** instalada globalmente:
   ```bash
   npm install -g eas-cli
   ```
4. **Login** (uma vez por máquina):
   ```bash
   eas login
   eas whoami    # confirma em qual conta está logado
   ```
   > Para deslogar: `eas logout`.

---

## 3. Estrutura de arquivos relevantes

```
apps/mobile/
  package.json          # dependências Expo/RN + scripts (expo start)
  app.config.js         # configuração do app (nome, slug, package, plugins, EAS)
  eas.json              # perfis de build (preview APK / production AAB)
  .env / .env.example   # variáveis locais (EXPO_PUBLIC_API_URL)
  .easignore            # padrão de arquivos ignorados nos builds
  google-services.json  # credencial Firebase/FCM (Android)
  plugins/withGradleRetry.js   # config-plugin p/ tolerar Maven 429 no build
  src/                  # código (lib, theme, ...)
  dist/                 # export estático gerado (ignorado)
```

### 3.1 `app.config.js`

Define o app e injeta o `google-services.json` do Firebase (via EAS secret em
cloud build ou arquivo local em dev):

```js
const googleServices =
  process.env.GOOGLE_SERVICES_JSON && fs.existsSync(process.env.GOOGLE_SERVICES_JSON)
    ? process.env.GOOGLE_SERVICES_JSON
    : './google-services.json';
```

- `extra.eas.projectId` → vincula ao projeto EAS.
- `android.package` → `com.quadrodomane.app`.
- `plugins` → `expo-router`, `expo-splash-screen`, `expo-secure-store`,
  `expo-font`, `expo-notifications`, `./plugins/withGradleRetry`.
- `owner: 'phalgus'` → conta dona do projeto.

### 3.2 `eas.json`

```json
{
  "cli": { "version": ">= 13.0.0", "appVersionSource": "remote" },
  "build": {
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" },
      "env": { "EXPO_PUBLIC_API_URL": "https://montemoria.com/api" }
    },
    "production": {
      "autoIncrement": true,
      "android": { "buildType": "app-bundle" }
    }
  },
  "submit": { "production": {} }
}
```

- **`preview`**: distribuição interna, gera **APK** direto (sem Play Store),
  injeta a URL da API em produção.
- **`production`**: gera **AAB** (`app-bundle`) com versionamento automático,
  pronto para submissão à Play Store.

---

## 4. Desenvolvimento local (`expo start`)

A partir de `apps/mobile/`:

```bash
# Inicia o dev server (qr code p/ Expo Go no celular)
npx expo start

# Opções:
npx expo start --android   # abre no emulador Android
npx expo start --ios       # abre no simulador iOS
npx expo start --web       # roda no navegador (react-native-web)

# Resetar cache (útil quando mudanças não aparecem)
npx expo start -c
```

> O `metro.config.js` foi configurado para funcionar com o **monorepo npm
> workspaces** — não precisa de ajustes manuais para resolução de pacotes.

---

## 5. Builds na nuvem (EAS Build)

### 5.1 Perfil `preview` (APK — distribuição interna)

```bash
eas build -p android --profile preview
```

- Gera um **APK instalável direto** em qualquer Android (sem loja).
- Baixa a URL do build ao final (`eas build:list`).
- É o fluxo usado para distribuir as versões atuais do app.

### 5.2 Perfil `production` (AAB — Play Store)

```bash
eas build -p android --profile production
```

- Gera **AAB** com `autoIncrement: true` (a versão sobe sozinha a cada build).
- Destinado à submissão na Google Play Console.

### 5.3 Gerenciando builds

```bash
eas build:list --platform android                # lista builds recentes
eas build:list --platform android --limit 5      # últimos 5
eas build:list --platform android --non-interactive
```

### 5.4 Configuração remota da versão

Com `appVersionSource: "remote"`, o EAS **define o número de versão (build
number)** automaticamente no servidor — não precisa editar `app.config.js`
manualmente a cada release.

### 5.5 Secrets (arquivos sensíveis)

O `google-services.json` (Firebase) pode ser passado ao build sem commitar via
**EAS secret**:

```bash
eas secret:create --name GOOGLE_SERVICES_JSON --value "$(cat google-services.json)"
```

O `app.config.js` lê a env `GOOGLE_SERVICES_JSON` caso exista; senão usa o
arquivo local `./google-services.json`.

---

## 6. Push Notifications (expo-notifications + FCM)

- O app usa **expo-notifications** com **Firebase Cloud Messaging** para push
  no Android standalone.
- A configuração do Firebase é injetada pelo `app.config.js` via
  `google-services.json`.
- Para registrar/disparar pushes no app, o fluxo usa o backend NestJS que se
  comunica com o FCM (ver módulo de push/notificações na API).

**Pontos de atenção:**
- `google-services.json` é sensível — **não commitar** (está no `.gitignore`).
- Mudanças no Firebase (novo projeto/package) exigem trocar esse arquivo e
  refazer o build.
- Push correto **apenas no build standalone (APK/AAB)**; no Expo Go o push tem
  limitações.

---

## 7. Troubleshooting

### 7.1 Erro Maven HTTP 429 durante o build (Maven Central rate-limit)

Sintoma: build falha baixando dependências do Gradle com erro **429**.

Causa: rate-limit do Maven Central sob demanda durante builds na nuvem.

Solução (já aplicada no projeto por `plugins/withGradleRetry.js`):
- Aumenta timeouts de rede do Gradle (`socketTimeout`, `connectionTimeout`).
- Aumenta retries (`repository.max.retries` + backoff) para tolerar 429.
- Adiciona mirror alternativo do Maven:
  `https://maven-central.storage-download.googleapis.com/maven2/`

Se quiser revalidar/manual:
```gradle
org.gradle.internal.http.socketTimeout=180000
org.gradle.internal.http.connectionTimeout=180000
org.gradle.internal.repository.max.retries=12
```

### 7.2 Build falha sem segredo `GOOGLE_SERVICES_JSON`

Garanta que o secret existe no EAS ou que `google-services.json` está presente
localmente antes de buildar.

### 7.3 `app.json` gerado na raiz

O EAS pode gerar um `app.json` na raiz do monorepo — ele é **ignorado
(commit `5e21f26`)**. Não use o da raiz; a fonte da verdade é
`apps/mobile/app.config.js`.

### 7.4 Dedupe / cache de builds

Se uma mudança não aparecer no build:
- Confira que o código está commitado/em `apps/mobile`.
- Use `expo start -c` no dev para limpar cache do Metro.

---

## 8. Fluxo de trabalho típico (distribuir uma versão)

1. Develop no app com `npx expo start`.
2. Commit as mudanças em `apps/mobile`.
3. Rode um build de teste interno:
   ```bash
   eas build -p android --profile preview
   ```
4. Instale o APK baixado em um aparelho.
5. Quando tudo validado, gere o AAB de produção:
   ```bash
   eas build -p android --profile production
   ```

---

## 9. Artefatos e histórico

- **APK v2** — build `582f110d` (edição de tarefas/projetos).
- **APK v3** — build `d70b4fdc` (checklists, subtarefas, e-mails, formulários e filtros).
- Artefatos de build (`*.apk`, `*.aab`) são ignorados pelo git (commit `0c6f660`).

---

## 10. Comandos rápidos (referência)

| Comando | O que faz |
|---|---|
| `eas login` / `eas whoami` / `eas logout` | gerenciar sessão Expo |
| `npx expo start [--android\|--ios\|--web\|-c]` | dev server local |
| `eas build -p android --profile preview` | APK interno |
| `eas build -p android --profile production` | AAB p/ Play Store |
| `eas build:list --platform android` | lista builds |
| `eas secret:create --name GOOGLE_SERVICES_JSON ...` | registrar secret Firebase |
| `eas update` | OTA (se habilitado para o canal) |
