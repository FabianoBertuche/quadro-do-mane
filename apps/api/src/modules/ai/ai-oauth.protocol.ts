import crypto from 'node:crypto';

export const REQUIRED_SCOPE = 'chatgpt.tokens.use.direct';
export const DEFAULT_ISSUER = 'https://auth.openai.com';
export const DEFAULT_AUTHORIZATION_ENDPOINT = `${DEFAULT_ISSUER}/api/accounts/authorize`;
export const DEFAULT_TOKEN_ENDPOINT = `${DEFAULT_ISSUER}/api/accounts/oauth/token`;
export const DEFAULT_JWKS_URI = `${DEFAULT_ISSUER}/.well-known/jwks.json`;
export const DEFAULT_RESOURCE = 'https://api.openai.com/v1';
export const DEFAULT_SCOPES = [
  'openid', 'profile', 'email', 'offline_access', 'resource.invoke', REQUIRED_SCOPE,
];

export interface AuthorizationUrlOptions {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
  scopes: string[];
  agentNameHint?: string;
  idTokenHint?: string;
  loginHint?: string;
  resource?: string;
}

export interface CallbackResult {
  code?: string;
  state?: string;
  clientId?: string;
  error?: Error;
  errorDescription?: string;
}

export interface IdTokenClaims {
  iss: string;
  sub: string;
  aud: string | string[];
  nonce: string;
  azp?: string;
  exp?: number;
  email?: string;
  name?: string;
  [key: string]: unknown;
}

export function assertRequiredScope(scope: string | undefined): string[] {
  const scopes = String(scope ?? '').split(/\s+/).filter(Boolean);
  if (!scopes.includes(REQUIRED_SCOPE)) throw new Error(`OAuth required scope missing: ${REQUIRED_SCOPE}`);
  return scopes;
}

export function resolveClientId(attemptClientId: string, tokenResponse: Record<string, any>): string {
  const issuedClientId = tokenResponse.client_id ?? tokenResponse.issued_client_id;
  if (attemptClientId === 'dynamic_agent_client' && !issuedClientId) throw new Error('OAuth dynamic client id missing');
  if (attemptClientId !== 'dynamic_agent_client' && issuedClientId && issuedClientId !== attemptClientId) throw new Error('OAuth client id mismatch');
  return issuedClientId ?? attemptClientId;
}

export function randomSecret(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

export function codeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier, 'ascii').digest('base64url');
}

export function buildAuthorizationUrl(options: AuthorizationUrlOptions): string {
  const url = new URL(options.authorizationEndpoint);
  url.searchParams.set('client_id', options.clientId);
  url.searchParams.set('redirect_uri', options.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', options.scopes.join(' '));
  url.searchParams.set('state', options.state);
  url.searchParams.set('nonce', options.nonce);
  url.searchParams.set('code_challenge', options.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('resource', options.resource ?? DEFAULT_RESOURCE);
  if (options.agentNameHint) url.searchParams.set('agent_name_hint', options.agentNameHint);
  if (options.idTokenHint) url.searchParams.set('id_token_hint', options.idTokenHint);
  if (options.loginHint) url.searchParams.set('login_hint', options.loginHint);
  return url.toString();
}

export async function fetchOpenAiModels(
  accessToken: string,
  fetcher: typeof fetch = fetch,
): Promise<Array<{ slug: string; displayName: string }>> {
  const response = await fetcher(`${DEFAULT_RESOURCE}/models`, {
    headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`OpenAI model catalog unavailable (${response.status})`);
  const body = await response.json().catch(() => ({}));
  const models = Array.isArray(body?.models) ? body.models : body?.data;
  if (!Array.isArray(models)) throw new Error('OpenAI model catalog response is invalid');
  return models.flatMap((model: any) => model?.visibility === 'list'
    && typeof model.slug === 'string' && typeof model.display_name === 'string'
    ? [{ slug: model.slug, displayName: model.display_name }]
    : []);
}

export function parseCallbackUrl(
  callbackUrl: string,
  expectedState: string,
  redirectUri: string,
  expectedClientId?: string,
  requireClientId = false,
): CallbackResult {
  const url = new URL(callbackUrl);
  if (url.origin + url.pathname !== new URL(redirectUri).origin + new URL(redirectUri).pathname) {
    throw new Error('OAuth redirect URI mismatch');
  }
  const state = url.searchParams.get('state') ?? undefined;
  if (!state || !safeEqual(state, expectedState)) return { state, error: new Error('OAuth state mismatch') };
  const callbackClientId = url.searchParams.get('client_id');
  const error = url.searchParams.get('error');
  if (error) return { state, clientId: callbackClientId ?? undefined, error: new Error(`OAuth authorization failed: ${error}`), errorDescription: url.searchParams.get('error_description') ?? undefined };
  if (requireClientId && !callbackClientId) throw new Error('OAuth client id missing');
  if (expectedClientId && callbackClientId && callbackClientId !== expectedClientId) {
    throw new Error('OAuth client id mismatch');
  }
  const code = url.searchParams.get('code');
  if (!code) throw new Error('OAuth callback did not contain an authorization code');
  return { code, state, clientId: callbackClientId ?? undefined };
}

export function assertCallbackClientId(callbackClientId: string | undefined, expectedClientId: string): void {
  if (!callbackClientId) throw new Error('OAuth client id missing');
  if (callbackClientId !== expectedClientId) throw new Error('OAuth client id mismatch');
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function exchangeToken(
  endpoint: string,
  form: Record<string, string>,
  fetcher: typeof fetch = fetch,
  options: { requireRefreshToken?: boolean; requireIdToken?: boolean } = {},
): Promise<Record<string, any>> {
  const requestForm = form.grant_type === 'authorization_code' && !form.resource
    ? { ...form, resource: DEFAULT_RESOURCE }
    : form;
  const response = await fetcher(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams(requestForm),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorCode = typeof body?.error === 'string' ? `: ${body.error}` : '';
    throw new Error(`OAuth token exchange failed (${response.status})${errorCode}`);
  }
  const requiredFields = ['access_token', 'expires_in'];
  if (options.requireRefreshToken !== false) requiredFields.push('refresh_token');
  if (options.requireIdToken !== false) requiredFields.push('id_token');
  for (const field of requiredFields) {
    const value = body?.[field];
    const invalid = field === 'expires_in'
      ? !Number.isFinite(Number(value)) || Number(value) <= 0
      : typeof value !== 'string' || value.length === 0;
    if (invalid) {
      throw new Error(`OAuth token response missing required field: ${field}`);
    }
  }
  if (body.refresh_token !== undefined && typeof body.refresh_token !== 'string') throw new Error('OAuth token response contains an invalid refresh_token');
  return body;
}

export async function validateIdToken(
  token: string,
  options: {
    issuer: string;
    audience: string | string[];
    nonce: string;
    jwksUri?: string;
    fetchJwks?: (uri: string) => Promise<{ keys: JsonWebKey[] }>;
    now?: number;
  },
): Promise<IdTokenClaims> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid OAuth ID token');
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as { alg?: string; kid?: string };
  const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as IdTokenClaims;
  if (claims.iss !== options.issuer) throw new Error('OAuth ID token issuer mismatch');
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  const expectedAudiences = Array.isArray(options.audience) ? options.audience : [options.audience];
  if (!expectedAudiences.some((audience) => audiences.includes(audience))) throw new Error('OAuth ID token audience mismatch');
  if (claims.nonce !== options.nonce) throw new Error('OAuth ID token nonce mismatch');
  if (typeof claims.exp !== 'number') throw new Error('OAuth ID token exp missing');
  if (claims.exp <= (options.now ?? Math.floor(Date.now() / 1000))) throw new Error('OAuth ID token expired');
  if (!header.kid || header.alg !== 'RS256') throw new Error('Unsupported OAuth ID token signing key');
  const fetchJwks = options.fetchJwks ?? (async (uri: string) => {
    const response = await fetch(uri);
    if (!response.ok) throw new Error('Unable to load OAuth signing keys');
    return response.json() as Promise<{ keys: JsonWebKey[] }>;
  });
  const jwks = await fetchJwks(options.jwksUri ?? DEFAULT_JWKS_URI);
  const jwk = jwks.keys.find((key: any) => key.kid === header.kid);
  if (!jwk) throw new Error('OAuth ID token signing key not found');
  const valid = crypto.verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), crypto.createPublicKey({ key: jwk as any, format: 'jwk' }), Buffer.from(parts[2], 'base64url'));
  if (!valid) throw new Error('OAuth ID token signature invalid');
  return claims;
}

export interface OpenIdConfiguration {
  token_endpoint?: string;
  revocation_endpoint?: string;
  jwks_uri?: string;
}

export async function discoverOpenIdConfiguration(
  issuer: string,
  fetcher: typeof fetch = fetch,
): Promise<OpenIdConfiguration> {
  const response = await fetcher(`${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error('OAuth OpenID configuration unavailable');
  return response.json() as Promise<OpenIdConfiguration>;
}

export async function revokeToken(
  endpoint: string,
  token: string,
  clientId: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const response = await fetcher(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({ token, client_id: clientId }),
  });
  if (!response.ok) throw new Error(`OAuth token revocation failed (${response.status})`);
}
