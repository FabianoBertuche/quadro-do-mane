# ChatGPT plan OAuth runbook

This flow lets an authenticated Monte Moria user authorize ChatGPT plan usage
without exposing an OAuth callback server to the Internet. The browser callback
is copied back to the application, while access and refresh tokens remain
encrypted in the API database. API responses expose connection metadata only.
The connection is intentionally global: one connected ChatGPT account and one
selected model are used by every authenticated user and tenant.

## Configuration

Set these values through the deployment secret manager or environment file:

```dotenv
CHATGPT_OAUTH_AGENT_NAME="Monte Moria"
CHATGPT_OAUTH_HOST_ID=monte-moria
CHATGPT_OAUTH_CALLBACK_PORT=1455
CHATGPT_OAUTH_ISSUER=https://auth.openai.com
```

The API uses OpenID discovery and its built-in OpenAI endpoints by default.
`CHATGPT_OAUTH_AUTHORIZATION_ENDPOINT`, `CHATGPT_OAUTH_TOKEN_ENDPOINT`, and
`CHATGPT_OAUTH_JWKS_URI` are optional overrides for controlled test environments.
Do not set them to arbitrary public endpoints in production. Never put OAuth
tokens, API keys, private keys, or signed ID tokens in `.env.example`,
`.env.docker`, source control, or logs.

The regular API-key fallback is independent of ChatGPT OAuth:

```dotenv
AI_ENABLED=true
OPENAI_API_KEY=<secret-manager-value>
OPENAI_MODEL=gpt-4o-mini
```

`AI_ENABLED` gates only this API-key fallback. OAuth can be used with
`AI_ENABLED=false`. Provider resolution always tries the global OAuth
connection first; the API key is used only when OAuth is disconnected and the
flag and key are both enabled. There is no per-user OAuth connection.

## OpenAI client setup

1. Register/configure the application using OpenAI's Sign in with ChatGPT
   documentation and the loopback redirect URI:
   `http://127.0.0.1:1455/auth/callback`.
2. Confirm the requested scopes include `openid`, `profile`, `email`,
   `offline_access`, `resource.invoke`, and `chatgpt.tokens.use.direct`.
3. Configure the same host ID and callback port in the API environment.
4. Apply the OAuth migration with the normal deploy flow before enabling the
   UI. The migration stores encrypted token fields and no plaintext tokens.

## Global connection flow

1. Sign in to Monte Moria with the `ai.use` permission. During homologation,
   this permission may start the global connection from chat; the account that
   completes the flow becomes the account used by all users.
2. Start the connection from the AI settings page, or call:
   `POST /api/ai/oauth/start`.
3. Open the returned `authorizationUrl` in the same browser session.
4. Approve the requested scopes at OpenAI.
5. Copy the complete browser URL after the redirect, including `code` and
   `state`. Do not edit, shorten, or paste it into chat, tickets, or logs.
6. Paste that URL into the connection form, or call:

   ```bash
   curl -X POST "$API_URL/api/ai/oauth/complete" \
     -H "Authorization: Bearer $ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     --data '{"callbackUrl":"http://127.0.0.1:1455/auth/callback?code=PASTE_CODE&state=PASTE_STATE"}'
   ```

7. Confirm the response contains only redacted connection metadata. List the
   single global connection with `GET /api/ai/oauth/connections`.

The state, nonce, and PKCE verifier are one-time and expire after ten minutes.
A callback with the wrong state, redirect URI, client ID, missing code, or a
replayed attempt must be rejected before token exchange.

## Revoke or disconnect

Use the connection's disconnect action, or call:
`POST /api/ai/oauth/:id/disconnect`. The API attempts provider-side refresh-token
revocation when OpenAI advertises a revocation endpoint, then always marks the
connection revoked locally. Local revocation is authoritative if the provider
is unavailable. Verify the connection list reports `status: "revoked"` and
that subsequent AI requests do not use its token.

If the account owner revokes access directly in OpenAI, refresh failures mark
the local global connection revoked. Reconnect through the start flow rather
than reusing an old callback URL. Until reconnection, users receive a safe
recoverable configuration error and no partial chat rows are written.

## Model catalog and selection

The API fetches `GET https://api.openai.com/v1/models` with the encrypted
global OAuth token. It keeps only entries whose `visibility` is `list`,
preserves OpenAI response order, and exposes only `slug` and `display_name`.
The redacted catalog is cached in API memory for the active connection and is
discarded when the connection is connected, refreshed/changed, or
disconnected. Selecting a model validates the slug against the current
catalog, stores it globally, and uses it for subsequent Responses requests.
An unavailable catalog should be retried after reconnecting or refreshing the
chat page; it never exposes the provider response or token.

The administrator settings provider page is the long-term home for this
configuration. During migration, chat retains the connect/disconnect and
model controls, while `GET /api/settings/ai/providers` is administrator-only.
Future providers are displayed as disabled `Em breve` entries and have no
connect action.

## Troubleshooting

- `AI_OAUTH_SCOPE_INSUFFICIENT`: the approval did not grant
  `chatgpt.tokens.use.direct`; reconnect and approve all requested scopes.
- `AI_OAUTH_DENIED`: the user cancelled approval. Start a new attempt.
- `AI_OAUTH_EXPIRED`: the callback was copied after ten minutes or the attempt
  was already consumed. Start again and copy the full URL immediately.
- A client or redirect mismatch: verify the callback port, loopback host,
  registered redirect URI, and that the callback belongs to the same attempt.
- Provider `401` after connection: the API performs one guarded refresh. If it
  fails, reconnect; never paste tokens into diagnostics.
- Provider limits or plan errors: ChatGPT plan access is subject to OpenAI's
  current ChatGPT usage limits, model availability, rate limits, and account
  entitlements. Monte Moria cannot increase those limits. Show the safe error
  and request ID to support, and check OpenAI's current plan/usage pages for
  the account.

## Deployment verification

Run from the repository root, with production secrets supplied out-of-band:

```bash
npm run db:generate
npm run build:api
npm run build:web
docker compose -f docker-compose.prod.yml build api web
docker compose -f docker-compose.prod.yml run --build --rm migrate
docker compose -f docker-compose.prod.yml up -d --build api web
docker compose -f docker-compose.prod.yml ps
api_status="$(curl -sS http://127.0.0.1:3001/api/auth/me -o /dev/null -w '%{http_code}')"
case "$api_status" in 200|401) ;; *) exit 1 ;; esac
web_status="$(curl -sS http://127.0.0.1:3000/ -o /dev/null -w '%{http_code}')"
test "$web_status" = 200 || test "$web_status" = 307
```

The unauthenticated API route should return `401` (or `200` for an already
authenticated probe), and the web root should return `200` or its expected
`307` login redirect. The commands above assert those statuses without `curl
-f`, which would incorrectly fail on the expected API `401`. Inspect logs only
for status/request IDs and confirm no `access_token`, `refresh_token`, ID token,
PKCE verifier, or authorization callback query is logged. Perform one
authenticated text request with a test account and verify the response is
successful. Do not run this procedure with real user callbacks in CI, and do
not publish or push deployment secrets.

The mocked integration test verifies URL parameters, PKCE, token form fields,
callback rejection, replay rejection, metadata redaction, and provider token
resolution. It does not replace an authenticated HTTP test of tenant isolation
or Nest route guards; those remain covered by the controller/unit tests and the
runtime permission/tenant guards.
