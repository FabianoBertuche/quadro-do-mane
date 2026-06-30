import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { RequestUser } from '../../../common/interfaces/request-context.interface';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';

/**
 * Estratégia JWT que aceita o access token via:
 *   1. Header `Authorization: Bearer <token>` (dev / APIs externas)
 *   2. Cookie HttpOnly `qd_access` (produção / proxy same-origin)
 *
 * A ordem de precedência é controlada por `ExtractJwt.fromExtractors`,
 * que tenta cada extrator na sequência e usa o primeiro que retornar
 * uma string não-vazia.
 */
const cookieExtractor = (req: Request): string | null => {
  if (!req) return null;
  // 1) cookie-parser (se estiver configurado)
  const fromParsed = (req as any).cookies?.qd_access;
  if (typeof fromParsed === 'string' && fromParsed.length > 0) return fromParsed;

  // 2) fallback manual parseando o header Cookie bruto
  const raw = req.headers?.cookie;
  if (!raw || typeof raw !== 'string') return null;
  const parts = raw.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    if (k === 'qd_access') {
      const v = part.slice(idx + 1).trim();
      try {
        return decodeURIComponent(v);
      } catch {
        return v;
      }
    }
  }
  return null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly tenantContext: TenantContextService,
  ) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET ausente — verifique o .env');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        cookieExtractor,
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true,
    });
  }

  /**
   * O validate roda dentro do Passport. Aqui populamos o TenantContext
   * via AsyncLocalStorage para que services downstream recebam tenantId
   * automaticamente via Prisma Client Extension.
   */
  async validate(req: Request, payload: any): Promise<RequestUser> {
    if (!payload.sub) {
      throw new UnauthorizedException('Token inválido');
    }

    const user: RequestUser = {
      userId: payload.sub,
      email: payload.email,
      tenantId: payload.tenantId,
      tenantUserId: payload.tenantUserId,
      roleId: payload.roleId,
      roleName: payload.roleName,
      permissions: payload.permissions || [],
    };

    if (user.tenantId && user.tenantUserId) {
      // Como `validate` retorna a Promise e Passport aguarda,
      // apenas populamos o contexto da thread atual.
      // O TenantMiddleware usa run() para criar um store por request
      // e aqui atribuímos os valores para uso síncrono.
      // Nota: AsyncLocalStorage já está propagado via TenantMiddleware
      // quando este validate roda em um contexto onde o middleware já passou.
      // Para garantir, também populamos via store direto:
      (this.tenantContext as any).storage?.enterWith?.({
        tenantId: user.tenantId,
        userId: user.userId,
        tenantUserId: user.tenantUserId,
      });
    }

    return user;
  }
}
