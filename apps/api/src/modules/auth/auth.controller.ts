import { Controller, Post, Get, Body, UseGuards, Req, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthService, AuthRequestMeta } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SelectTenantDto } from './dto/select-tenant.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-context.interface';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CookieService } from '../../common/cookies/cookie.service';
import { applyAuthCookies } from '../../common/cookies/auth-cookies.interceptor';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private cookies: CookieService,
  ) {}

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const meta = this.extractMeta(req);
    const result = await this.authService.login(dto, meta);
    return applyAuthCookies(res, result, this.cookies);
  }

  @Post('select-tenant')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async selectTenant(
    @CurrentUser('userId') userId: string,
    @Body() dto: SelectTenantDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const meta = this.extractMeta(req);
    const result = await this.authService.selectTenant(userId, dto, meta);
    return applyAuthCookies(res, result, this.cookies);
  }

  /**
   * Refresh aceita o refresh token via:
   * 1. Header Authorization: "Bearer <token>" (DEV)
   * 2. Body { refreshToken: "..." } (alternativa)
   * 3. Cookie HttpOnly "qd_refresh" (PRODUÇÃO)
   */
  @Post('refresh')
  @ApiBearerAuth()
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Tenta extrair o refresh token de várias fontes
    const token =
      dto.refreshToken ||
      this.extractBearer(req) ||
      req?.cookies?.qd_refresh ||
      '';

    if (!token) {
      throw new Error('Refresh token não fornecido');
    }

    const tokens = await this.authService.refreshToken(token, this.extractMeta(req));
    return applyAuthCookies(res, tokens, this.cookies);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async logout(
    @CurrentUser() user: RequestUser,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.logout(
      user.userId,
      user.tenantId,
      this.extractBearer(req),
    );
    this.cookies.clearAuthCookies(res);
    return result;
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async logoutAll(@CurrentUser('userId') userId: string) {
    return this.authService.logoutAll(userId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async me(
    @CurrentUser('userId') userId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.authService.getProfile(userId, tenantId);
  }

  private extractMeta(req: any): AuthRequestMeta {
    return {
      ipAddress: req?.ip ?? req?.headers?.['x-forwarded-for'],
      userAgent: req?.headers?.['user-agent'],
    };
  }

  private extractBearer(req: any): string {
    const auth = req?.headers?.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return '';
    return auth.substring('Bearer '.length).trim();
  }
}
