import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import {
  buildAuthorizationUrl, codeChallenge, DEFAULT_AUTHORIZATION_ENDPOINT, DEFAULT_ISSUER,
  DEFAULT_JWKS_URI, DEFAULT_SCOPES, DEFAULT_TOKEN_ENDPOINT, exchangeToken, parseCallbackUrl,
  randomSecret, REQUIRED_SCOPE, sha256, validateIdToken,
} from './ai-oauth.protocol';

export interface AiOAuthActor { tenantId: string; tenantUserId: string }
export interface AiOAuthConnectionView {
  id: string; issuer: string; subject: string; clientId: string; email: string | null;
  displayName: string | null; scopes: string[]; expiresAt: string; isRevoked: boolean; lastUsedAt: string | null;
}

const ATTEMPT_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class AiOAuthService {
  private readonly verifiers = new Map<string, string>();
  private readonly nonces = new Map<string, string>();
  private readonly refreshes = new Map<string, Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly config: ConfigService,
  ) {}

  async startAuthorization(actor: AiOAuthActor) {
    const issuer = this.config.get<string>('CHATGPT_OAUTH_ISSUER') ?? DEFAULT_ISSUER;
    const redirectUri = this.config.get<string>('CHATGPT_OAUTH_REDIRECT_URI') ?? 'http://127.0.0.1/callback';
    const existing = await this.prisma.aiOAuthConnection.findFirst({ where: { tenantId: actor.tenantId, tenantUserId: actor.tenantUserId, issuer, isRevoked: false }, orderBy: { updatedAt: 'desc' } });
    const clientId = existing?.clientId ?? 'dynamic_agent_client';
    const state = randomSecret();
    const nonce = randomSecret();
    const verifier = randomSecret(48);
    const expiresAt = new Date(Date.now() + ATTEMPT_TTL_MS);
    const hostId = this.config.get<string>('CHATGPT_OAUTH_EXT_AGENT_HOST_ID') ?? 'monte-moria';
    const created = await this.prisma.aiOAuthAttempt.create({ data: {
      tenantId: actor.tenantId, tenantUserId: actor.tenantUserId, stateHash: sha256(state), nonceHash: sha256(nonce),
      pkceVerifierHash: sha256(verifier), redirectUri, clientId, extAgentHostId: hostId, expiresAt,
    } });
    this.verifiers.set(sha256(state), verifier);
    this.nonces.set(sha256(state), nonce);
    return {
      authorizationUrl: buildAuthorizationUrl({
        authorizationEndpoint: this.config.get<string>('CHATGPT_OAUTH_AUTHORIZATION_ENDPOINT') ?? DEFAULT_AUTHORIZATION_ENDPOINT,
        clientId, redirectUri, state, nonce, codeChallenge: codeChallenge(verifier), scopes: DEFAULT_SCOPES,
        agentNameHint: this.config.get<string>('CHATGPT_OAUTH_AGENT_NAME') ?? 'Monte Moria',
      }),
      attemptId: created.id,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async completeAuthorization(actor: AiOAuthActor, callbackUrl: string): Promise<AiOAuthConnectionView> {
    const callback = new URL(callbackUrl);
    const state = callback.searchParams.get('state');
    if (!state) throw new Error('OAuth state mismatch');
    const stateHash = sha256(state);
    const now = new Date();
    const attempt = await this.prisma.aiOAuthAttempt.findFirst({ where: { tenantId: actor.tenantId, tenantUserId: actor.tenantUserId, stateHash, consumedAt: null, expiresAt: { gt: now } } });
    if (!attempt) throw new Error('OAuth attempt is invalid or expired');
    const expectedState = state;
    const parsed = parseCallbackUrl(callbackUrl, expectedState, attempt.redirectUri, attempt.clientId === 'dynamic_agent_client' ? undefined : attempt.clientId);
    if (parsed.error) throw parsed.error;
    const claimed = await this.prisma.aiOAuthAttempt.updateMany({ where: { id: attempt.id, tenantId: actor.tenantId, tenantUserId: actor.tenantUserId, consumedAt: null, expiresAt: { gt: now } }, data: { consumedAt: now } });
    if (claimed.count !== 1) throw new Error('OAuth attempt is already consumed');
    const verifier = this.verifiers.get(stateHash);
    this.verifiers.delete(stateHash);
    const nonce = this.nonces.get(stateHash);
    this.nonces.delete(stateHash);
    if (!verifier || sha256(verifier) !== attempt.pkceVerifierHash) throw new Error('OAuth PKCE verifier unavailable');
    const tokens = await exchangeToken(this.config.get<string>('CHATGPT_OAUTH_TOKEN_ENDPOINT') ?? DEFAULT_TOKEN_ENDPOINT, {
      grant_type: 'authorization_code', code: parsed.code!, redirect_uri: attempt.redirectUri, client_id: attempt.clientId, code_verifier: verifier,
    });
    const issuer = this.config.get<string>('CHATGPT_OAUTH_ISSUER') ?? DEFAULT_ISSUER;
    const clientId = tokens.client_id ?? tokens.issued_client_id ?? attempt.clientId;
    const scopes = String(tokens.scope ?? '').split(/\s+/).filter(Boolean);
    if (!scopes.includes(REQUIRED_SCOPE)) throw new Error(`OAuth required scope missing: ${REQUIRED_SCOPE}`);
    const claims = await validateIdToken(tokens.id_token, { issuer, audience: clientId, nonce: nonce ?? '', jwksUri: this.config.get<string>('CHATGPT_OAUTH_JWKS_URI') ?? DEFAULT_JWKS_URI });
    const saved = await this.persistTokens(actor, attempt, clientId, scopes, claims, tokens);
    return this.toConnectionView(saved);
  }

  private async persistTokens(actor: AiOAuthActor, attempt: any, clientId: string, scopes: string[], claims: any, tokens: any) {
    const encrypt = (value: string) => this.encryption.encrypt(value);
    const access = encrypt(tokens.access_token);
    const refresh = encrypt(tokens.refresh_token);
    const idToken = encrypt(tokens.id_token);
    return this.prisma.aiOAuthConnection.upsert({ where: { tenantUserId_issuer_subject_clientId: { tenantUserId: actor.tenantUserId, issuer: claims.iss, subject: claims.sub, clientId } }, create: {
      tenantId: actor.tenantId, tenantUserId: actor.tenantUserId, issuer: claims.iss, subject: claims.sub, clientId,
      accessTokenCiphertext: access.ciphertext, accessTokenIv: access.iv, accessTokenAuthTag: access.authTag,
      refreshTokenCiphertext: refresh.ciphertext, refreshTokenIv: refresh.iv, refreshTokenAuthTag: refresh.authTag,
      idTokenCiphertext: idToken.ciphertext, idTokenIv: idToken.iv, idTokenAuthTag: idToken.authTag,
      email: claims.email ?? null, displayName: claims.name ?? null, scopes: scopes.join(' '), expiresAt: new Date(Date.now() + Number(tokens.expires_in ?? 3600) * 1000), extAgentHostId: attempt.extAgentHostId,
    }, update: {
      accessTokenCiphertext: access.ciphertext, accessTokenIv: access.iv, accessTokenAuthTag: access.authTag, refreshTokenCiphertext: refresh.ciphertext, refreshTokenIv: refresh.iv, refreshTokenAuthTag: refresh.authTag, idTokenCiphertext: idToken.ciphertext, idTokenIv: idToken.iv, idTokenAuthTag: idToken.authTag, scopes: scopes.join(' '), expiresAt: new Date(Date.now() + Number(tokens.expires_in ?? 3600) * 1000), isRevoked: false, revokedAt: null,
    } });
  }

  async refreshConnection(actor: AiOAuthActor, connectionId: string): Promise<void> {
    const running = this.refreshes.get(connectionId);
    if (running) return running;
    const operation = this.doRefresh(actor, connectionId).finally(() => this.refreshes.delete(connectionId));
    this.refreshes.set(connectionId, operation);
    return operation;
  }

  private async doRefresh(actor: AiOAuthActor, connectionId: string): Promise<void> {
    const connection = await this.prisma.aiOAuthConnection.findFirst({ where: { id: connectionId, tenantId: actor.tenantId, tenantUserId: actor.tenantUserId, isRevoked: false } });
    if (!connection) throw new Error('OAuth connection not found');
    const refreshToken = this.encryption.decrypt({ ciphertext: connection.refreshTokenCiphertext, iv: connection.refreshTokenIv, authTag: connection.refreshTokenAuthTag });
    try {
      const tokens = await exchangeToken(this.config.get<string>('CHATGPT_OAUTH_TOKEN_ENDPOINT') ?? DEFAULT_TOKEN_ENDPOINT, { grant_type: 'refresh_token', refresh_token: refreshToken, client_id: connection.clientId });
      const access = this.encryption.encrypt(tokens.access_token);
      const refresh = this.encryption.encrypt(tokens.refresh_token ?? refreshToken);
      await this.prisma.aiOAuthConnection.update({ where: { id: connection.id }, data: { accessTokenCiphertext: access.ciphertext, accessTokenIv: access.iv, accessTokenAuthTag: access.authTag, refreshTokenCiphertext: refresh.ciphertext, refreshTokenIv: refresh.iv, refreshTokenAuthTag: refresh.authTag, expiresAt: new Date(Date.now() + Number(tokens.expires_in ?? 3600) * 1000), lastUsedAt: new Date() } });
    } catch (error) {
      if (/invalid_grant|401|403/.test(String(error))) await this.prisma.aiOAuthConnection.update({ where: { id: connection.id }, data: { isRevoked: true, revokedAt: new Date() } });
      throw new Error('OAuth connection refresh failed');
    }
  }

  async disconnectConnection(actor: AiOAuthActor, connectionId: string): Promise<void> {
    await this.prisma.aiOAuthConnection.updateMany({ where: { id: connectionId, tenantId: actor.tenantId, tenantUserId: actor.tenantUserId, isRevoked: false }, data: { isRevoked: true, revokedAt: new Date() } });
  }

  toConnectionView(connection: any): AiOAuthConnectionView {
    return { id: connection.id, issuer: connection.issuer, subject: connection.subject, clientId: connection.clientId, email: connection.email ?? null, displayName: connection.displayName ?? null, scopes: String(connection.scopes).split(/\s+/).filter(Boolean), expiresAt: new Date(connection.expiresAt).toISOString(), isRevoked: connection.isRevoked, lastUsedAt: connection.lastUsedAt ? new Date(connection.lastUsedAt).toISOString() : null };
  }
}
