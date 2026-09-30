# OAuth Production Fix Report

## Status

Fixed and verified.

## Root Cause

The authorization-code token exchange did not include the OpenAI resource
parameter required by the provider: `resource=https://api.openai.com/v1`.
This caused `/api/ai/oauth/complete` to return HTTP 400 in production.

The callback parser also treated every missing `client_id` as invalid. OpenAI
returning-client callbacks may omit that parameter, while first dynamic
registration callbacks must include it. The service additionally performed a
second unconditional client-id assertion after token exchange.

## Changes

- Add the default OpenAI resource to authorization-code token exchange forms.
- Require callback `client_id` only for dynamic registration.
- Allow a returning callback to omit `client_id`.
- Reject a supplied returning callback client-id mismatch.
- Process provider callback errors before missing client-id validation.
- Preserve token, verifier, nonce, and callback-secret redaction behavior.
- Update focused and end-to-end OAuth tests, without changing audio code.

## Verification

- Red phase: focused tests failed for missing resource and unconditional
  missing-client-id rejection.
- `node -r ts-node/register --test src/modules/ai/ai-oauth*.spec.ts`: 28 passed.
- `npm run build` from `apps/api`: passed.
- `git diff --check`: passed.
