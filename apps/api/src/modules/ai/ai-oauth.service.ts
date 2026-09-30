import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import {
  buildAuthorizationUrl, codeChallenge, DEFAULT_AUTHORIZATION_ENDPOINT, DEFAULT_ISSUER,
  DEFAULT_JWKS_URI, DEFAULT_SCOPES, DEFAULT_TOKEN_ENDPOINT, discoverOpenIdConfiguration,
  assertRequiredScope, exchangeToken, OpenIdConfiguration, parseCallbackUrl, randomSecret, revokeToken, resolveClientId, sha256, validateIdToken,
} from './ai-oauth.protocol';

export interface AiOAuthActor { tenantId: string; tenantUserId: string }
export interface AiOAuthConnectionView {
  id: string; issuer: string; subject: string; clientId: string; email: string | null;
  displayName: string | null; scopes: string[]; expiresAt: string; isRevoked: boolean; lastUsedAt: string | null;
}

const ATTEMPT_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class AiOAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly config: ConfigService,
  ) {}

  async startAuthorization(actor: AiOAuthActor) {
    const issuer = this.config.get<string>('CHATGPT_OAUTH_ISSUER') ?? DEFAULT_ISSUER;
    const callbackPort = this.config.get<number>('CHATGPT_OAUTH_CALLBACK_PORT') ?? 1455;
    const redirectUri = `http://127.0.0.1:${callbackPort}/auth/callback`;
    const existing = await this.prisma.aiOAuthConnection.findFirst({ where: { tenantId: actor.tenantId, tenantUserId: actor.tenantUserId, issuer, isRevoked: false }, orderBy: { updatedAt: 'desc' } });
    const clientId = existing?.clientId ?? 'dynamic_agent_client';
    const state = randomSecret();
    const nonce = randomSecret();
    const verifier = randomSecret(48);
    const expiresAt = new Date(Date.now() + ATTEMPT_TTL_MS);
    const hostId = this.config.get<string>('CHATGPT_OAUTH_HOST_ID') ?? 'monte-moria';
    const encryptedVerifier = this.encryption.encrypt(verifier);
    const encryptedNonce = this.encryption.encrypt(nonce);
    const created = await this.prisma.aiOAuthAttempt.create({ data: {
      tenantId: actor.tenantId, tenantUserId: actor.tenantUserId, stateHash: sha256(state), nonceHash: sha256(nonce),
      pkceVerifierHash: sha256(verifier), pkceVerifierCiphertext: encryptedVerifier.ciphertext, pkceVerifierIv: encryptedVerifier.iv,
      pkceVerifierAuthTag: encryptedVerifier.authTag, nonceCiphertext: encryptedNonce.ciphertext, nonceIv: encryptedNonce.iv,
      nonceAuthTag: encryptedNonce.authTag, redirectUri, clientId, extAgentHostId: hostId, expiresAt,
    } });
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
    const verifier = this.encryption.decrypt({ ciphertext: attempt.pkceVerifierCiphertext, iv: attempt.pkceVerifierIv, authTag: attempt.pkceVerifierAuthTag });
    const nonce = this.encryption.decrypt({ ciphertext: attempt.nonceCiphertext, iv: attempt.nonceIv, authTag: attempt.nonceAuthTag });
    if (sha256(verifier) !== attempt.pkceVerifierHash) throw new Error('OAuth PKCE verifier mismatch');
    if (sha256(nonce) !== attempt.nonceHash) throw new Error('OAuth nonce mismatch');
    const issuer = this.config.get<string>('CHATGPT_OAUTH_ISSUER') ?? DEFAULT_ISSUER;
    const discovered = await discoverOpenIdConfiguration(issuer).catch((): OpenIdConfiguration => ({}));
    const tokens = await exchangeToken(discovered.token_endpoint ?? this.config.get<string>('CHATGPT_OAUTH_TOKEN_ENDPOINT') ?? DEFAULT_TOKEN_ENDPOINT, {
      grant_type: 'authorization_code', code: parsed.code!, redirect_uri: attempt.redirectUri, client_id: attempt.clientId, code_verifier: verifier,
    });
    const clientId = resolveClientId(attempt.clientId, tokens);
    const scopes = assertRequiredScope(tokens.scope);
    const claims = await validateIdToken(tokens.id_token, { issuer, audience: clientId, nonce, jwksUri: discovered.jwks_uri ?? this.config.get<string>('CHATGPT_OAUTH_JWKS_URI') ?? DEFAULT_JWKS_URI });
    if (Array.isArray(claims.aud) && claims.aud.length > 1 && claims.azp !== clientId) throw new Error('OAuth ID token authorized-party mismatch');
    const saved = await this.persistTokens(actor, attempt, clientId, scopes, claims, tokens);
    return this.toConnectionView(saved);
  }

  private async persistTokens(actor: AiOAuthActor, attempt: any, clientId: string, scopes: string[], claims: any, tokens: any) {
    const encrypt = (value: string) => this.encryption.encrypt(value);
    const access = encrypt(tokens.access_token);
    const refresh = encrypt(tokens.refresh_token);
    const idToken = encrypt(tokens.id_token);
    return this.prisma.aiOAuthConnection.upsert({ where: { tenantId_tenantUserId_issuer_subject_clientId: { tenantId: actor.tenantId, tenantUserId: actor.tenantUserId, issuer: claims.iss, subject: claims.sub, clientId } }, create: {
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
    const leaseToken = randomSecret(24);
    const leaseExpiresAt = new Date(Date.now() + 30_000);
    const claimed = await this.prisma.aiOAuthConnection.updateMany({ where: {
      id: connectionId, tenantId: actor.tenantId, tenantUserId: actor.tenantUserId, isRevoked: false,
      OR: [{ refreshLeaseToken: null }, { refreshLeaseExpiresAt: null }, { refreshLeaseExpiresAt: { lt: new Date() } }],
    }, data: { refreshLeaseToken: leaseToken, refreshLeaseExpiresAt: leaseExpiresAt } });
    if (!claimed.count) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      const current = await this.prisma.aiOAuthConnection.findFirst({ where: { id: connectionId, tenantId: actor.tenantId, tenantUserId: actor.tenantUserId, isRevoked: false } });
      if (!current) throw new Error('OAuth connection not found');
      if (current.refreshLeaseToken && current.refreshLeaseExpiresAt && current.refreshLeaseExpiresAt > new Date()) return;
      return this.refreshConnection(actor, connectionId);
    }
    try {
      await this.doRefresh(actor, connectionId);
    } finally {
      await this.prisma.aiOAuthConnection.updateMany({ where: { id: connectionId, refreshLeaseToken: leaseToken }, data: { refreshLeaseToken: null, refreshLeaseExpiresAt: null } });
    }
  }

  private async doRefresh(actor: AiOAuthActor, connectionId: string): Promise<void> {
    const connection = await this.prisma.aiOAuthConnection.findFirst({ where: { id: connectionId, tenantId: actor.tenantId, tenantUserId: actor.tenantUserId, isRevoked: false } });
    if (!connection) throw new Error('OAuth connection not found');
    const refreshToken = this.encryption.decrypt({ ciphertext: connection.refreshTokenCiphertext, iv: connection.refreshTokenIv, authTag: connection.refreshTokenAuthTag });
    try {
      const discovered = await discoverOpenIdConfiguration(connection.issuer).catch((): OpenIdConfiguration => ({}));
      const tokens = await exchangeToken(discovered.token_endpoint ?? this.config.get<string>('CHATGPT_OAUTH_TOKEN_ENDPOINT') ?? DEFAULT_TOKEN_ENDPOINT, { grant_type: 'refresh_token', refresh_token: refreshToken, client_id: connection.clientId });
      const access = this.encryption.encrypt(tokens.access_token);
      const refresh = this.encryption.encrypt(tokens.refresh_token ?? refreshToken);
      await this.prisma.aiOAuthConnection.update({ where: { id: connection.id }, data: { accessTokenCiphertext: access.ciphertext, accessTokenIv: access.iv, accessTokenAuthTag: access.authTag, refreshTokenCiphertext: refresh.ciphertext, refreshTokenIv: refresh.iv, refreshTokenAuthTag: refresh.authTag, expiresAt: new Date(Date.now() + Number(tokens.expires_in ?? 3600) * 1000), lastUsedAt: new Date() } });
    } catch (error) {
      if (/invalid_grant|401|403/.test(String(error))) await this.prisma.aiOAuthConnection.update({ where: { id: connection.id }, data: { isRevoked: true, revokedAt: new Date() } });
      throw new Error('OAuth connection refresh failed');
    }
  }

  async disconnectConnection(actor: AiOAuthActor, connectionId: string): Promise<void> {
    const connection = await this.prisma.aiOAuthConnection.findFirst({ where: { id: connectionId, tenantId: actor.tenantId, tenantUserId: actor.tenantUserId, isRevoked: false } });
    if (!connection) return;
    try {
      const configuration = await discoverOpenIdConfiguration(connection.issuer);
      if (configuration.revocation_endpoint) {
        const refreshToken = this.encryption.decrypt({ ciphertext: connection.refreshTokenCiphertext, iv: connection.refreshTokenIv, authTag: connection.refreshTokenAuthTag });
        await revokeToken(configuration.revocation_endpoint, refreshToken, connection.clientId);
      }
    } catch {
      // Local revocation is still enforced when discovery or provider revocation is unavailable.
    }
    await this.prisma.aiOAuthConnection.updateMany({ where: { id: connectionId, tenantId: actor.tenantId, tenantUserId: actor.tenantUserId, isRevoked: false }, data: { isRevoked: true, revokedAt: new Date() } });
  }

  toConnectionView(connection: any): AiOAuthConnectionView {
    return { id: connection.id, issuer: connection.issuer, subject: connection.subject, clientId: connection.clientId, email: connection.email ?? null, displayName: connection.displayName ?? null, scopes: String(connection.scopes).split(/\s+/).filter(Boolean), expiresAt: new Date(connection.expiresAt).toISOString(), isRevoked: connection.isRevoked, lastUsedAt: connection.lastUsedAt ? new Date(connection.lastUsedAt).toISOString() : null };
  }
}
