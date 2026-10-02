# Sign in with ChatGPT Plan Usage

## Goal

Allow each Monte Moria user to authorize ChatGPT plan usage through OpenAI's open-source Sign in with ChatGPT flow, using a copy/paste callback instead of requiring a public callback server.

## Scope

- Support the open-source dynamic registration flow with `client_id=dynamic_agent_client` on first authorization.
- Persist the issued `oaiapp_...` client ID per OpenAI account registration and reuse it for later sign-ins.
- Display an OpenAI authorization URL and accept the callback URL pasted by the user.
- Validate `state`, PKCE, nonce, ID token signature, issuer, audience, expiry, subject, and granted scopes.
- Encrypt access, refresh, and retained ID tokens at rest with the existing `EncryptionService`.
- Refresh rotating refresh tokens and support local disconnect/revocation.
- Send eligible requests to `POST https://api.openai.com/v1/responses` with `store: false`, streaming enabled, and the OAuth access token as the bearer credential.
- Preserve the existing task tools, proposal confirmation, audit, tenant isolation, and frontend chat contract.
- Keep API-key provider support as an optional fallback, never exposing credentials to the frontend.

## Non-Goals

- Do not use ChatGPT private `backend-api` endpoints.
- Do not treat the OAuth access token as a global tenant credential.
- Do not invent or claim support for an undocumented device-code flow; the first version accepts the returned callback URL.
- Do not expose OAuth tokens in URLs, browser storage, logs, analytics, or API responses.

## OAuth Flow

1. Authenticated user starts `POST /api/ai/oauth/start`.
2. Backend creates a short-lived authorization attempt containing a random `state`, nonce, PKCE verifier, selected loopback port/path, and stable `ext_agent_host_id`.
3. Backend returns the authorization URL using `https://auth.openai.com/api/accounts/authorize`, `resource=https://api.openai.com/v1`, identity scopes, and `offline_access resource.invoke chatgpt.tokens.use.direct`.
4. First registration uses `dynamic_agent_client` and `agent_name_hint`; subsequent attempts use the saved issued client ID and may include `id_token_hint`/`login_hint`.
5. User authenticates, copies the complete callback URL, and submits it with `POST /api/ai/oauth/complete`.
6. Backend validates the attempt and callback, exchanges the code at `https://auth.openai.com/api/accounts/oauth/token`, validates the ID token using OpenAI JWKS, checks `chatgpt.tokens.use.direct`, and encrypts the credential record.
7. Chat requests select the active authorized registration for the authenticated Monte Moria user. If absent or expired, the UI asks the user to connect/reconnect ChatGPT.

## Data Model

Add an OpenAI connection model scoped to `tenantId` and `tenantUserId`, with unique `(tenantUserId, issuer, subject, clientId)`. Store encrypted token payloads, verified email/display metadata, scopes, expiry, last-used timestamp, revoked/disconnected state, and stable host ID. Store OAuth attempts separately with hashed state/verifier material, expiry, redirect URI, client ID used for the attempt, and no access tokens.

## Provider

Replace the current OAuth-incompatible Chat Completions path with a Responses API adapter. Normalize streamed `response.output_text.delta`, function-call arguments, `response.completed`, `response.failed`, and incomplete/interrupted events into the existing `AiCompletionResult`. Use the selected user's access token; refresh once on an expired-token response, serialize refreshes per connection, then retry once.

## Security and Errors

- PKCE verifier and OAuth state are single-use and expire quickly.
- Callback client ID must match the issued client ID returned for a new registration or the client ID retained for reauthorization.
- Granted scopes are checked after every token exchange; valid identity without `chatgpt.tokens.use.direct` is not enough for inference.
- `invalid_grant` and token-invalidated errors clear the active credential and require a new authorization.
- ChatGPT plan usage errors preserve OpenAI status/code/request ID in server audit logs while exposing a safe localized message to the user.

## UI

- Add `Continuar com ChatGPT` and connection status to the AI settings/chat entry point.
- Show the authorization URL with copy/open controls.
- Show a single-use callback URL input with clear instructions to paste the entire browser address.
- Show connected account, scopes, expiration, reconnect, and disconnect actions.

## Acceptance Criteria

- A new user can complete dynamic registration by copying the callback URL and see a connected ChatGPT account without a client secret.
- A returning user reuses the issued client ID and refreshes credentials without creating a duplicate registration.
- A connected user can send text and tool calls through the Responses API; proposals still require confirmation.
- A disconnected, expired, scope-insufficient, or ineligible account receives a recoverable UI state.
- No OAuth secret appears in frontend payloads, logs, URLs, or repository files.
