# Task 2 Report: OAuth Protocol Service

## Implemented

- Added `ai-oauth.protocol.ts` with authorization URL construction, S256 PKCE helpers, callback validation, form-encoded token exchange, and RS256 JWKS-backed ID-token validation.
- Added `ai-oauth.service.ts` with actor-scoped authorization attempts and connections.
- Authorization attempts use random state, nonce, and verifier values, a ten-minute expiry, a fixed `127.0.0.1` callback default, stable host ID, required scopes, and issued-client reuse.
- Callback completion checks redirect/state/client identity, claims attempts atomically with `consumedAt IS NULL` and `expiresAt > now`, verifies PKCE, validates issuer/audience/nonce/signature, and requires `chatgpt.tokens.use.direct`.
- Access, refresh, and ID tokens are encrypted before persistence. Connection views contain identity/metadata only and never token fields.
- Refreshes are serialized per connection, preserve replacement refresh tokens, and revoke the connection on invalid-grant/authorization failures.
- Added optional ChatGPT OAuth endpoint and identity settings to environment validation with secure defaults.

## Tests

- Added focused protocol/service tests for authorization parameters, state mismatch, callback client mismatch, ID-token issuer/audience/nonce/signature validation, hashing, and safe connection output.
- Existing Task 1 OAuth persistence tests continue to pass.

## Verification

```text
node -r ts-node/register --test src/modules/ai/ai-oauth.service.spec.ts src/modules/ai/ai-oauth-persistence.spec.ts
8 tests passed

npm run build
passed
```

## Scope Notes

- No controller, provider, UI, or unrelated application files were changed.
- PKCE verifier and nonce plaintext are held in process memory while an authorization attempt is pending; only hashes are persisted as required by the Task 1 schema. A process restart invalidates pending attempts safely.
- Provider revocation is represented by the actor-scoped local revoked state; controller/provider integration remains assigned to later tasks.
