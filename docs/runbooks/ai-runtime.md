# AI runtime runbook

## Runtime contract

Monte Moria has one server-wide ChatGPT OAuth connection and one selected
OpenAI model. The account's plan, quota, and model entitlements therefore
affect every authenticated user and tenant. This is not a per-user or
per-tenant provider setting.

`AI_ENABLED` controls only the API-key fallback. A connected OAuth account is
used even when `AI_ENABLED=false`; when OAuth is disconnected, the API-key
provider is available only if `AI_ENABLED=true` and `OPENAI_API_KEY` is set.
The fake provider is not selected as a production fallback.

## Catalog and model changes

The API calls `GET https://api.openai.com/v1/models` with the server-side OAuth
bearer token. It filters to `visibility == "list"`, preserves the provider's
server order, and returns only `slug` and `display_name`. Tokens and raw
provider responses never leave the API.

The redacted catalog is cached in API memory for the active connection. A
connect, reconnect, refresh that changes the connection, or disconnect clears
the cache. A model selection is checked against the catalog and then saved on
the singleton runtime row. Every subsequent Responses request uses the saved
slug with `store: false` and `stream: true`.

If the catalog is unavailable, refresh the chat/runtime view after checking the
connection. Do not paste provider payloads, callback URLs, or tokens into
support tickets.

## Permissions and settings migration

During homologation, `ai.use` protects the runtime and model endpoints and
may be used to start the global OAuth flow from chat. The account that completes
OAuth is the account consumed by all users. The administrator-only provider
status route is `GET /api/settings/ai/providers`; it reports ChatGPT and
disabled future providers marked `coming_soon`. The settings page is the
intended long-term location for connection and model administration, but chat
controls remain available during this migration.

## Disconnect and recovery

1. Disconnect the global connection from the protected OAuth action or
   `POST /api/ai/oauth/:id/disconnect`.
2. Confirm the runtime reports `disconnected` and that the model selection was
   cleared.
3. Reconnect using a fresh authorization attempt and complete the full loopback
   callback URL within ten minutes.
4. Refresh the runtime/catalog view and select a model available to the new
   account.
5. If refresh fails with an expired or revoked grant, reconnect instead of
   retrying an old callback. Local revocation is authoritative if provider
   revocation is unavailable.

Provider, catalog, and tool-validation failures are recoverable errors. Chat
persists the user message, assistant message, and action proposals only after
provider completion and tool validation succeed, so a failed request must not
leave partial rows.

## Safe deployment

Supply secrets through the deployment secret manager. Never commit or log
`OPENAI_API_KEY`, OAuth access/refresh/ID tokens, PKCE values, callback URLs, or
private keys. Use the repository's normal migration-before-application order:

```bash
npm run db:generate
npm run build:api
npm run build:web
docker compose -f docker-compose.prod.yml build api web
docker compose -f docker-compose.prod.yml run --build --rm migrate
# Only after the migration succeeds and the database is reachable:
docker compose -f docker-compose.prod.yml up -d --build api web
docker compose -f docker-compose.prod.yml ps
```

Stop immediately if the migration fails or the database is unreachable. Do not
run `docker compose -f docker-compose.prod.yml up -d --build api web` in that
case; fix database connectivity and rerun the migration first.

Verify the API health/auth route accepts its expected `200` or `401`, the web
root returns `200` or its expected login redirect, and the runtime/settings
routes reject unauthenticated or unauthorized requests. An authenticated
runtime response may contain only connection status, provider, selected model,
and redacted catalog entries. A live connected-account catalog check is
optional in CI; mocked integration tests cover OAuth and OpenAI contracts.
