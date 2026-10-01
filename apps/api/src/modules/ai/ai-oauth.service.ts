import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import {
  buildAuthorizationUrl, codeChallenge, DEFAULT_AUTHORIZATION_ENDPOINT, DEFAULT_ISSUER,
  DEFAULT_JWKS_URI, DEFAULT_SCOPES, DEFAULT_TOKEN_ENDPOINT, discoverOpenIdConfiguration,
  assertCallbackClientId, assertRequiredScope, exchangeToken, OpenIdConfiguration, parseCallbackUrl, randomSecret, revokeToken, resolveClientId, sha256, validateIdToken,
} from './ai-oauth.protocol';
import { AiProviderAuth } from './ports/ai-provider.port';
import { AiAuditService } from './ai-audit.service';

export interface AiOAuthActor { tenantId: string; tenantUserId: string }
export interface AiOAuthConnectionView {
  id: string; issuer: string; subject: string; clientId: string; email: string | null;
  displayName: string | null; scopes: string[]; expiresAt: string; isRevoked: boolean; lastUsedAt: string | null;
}

export type AiOAuthErrorCode = 'AI_OAUTH_DENIED' | 'AI_OAUTH_EXPIRED' | 'AI_OAUTH_SCOPE_INSUFFICIENT' | 'AI_OAUTH_FAILED';

export class AiOAuthException extends BadRequestException {
  constructor(code: AiOAuthErrorCode, message: string) {
    super({ code, message });
  }
}

export function toAiOAuthException(error: unknown): AiOAuthException {
  if (error instanceof AiOAuthException) return error;
  const message = String(error instanceof Error ? error.message : error);
  if (/access_denied|authorization denied|authorization was denied/i.test(message)) {
    return new AiOAuthException('AI_OAUTH_DENIED', 'A autorização foi cancelada. Você pode tentar novamente.');
  }
  if (/attempt is invalid or expired|attempt is already consumed|authorization.*expired/i.test(message)) {
    return new AiOAuthException('AI_OAUTH_EXPIRED', 'A autorização expirou. Inicie a conexão novamente.');
  }
  if (/required scope missing|scope.*insufficient/i.test(message)) {
    return new AiOAuthException('AI_OAUTH_SCOPE_INSUFFICIENT', 'A autorização não incluiu as permissões necessárias.');
  }
  return new AiOAuthException('AI_OAUTH_FAILED', 'Não foi possível concluir a autorização. Tente novamente.');
}

const ATTEMPT_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class AiOAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly config: ConfigService,
    @Optional() private readonly audit?: AiAuditService,
  ) {}

  async startAuthorization(actor: AiOAuthActor) {
    const issuer = this.config.get<string>('CHATGPT_OAUTH_ISSUER') ?? DEFAULT_ISSUER;
    const callbackPort = this.config.get<number>('CHATGPT_OAUTH_CALLBACK_PORT') ?? 1455;
    const redirectUri = `http://127.0.0.1:${callbackPort}/auth/callback`;
    const runtime = await this.globalRuntime();
    const existing = runtime.oauthConnection;
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
    try {
      return await this.completeAuthorizationInternal(actor, callbackUrl);
    } catch (error) {
      throw toAiOAuthException(error);
    }
  }

  private async completeAuthorizationInternal(actor: AiOAuthActor, callbackUrl: string): Promise<AiOAuthConnectionView> {
    const callback = new URL(callbackUrl);
    const state = callback.searchParams.get('state');
    if (!state) throw new Error('OAuth state mismatch');
    const stateHash = sha256(state);
    const now = new Date();
    const attempt = await this.prisma.aiOAuthAttempt.findFirst({ where: { tenantId: actor.tenantId, tenantUserId: actor.tenantUserId, stateHash, consumedAt: null, expiresAt: { gt: now } } });
    if (!attempt) throw new Error('OAuth attempt is invalid or expired');
    const expectedState = state;
    const parsed = parseCallbackUrl(callbackUrl, expectedState, attempt.redirectUri, attempt.clientId === 'dynamic_agent_client' ? undefined : attempt.clientId, attempt.clientId === 'dynamic_agent_client');
    if (parsed.error) throw parsed.error;
    const claimed = await this.prisma.aiOAuthAttempt.updateMany({ where: { id: attempt.id, tenantId: actor.tenantId, tenantUserId: actor.tenantUserId, consumedAt: null, expiresAt: { gt: now } }, data: { consumedAt: now } });
    if (claimed.count !== 1) throw new Error('OAuth attempt is already consumed');
    const verifier = this.encryption.decrypt({ ciphertext: attempt.pkceVerifierCiphertext, iv: attempt.pkceVerifierIv, authTag: attempt.pkceVerifierAuthTag });
    const nonce = this.encryption.decrypt({ ciphertext: attempt.nonceCiphertext, iv: attempt.nonceIv, authTag: attempt.nonceAuthTag });
    if (sha256(verifier) !== attempt.pkceVerifierHash) throw new Error('OAuth PKCE verifier mismatch');
    if (sha256(nonce) !== attempt.nonceHash) throw new Error('OAuth nonce mismatch');
    const issuer = this.config.get<string>('CHATGPT_OAUTH_ISSUER') ?? DEFAULT_ISSUER;
    const discovered = await discoverOpenIdConfiguration(issuer).catch((): OpenIdConfiguration => ({}));
    const clientId = parsed.clientId ?? attempt.clientId;
    const tokens = await exchangeToken(discovered.token_endpoint ?? this.config.get<string>('CHATGPT_OAUTH_TOKEN_ENDPOINT') ?? DEFAULT_TOKEN_ENDPOINT, {
      grant_type: 'authorization_code', code: parsed.code!, redirect_uri: attempt.redirectUri, client_id: clientId, code_verifier: verifier,
    });
    const resolvedClientId = resolveClientId(clientId, tokens);
    if (parsed.clientId) assertCallbackClientId(parsed.clientId, resolvedClientId);
    const scopes = assertRequiredScope(tokens.scope);
    const claims = await validateIdToken(tokens.id_token, { issuer, audience: resolvedClientId, nonce, jwksUri: discovered.jwks_uri ?? this.config.get<string>('CHATGPT_OAUTH_JWKS_URI') ?? DEFAULT_JWKS_URI });
    if (Array.isArray(claims.aud) && claims.aud.length > 1 && claims.azp !== resolvedClientId) throw new Error('OAuth ID token authorized-party mismatch');
    const saved = await this.persistTokens(attempt, resolvedClientId, scopes, claims, tokens);
    await this.audit?.record({ tenantId: actor.tenantId, actorTenantUserId: actor.tenantUserId, action: 'oauth.connected', targetId: saved.id, metadata: { provider: 'chatgpt', status: 'connected' } });
    return this.toConnectionView(saved);
  }

  private async persistTokens(attempt: any, clientId: string, scopes: string[], claims: any, tokens: any) {
    const encrypt = (value: string) => this.encryption.encrypt(value);
    const access = encrypt(tokens.access_token);
    const refresh = encrypt(tokens.refresh_token);
    const idToken = encrypt(tokens.id_token);
    const data = {
      issuer: claims.iss, subject: claims.sub, clientId,
      accessTokenCiphertext: access.ciphertext, accessTokenIv: access.iv, accessTokenAuthTag: access.authTag,
      refreshTokenCiphertext: refresh.ciphertext, refreshTokenIv: refresh.iv, refreshTokenAuthTag: refresh.authTag,
      idTokenCiphertext: idToken.ciphertext, idTokenIv: idToken.iv, idTokenAuthTag: idToken.authTag,
      email: claims.email ?? null, displayName: claims.name ?? null, scopes: scopes.join(' '), expiresAt: new Date(Date.now() + Number(tokens.expires_in ?? 3600) * 1000), extAgentHostId: attempt.extAgentHostId,
    };
    return this.withLockedRuntime(async (tx, runtime) => {
      const saved = runtime.oauthConnectionId
        ? await tx.aiOAuthConnection.update({ where: { id: runtime.oauthConnectionId }, data: { ...data, isRevoked: false, revokedAt: null } })
        : await tx.aiOAuthConnection.create({ data: { ...data, tenantId: null, tenantUserId: null } });
      await tx.aiServerRuntime.update({
        where: { id: 'global' },
        data: { oauthConnectionId: saved.id, chatgptModelSlug: null, chatgptModelDisplayName: null },
      });
      return saved;
    });
  }

  async refreshConnection(actorOrConnectionId: AiOAuthActor | string, suppliedConnectionId?: string): Promise<void> {
    const connectionId = typeof actorOrConnectionId === 'string' ? actorOrConnectionId : suppliedConnectionId!;
    await this.assertGlobalConnection(connectionId);
    const leaseToken = randomSecret(24);
    const leaseExpiresAt = new Date(Date.now() + 30_000);
    const claimed = await this.prisma.aiOAuthConnection.updateMany({ where: {
      id: connectionId, isRevoked: false,
      OR: [{ refreshLeaseToken: null }, { refreshLeaseExpiresAt: null }, { refreshLeaseExpiresAt: { lt: new Date() } }],
    }, data: { refreshLeaseToken: leaseToken, refreshLeaseExpiresAt: leaseExpiresAt } });
    if (!claimed.count) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      const current = await this.prisma.aiOAuthConnection.findFirst({ where: { id: connectionId, isRevoked: false } });
      if (!current) throw new Error('OAuth connection not found');
      if (current.refreshLeaseToken && current.refreshLeaseExpiresAt && current.refreshLeaseExpiresAt > new Date()) return;
      return this.refreshConnection(connectionId);
    }
    try {
      await this.doRefresh(connectionId, leaseToken);
    } finally {
      await this.prisma.aiOAuthConnection.updateMany({ where: { id: connectionId, refreshLeaseToken: leaseToken }, data: { refreshLeaseToken: null, refreshLeaseExpiresAt: null } });
    }
  }

  async resolveProviderAuth(_actor?: AiOAuthActor): Promise<AiProviderAuth | undefined> {
    const runtime = await this.globalRuntime();
    let connection = runtime.oauthConnection;
    if (connection?.isRevoked) connection = null;
    if (!connection) return undefined;
    if (new Date(connection.expiresAt) <= new Date()) {
      await this.refreshConnection(connection.id);
      connection = await this.prisma.aiOAuthConnection.findFirst({
        where: { id: connection.id, isRevoked: false },
      });
      if (!connection) return undefined;
    }
    await this.prisma.aiOAuthConnection.updateMany({ where: { id: connection.id, isRevoked: false }, data: { lastUsedAt: new Date() } });
    connection = await this.prisma.aiOAuthConnection.findFirst({ where: { id: connection.id, isRevoked: false } });
    if (!connection) return undefined;
    const accessToken = this.encryption.decrypt({ ciphertext: connection.accessTokenCiphertext, iv: connection.accessTokenIv, authTag: connection.accessTokenAuthTag });
    return {
      type: 'oauth',
      accessToken,
      connectionId: connection.id,
      connectionUpdatedAt: connection.updatedAt ? new Date(connection.updatedAt).toISOString() : undefined,
      refresh: async () => {
        await this.refreshConnection(connection!.id);
        const refreshed = await this.resolveProviderAuth();
        if (!refreshed) throw new Error('OAuth connection refresh failed');
        return refreshed;
      },
    };
  }

  private async doRefresh(connectionId: string, leaseToken: string): Promise<void> {
    const connection = await this.prisma.aiOAuthConnection.findFirst({ where: { id: connectionId, isRevoked: false, refreshLeaseToken: leaseToken } });
    if (!connection) throw new Error('OAuth connection not found');
    const refreshToken = this.encryption.decrypt({ ciphertext: connection.refreshTokenCiphertext, iv: connection.refreshTokenIv, authTag: connection.refreshTokenAuthTag });
    try {
      const discovered = await discoverOpenIdConfiguration(connection.issuer).catch((): OpenIdConfiguration => ({}));
      const tokens = await exchangeToken(discovered.token_endpoint ?? this.config.get<string>('CHATGPT_OAUTH_TOKEN_ENDPOINT') ?? DEFAULT_TOKEN_ENDPOINT, { grant_type: 'refresh_token', refresh_token: refreshToken, client_id: connection.clientId }, fetch, { requireRefreshToken: false, requireIdToken: false });
      const access = this.encryption.encrypt(tokens.access_token);
      const refresh = this.encryption.encrypt(tokens.refresh_token ?? refreshToken);
      await this.prisma.aiOAuthConnection.updateMany({ where: { id: connection.id, isRevoked: false, refreshLeaseToken: leaseToken }, data: { accessTokenCiphertext: access.ciphertext, accessTokenIv: access.iv, accessTokenAuthTag: access.authTag, refreshTokenCiphertext: refresh.ciphertext, refreshTokenIv: refresh.iv, refreshTokenAuthTag: refresh.authTag, expiresAt: new Date(Date.now() + Number(tokens.expires_in ?? 3600) * 1000), lastUsedAt: new Date() } });
    } catch (error) {
      if (/invalid_grant|401|403/.test(String(error))) await this.prisma.aiOAuthConnection.updateMany({ where: { id: connection.id, isRevoked: false, refreshLeaseToken: leaseToken }, data: { isRevoked: true, revokedAt: new Date() } });
      throw new Error('OAuth connection refresh failed');
    }
  }

  async disconnectConnection(actorOrConnectionId: AiOAuthActor | string, suppliedConnectionId?: string): Promise<void> {
    const connectionId = typeof actorOrConnectionId === 'string' ? actorOrConnectionId : suppliedConnectionId!;
    const actor = typeof actorOrConnectionId === 'string' ? undefined : actorOrConnectionId;
    await this.withLockedRuntime(async (tx, runtime) => {
      if (runtime.oauthConnectionId !== connectionId || !runtime.oauthConnection || runtime.oauthConnection.isRevoked) {
        throw new Error('OAuth connection not found');
      }
      try {
        const configuration = await discoverOpenIdConfiguration(runtime.oauthConnection.issuer);
        if (configuration.revocation_endpoint) {
          const refreshToken = this.encryption.decrypt({ ciphertext: runtime.oauthConnection.refreshTokenCiphertext, iv: runtime.oauthConnection.refreshTokenIv, authTag: runtime.oauthConnection.refreshTokenAuthTag });
          await revokeToken(configuration.revocation_endpoint, refreshToken, runtime.oauthConnection.clientId);
        }
      } catch {
        // Local revocation is still enforced when discovery or provider revocation is unavailable.
      }
      await tx.aiOAuthConnection.updateMany({ where: { id: connectionId, isRevoked: false }, data: { isRevoked: true, revokedAt: new Date() } });
      await tx.aiServerRuntime.update({ where: { id: 'global' }, data: { oauthConnectionId: null, chatgptModelSlug: null, chatgptModelDisplayName: null } });
    });
    if (actor) await this.audit?.record({ tenantId: actor.tenantId, actorTenantUserId: actor.tenantUserId, action: 'oauth.disconnected', targetId: connectionId, metadata: { provider: 'chatgpt', status: 'disconnected' } });
  }

  private async assertGlobalConnection(connectionId: string): Promise<void> {
    const runtime = await this.globalRuntime();
    if (runtime.oauthConnectionId !== connectionId) throw new Error('OAuth connection not found');
  }

  private async withLockedRuntime<T>(callback: (tx: any, runtime: any) => Promise<T>): Promise<T> {
    const execute = async (tx: any) => {
      await tx.$queryRawUnsafe('SELECT "id" FROM "ai_server_runtime" WHERE "id" = $1 FOR UPDATE', 'global');
      const runtime = await tx.aiServerRuntime.findUnique({ where: { id: 'global' }, include: { oauthConnection: true } });
      if (!runtime) throw new Error('AI server runtime not found');
      return callback(tx, runtime);
    };
    if (this.prisma.$transaction) return this.prisma.$transaction(execute);
    return execute({
      ...this.prisma,
      $queryRawUnsafe: async () => undefined,
      aiServerRuntime: { ...this.prisma.aiServerRuntime, findUnique: async () => this.globalRuntime() },
    });
  }

  private globalRuntime() {
    return this.prisma.aiServerRuntime.upsert({
      where: { id: 'global' },
      create: { id: 'global' },
      update: {},
      include: { oauthConnection: true },
    });
  }

  toConnectionView(connection: any): AiOAuthConnectionView {
    return { id: connection.id, issuer: connection.issuer, subject: connection.subject, clientId: connection.clientId, email: connection.email ?? null, displayName: connection.displayName ?? null, scopes: String(connection.scopes).split(/\s+/).filter(Boolean), expiresAt: new Date(connection.expiresAt).toISOString(), isRevoked: connection.isRevoked, lastUsedAt: connection.lastUsedAt ? new Date(connection.lastUsedAt).toISOString() : null };
  }
}
