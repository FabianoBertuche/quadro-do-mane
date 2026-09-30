import assert from 'node:assert/strict';
import test from 'node:test';
import { AiOAuthException, toAiOAuthException } from './ai-oauth.service';

test('maps OAuth denial, expiry, and missing scope to stable HTTP error codes', () => {
  const cases = [
    ['OAuth authorization failed: access_denied', 'AI_OAUTH_DENIED'],
    ['OAuth attempt is invalid or expired', 'AI_OAUTH_EXPIRED'],
    ['OAuth required scope missing', 'AI_OAUTH_SCOPE_INSUFFICIENT'],
  ] as const;

  for (const [message, code] of cases) {
    const exception = toAiOAuthException(new Error(message));
    assert.ok(exception instanceof AiOAuthException);
    assert.equal((exception.getResponse() as any).code, code);
  }
});
