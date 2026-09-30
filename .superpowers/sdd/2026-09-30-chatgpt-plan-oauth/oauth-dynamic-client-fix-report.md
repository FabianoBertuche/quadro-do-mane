# OAuth Dynamic Client Fix Report

Date: 2026-09-30

## Change

For first-time authorization, `AiOAuthService.completeAuthorization` now uses
the required callback `client_id` as the authorization-code token-exchange
client ID. The callback-issued value is also the expected final client identity
and ID-token audience. Returning flows continue to use the stored client ID
when the callback omits `client_id`; a supplied mismatch is rejected.

No token or secret values were logged.

## Red Evidence

Test added first: `uses the callback-issued dynamic client ID to complete
ChatGPT OAuth and resolve an OpenAI token` in
`apps/api/src/modules/ai/ai-oauth.e2e.spec.ts`.

The fixture requires `client_id=oaiapp_callback-issued-client` at the token
endpoint, returns no `client_id` in the token response, and signs its ID token
with that callback value as `aud`.

Initial command:

```sh
TS_NODE_PROJECT=apps/api/tsconfig.json TS_NODE_TRANSPILE_ONLY=1 node -r ts-node/register --test apps/api/src/modules/ai/ai-oauth.e2e.spec.ts
```

Initial result: exit 1. The new test failed in `controller.complete` with
`AiOAuthException: Nao foi possivel concluir a autorizacao. Tente novamente.`
The pre-fix service passed `attempt.clientId` (`dynamic_agent_client`) to the
token exchange and then required the omitted token-response `client_id` via
`resolveClientId`, so it could not complete the callback-issued-client flow.

The unconfigured test command was also attempted first:

```sh
node -r ts-node/register --test apps/api/src/modules/ai/ai-oauth.e2e.spec.ts
```

It did not execute tests because the pre-existing e2e spec uses `Array#at`
while the repository TypeScript target is ES2021. Using the API project and
transpile-only mode above executes the actual runtime regression without
altering unrelated test configuration.

## Green Evidence

After the minimal service change, the same focused e2e command exited 0:

```text
tests 1
pass 1
fail 0
```

Focused OAuth suite:

```sh
TS_NODE_PROJECT=apps/api/tsconfig.json TS_NODE_TRANSPILE_ONLY=1 node -r ts-node/register --test apps/api/src/modules/ai/ai-oauth*.spec.ts
```

Result: exit 0, `tests 28`, `pass 28`, `fail 0`.

API build:

```sh
npm run build:api
```

Result: exit 0 (`nest build`).

## Returning Client Regression

Added an e2e assertion that the returning authorization-code exchange sends
the retained `oaiapp_callback-issued-client` value at the token endpoint.

Red evidence used the same assertion with the deliberately incorrect expected
value `dynamic_agent_client`:

```sh
TS_NODE_PROJECT=apps/api/tsconfig.json TS_NODE_TRANSPILE_ONLY=1 node -r ts-node/register --test apps/api/src/modules/ai/ai-oauth.e2e.spec.ts
```

Result: exit 1 at `ai-oauth.e2e.spec.ts:166`, with actual
`oaiapp_callback-issued-client` and expected `dynamic_agent_client`.

The final assertion expects `oaiapp_callback-issued-client`; no production
code change was required.

Green verification:

```sh
TS_NODE_PROJECT=apps/api/tsconfig.json TS_NODE_TRANSPILE_ONLY=1 node -r ts-node/register --test apps/api/src/modules/ai/ai-oauth*.spec.ts
npm run build:api
```

Results: OAuth suite exit 0, `tests 28`, `pass 28`, `fail 0`; API build exit
0 (`nest build`).
