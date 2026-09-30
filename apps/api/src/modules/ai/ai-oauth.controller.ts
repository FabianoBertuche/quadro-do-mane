import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';
import { RequestUser } from '../../common/interfaces/request-context.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiOAuthService } from './ai-oauth.service';
import { CompleteAiOAuthDto } from './dto/complete-ai-oauth.dto';

interface OAuthConnectionMetadata {
  id: string;
  provider: string;
  email: string | null;
  scopes: string[];
  expiresAt: string;
  status: 'connected' | 'revoked';
}

@UseGuards(AuthGuard('jwt'), TenantContextGuard, PermissionGuard)
@RequirePermissions('ai.use')
@Controller('ai/oauth')
export class AiOAuthController {
  constructor(
    private readonly oauth: AiOAuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('start')
  async start(@CurrentUser() user: RequestUser) {
    const result = await this.oauth.startAuthorization(this.actor(user));
    return {
      authorizationUrl: result.authorizationUrl,
      attemptId: result.attemptId,
      expiresAt: result.expiresAt,
    };
  }

  @Post('complete')
  async complete(@CurrentUser() user: RequestUser, @Body() dto: CompleteAiOAuthDto) {
    return this.toMetadata(await this.oauth.completeAuthorization(this.actor(user), dto.callbackUrl));
  }

  @Get('connections')
  async connections(@CurrentUser() _user: RequestUser) {
    const runtime = await this.prisma.aiServerRuntime.findUnique({
      where: { id: 'global' },
      include: { oauthConnection: true },
    });
    return runtime?.oauthConnection ? [this.toMetadata(this.oauth.toConnectionView(runtime.oauthConnection))] : [];
  }

  @Post(':id/refresh')
  async refresh(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await this.oauth.refreshConnection(this.actor(user), id);
    return { status: 'refreshed' };
  }

  @Post(':id/disconnect')
  async disconnect(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await this.oauth.disconnectConnection(this.actor(user), id);
    return { status: 'disconnected' };
  }

  private actor(user: RequestUser) {
    return { tenantId: user.tenantId, tenantUserId: user.tenantUserId };
  }

  private toMetadata(connection: any): OAuthConnectionMetadata {
    return {
      id: connection.id,
      provider: connection.issuer,
      email: connection.email ?? null,
      scopes: Array.isArray(connection.scopes)
        ? connection.scopes
        : String(connection.scopes ?? '').split(/\s+/).filter(Boolean),
      expiresAt: new Date(connection.expiresAt).toISOString(),
      status: connection.isRevoked ? 'revoked' : 'connected',
    };
  }
}
